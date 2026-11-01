'use client';
import { useState, useTransition } from 'react';
import Script from 'next/script';
import { ActionForm, Field, SubmitButton } from './forms';
import { cancelSubscription, confirmRazorpayCheckout, startCheckout, syncSubscription, type FormState } from '@/app/actions';
import { COUNTRIES, offerFor } from '@/lib/pricing';

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open(): void; on(e: string, f: (r: unknown) => void): void } } }

export function Checkout({ defaultCountry, prices }: { defaultCountry: string; prices: { usd: string; inr: string } }) {
  const [country, setCountry] = useState(defaultCountry); const [msg, setMsg] = useState<FormState>(null);
  const offer = offerFor(country, { PRO_PRICE_USD: prices.usd, PRO_PRICE_INR: prices.inr });
  function onResult(s: FormState) {
    const rz = (s?.data as { razorpay?: { subscriptionId: string; keyId: string; email?: string } } | undefined)?.razorpay; if (!s?.ok || !rz) return;
    if (!window.Razorpay) return setMsg({ ok: false, error: 'The payment window did not load. Check your connection or ad blocker and try again.' });
    const r = new window.Razorpay({
      key: rz.keyId, subscription_id: rz.subscriptionId, name: 'Duevance', description: 'Duevance Pro, monthly', prefill: { email: rz.email }, theme: { color: '#2447F5' },
      modal: { ondismiss: () => setMsg({ ok: false, error: 'Checkout was closed before payment finished. You were not charged.' }) },
      handler: async (resp: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
        setMsg({ ok: true, message: 'Payment received. Confirming with Razorpay…' });
        setMsg(await confirmRazorpayCheckout(resp.razorpay_payment_id, resp.razorpay_subscription_id, resp.razorpay_signature)); setTimeout(() => location.reload(), 1200);
      },
    });
    r.on('payment.failed', () => setMsg({ ok: false, error: 'The payment did not go through. Try another card or method; nothing was activated.' })); r.open();
  }
  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <ActionForm action={startCheckout} onResult={onResult}>
        <Field name="country" label="Billing country" hint="India is billed in INR. All other countries are billed in USD. International cards must be accepted by your bank for recurring payments."><select id="f-country" name="country" value={country} onChange={e => setCountry(e.target.value)}>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></Field>
        <p><strong>{offer.label}</strong> ({offer.currency}) through Razorpay. Renews monthly until you cancel.</p>
        <SubmitButton pending="Starting checkout…">Upgrade to Pro</SubmitButton>
      </ActionForm>
      {msg?.error && <p className="notice notice-error" role="alert">{msg.error}</p>}{msg?.ok && msg.message && <p className="notice notice-ok" role="status">{msg.message}</p>}
    </>
  );
}
export function RefreshButton() { const [m, setM] = useState<string | null>(null); const [p, t] = useTransition(); return <><button className="btn btn-quiet btn-sm" disabled={p} onClick={() => t(async () => { const r = await syncSubscription(); setM(r?.message ?? r?.error ?? null); location.reload(); })}>{p ? 'Checking…' : 'Refresh status'}</button>{m && <span className="small muted"> {m}</span>}</>; }
export function CancelButton() {
  return <ActionForm action={async () => cancelSubscription()} confirm="Cancel your Pro plan? You keep Pro until the end of the period you already paid for."><SubmitButton className="btn btn-line btn-sm" pending="Cancelling…">Cancel subscription</SubmitButton></ActionForm>;
}
