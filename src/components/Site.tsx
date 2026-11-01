'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Logo } from './Logo';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-head"><div className="wrap">
      <Link href="/" aria-label="Duevance home"><Logo /></Link>
      <button className="btn btn-quiet btn-sm menu-btn" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(o => !o)}>{open ? 'Close' : 'Menu'}</button>
      <nav id="site-nav" aria-label="Primary" className={`site-nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <Link className="hide-m" href="/#how">How it works</Link><Link className="hide-m" href="/#features">Features</Link><Link className="hide-m" href="/pricing">Pricing</Link><Link className="hide-m" href="/#faq">FAQ</Link>
        <Link className="hide-m" href="/login">Sign in</Link><Link className="btn btn-primary btn-sm" href="/signup">Start free</Link>
      </nav></div></header>
  );
}
export function SiteFooter() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <footer className="site-foot on-ink"><div className="wrap"><div className="foot-grid">
      <div><Logo tone="dark" /><p style={{ marginTop: 14, maxWidth: '32ch' }}>Get paid. Move forward.</p></div>
      <nav aria-label="Product"><h2>Product</h2><ul><li><Link href="/#features">Features</Link></li><li><Link href="/pricing">Pricing</Link></li><li><Link href="/#faq">FAQ</Link></li></ul></nav>
      <nav aria-label="Account"><h2>Account</h2><ul><li><Link href="/login">Sign in</Link></li><li><Link href="/signup">Start free</Link></li></ul></nav>
      <nav aria-label="Company"><h2>Company</h2><ul><li><Link href="/contact">Contact and support</Link></li><li><Link href="/privacy">Privacy</Link></li><li><Link href="/terms">Terms</Link></li>{email && <li><a href={`mailto:${email}`}>{email}</a></li>}</ul></nav>
    </div><p className="fine-print">Duevance prepares reminders; you send them. Payments are processed by Razorpay. © {new Date().getFullYear()} Duevance.</p></div></footer>
  );
}
