import crypto from 'node:crypto';
import type { ProviderState, SubStatus } from './types';

const API = 'https://api.razorpay.com/v1';
const auth = () => 'Basic ' + Buffer.from(`${process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
const hmac = (secret: string, data: string | Buffer) => crypto.createHmac('sha256', secret).update(data).digest('hex');
export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8'), y = Buffer.from(b, 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Webhook authenticity: HMAC-SHA256 of the RAW body with the webhook secret (Razorpay's documented method). */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!signature || !secret) return false;
  return safeEqualHex(hmac(secret, rawBody), signature);
}
/** Checkout handler signature: HMAC of `payment_id|subscription_id` with the API key secret. */
export function verifyPaymentSignature(paymentId: string, subscriptionId: string, signature: string, keySecret: string | undefined): boolean {
  if (!keySecret) return false;
  return safeEqualHex(hmac(keySecret, `${paymentId}|${subscriptionId}`), signature);
}

export function mapRazorpayStatus(s: string): SubStatus {
  switch (s) {
    case 'active': return 'active';
    case 'created': case 'authenticated': return 'pending';
    case 'pending': case 'paused': return 'past_due';
    case 'cancelled': return 'cancelled';
    default: return 'expired'; // halted, completed, expired
  }
}
export function stateFromRazorpay(sub: { status: string; current_end?: number | null }): ProviderState {
  return { status: mapRazorpayStatus(sub.status), currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null };
}
export function extractRazorpaySubscriptionId(event: any): string | null {
  const t: string = event?.event ?? '';
  if (t.startsWith('subscription.')) return event?.payload?.subscription?.entity?.id ?? null;
  return null; // payment.* events are ignored; subscription.charged/halted/etc. carry the state we need
}

async function rzp(path: string, init?: RequestInit) {
  const res = await fetch(API + path, { ...init, headers: { Authorization: auth(), 'Content-Type': 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Razorpay ${path} failed (${res.status})`);
  return res.json();
}
export async function createRazorpaySubscription(userId: string, planId: string): Promise<{ id: string }> {
  return rzp('/subscriptions', { method: 'POST', body: JSON.stringify({ plan_id: planId, total_count: 120, customer_notify: 1, notes: { user_id: userId } }) });
}
export async function fetchRazorpayState(id: string): Promise<ProviderState> { return stateFromRazorpay(await rzp(`/subscriptions/${encodeURIComponent(id)}`)); }
export async function cancelRazorpay(id: string, atCycleEnd = true) { await rzp(`/subscriptions/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }) }); }
export async function createRazorpayPlan(currency: string, amountMajor: number): Promise<{ id: string }> {
  return rzp('/plans', { method: 'POST', body: JSON.stringify({ period: 'monthly', interval: 1, item: { name: 'Duevance Pro', description: 'Duevance Pro monthly subscription', amount: Math.round(amountMajor * 100), currency } }) });
}