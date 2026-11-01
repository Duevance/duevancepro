import Papa from 'papaparse';
import { isRealDate } from './dates';
import { isValidCurrency, parseAmount } from './money';

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 2000;

export const FIELDS = ['customer_name', 'customer_email', 'customer_phone', 'invoice_no', 'amount', 'currency', 'issue_date', 'due_date', 'status', 'invoice_url', 'notes'] as const;
export type Field = (typeof FIELDS)[number];
export const REQUIRED: Field[] = ['customer_name', 'invoice_no', 'amount', 'due_date'];
export const FIELD_LABEL: Record<Field, string> = {
  customer_name: 'Customer name', customer_email: 'Customer email', customer_phone: 'Customer phone', invoice_no: 'Invoice number', amount: 'Amount',
  currency: 'Currency', issue_date: 'Issue date', due_date: 'Due date', status: 'Status', invoice_url: 'Invoice URL', notes: 'Notes',
};
export type Mapping = Partial<Record<Field, string>>; // field -> CSV header

export const TEMPLATE_CSV =
  'customer_name,customer_email,customer_phone,invoice_no,amount,currency,issue_date,due_date,status,invoice_url,notes\n' +
  'Northwind Studio,billing@northwind.example,+14155550123,INV-1001,1250.00,USD,2026-09-01,2026-09-30,open,,Design retainer\n';

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[]; error?: string } {
  if (text.length > MAX_CSV_BYTES) return { headers: [], rows: [], error: 'File is larger than 2 MB. Split it into smaller files.' };
  const r = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
  const fatal = r.errors.find(e => e.type === 'Quotes');
  if (fatal) return { headers: [], rows: [], error: `Could not read the file: ${fatal.message}` };
  const headers = r.meta.fields ?? [];
  if (!headers.length) return { headers, rows: [], error: 'The file has no header row.' };
  if (r.data.length > MAX_CSV_ROWS) return { headers, rows: [], error: `The file has more than ${MAX_CSV_ROWS} rows. Split it into smaller files.` };
  return { headers, rows: r.data };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES: Record<Field, string[]> = {
  customer_name: ['customername', 'customer', 'client', 'clientname', 'name', 'billto'],
  customer_email: ['customeremail', 'email', 'clientemail'],
  customer_phone: ['customerphone', 'phone', 'mobile', 'whatsapp', 'clientphone'],
  invoice_no: ['invoiceno', 'invoicenumber', 'invoice', 'number', 'invoiceid', 'ref'],
  amount: ['amount', 'total', 'amountdue', 'balance', 'value'],
  currency: ['currency', 'curr', 'ccy'],
  issue_date: ['issuedate', 'issued', 'invoicedate', 'date'],
  due_date: ['duedate', 'due', 'paymentdue', 'dueon'],
  status: ['status', 'state'],
  invoice_url: ['invoiceurl', 'url', 'link', 'invoicelink'],
  notes: ['notes', 'note', 'memo', 'description'],
};
export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {}; const used = new Set<string>();
  for (const f of FIELDS) {
    const hit = headers.find(h => !used.has(h) && (norm(h) === norm(f) || ALIASES[f].includes(norm(h))));
    if (hit) { m[f] = hit; used.add(hit); }
  }
  return m;
}
export const missingRequired = (m: Mapping) => REQUIRED.filter(f => !m[f]);

export interface ImportRow {
  customer_name: string; customer_email: string | null; customer_phone: string | null; invoice_no: string;
  amount: number; currency: string; issue_date: string | null; due_date: string; status: 'open' | 'paid';
  invoice_url: string | null; notes: string | null;
}
export interface RowIssue { line: number; invoice_no?: string; kind: 'error' | 'duplicate'; messages: string[] }
export interface Validation { valid: { line: number; row: ImportRow }[]; issues: RowIssue[]; total: number }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const OPEN_WORDS = new Set(['open', 'unpaid', 'outstanding', 'overdue', 'due', 'pending', 'sent']);
const PAID_WORDS = new Set(['paid', 'settled', 'complete', 'completed']);

export function validateRows(
  rows: Record<string, string>[], mapping: Mapping,
  ctx: { defaultCurrency: string; existingKeys: Set<string> },
): Validation {
  const valid: Validation['valid'] = []; const issues: RowIssue[] = []; const seen = new Map<string, number>();
  rows.forEach((raw, i) => {
    const line = i + 2; // header is line 1
    const get = (f: Field) => (mapping[f] ? (raw[mapping[f]!] ?? '').toString().trim() : '');
    const errs: string[] = [];
    const name = get('customer_name'); if (!name) errs.push('Customer name is required.'); else if (name.length > 200) errs.push('Customer name is longer than 200 characters.');
    const invoice_no = get('invoice_no'); if (!invoice_no) errs.push('Invoice number is required.'); else if (invoice_no.length > 80) errs.push('Invoice number is longer than 80 characters.');
    const a = parseAmount(get('amount')); if (!a.ok) errs.push(a.error);
    const email = get('customer_email'); if (email && !EMAIL.test(email)) errs.push(`"${email}" is not a valid email address.`);
    const phone = get('customer_phone'); if (phone.length > 32) errs.push('Phone number is longer than 32 characters.');
    const cur = (get('currency') || ctx.defaultCurrency).toUpperCase(); if (!isValidCurrency(cur)) errs.push(`"${cur}" is not a supported currency code.`);
    const due = get('due_date'); if (!due) errs.push('Due date is required.'); else if (!isRealDate(due)) errs.push(`Due date "${due}" must be a real date in YYYY-MM-DD format.`);
    const issue = get('issue_date'); if (issue && !isRealDate(issue)) errs.push(`Issue date "${issue}" must be a real date in YYYY-MM-DD format.`);
    const sw = get('status').toLowerCase(); let status: 'open' | 'paid' = 'open';
    if (sw) { if (PAID_WORDS.has(sw)) status = 'paid'; else if (!OPEN_WORDS.has(sw)) errs.push(`Status "${sw}" is not recognised. Use open or paid.`); }
    const url = get('invoice_url'); if (url && !/^https?:\/\//i.test(url)) errs.push('Invoice URL must start with http:// or https://.');
    const notes = get('notes'); if (notes.length > 2000) errs.push('Notes are longer than 2000 characters.');
    if (errs.length) { issues.push({ line, invoice_no: invoice_no || undefined, kind: 'error', messages: errs }); return; }
    const key = invoice_no.toLowerCase();
    if (ctx.existingKeys.has(key)) { issues.push({ line, invoice_no, kind: 'duplicate', messages: ['An invoice with this number already exists in your account. Skipped.'] }); return; }
    if (seen.has(key)) { issues.push({ line, invoice_no, kind: 'duplicate', messages: [`Same invoice number as line ${seen.get(key)} in this file. Skipped.`] }); return; }
    seen.set(key, line);
    valid.push({ line, row: { customer_name: name, customer_email: email || null, customer_phone: phone || null, invoice_no, amount: (a as { value: number }).value, currency: cur, issue_date: issue || null, due_date: due, status, invoice_url: url || null, notes: notes || null } });
  });
  return { valid, issues, total: rows.length };
}

/** Prevent spreadsheet formula injection when exporting user-supplied text. */
export const safeCell = (v: unknown) => { const s = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; };
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return Papa.unparse({ fields: columns, data: rows.map(r => columns.map(c => safeCell(r[c]))) }, { newline: '\n' }) + '\n';
}
