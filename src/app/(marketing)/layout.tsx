import { SiteFooter, SiteHeader } from '@/components/Site';
export default function Marketing({ children }: { children: React.ReactNode }) {
  return <><a className="skip" href="#main">Skip to content</a><SiteHeader /><main id="main">{children}</main><SiteFooter /></>;
}
