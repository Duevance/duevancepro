'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from './Logo';

const I = (d: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: I('M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10') },
  { href: '/invoices', label: 'Invoices', icon: I('M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7') },
  { href: '/import', label: 'Import', icon: I('M12 3v12m0 0l-4-4m4 4l4-4M4 20h16') },
  { href: '/activity', label: 'Activity', icon: I('M3 12h4l3-8 4 16 3-8h4') },
  { href: '/billing', label: 'Billing', icon: I('M3 6h18v12H3zM3 10h18') },
  { href: '/settings', label: 'Settings', icon: I('M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2m12 0h2M12 4v2m0 12v2') },
  { href: '/help', label: 'Help', icon: I('M12 18h.01M9.5 9a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 4M12 22a10 10 0 100-20 10 10 0 000 20z') },
];
const active = (p: string, h: string) => p === h || p.startsWith(h + '/');

export function Sidebar({ email, isPro }: { email: string; isPro: boolean }) {
  const p = usePathname();
  return (
    <aside className="side on-ink">
      <Link href="/dashboard" aria-label="Duevance dashboard"><Logo tone="dark" /></Link>
      <nav className="nav" aria-label="Main">{ITEMS.map(i => <Link key={i.href} href={i.href} aria-current={active(p, i.href) ? 'page' : undefined}>{i.icon}{i.label}</Link>)}</nav>
      <div className="side-foot"><span className="plan">{isPro ? 'Pro plan' : 'Free plan'}</span><div className="small" style={{ wordBreak: 'break-all', marginBottom: 8 }}>{email}</div>
        <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form></div>
    </aside>
  );
}
export function MobileNav({ email }: { email: string }) {
  const p = usePathname(); const [open, setOpen] = useState(false);
  const main = ITEMS.slice(0, 4); const more = ITEMS.slice(4);
  return (
    <>
      <div className="mobile-bar on-ink"><Link href="/dashboard" aria-label="Duevance dashboard"><Logo tone="dark" size={26} /></Link></div>
      {open && (
        <div className="more-sheet" role="dialog" aria-label="More">
          {more.map(i => <Link key={i.href} href={i.href} onClick={() => setOpen(false)}>{i.label}</Link>)}
          <p className="small" style={{ color: '#AAB2D1', padding: '6px 14px', margin: 0, wordBreak: 'break-all' }}>{email}</p>
          <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
        </div>
      )}
      <nav className="tabbar" aria-label="Main">
        {main.map(i => <Link key={i.href} href={i.href} aria-current={active(p, i.href) ? 'page' : undefined}>{i.icon}{i.label}</Link>)}
        <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} aria-current={more.some(m => active(p, m.href)) ? 'page' : undefined}>{I('M5 12h.01M12 12h.01M19 12h.01')}More</button>
      </nav>
    </>
  );
}
