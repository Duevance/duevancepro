import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCtx } from '@/lib/session';
import { classify } from '@/lib/dates';
import { Composer } from '@/components/Composer';
import { StatusChip } from '@/components/InvoiceBits';
import { suggestStage, type Stage } from '@/lib/reminders';
export const metadata = { title: 'Prepare reminder' };

export default async function Remind({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user, profile, today, isPro } = await requireCtx();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!inv) notFound();
  const custom: Partial<Record<Stage, { subject: string; body: string }>> = {};
  if (isPro) { const { data } = await supabase.from('reminder_templates').select('stage,subject,body').eq('user_id', user.id); (data ?? []).forEach(t => { custom[t.stage as Stage] = { subject: t.subject, body: t.body }; }); }
  const c = classify(inv, today);
  return (
    <>
      <div className="page-head"><div><h1>Prepare reminder</h1><p><Link href={`/invoices/${id}`}>{inv.invoice_no}</Link> · {inv.customer_name} · <StatusChip inv={inv} today={today} /></p></div></div>
      {inv.status === 'paid' && <p className="notice notice-warn">This invoice is marked paid. You probably do not need a reminder.</p>}
      <Composer invoiceId={id} email={inv.customer_email} phone={inv.customer_phone} initialStage={suggestStage(c.daysOverdue)} custom={custom} isPro={isPro}
        vars={{ customerName: inv.customer_name, invoiceNo: inv.invoice_no, amount: inv.amount, currency: inv.currency, dueDate: inv.due_date, businessName: profile.business_name, invoiceUrl: inv.invoice_url }} />
    </>
  );
}
