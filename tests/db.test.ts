import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

// Minimal stand-in for Supabase's auth schema so the real migration runs unchanged.
const SHIM = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
let db: PGlite;

async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  await db.exec('set role authenticated');
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const ins = (uid: string, no: string, extra = '') =>
  db.query(`insert into invoices (user_id, customer_name, invoice_no, amount, currency, due_date ${extra ? ',' + extra.split('=')[0] : ''}) values ($1,'Acme',$2,100,'USD','2026-01-01' ${extra ? ',' + extra.split('=')[1] : ''}) returning id`, [uid, no]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SHIM);
  const dir = path.join(import.meta.dirname, '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  await db.query(`insert into auth.users (id,email) values ($1,'a@x.com'),($2,'b@x.com')`, [A, B]);
});

describe('migration + profiles', () => {
  it('creates a profile for each new auth user', async () => {
    const r = await db.query(`select count(*)::int c from profiles`);
    expect((r.rows[0] as { c: number }).c).toBe(2);
  });
});

describe('RLS isolation between two users', () => {
  let aInvoice: string;
  beforeAll(async () => {
    const r = await as(A, () => ins(A, 'INV-1'));
    aInvoice = (r.rows[0] as { id: string }).id;
    await as(A, () => db.query(`insert into reminders_log (user_id, invoice_id, action_type, channel, stage) values ($1,$2,'prepared','email','friendly')`, [A, aInvoice]));
    await db.query(`insert into subscriptions (user_id, provider, provider_subscription_id, status) values ($1,'paypal','I-A','active')`, [A]);
  });
  it('owner can read their own data', async () => {
    const r = await as(A, () => db.query(`select id from invoices`));
    expect(r.rows.length).toBe(1);
  });
  it('B cannot read A invoices, reminders, subscriptions or profile', async () => {
    for (const t of ['invoices', 'reminders_log', 'subscriptions']) {
      const r = await as(B, () => db.query(`select * from ${t}`));
      expect(r.rows.length, t).toBe(0);
    }
    const p = await as(B, () => db.query(`select user_id from profiles`));
    expect((p.rows as { user_id: string }[]).map(x => x.user_id)).toEqual([B]);
  });
  it('B cannot update or delete A invoice', async () => {
    const u = await as(B, () => db.query(`update invoices set customer_name='hacked' where id=$1 returning id`, [aInvoice]));
    expect(u.rows.length).toBe(0);
    const d = await as(B, () => db.query(`delete from invoices where id=$1 returning id`, [aInvoice]));
    expect(d.rows.length).toBe(0);
  });
  it('B cannot insert rows owned by A', async () => {
    await expect(as(B, () => ins(A, 'INV-X'))).rejects.toThrow(/row-level security/i);
  });
  it('B cannot log a reminder against A invoice', async () => {
    await expect(as(B, () => db.query(`insert into reminders_log (user_id, invoice_id, action_type) values ($1,$2,'prepared')`, [B, aInvoice]))).rejects.toThrow(/row-level security/i);
  });
  it('users cannot edit or delete activity history (append-only)', async () => {
    await expect(as(A, () => db.query(`update reminders_log set stage='final'`))).rejects.toThrow(/permission denied/i);
    await expect(as(A, () => db.query(`delete from reminders_log`))).rejects.toThrow(/permission denied/i);
  });
  it('users cannot grant themselves a subscription', async () => {
    await expect(as(B, () => db.query(`insert into subscriptions (user_id, provider, provider_subscription_id, status) values ($1,'paypal','I-B','active')`, [B]))).rejects.toThrow(/permission denied/i);
  });
  it('users cannot touch webhook_events', async () => {
    await expect(as(A, () => db.query(`select * from webhook_events`))).rejects.toThrow(/permission denied/i);
  });
  it('anonymous users see nothing', async () => {
    await db.exec('set role anon');
    try { await expect(db.query(`select * from invoices`)).rejects.toThrow(/permission denied/i); } finally { await db.exec('reset role'); }
  });
});

