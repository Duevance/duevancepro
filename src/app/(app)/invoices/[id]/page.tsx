import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import { InvoiceForm } from '@/components/InvoiceForm';
import { StatusChip } from '@/components/InvoiceBits';
import { ActionForm, SubmitButton, QuickAction } from '@/components/forms';
import { archiveInvoice, deleteInvoice, markPaid, reopenInvoice, restoreInvoice } from '@/app/actions';
import { formatDateTime } from '@/lib/dates';
import { activityLabel } from '@/lib/activity';
export const metadata = { title: 'Invoice' };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user, profile, today } = await requireCtx();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!inv) notFound();
  const { data: log } = await supabase.from('reminders_log').select('*').eq('invoice_id', id).order('created_at', { ascending: false }).limit(30);
  return (
    <>
      <div className="page-head"><div><h1>{inv.invoice_no}</h1><p>{inv.customer_name} <StatusChip inv={inv} today={today} /> {inv.archived_at && <span className="chip">Archived</span>}</p></div>
        <div className="actions">
          {inv.status === 'open' && !inv.archived_at && <><Link className="btn btn-primary" href={`/invoices/${id}/remind`}>Prepare reminder</Link><QuickAction action={markPaid} id={id} label="Mark paid" className="btn btn-quiet" /></>}
          {inv.status === 'paid' && <QuickAction action={reopenInvoice} id={id} label="Reopen" className="btn btn-quiet" />}
          {inv.archived_at ? <QuickAction action={restoreInvoice} id={id} label="Restore" className="btn btn-quiet" /> : <QuickAction action={archiveInvoice} id={id} label="Archive" className="btn btn-quiet" />}
        </div></div>
      <div className="cols"><div className="span-8"><InvoiceForm inv={inv} defaultCurrency={profile.default_currency} /></div>
        <aside className="span-4"><section className="panel"><h2>History</h2>
          {log?.length ? <ul className="list">{log.map(l => <li key={l.id}><span>{activityLabel(l)}</span><span className="small muted">{formatDateTime(l.created_at, profile.timezone)}</span></li>)}</ul> : <p className="muted">No reminder activity yet.</p>}</section>
          <section className="panel" style={{ marginTop: 18 }}><h2>Delete invoice</h2><p className="small muted">Permanently removes this invoice and its history. Archive it instead if you may need it later.</p>
            <ActionForm action={deleteInvoice} confirm="Delete this invoice and its history permanently?"><input type="hidden" name="id" value={id} /><SubmitButton className="btn btn-danger btn-sm">Delete permanently</SubmitButton></ActionForm></section></aside></div>
    </>
  );
}
