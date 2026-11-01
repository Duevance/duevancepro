import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { classify, daysBetween, todayIn, isRealDate } from '@/lib/dates';
import { parseAmount, totalsByCurrency, isValidCurrency } from '@/lib/money';
import { parseCsv, guessMapping, validateRows, missingRequired, toCsv, safeCell, TEMPLATE_CSV } from '@/lib/csv';
import { mailtoUrl, whatsappUrl, normalizePhone, buildMessage, suggestStage } from '@/lib/reminders';
import { hasProAccess, isFreePlanLimitError } from '@/lib/plan';
import { offerFor } from '@/lib/pricing';
import { verifyWebhookSignature, verifyPaymentSignature, stateFromRazorpay, extractRazorpaySubscriptionId } from '@/lib/billing/razorpay';
import { safeNext, validatePassword } from '@/lib/auth';
import { processWebhook, type WebhookDeps } from '@/lib/billing/webhook';

describe('dates and overdue classification', () => {
  it('computes whole-day differences across month and leap boundaries', () => {
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });
  it('derives buckets from the due date, not stored status', () => {
    const t = '2026-10-25';
    const c = (due: string, status = 'open') => classify({ status, due_date: due }, t).bucket;
    expect(c('2026-10-25')).toBe('due_soon');
    expect(c('2026-11-01')).toBe('due_soon');
    expect(c('2026-11-02')).toBe('upcoming');
    expect(c('2026-10-24')).toBe('overdue_1_7');
    expect(c('2026-10-18')).toBe('overdue_1_7');
    expect(c('2026-10-17')).toBe('overdue_8_30');
    expect(c('2026-09-25')).toBe('overdue_8_30');
    expect(c('2026-09-24')).toBe('overdue_30_plus');
    expect(c('2020-01-01', 'paid')).toBe('paid');
  });
  it('evaluates "today" in the user timezone at the date boundary', () => {
    const instant = new Date('2026-10-25T20:00:00Z'); // already the 26th in Chennai, still the 25th in New York
    expect(todayIn('Asia/Kolkata', instant)).toBe('2026-10-26');
    expect(todayIn('America/New_York', instant)).toBe('2026-10-25');
    expect(classify({ status: 'open', due_date: '2026-10-25' }, todayIn('Asia/Kolkata', instant)).overdue).toBe(true);
    expect(classify({ status: 'open', due_date: '2026-10-25' }, todayIn('America/New_York', instant)).overdue).toBe(false);
    expect(todayIn('Not/AZone', instant)).toBe('2026-10-25');
  });
  it('rejects impossible dates', () => { expect(isRealDate('2026-02-30')).toBe(false); expect(isRealDate('2026-13-01')).toBe(false); expect(isRealDate('2028-02-29')).toBe(true); });
});

describe('money', () => {
  it('parses valid amounts and rejects invalid ones', () => {
    expect(parseAmount('1,250.50')).toEqual({ ok: true, value: 1250.5 });
    expect(parseAmount('$99')).toEqual({ ok: true, value: 99 });
    for (const bad of ['', '0', '-5', 'abc', '1.234,56', '12.345', '1e5']) expect(parseAmount(bad).ok, bad).toBe(false);
  });
  it('never mixes currencies and avoids float drift', () => {
    const r = totalsByCurrency([{ amount: 0.1, currency: 'USD' }, { amount: 0.2, currency: 'USD' }, { amount: 999, currency: 'INR' }]);
    expect(r).toEqual([{ currency: 'INR', total: 999, count: 1 }, { currency: 'USD', total: 0.3, count: 2 }]);
  });
  it('validates currency codes', () => { expect(isValidCurrency('USD')).toBe(true); expect(isValidCurrency('usd')).toBe(false); expect(isValidCurrency('ZZZ')).toBe(false); });
});

