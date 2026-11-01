export const FREE_ACTIVE_LIMIT = 10;
export const isFreePlanLimitError = (e: unknown) => /FREE_PLAN_LIMIT/.test(String((e as { message?: string })?.message ?? e));
export const PLAN_LIMIT_MESSAGE = `The Free plan includes ${FREE_ACTIVE_LIMIT} active invoices. Mark invoices paid, archive some, or upgrade to Pro.`;
export function hasProAccess(subs: { status: string; current_period_end: string | null }[], now = new Date()): boolean {
  return subs.some(s => s.status === 'active' || ((s.status === 'cancelled' || s.status === 'past_due') && !!s.current_period_end && new Date(s.current_period_end) > now));
}
