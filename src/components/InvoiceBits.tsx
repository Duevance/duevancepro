import { BUCKET_LABEL, classify } from '@/lib/dates';
const CLS: Record<string, string> = { paid: 'chip-paid', upcoming: '', due_soon: 'chip-soon', overdue_1_7: 'chip-late', overdue_8_30: 'chip-late', overdue_30_plus: 'chip-late-hard' };
export function StatusChip({ inv, today }: { inv: { status: string; due_date: string }; today: string }) {
  const c = classify(inv, today);
  const text = c.overdue ? `${c.daysOverdue} day${c.daysOverdue === 1 ? '' : 's'} overdue` : c.bucket === 'due_soon' ? (c.daysUntilDue === 0 ? 'Due today' : `Due in ${c.daysUntilDue}d`) : BUCKET_LABEL[c.bucket];
  return <span className={`chip ${CLS[c.bucket]}`}>{text}</span>;
}
export function UpgradeNote({ children }: { children: React.ReactNode }) { return <p className="notice notice-info small">{children} <a href="/billing">See Pro</a></p>; }
