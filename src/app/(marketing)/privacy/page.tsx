export const metadata = { title: 'Privacy Policy' };
export default function Privacy() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'the support address on the Contact page';
  return (<section className="block"><div className="wrap prose"><h1 style={{ fontSize: '3rem' }}>Privacy Policy</h1>
    
    <h2>What we collect</h2><ul><li>Account data: your email address and the business name, currency and timezone you choose.</li><li>Invoice data you enter or import: customer names, emails, phone numbers, invoice numbers, amounts, dates, links and notes.</li><li>Activity data: reminders you prepared, opened or marked as sent.</li><li>Billing data: your plan, provider subscription ID, status and billing period. Card details are handled only by Razorpay.</li><li>Basic product events such as “first invoice created”, without invoice contents or customer details.</li></ul>
    <h2>How we use it</h2><p>To run the service, authenticate you, calculate overdue status, prepare reminders, process subscriptions and prevent abuse. We do not sell your data and we do not send messages to your customers.</p>
    <h2>Who processes it</h2><p>Supabase (database and authentication), our hosting provider, Razorpay (payments). Each acts under its own terms.</p>
    <h2>Retention and deletion</h2><p>Data is kept while your account exists. You can download it as JSON or delete your account in Settings, which removes your profile, invoices, history and templates. Payment providers and legal or tax records may be retained as their rules require.</p>
    <h2>Your invoice customers</h2><p>You are responsible for having a lawful basis to store and contact the people in your invoices. Duevance acts as a processor of that data on your behalf.</p>
    <h2>Contact</h2><p>Questions or requests: {email}.</p></div></section>);
}