describe('CSV import', () => {
  const ctx = { defaultCurrency: 'USD', existingKeys: new Set(['inv-exists']) };
  it('template parses and validates cleanly', () => {
    const p = parseCsv(TEMPLATE_CSV); const m = guessMapping(p.headers);
    expect(missingRequired(m)).toEqual([]);
    const v = validateRows(p.rows, m, ctx);
    expect(v.valid.length).toBe(1); expect(v.issues).toEqual([]);
  });
  it('maps common header aliases', () => {
    const m = guessMapping(['Client', 'Invoice Number', 'Total', 'Due', 'Email']);
    expect(m).toMatchObject({ customer_name: 'Client', invoice_no: 'Invoice Number', amount: 'Total', due_date: 'Due', customer_email: 'Email' });
  });
  it('reports row-level errors and duplicates instead of dropping rows silently', () => {
    const csv = [
      'customer_name,invoice_no,amount,due_date,customer_email,currency',
      'A,INV-1,100,2026-09-01,a@x.com,USD',
      'B,INV-1,100,2026-09-01,b@x.com,USD',
      'C,INV-EXISTS,100,2026-09-01,,USD',
      ',INV-3,100,2026-09-01,,USD',
      'D,INV-4,-5,2026-09-01,,USD',
      'E,INV-5,50,2026-02-30,,USD',
      'F,INV-6,50,2026-09-01,not-an-email,USD',
      'G,INV-7,50,2026-09-01,,XXX',
      'H,INV-8,75,2026-09-01,,eur',
    ].join('\n');
    const p = parseCsv(csv); const v = validateRows(p.rows, guessMapping(p.headers), ctx);
    expect(v.total).toBe(9);
    expect(v.valid.map(x => x.row.invoice_no)).toEqual(['INV-1', 'INV-8']);
    expect(v.valid[1].row.currency).toBe('EUR');
    expect(v.issues.filter(i => i.kind === 'duplicate').map(i => i.line)).toEqual([3, 4]);
    expect(v.issues.filter(i => i.kind === 'error').map(i => i.line)).toEqual([5, 6, 7, 8, 9]);
    expect(v.valid.length + v.issues.length).toBe(v.total);
  });
  it('is idempotent on retry: a second run finds everything as duplicates', () => {
    const p = parseCsv(TEMPLATE_CSV); const m = guessMapping(p.headers);
    const first = validateRows(p.rows, m, { defaultCurrency: 'USD', existingKeys: new Set() });
    const second = validateRows(p.rows, m, { defaultCurrency: 'USD', existingKeys: new Set(first.valid.map(x => x.row.invoice_no.toLowerCase())) });
    expect(second.valid.length).toBe(0); expect(second.issues[0].kind).toBe('duplicate');
  });
  it('rejects oversized input', () => { expect(parseCsv('a,b\n' + 'x,y\n'.repeat(2500)).error).toMatch(/more than/); });
  it('neutralises formula injection on export', () => {
    expect(safeCell('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`); expect(safeCell('+1')).toBe("'+1"); expect(safeCell('ok')).toBe('ok');
    expect(toCsv([{ a: '=1+1', b: 'x,y' }], ['a', 'b'])).toBe(`a,b\n'=1+1,"x,y"\n`);
  });
});

describe('reminders', () => {
  const v = { customerName: 'Priya Nair', invoiceNo: 'INV-42', amount: 1250, currency: 'USD', dueDate: '2026-09-30', businessName: 'Studio Kite' };
  it('fills every placeholder for all three tones', () => {
    for (const s of ['friendly', 'firm', 'final'] as const) {
      const m = buildMessage(s, v); const all = m.subject + m.body;
      expect(all).toContain('INV-42'); expect(all).toContain('$1,250.00'); expect(all).toContain('Sep 30, 2026'); expect(all).not.toMatch(/\{\{/);
    }
  });
  it('final tone contains no legal threats', () => { expect(buildMessage('final', v).body.toLowerCase()).not.toMatch(/lawyer|legal|court|sue|collections|attorney/); });
  it('encodes mailto URLs safely', () => {
    const u = mailtoUrl('a+b@x.com', 'Re: INV & "42"', 'Line1\nLine2 100% é');
    expect(u).toBe('mailto:a%2Bb@x.com?subject=Re%3A%20INV%20%26%20%2242%22&body=Line1%0ALine2%20100%25%20%C3%A9');
    expect(u).not.toMatch(/\s|\+(?=[^@]*\?)/);
  });
  it('builds wa.me links only for trustworthy numbers', () => {
    expect(whatsappUrl('+91 98765-43210', 'Hi & bye')).toBe('https://wa.me/919876543210?text=Hi%20%26%20bye');
    expect(whatsappUrl('0044 20 7946 0958', 'x')).toBe('https://wa.me/442079460958?text=x');
    expect(normalizePhone('098765 43210')).toBeNull(); expect(normalizePhone('+12')).toBeNull(); expect(normalizePhone('')).toBeNull(); expect(whatsappUrl(null, 'x')).toBeNull();
  });
  it('leaves unknown placeholders visible and ignores prototype keys', () => {
    expect(buildMessage('friendly', v, { subject: '{{nope}} {{constructor}}', body: 'b' }).subject).toBe('{{nope}} {{constructor}}');
  });
  it('suggests the tone from days overdue', () => { expect([suggestStage(3), suggestStage(15), suggestStage(45)]).toEqual(['friendly', 'firm', 'final']); });
});

describe('plan and pricing', () => {
  it('grants Pro for active, or cancelled/past_due within the paid period only', () => {
    const now = new Date('2026-10-25T00:00:00Z');
    expect(hasProAccess([{ status: 'active', current_period_end: null }], now)).toBe(true);
    expect(hasProAccess([{ status: 'cancelled', current_period_end: '2026-11-01T00:00:00Z' }], now)).toBe(true);
    expect(hasProAccess([{ status: 'cancelled', current_period_end: '2026-10-01T00:00:00Z' }], now)).toBe(false);
    for (const s of ['pending', 'expired']) expect(hasProAccess([{ status: s, current_period_end: '2027-01-01T00:00:00Z' }], now)).toBe(false);
  });
  it('recognises the DB limit error', () => { expect(isFreePlanLimitError({ message: 'FREE_PLAN_LIMIT' })).toBe(true); expect(isFreePlanLimitError(new Error('other'))).toBe(false); });
  it('bills India in INR and everyone else in USD, always through Razorpay, with configurable prices', () => {
    expect(offerFor('IN', {})).toMatchObject({ provider: 'razorpay', currency: 'INR', amount: 999, planEnv: 'RAZORPAY_PLAN_ID_INR' });
    expect(offerFor('US', {})).toMatchObject({ provider: 'razorpay', currency: 'USD', amount: 19, planEnv: 'RAZORPAY_PLAN_ID_USD' });
    expect(offerFor('US', { PRO_PRICE_USD: '25' }).amount).toBe(25);
    expect(offerFor('DE', { PRO_PRICE_USD: 'junk' }).amount).toBe(19);
    expect(offerFor('IN', {}).label).toBe('₹999/month');
  });
});

describe('webhook authenticity (Razorpay HMAC)', () => {
  const secret = 'whsec_test', body = '{"event":"subscription.activated"}';
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  it('accepts a correct signature', () => { expect(verifyWebhookSignature(body, sig, secret)).toBe(true); });
  it('rejects tampered body, wrong secret, missing or malformed signature', () => {
    expect(verifyWebhookSignature(body + ' ', sig, secret)).toBe(false);
    expect(verifyWebhookSignature(body, sig, 'other')).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, 'abc', secret)).toBe(false);
    expect(verifyWebhookSignature(body, sig, undefined)).toBe(false);
  });
  it('verifies the checkout payment signature', () => {
    const s = crypto.createHmac('sha256', 'ks').update('pay_1|sub_1').digest('hex');
    expect(verifyPaymentSignature('pay_1', 'sub_1', s, 'ks')).toBe(true); expect(verifyPaymentSignature('pay_2', 'sub_1', s, 'ks')).toBe(false);
  });
});

describe('provider state mapping', () => {
  it('maps Razorpay statuses', () => {
    const e = (status: string) => stateFromRazorpay({ status, current_end: 1798000000 }).status;
    expect([e('active'), e('created'), e('authenticated'), e('pending'), e('halted'), e('cancelled'), e('completed')]).toEqual(['active', 'pending', 'pending', 'past_due', 'expired', 'cancelled', 'expired']);
    expect(stateFromRazorpay({ status: 'active', current_end: 1798000000 }).currentPeriodEnd).toBe(new Date(1798000000 * 1000).toISOString());
  });
  it('extracts subscription ids from events', () => {
    expect(extractRazorpaySubscriptionId({ event: 'subscription.charged', payload: { subscription: { entity: { id: 'sub_1' } } } })).toBe('sub_1');
    expect(extractRazorpaySubscriptionId({ event: 'payment.failed', payload: {} })).toBeNull();
  });
});

describe('processWebhook idempotency', () => {
  function fake() {
    const events = new Map<string, string>(); const subs = new Map<string, { status: string }>([['sub_1', { status: 'pending' }]]);
    let fetches = 0; let failNext = false;
    const deps: WebhookDeps = {
      async claim(p, id) { const k = p + id; const cur = events.get(k); if (!cur) { events.set(k, 'processing'); return 'claimed'; } if (cur === 'failed') { events.set(k, 'processing'); return 'claimed'; } return cur === 'processing' ? 'in_flight' : 'duplicate'; },
      async finish(p, id, s) { events.set(p + id, s); },
      async fetchState() { fetches++; if (failNext) { failNext = false; throw new Error('provider down'); } return { status: 'active', currentPeriodEnd: '2026-12-01T00:00:00Z' }; },
      async applyState(_p, id, st) { const s = subs.get(id); if (!s) return false; s.status = st.status; return true; },
    };
    return { deps, subs, events, fetches: () => fetches, failNext: () => { failNext = true; } };
  }
  it('processes once and treats replays as duplicates', async () => {
    const f = fake();
    expect(await processWebhook(f.deps, 'razorpay', 'evt_1', 'sub_1')).toBe('processed');
    expect(f.subs.get('sub_1')!.status).toBe('active');
    expect(await processWebhook(f.deps, 'razorpay', 'evt_1', 'sub_1')).toBe('duplicate');
    expect(f.fetches()).toBe(1);
  });
  it('ignores events for subscriptions we never created (cannot self-grant Pro)', async () => {
    const f = fake(); expect(await processWebhook(f.deps, 'razorpay', 'e2', 'sub_UNKNOWN')).toBe('ignored'); expect(await processWebhook(f.deps, 'razorpay', 'e3', null)).toBe('ignored');
  });
  it('lets a failed event be retried', async () => {
    const f = fake(); f.failNext();
    await expect(processWebhook(f.deps, 'razorpay', 'evt_9', 'sub_1')).rejects.toThrow('provider down');
    expect(f.subs.get('sub_1')!.status).toBe('pending');
    expect(await processWebhook(f.deps, 'razorpay', 'evt_9', 'sub_1')).toBe('processed');
  });
});

describe('auth helpers', () => {
  it('accepts only same-site relative redirect targets', () => {
    expect(safeNext('/billing')).toBe('/billing'); expect(safeNext('/invoices/new')).toBe('/invoices/new');
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '/a?x=1', '', null, undefined]) expect(safeNext(bad as string | null), String(bad)).toBe('/dashboard');
  });
  it('enforces password rules', () => {
    expect(validatePassword('short')).toMatch(/at least 8/);
    expect(validatePassword('a'.repeat(73))).toMatch(/72/);
    expect(validatePassword('        ')).toMatch(/spaces|at least|common/i);
    expect(validatePassword('Password123')).toMatch(/common/); expect(validatePassword('Tr1cky-Harbor-92')).toBeNull();
    expect(validatePassword('password123')).toMatch(/common/);
    expect(validatePassword('janedoe-2026!', 'janedoe@x.com')).toMatch(/email/);
    expect(validatePassword('correct horse battery', 'jane@x.com')).toBeNull();
    expect(validatePassword('é'.repeat(40))).toMatch(/72/); // byte length, not characters
  });
});
