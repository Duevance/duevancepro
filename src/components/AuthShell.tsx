import Link from 'next/link';
import { Logo } from './Logo';
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="on-ink"><Link href="/" aria-label="Duevance home"><Logo tone="dark" size={34} /></Link><h2>Get paid. Move forward.</h2><p style={{ color: '#C9CFE6' }}>Track unpaid invoices and follow up with confidence. Duevance prepares your reminders; you stay in control of what gets sent.</p></aside>
      <main id="main">{children}</main>
    </div>
  );
}
