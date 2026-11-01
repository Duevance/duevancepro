export function supportedCurrencies(): string[] {
  try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('currency'); }
  catch { return ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'JPY']; }
}
const SET = new Set(supportedCurrencies());
export const isValidCurrency = (c: string) => /^[A-Z]{3}$/.test(c) && SET.has(c);

export function formatMoney(amount: number | string, currency: string, locale = 'en'): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n); }
  catch { return `${n.toFixed(2)} ${currency}`; }
}

/** Accepts "1250", "1,250.00", "$1250.5". Ambiguous European formats are rejected rather than guessed. */
export function parseAmount(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const s = raw.trim().replace(/[\s$€£₹¥]/g, '');
  if (!s) return { ok: false, error: 'Amount is required.' };
  if (/^-/.test(s)) return { ok: false, error: 'Amount must be greater than zero.' };
  if (!/^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(s)) return { ok: false, error: 'Use a plain number such as 1250.00 (up to 2 decimals, no European formats).' };
  const v = Number(s.replace(/,/g, ''));
  if (!(v > 0)) return { ok: false, error: 'Amount must be greater than zero.' };
  if (v >= 1e12) return { ok: false, error: 'Amount is too large.' };
  return { ok: true, value: Math.round(v * 100) / 100 };
}

/** Totals are kept per currency; different currencies are never added together. */
export function totalsByCurrency<T extends { amount: number | string; currency: string }>(rows: T[]): { currency: string; total: number; count: number }[] {
  const m = new Map<string, { cents: number; count: number }>();
  for (const r of rows) {
    const e = m.get(r.currency) ?? { cents: 0, count: 0 };
    e.cents += Math.round(Number(r.amount) * 100); e.count += 1; m.set(r.currency, e);
  }
  return [...m.entries()].map(([currency, e]) => ({ currency, total: e.cents / 100, count: e.count })).sort((a, b) => a.currency.localeCompare(b.currency));
}
