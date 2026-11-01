import { requireCtx } from '@/lib/session';
import { Checkout, CancelButton, RefreshButton } from '@/components/BillingActions';
import { formatDate, FREE_NOTE } from './util';
export const metadata = { title: 'Billing' };

export default async function Billing({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const sp = await searchParams; const { subs, isPro, profile, supabase, user } = await requireCtx();
  const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'open').is('archived_at', null);
  const current = subs.find(s => ['active', 'past_due', 'cancelled'].includes(s.status) && isPro) ?? null;
  const pending = subs.find(s => s.status === 'pending');
  const ending = current && (current.status === 'cancelled' || current.cancel_requested_at);
  return (
    <>
      <div className="page-head"><div><h1>Billing and plan</h1><p>{isPro ? 'You are on Pro.' : 'You are on the Free plan.'}</p></div></div>
      {sp.checkout === 'cancelled' && <p className="notice notice-info">Checkout was cancelled. You were not charged.</p>}
      {sp.checkout === 'return' && !isPro && <p className="notice notice-warn" role="status">Thanks. We are waiting for Razorpay to confirm your subscription, which can take a minute. Use “Refresh status” below.</p>}
      <div className="cols">
        <section className="panel span-6"><h2>Current plan</h2>
          {isPro && current ? <>
            <p><span className="chip chip-paid">Pro</span> {current.status === 'past_due' ? <span className="chip chip-soon">Payment issue</span> : null}</p>
            <ul className="list"><li><span>Billed through</span><strong>Razorpay</strong></li><li><span>{ending ? 'Pro access ends' : 'Renews / current period ends'}</span><strong>{current.current_period_end ? formatDate(current.current_period_end) : 'Confirming…'}</strong></li></ul>
            {ending ? <p className="notice notice-info">Cancellation is scheduled. You keep Pro until the date above, then move to Free. Your invoices are kept; creating new active invoices beyond 10 will be blocked.</p>
              : current.status === 'past_due' ? <p className="notice notice-warn">The last payment did not go through. Update your payment method with Razorpay (check your email for their link). Pro stays active until the period ends.</p> : null}
            {!ending && <CancelButton />}</> : <>
            <p><span className="chip">Free</span></p>
            <ul className="list"><li><span>Active invoices</span><strong>{count ?? 0} of 10</strong></li><li><span>Billing country</span><strong>{profile.billing_country ?? 'Not set'}</strong></li></ul>
            {pending && <p className="notice notice-warn">A payment is pending confirmation. <RefreshButton /></p>}
            {!pending && subs.some(s => s.status === 'expired') && <p className="notice notice-info">Your last subscription has ended.</p>}</>}
          <p className="small muted">{FREE_NOTE}</p></section>
        <section className="panel span-6"><h2>{isPro ? 'What Pro includes' : 'Upgrade to Pro'}</h2>
          <ul className="list"><li>Unlimited active invoices (fair use)</li><li>Full reminder history</li><li>CSV export</li><li>Saved custom reminder templates</li><li>Aging filters</li></ul>
          {!isPro && !pending && <Checkout defaultCountry={profile.billing_country ?? 'US'} prices={{ usd: process.env.PRO_PRICE_USD ?? '19', inr: process.env.PRO_PRICE_INR ?? '999' }} />}
          {!isPro && pending && <p className="muted">You already started a checkout. Refresh the status after paying; if it stays pending for more than an hour, contact support.</p>}
        </section>
      </div>
    </>
  );
}
