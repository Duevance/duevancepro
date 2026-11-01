/** Razorpay handles every customer: INR for India, USD for everyone else. Each currency has its own Razorpay plan. */
export type Provider = 'razorpay';
export interface Offer { provider: Provider; currency: 'USD' | 'INR'; amount: number; label: string }
export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'IN', name: 'India' }, { code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' }, { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' }, { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' }, { code: 'NL', name: 'Netherlands' },
  { code: 'SG', name: 'Singapore' }, { code: 'AE', name: 'United Arab Emirates' }, { code: 'ZA', name: 'South Africa' }, { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' }, { code: 'ES', name: 'Spain' }, { code: 'IT', name: 'Italy' }, { code: 'SE', name: 'Sweden' }, { code: 'BR', name: 'Brazil' },
];
export const isSupportedCountry = (c: string) => COUNTRIES.some(x => x.code === c);
const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
/** Prices come from config. The Razorpay plan for each price is created automatically on first checkout. */
export function offerFor(country: string, env: Record<string, string | undefined> = process.env): Offer {
  if (country === 'IN') { const a = num(env.PRO_PRICE_INR, 999); return { provider: 'razorpay', currency: 'INR', amount: a, label: `₹${a.toLocaleString('en-IN')}/month` }; }
  const a = num(env.PRO_PRICE_USD, 19); return { provider: 'razorpay', currency: 'USD', amount: a, label: `$${a}/month` };
}