import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import { classify, formatDate, nowMs } from '@/lib/dates';
import { formatMoney, totalsByCurrency } from '@/lib/money';
import { StatusChip } from '@/components/InvoiceBits';
import { ActionForm, SubmitButton } from '@/components/forms';
import { removeSampleData, loadSampleData } from '@/app/actions';

export const metadata = { title: 'Dashboard' };
type Inv = { id: string; customer_name: string; invoice_no: string; amount: number; currency: string; due_date: string; status: string; is_sample: boolean; updated_at: string };

function Totals({ rows, tone }: { rows: { amount: number; currency: string }[]; tone?: 'late' }) {
  const t = totalsByCurrency(rows);
  if (!t.length) return <div className="big">—</div>;
  return <>{t.map(x => <div className="row" key={x.currency}><span className={`big ${tone ?? ''}`}>{formatMoney(x.total, x.currency)}</span><span className="sub">{x.count} invoice{x.count === 1 ? '' : 's'}</span></div>)}</>;
}

export default async function Dashboard() {
  const { supabase, user, today, profile } = await requireCtx();
  const since = new Date(nowMs() - 30 * 864e5).toISOString();
  const [openQ, paidQ, sentQ] = await Promise.all([
    supabase.from('invoices').select('id,customer_name,invoice_no,amount,currency,due_date,status,is_sample,updated_at').eq('user_id', user.id).eq('status', 'open').is('archived_at', null).order('due_date').limit(2000),
    supabase.from('invoices').select('amount,currency').eq('user_id', user.id).eq('status', 'paid').gte('paid_at', since).limit(2000),
    supabase.from('reminders_log').select('invoice_id,sent_at').eq('user_id', user.id).eq('action_type', 'marked_sent').gte('sent_at', new Date(nowMs() - 60 * 864e5).toISOString()),
  ]);
  if (openQ.error) throw new Error('load failed');
  const open = (openQ.data ?? []) as Inv[]; const paid = paidQ.data ?? [];
  const cl = open.map(i => ({ i, c: classify(i, today) }));
  const overdue = cl.filter(x => x.c.overdue), soon = cl.filter(x => x.c.bucket === 'due_soon');
  const lastSent = new Map<string, number>(); (sentQ.data ?? []).forEach(r => { const t = new Date(r.sent_at as string).getTime(); if (t > (lastSent.get(r.invoice_id) ?? 0)) lastSent.set(r.invoice_id, t); });
  const cutoff = nowMs() - 7 * 864e5;
  const followUp = overdue.filter(x => (lastSent.get(x.i.id) ?? 0) < cutoff).sort((a, b) => b.c.daysOverdue - a.c.daysOverdue).slice(0, 6);
  const recent = [...open].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  const hasSample = open.some(i => i.is_sample);

  if (!open.length && !paid.length) return (
    <><div className="page-head"><div><h1>Dashboard</h1></div></div>
      <div className="empty"><h2>No invoices yet</h2><p>Add your first unpaid invoice or import a CSV. Duevance shows who owes you, how late it is, and what to send next.</p>
        <div className="actions" style={{ justifyContent: 'center' }}><Link className="btn btn-primary" href="/invoices/new">Add invoice</Link><Link className="btn btn-line" href="/import">Import CSV</Link></div>
        <ActionForm action={loadSampleData}><p className="small muted" style={{ margin: '18px auto 8px' }}>Just exploring? Add clearly labelled sample invoices you can remove anytime.</p><SubmitButton className="btn btn-quiet btn-sm">Load sample data</SubmitButton></ActionForm></div></>
  );
  return (
    <>
      <div className="page-head"><div><h1>{profile.business_name || 'Dashboard'}</h1><p>Totals are shown per currency. Dates use your timezone ({profile.timezone}).</p></div>
        <div className="actions"><Link className="btn btn-primary" href="/invoices/new">Add invoice</Link><Link className="btn btn-line" href="/import">Import CSV</Link><Link className="btn btn-line" href="/invoices?view=overdue">Prepare a reminder</Link></div></div>
      {hasSample && <div className="notice notice-info"><ActionForm action={removeSampleData}><strong>You are looking at sample data.</strong> Sample invoices are labelled “Sample”. <SubmitButton className="btn btn-quiet btn-sm">Remove sample data</SubmitButton></ActionForm></div>}
      <div className="cols">
        <section className="panel stat span-4" aria-labelledby="s1"><h2 id="s1" className="label">Total outstanding</h2><Totals rows={open} /></section>
        <section className="panel stat span-4" aria-labelledby="s2"><h2 id="s2" className="label">Total overdue</h2><Totals rows={overdue.map(x => x.i)} tone="late" /><p className="sub">{overdue.length} overdue invoice{overdue.length === 1 ? '' : 's'}</p></section>
        <section className="panel stat span-4" aria-labelledby="s3"><h2 id="s3" className="label">Due in the next 7 days</h2><Totals rows={soon.map(x => x.i)} /><p className="sub">Paid in the last 30 days: {totalsByCurrency(paid).map(t => formatMoney(t.total, t.currency)).join(' and ') || 'none yet'}</p></section>
        <section className="panel span-8" aria-labelledby="f1"><h2 id="f1">Needs follow-up</h2>
          {followUp.length ? <ul className="list">{followUp.map(({ i }) => <li key={i.id}><div><Link href={`/invoices/${i.id}`}><strong>{i.customer_name}</strong></Link> <span className="muted small">{i.invoice_no} · {formatMoney(i.amount, i.currency)}</span><br /><span className="small muted">{lastSent.has(i.id) ? 'Last marked sent over 7 days ago' : 'No reminder marked as sent yet'}</span></div>
            <div className="actions"><StatusChip inv={i} today={today} /><Link className="btn btn-primary btn-sm" href={`/invoices/${i.id}/remind`}>Prepare reminder</Link></div></li>)}</ul>
            : <p className="muted">Nothing needs follow-up right now. Overdue invoices appear here until you mark a reminder as sent.</p>}</section>
        <section className="panel span-4" aria-labelledby="r1"><h2 id="r1">Recently updated</h2>
          <ul className="list">{recent.map(i => <li key={i.id}><div><Link href={`/invoices/${i.id}`}>{i.customer_name}</Link><br /><span className="small muted">{i.invoice_no} · due {formatDate(i.due_date)}</span></div><span className="small">{formatMoney(i.amount, i.currency)}</span></li>)}</ul></section>
      </div>
    </>
  );
}
