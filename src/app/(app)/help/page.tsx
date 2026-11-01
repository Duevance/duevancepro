import Link from 'next/link';
export const metadata = { title: 'Help' };
const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
export default function Help() {
  return (
    <>
      <div className="page-head"><div><h1>Help and support</h1></div></div>
      <div className="cols"><section className="panel span-8 prose"><h2 style={{ marginTop: 0 }}>Common questions</h2>
        <h3>Does Duevance send the reminders?</h3><p>No. Duevance prepares the message and opens your email app or WhatsApp. You press send. Use “I sent this reminder” afterwards so your history is accurate.</p>
        <h3>Why is my invoice overdue today but not yesterday?</h3><p>Overdue is calculated from the due date in your timezone. Change it in <Link href="/settings">Settings</Link>.</p>
        <h3>Why did my import skip rows?</h3><p>The review step lists every skipped row with the reason: invalid values, duplicate invoice numbers, or the Free plan limit.</p>
        <h3>Why does WhatsApp say I need a country code?</h3><p>Phone numbers must start with + and the country code, for example +91 98765 43210. Duevance does not guess country codes.</p>
        <h3>Billing and cancellation</h3><p>Manage or cancel under <Link href="/billing">Billing</Link>. Pro stays active until the end of the paid period.</p></section>
        <aside className="panel span-4"><h2>Contact</h2>{email ? <p><a href={`mailto:${email}`}>{email}</a></p> : <p>Support email is not configured on this deployment.</p>}<p className="small muted">Include the invoice number, not customer details, when you write to us.</p></aside></div>
    </>
  );
}
