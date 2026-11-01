import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/instrument-sans';
import './globals.css';

const url = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: { default: 'Duevance: Get paid. Move forward.', template: '%s · Duevance' },
  description: 'Duevance helps freelancers, agencies and small businesses track unpaid invoices and follow up without the stress. Prepare reminders in one click and see who owes you.',
  openGraph: { type: 'website', siteName: 'Duevance', title: 'Duevance: Get paid. Move forward.', description: 'Track unpaid invoices and prepare professional payment reminders.', images: [{ url: '/opengraph-image', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'Duevance: Get paid. Move forward.' },
  icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = { themeColor: '#0C1226', width: 'device-width', initialScale: 1 };
export default function Root({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
