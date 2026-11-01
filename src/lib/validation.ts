import { isRealDate } from './dates';
import { isValidCurrency, parseAmount } from './money';

export interface InvoiceInput {
  customer_name: string; customer_email: string | null; customer_phone: string | null; invoice_no: string; amount: number; currency: string;
  issue_date: string | null; due_date: string; invoice_url: string | null; notes: string | null;
}
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function validateInvoiceForm(fd: FormData): { ok: true; value: InvoiceInput } | { ok: false; errors: Record<string, string> } {
  const g = (k: string) => String(fd.get(k) ?? '').trim();
  const e: Record<string, string> = {};
  const customer_name = g('customer_name'); if (!customer_name) e.customer_name = 'Enter the customer name.'; else if (customer_name.length > 200) e.customer_name = 'Keep the name under 200 characters.';
  const invoice_no = g('invoice_no'); if (!invoice_no) e.invoice_no = 'Enter the invoice number.'; else if (invoice_no.length > 80) e.invoice_no = 'Keep the number under 80 characters.';
  const a = parseAmount(g('amount')); if (!a.ok) e.amount = a.error;
  const currency = g('currency').toUpperCase(); if (!isValidCurrency(currency)) e.currency = 'Choose a valid 3-letter currency code.';
  const due_date = g('due_date'); if (!isRealDate(due_date)) e.due_date = 'Enter a real due date.';
  const issue_date = g('issue_date'); if (issue_date && !isRealDate(issue_date)) e.issue_date = 'Enter a real issue date.';
  if (issue_date && isRealDate(issue_date) && isRealDate(due_date) && issue_date > due_date) e.due_date = 'The due date cannot be before the issue date.';
  const email = g('customer_email'); if (email && !EMAIL.test(email)) e.customer_email = 'Enter a valid email address.';
  const phone = g('customer_phone'); if (phone.length > 32) e.customer_phone = 'Keep the phone number under 32 characters.';
  const url = g('invoice_url'); if (url && !/^https?:\/\/\S+$/i.test(url)) e.invoice_url = 'The link must start with http:// or https://.';
  const notes = g('notes'); if (notes.length > 2000) e.notes = 'Keep notes under 2000 characters.';
  if (Object.keys(e).length) return { ok: false, errors: e };
  return { ok: true, value: { customer_name, customer_email: email || null, customer_phone: phone || null, invoice_no, amount: (a as { value: number }).value, currency, issue_date: issue_date || null, due_date, invoice_url: url || null, notes: notes || null } };
}
