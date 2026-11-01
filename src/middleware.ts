import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/invoices', '/import', '/activity', '/billing', '/settings', '/help', '/onboarding'];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isProtected = PROTECTED.some(p => req.nextUrl.pathname === p || req.nextUrl.pathname.startsWith(p + '/'));
  const validUrl = (() => { try { return !!url && /^https?:$/.test(new URL(url).protocol); } catch { return false; } })();
  if (!validUrl || !key) return isProtected ? NextResponse.redirect(new URL('/login?error=config', req.url)) : res;
  const supabase = createServerClient(url!, key!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser(); // verifies the JWT with Supabase Auth
  if (isProtected && !user) {
    const to = new URL('/login', req.url); to.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(to);
  }
  if (user && ['/login', '/signup', '/forgot-password'].includes(req.nextUrl.pathname)) return NextResponse.redirect(new URL('/dashboard', req.url));
  return res;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp|txt|xml)$).*)'] };
