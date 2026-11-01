import { formatMoney } from './money';
import { formatDate } from './dates';

export const STAGES = ['friendly', 'firm', 'final'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = { friendly: 'Friendly', firm: 'Firm', final: 'Final' };

export interface Vars { customerName: string; invoiceNo: string; amount: number | string; currency: string; dueDate: string; businessName: string; invoiceUrl?: string | null }

export function suggestStage(daysOverdue: number): Stage { return daysOverdue > 30 ? 'final' : daysOverdue > 7 ? 'firm' : 'friendly'; }

export const DEFAULT_TEMPLATES: Record<Stage, { subject: string; body: string }> = {
  friendly: {
    subject: 'Friendly reminder: invoice {{invoice_no}}',
    body: 'Hi {{customer_name}},\n\nA quick reminder that invoice {{invoice_no}} for {{amount}} was due on {{due_date}}. If it has already been paid, please ignore this note and thank you.\n{{invoice_link}}\nIf anything is unclear, just reply and I will help.\n\nThanks,\n{{business_name}}',
  },
  firm: {
    subject: 'Overdue invoice {{invoice_no}} ({{amount}})',
    body: 'Hi {{customer_name}},\n\nInvoice {{invoice_no}} for {{amount}} was due on {{due_date}} and is now overdue. Please arrange payment this week, or let me know the expected payment date.\n{{invoice_link}}\nIf there is an issue with the invoice, tell me and we will sort it out.\n\nRegards,\n{{business_name}}',
  },
  final: {
    subject: 'Final reminder: invoice {{invoice_no}} ({{amount}})',
    body: 'Hi {{customer_name}},\n\nThis is my final reminder about invoice {{invoice_no}} for {{amount}}, which was due on {{due_date}}. Please pay it or reply with a payment date within the next 5 days.\n{{invoice_link}}\nIf you would like to discuss the invoice or agree a payment plan, please reply and I will work with you.\n\nRegards,\n{{business_name}}',
  },
};

/** Replaces only known {{placeholders}}; unknown ones stay visible so the user notices. */
export function render(template: string, v: Vars): string {
  const map: Record<string, string> = {
    customer_name: v.customerName || 'there', invoice_no: v.invoiceNo, amount: formatMoney(v.amount, v.currency),
    due_date: formatDate(v.dueDate), business_name: v.businessName || 'Accounts',
    invoice_link: v.invoiceUrl ? `\nInvoice: ${v.invoiceUrl}\n` : '',
  };
  return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (Object.hasOwn(map, k) ? map[k] : m));
}
export function buildMessage(stage: Stage, v: Vars, custom?: { subject: string; body: string } | null) {
  const t = custom ?? DEFAULT_TEMPLATES[stage];
  return { subject: render(t.subject, v), body: render(t.body, v) };
}

export function mailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Returns a digits-only international number, or null when it cannot be trusted (e.g. no country code). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim(); if (!s) return null;
  const hasPlus = s.startsWith('+'); const has00 = s.startsWith('00');
  s = s.replace(/[^\d]/g, '');
  if (has00) s = s.slice(2);
  if (!hasPlus && !has00) return null; // no country code: we will not guess
  return s.length >= 8 && s.length <= 15 && !s.startsWith('0') ? s : null;
}
export function whatsappUrl(phone: string | null | undefined, body: string): string | null {
  const n = normalizePhone(phone); return n ? `https://wa.me/${n}?text=${encodeURIComponent(body)}` : null;
}