describe('constraints', () => {
  it('rejects duplicate invoice numbers per user, case-insensitively', async () => {
    await as(B, () => ins(B, 'Dup-1'));
    await expect(as(B, () => ins(B, ' dup-1 '))).rejects.toThrow(/duplicate key/i);
  });
  it('allows the same invoice number for different users', async () => {
    await expect(as(A, () => ins(A, 'Dup-1'))).resolves.toBeTruthy();
  });
  it('rejects non-positive amounts and bad currency codes', async () => {
    await expect(as(B, () => db.query(`insert into invoices (user_id,customer_name,invoice_no,amount,currency,due_date) values ($1,'x','N1',0,'USD','2026-01-01')`, [B]))).rejects.toThrow(/check/i);
    await expect(as(B, () => db.query(`insert into invoices (user_id,customer_name,invoice_no,amount,currency,due_date) values ($1,'x','N2',5,'usd','2026-01-01')`, [B]))).rejects.toThrow(/check/i);
  });
  it('sent_at is only allowed on manually confirmed sends', async () => {
    const r = await as(B, () => db.query(`select id from invoices where user_id=$1 limit 1`, [B]));
    const id = (r.rows[0] as { id: string }).id;
    await expect(as(B, () => db.query(`insert into reminders_log (user_id,invoice_id,action_type,sent_at) values ($1,$2,'link_opened',now())`, [B, id]))).rejects.toThrow(/check/i);
    await expect(as(B, () => db.query(`insert into reminders_log (user_id,invoice_id,action_type) values ($1,$2,'marked_sent')`, [B, id]))).rejects.toThrow(/check/i);
    await expect(as(B, () => db.query(`insert into reminders_log (user_id,invoice_id,action_type,sent_at) values ($1,$2,'marked_sent',now())`, [B, id]))).resolves.toBeTruthy();
  });
  it('webhook events are unique per provider + event id', async () => {
    await db.query(`insert into webhook_events (provider,event_id) values ('paypal','WH-1')`);
    await expect(db.query(`insert into webhook_events (provider,event_id) values ('paypal','WH-1')`)).rejects.toThrow(/duplicate key/i);
    await expect(db.query(`insert into webhook_events (provider,event_id) values ('razorpay','WH-1')`)).resolves.toBeTruthy();
  });
});

describe('free plan limit (server-side trigger)', () => {
  const C = '33333333-3333-3333-3333-333333333333';
  beforeAll(async () => { await db.query(`insert into auth.users (id,email) values ($1,'c@x.com')`, [C]); });
  it('allows 10 active invoices and blocks the 11th', async () => {
    for (let i = 1; i <= 10; i++) await as(C, () => ins(C, `L-${i}`));
    await expect(as(C, () => ins(C, 'L-11'))).rejects.toThrow(/FREE_PLAN_LIMIT/);
  });
  it('marking an invoice paid or archiving it frees a slot', async () => {
    await as(C, () => db.query(`update invoices set status='paid', paid_at=now() where invoice_no='L-1'`));
    await expect(as(C, () => ins(C, 'L-11'))).resolves.toBeTruthy();
    await expect(as(C, () => ins(C, 'L-12'))).rejects.toThrow(/FREE_PLAN_LIMIT/);
    await as(C, () => db.query(`update invoices set archived_at=now() where invoice_no='L-2'`));
    await expect(as(C, () => ins(C, 'L-12'))).resolves.toBeTruthy();
  });
  it('blocks restoring or reopening beyond the limit', async () => {
    await expect(as(C, () => db.query(`update invoices set archived_at=null where invoice_no='L-2'`))).rejects.toThrow(/FREE_PLAN_LIMIT/);
    await expect(as(C, () => db.query(`update invoices set status='open', paid_at=null where invoice_no='L-1'`))).rejects.toThrow(/FREE_PLAN_LIMIT/);
  });
  it('editing an already-counted invoice never trips the limit', async () => {
    await expect(as(C, () => db.query(`update invoices set notes='ok' where invoice_no='L-3'`))).resolves.toBeTruthy();
  });
  it('Pro (active) lifts the limit; expired cancelled does not', async () => {
    await db.query(`insert into subscriptions (user_id,provider,provider_subscription_id,status,current_period_end) values ($1,'paypal','I-C','cancelled', now() - interval '1 day')`, [C]);
    await expect(as(C, () => ins(C, 'P-1'))).rejects.toThrow(/FREE_PLAN_LIMIT/);
    await db.query(`update subscriptions set status='cancelled', current_period_end = now() + interval '5 days' where provider_subscription_id='I-C'`);
    await expect(as(C, () => ins(C, 'P-1'))).resolves.toBeTruthy();
    await db.query(`update subscriptions set status='active' where provider_subscription_id='I-C'`);
    await expect(as(C, () => ins(C, 'P-2'))).resolves.toBeTruthy();
  });
});

