import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import { formatDateTime, nowMs } from '@/lib/dates';
import { activityLabel } from '@/lib/activity';
import { UpgradeNote } from '@/components/InvoiceBits';
export const metadata = { title: 'Reminder activity' };
const FREE_ROWS = 25, FREE_DAYS = 30, PAGE = 50;

export default async function Activity({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { supabase, user, profile, isPro } = await requireCtx();
  const page = isPro ? Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1) : 1;
  let q = supabase.from('reminders_log').select('*, invoices(invoice_no, customer_name)', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false });
  if (!isPro) q = q.gte('created_at', new Date(nowMs() - FREE_DAYS * 864e5).toISOString()).range(0, FREE_ROWS - 1); else q = q.range((page - 1) * PAGE, page * PAGE - 1);
  const { data, count, error } = await q; if (error) throw new Error('load failed');
  const rows = (data ?? []) as unknown as { id: string; invoice_id: string; action_type: string; channel: string | null; stage: string | null; created_at: string; invoices: { invoice_no: string; customer_name: string } | null }[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  return (
    <>
      <div className="page-head"><div><h1>Reminder activity</h1><p>A record of what you prepared and sent. “Link opened” means your email or WhatsApp app was opened, not that a message was delivered.</p></div></div>
      {!isPro && <UpgradeNote>The Free plan shows your latest {FREE_ROWS} events from the last {FREE_DAYS} days. Pro keeps your full history.</UpgradeNote>}
      {!rows.length ? <div className="empty"><h2>No activity yet</h2><p>When you prepare or send a reminder, it appears here with the time and the invoice.</p><Link className="btn btn-primary" href="/invoices?view=overdue">See overdue invoices</Link></div> : (
        <div className="tablewrap"><table><thead><tr><th>When</th><th>Invoice</th><th>Event</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.id}><td>{formatDateTime(r.created_at, profile.timezone)}</td><td><Link href={`/invoices/${r.invoice_id}`}>{r.invoices?.invoice_no ?? 'Invoice'}</Link><br /><span className="small muted">{r.invoices?.customer_name}</span></td><td>{activityLabel(r)}</td></tr>)}</tbody></table></div>)}
      {isPro && pages > 1 && <nav className="pager" aria-label="Pagination"><span className="small muted">Page {page} of {pages}</span><span className="actions">{page > 1 && <Link className="btn btn-quiet btn-sm" href={`/activity?page=${page - 1}`}>Previous</Link>}{page < pages && <Link className="btn btn-quiet btn-sm" href={`/activity?page=${page + 1}`}>Next</Link>}</span></nav>}
    </>
  );
}
