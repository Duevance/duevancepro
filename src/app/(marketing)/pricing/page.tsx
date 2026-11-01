import { Faq, Pricing } from '@/components/Marketing';
export const metadata = { title: 'Pricing', description: 'Duevance is free for up to 10 active invoices. Pro adds unlimited invoices, full history, CSV export and custom templates.' };
export default function PricingPage() {
  return (
    <section className="block"><div className="wrap">
      <div className="sect-head"><h1 style={{ fontSize: 'clamp(2.4rem,5vw,4rem)' }}>Pricing</h1><p>Free to start. Pro is a monthly subscription that you can cancel any time.</p></div>
      <Pricing />
      <div className="prose" style={{ marginTop: 40 }}><h2>Billing details</h2><ul>
        <li>Customers in India are billed in INR and customers elsewhere in USD, all through Razorpay. Prices shown are the current list prices and may change with notice.</li>
        <li>Subscriptions renew monthly until cancelled. Cancelling stops future charges; Pro stays active until the end of the paid period.</li>
        <li>Taxes may apply depending on your location. Refunds are handled case by case; contact support within 14 days of a charge.</li>
        <li>Card details are entered with Razorpay. Duevance does not receive or store them.</li></ul></div>
      <div style={{ marginTop: 56 }}><h2>Questions</h2><Faq /></div></div></section>
  );
}
