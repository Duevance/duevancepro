import { requireCtx } from '@/lib/session';
import { InvoiceForm } from '@/components/InvoiceForm';
export const metadata = { title: 'Add invoice' };
export default async function NewInvoice() {
  const { profile } = await requireCtx();
  return <><div className="page-head"><div><h1>Add invoice</h1><p>Enter an unpaid invoice you want to follow up on.</p></div></div><div style={{ maxWidth: 760 }}><InvoiceForm defaultCurrency={profile.default_currency} /></div></>;
}
