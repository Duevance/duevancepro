import Link from 'next/link';
import { ActionForm, Field, SubmitButton } from './forms';
import { saveInvoice } from '@/app/actions';
import { supportedCurrencies } from '@/lib/money';
type Inv = Partial<{ id: string; customer_name: string; customer_email: string | null; customer_phone: string | null; invoice_no: string; amount: number; currency: string; issue_date: string | null; due_date: string; invoice_url: string | null; notes: string | null }>;

export function InvoiceForm({ inv, defaultCurrency }: { inv?: Inv; defaultCurrency: string }) {
  const cur = inv?.currency ?? defaultCurrency;
  return (
    <ActionForm action={saveInvoice} className="panel" >
      {inv?.id && <input type="hidden" name="id" value={inv.id} />}
      <div className="grid-2"><Field name="customer_name" label="Customer name" defaultValue={inv?.customer_name} required autoComplete="off" /><Field name="invoice_no" label="Invoice number" defaultValue={inv?.invoice_no} required /></div>
      <div className="grid-2"><Field name="customer_email" label="Customer email" type="email" defaultValue={inv?.customer_email} hint="Needed for the email reminder shortcut." /><Field name="customer_phone" label="Customer phone" type="tel" defaultValue={inv?.customer_phone} hint="Include the country code, like +91 98765 43210, to enable WhatsApp." /></div>
      <div className="grid-2"><Field name="amount" label="Amount" defaultValue={inv?.amount} inputMode="decimal" required />
        <Field name="currency" label="Currency"><select id="f-currency" name="currency" defaultValue={cur}>{supportedCurrencies().map(c => <option key={c}>{c}</option>)}</select></Field></div>
      <div className="grid-2"><Field name="issue_date" label="Issue date" type="date" defaultValue={inv?.issue_date} /><Field name="due_date" label="Due date" type="date" defaultValue={inv?.due_date} required /></div>
      <Field name="invoice_url" label="Invoice link" type="url" defaultValue={inv?.invoice_url} hint="Optional. A link to the invoice or payment page. It is added to your reminder." />
      <Field name="notes" label="Notes" hint="Private. Never included in reminders."><textarea id="f-notes" name="notes" defaultValue={inv?.notes ?? ''} maxLength={2000} /></Field>
      <div className="actions"><SubmitButton pending="Saving…">{inv?.id ? 'Save changes' : 'Add invoice'}</SubmitButton><Link className="btn btn-line" href="/invoices">Cancel</Link></div>
    </ActionForm>
  );
}
