import Link from 'next/link';
import { offerFor } from '@/lib/pricing';
export { Ledger } from './Ledger';

export function Pricing() {
  const usd = offerFor('US'), inr = offerFor('IN');
  return (
    <div className="plans">
      <section className="plan" aria-labelledby="p-free"><h3 id="p-free">Free</h3><div className="price">$0<small> forever</small></div><p className="muted">For getting your first overdue invoices under control.</p>
        <ul><li>Up to 10 active invoices</li><li>Manual invoice entry and CSV import</li><li>Dashboard and overdue tracking</li><li>Friendly, Firm and Final reminder templates</li><li>Email and WhatsApp shortcuts</li><li>Basic reminder history (latest 25 events, 30 days)</li></ul>
        <Link className="btn btn-line" href="/signup">Start free</Link></section>
      <section className="plan pro" aria-labelledby="p-pro"><h3 id="p-pro">Pro</h3><div className="price">{usd.label.replace('/month', '')}<small> / month</small></div>
        <p className="alt-price">Pay in India? {inr.label} in INR. Everyone else pays in USD. All payments are processed by Razorpay.</p>
        <ul><li>Unlimited active invoices (fair use)</li><li>Full reminder history</li><li>CSV export of your invoices</li><li>Saved custom reminder templates</li><li>Aging filters and extra workflow controls</li></ul>
        <Link className="btn btn-primary" href="/signup">Start free, upgrade anytime</Link><p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>Cancel any time. Pro stays active until the end of the period you paid for.</p></section>
    </div>
  );
}

export const FAQ: [string, string][] = [
  ['Does Duevance send reminders for me?', 'No. Duevance fills in a message from your invoice details and opens your own email app or WhatsApp. You review it, send it yourself, and then record that you sent it. Duevance cannot know whether a message was delivered.'],
  ['Which currencies are supported?', 'Any standard three-letter currency code, such as USD, EUR, GBP, INR or AUD. Totals are always shown separately per currency. Duevance never adds different currencies together.'],
  ['How does the CSV import work?', 'Upload a file, match its columns, review a preview and import. Rows with problems are listed with the reason and skipped. Importing the same file again will not create duplicates.'],
  ['How does billing work?', 'Pro is a monthly subscription. Customers in India pay in INR and everyone else pays in USD, all through Razorpay. Your card details go to Razorpay, never to Duevance. Pro access starts once the provider confirms the payment.'],
  ['What happens to my data?', 'Your invoices are stored in a managed Postgres database and only your account can read them. You can download everything as JSON or delete your account at any time from Settings. See the Privacy Policy for details.'],
  ['Can I cancel?', 'Yes, from the Billing page. You keep Pro until the end of the period you already paid for, then your account returns to the Free plan. Nothing is deleted.'],
];
export function Faq() {
  return <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>;
}