describe('Pro-only templates, events, webhook claim function', () => {
  const D = '44444444-4444-4444-4444-444444444444';
  beforeAll(async () => { await db.query(`insert into auth.users (id,email) values ($1,'d@x.com')`, [D]); });
  it('free users cannot save custom templates; Pro users can; others cannot read them', async () => {
    await expect(as(D, () => db.query(`insert into reminder_templates (user_id,stage,subject,body) values ($1,'friendly','s','b')`, [D]))).rejects.toThrow(/row-level security/i);
    await db.query(`insert into subscriptions (user_id,provider,provider_subscription_id,status) values ($1,'razorpay','sub_D','active')`, [D]);
    await expect(as(D, () => db.query(`insert into reminder_templates (user_id,stage,subject,body) values ($1,'friendly','s','b')`, [D]))).resolves.toBeTruthy();
    expect((await as(B, () => db.query(`select * from reminder_templates`))).rows.length).toBe(0);
  });
  it('first_* product events are recorded once per user; events are owner-scoped', async () => {
    await as(D, () => db.query(`insert into product_events (user_id,name) values ($1,'first_invoice_created')`, [D]));
    await expect(as(D, () => db.query(`insert into product_events (user_id,name) values ($1,'first_invoice_created')`, [D]))).rejects.toThrow(/duplicate key/i);
    await expect(as(D, () => db.query(`insert into product_events (user_id,name) values ($1,'free_limit_reached')`, [D]))).resolves.toBeTruthy();
    await expect(as(D, () => db.query(`insert into product_events (user_id,name) values ($1,'free_limit_reached')`, [D]))).resolves.toBeTruthy();
    expect((await as(B, () => db.query(`select * from product_events where user_id=$1`, [D]))).rows.length).toBe(0);
    await expect(as(D, () => db.query(`insert into product_events (user_id,name) values ($1,'made_up')`, [D]))).rejects.toThrow(/check/i);
  });
  it('claim_webhook_event is atomic: claimed, then in_flight, then duplicate; failed events are reclaimable', async () => {
    const claim = async () => ((await db.query(`select claim_webhook_event('razorpay','evt-claim') r`)).rows[0] as { r: string }).r;
    expect(await claim()).toBe('claimed');
    expect(await claim()).toBe('in_flight');
    await db.query(`select finish_webhook_event('razorpay','evt-claim','failed')`);
    expect(await claim()).toBe('claimed');
    await db.query(`select finish_webhook_event('razorpay','evt-claim','processed')`);
    expect(await claim()).toBe('duplicate');
  });
  it('end users cannot call the webhook functions', async () => {
    await expect(as(D, () => db.query(`select claim_webhook_event('paypal','x')`))).rejects.toThrow(/permission denied/i);
  });
});
