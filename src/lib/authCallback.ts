import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from './supabase/server';

/** Completes an emailed link: PKCE `code` (same browser) or `token_hash` (works across devices). */
export async function completeAuthLink(req: NextRequest, next: string) {
  const p = req.nextUrl.searchParams; const supabase = await createClient();
  let ok = false; let reason = 'invalid';
  const code = p.get('code'), tokenHash = p.get('token_hash'), type = p.get('type') as EmailOtpType | null;
  if (code) { const { error } = await supabase.auth.exchangeCodeForSession(code); ok = !error; if (error) reason = /expired/i.test(error.message) ? 'expired' : 'invalid'; }
  else if (tokenHash && type) { const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }); ok = !error; if (error) reason = /expired/i.test(error.message) ? 'expired' : 'invalid'; }
  else if (p.get('error_code') === 'otp_expired') reason = 'expired';
  return NextResponse.redirect(ok ? new URL(next, req.url) : new URL(`/login?error=${reason}`, req.url));
}
