export const metadata = { title: 'Contact and support' };
export default function Contact() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (<section className="block"><div className="wrap prose"><h1 style={{ fontSize: '3rem' }}>Contact and support</h1>
    {email ? <p>Email us at <a href={`mailto:${email}`}>{email}</a>. We reply as soon as we can.</p> : <p className="notice notice-warn">Support email is not configured. Set NEXT_PUBLIC_SUPPORT_EMAIL.</p>}
    <h2>Helpful details</h2><ul><li>The email address on your account.</li><li>The invoice number, not the customer’s personal details.</li><li>For billing issues, your Razorpay payment ID.</li></ul></div></section>);
}
