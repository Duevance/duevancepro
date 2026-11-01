import { requireCtx } from '@/lib/session';
import { MobileNav, Sidebar } from '@/components/AppNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isPro } = await requireCtx({ allowUnonboarded: true });
  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <Sidebar email={user.email ?? ''} isPro={isPro} /><MobileNav email={user.email ?? ''} />
      <main id="main" className="main">{children}</main>
    </div>
  );
}
