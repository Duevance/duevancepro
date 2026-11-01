/** Date handling. Due dates are calendar dates (no time); "today" is evaluated in the user's timezone. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** Today's calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function todayIn(tz: string, now: Date = new Date()): string {
  const zone = isValidTimezone(tz) ? tz : 'UTC';
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function isRealDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Whole days from a to b (positive when b is after a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export type Bucket = 'paid' | 'upcoming' | 'due_soon' | 'overdue_1_7' | 'overdue_8_30' | 'overdue_30_plus';
export const DUE_SOON_DAYS = 7;
export const BUCKET_LABEL: Record<Bucket, string> = {
  paid: 'Paid', upcoming: 'Upcoming', due_soon: 'Due soon', overdue_1_7: '1–7 days overdue', overdue_8_30: '8–30 days overdue', overdue_30_plus: '30+ days overdue',
};

export interface Classified { bucket: Bucket; daysOverdue: number; daysUntilDue: number; overdue: boolean }

/** Status is always derived from due_date and today; the stored value only distinguishes open vs paid. */
export function classify(inv: { status: string; due_date: string }, today: string): Classified {
  const diff = daysBetween(inv.due_date, today); // >0 means overdue
  if (inv.status === 'paid') return { bucket: 'paid', daysOverdue: 0, daysUntilDue: 0, overdue: false };
  if (diff <= 0) {
    const until = -diff;
    return { bucket: until <= DUE_SOON_DAYS ? 'due_soon' : 'upcoming', daysOverdue: 0, daysUntilDue: until, overdue: false };
  }
  const bucket: Bucket = diff <= 7 ? 'overdue_1_7' : diff <= 30 ? 'overdue_8_30' : 'overdue_30_plus';
  return { bucket, daysOverdue: diff, daysUntilDue: 0, overdue: true };
}

export function formatDate(iso: string, locale = 'en'): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function formatDateTime(iso: string, tz: string, locale = 'en'): string {
  try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(iso)); } catch { return new Date(iso).toISOString(); }
}
export const COMMON_TIMEZONES = ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Africa/Johannesburg', 'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto'];
export const nowMs = () => Date.now();
