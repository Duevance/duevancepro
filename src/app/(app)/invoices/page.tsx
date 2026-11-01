import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import { addDays, formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { StatusChip, UpgradeNote } from '@/components/InvoiceBits';
import { QuickAction } from '@/components/forms';
import { archiveInvoice, markPaid, reopenInvoice, restoreInvoice } from '@/app/actions';
export const metadata = { title: 'Invoices' };
const PAGE = 20;
const SORTS = ['due_date', 'amount', 'customer_name', 'updated_at'] as const;
type SP = { q?: string; view?: string; bucket?: string; sort?: string; dir?: string; page?: string; saved?: string; deleted?: string };

export default async function Invoices({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams; const { supabase, user, today, isPro } = await requireCtx();
  const view = ['open', 'paid', 'archived', 'overdue'].includes(sp.view ?? '') ? sp.view! : 'open';
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? '') ? sp.sort! : 'due_date'; const asc = (sp.dir ?? (sort === 'updated_at' ? 'desc' : 'asc')) !== 'desc';
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const bucket = isPro ? sp.bucket ?? '' : ''; // aging filters are a Pro control, enforced here on the server
  let q = supabase.from('invoices').select('*', { count: 'exact' }).eq('user_id', user.id);
  q = view === 'archived' ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
  if (view === 'paid') q = q.eq('status', 'paid'); else if (view !== 'archived') q = q.eq('status', 'open');
  if (view === 'overdue') q = q.lt('due_date', today);
  const range: Record<string, [string | null, string | null]> = { due_soon: [today, addDays(today, 7)], overdue_1_7: [addDays(today, -7), addDays(today, -1)], overdue_8_30: [addDays(today, -30), addDays(today, -8)], overdue_30_plus: [null, addDays(today, -31)] };
  if (range[bucket]) { const [a, b] = range[bucket]; if (a) q = q.gte('due_date', a); if (b) q = q.lte('due_date', b); }
  const term = (sp.q ?? '').replace(/[%,()*\\"']/g, ' ').trim().slice(0, 80);
  if (term) q = q.or(`customer_name.ilike.%${term}%,invoice_no.ilike.%${term}%,customer_email.ilike.%${term}%`);
  const { data, count, error } = await q.order(sort, { ascending: asc }).range((page - 1) * PAGE, page * PAGE - 1);
  if (error) throw new Error('load failed');
  const rows = data ?? []; const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const link = (o: Partial<SP>) => { const p = new URLSearchParams(); const m = { q: term, view, bucket, sort, dir: asc ? 'asc' : 'desc', page: String(page), ...o }; Object.entries(m).forEach(([k, v]) => { if (v && !(k === 'view' && v === 'open') && !(k === 'page' && v === '1')) p.set(k, String(v)); }); const s = p.toString(); return `/invoices${s ? '?' + s : ''}`; };
  return (
    <>
      <div className="page-head"><div><h1>Invoices</h1><p>{count ?? 0} {view} invoice{count === 1 ? '' : 's'}</p></div><div className="actions"><Link className="btn btn-primary" href="/invoices/new">Add invoice</Link><Link className="btn btn-line" href="/import">Import CSV</Link>{isPro ? <a className="btn btn-line" href="/api/export">Export CSV</a> : null}</div></div>
      {sp.saved && <p className="notice notice-ok" role="status">Invoice saved.</p>}{sp.deleted && <p className="notice notice-ok" role="status">Invoice deleted.</p>}
      <form className="toolbar" role="search" action="/invoices">
        <div className="field grow"><label htmlFor="q">Search</label><input id="q" name="q" type="search" defaultValue={term} placeholder="Customer, invoice number or email" /></div>
        <div className="field"><label htmlFor="view">Show</label><select id="view" name="view" defaultValue={view}><option value="open">Open</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="archived">Archived</option></select></div>
        {isPro && <div className="field"><label htmlFor="bucket">Aging</label><select id="bucket" name="bucket" defaultValue={bucket}><option value="">Any</option><option value="due_soon">Due soon</option><option value="overdue_1_7">1–7 days overdue</option><option value="overdue_8_30">8–30 days overdue</option><option value="overdue_30_plus">30+ days overdue</option></select></div>}
        <div className="field"><label htmlFor="sort">Sort by</label><select id="sort" name="sort" defaultValue={sort}><option value="due_date">Due date</option><option value="amount">Amount</option><option value="customer_name">Customer</option><option value="updated_at">Last updated</option></select></div>
        <div className="field"><label htmlFor="dir">Order</label><select id="dir" name="dir" defaultValue={asc ? 'asc' : 'desc'}><option value="asc">Ascending</option><option value="desc">Descending</option></select></div>
        <button className="btn btn-ink" type="submit">Apply</button>
      </form>
      {!isPro && <UpgradeNote>Pro adds aging filters (1–7, 8–30, 30+ days overdue) and CSV export.</UpgradeNote>}
      {!rows.length ? <div className="empty"><h2>{term || bucket ? 'No matching invoices' : 'Nothing here yet'}</h2><p>{term || bucket ? 'Try a different search or clear the filters.' : 'Add an invoice or import a CSV to start tracking.'}</p>{term || bucket ? <Link className="btn btn-line" href="/invoices">Clear filters</Link> : <Link className="btn btn-primary" href="/invoices/new">Add invoice</Link>}</div> : (
        <div className="tablewrap"><table><thead><tr><th>Customer</th><th>Invoice</th><th>Due</th><th>Status</th><th className="num">Amount</th><th><span className="sr">Actions</span></th></tr></thead><tbody>
          {rows.map(i => <tr key={i.id}><td><Link href={`/invoices/${i.id}`}><strong>{i.customer_name}</strong></Link>{i.is_sample && <span className="chip chip-info" style={{ marginLeft: 8 }}>Sample</span>}<br /><span className="small muted">{i.customer_email ?? 'No email'}</span></td><td>{i.invoice_no}</td><td>{formatDate(i.due_date)}</td><td><StatusChip inv={i} today={today} /></td><td className="num">{formatMoney(i.amount, i.currency)}</td>
            <td><div className="actions" style={{ justifyContent: 'flex-end' }}>
              {i.status === 'open' && !i.archived_at && <><Link className="btn btn-primary btn-sm" href={`/invoices/${i.id}/remind`}>Remind</Link><QuickAction action={markPaid} id={i.id} label="Mark paid" /></>}
              {i.status === 'paid' && <QuickAction action={reopenInvoice} id={i.id} label="Reopen" />}
              {i.archived_at ? <QuickAction action={restoreInvoice} id={i.id} label="Restore" /> : <QuickAction action={archiveInvoice} id={i.id} label="Archive" />}</div></td></tr>)}
        </tbody></table></div>)}
      {pages > 1 && <nav className="pager" aria-label="Pagination"><span className="small muted">Page {page} of {pages}</span><span className="actions">{page > 1 && <Link className="btn btn-quiet btn-sm" href={link({ page: String(page - 1) })}>Previous</Link>}{page < pages && <Link className="btn btn-quiet btn-sm" href={link({ page: String(page + 1) })}>Next</Link>}</span></nav>}
    </>
  );
}
