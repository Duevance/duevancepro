import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { hasProAccess } from './plan';
import { todayIn } from './dates';

export type Profile = { user_id: string; business_name: string; default_currency: string; timezone: string; billing_country: string | null; onboarded_at: string | null };
export type Sub = { id: string; provider: 'razorpay' | 'paypal'; provider_subscription_id: string; status: string; current_period_end: string | null; cancel_requested_at: string | null; created_at: string };

/** Authenticates on the server (never trusts the client) and loads everything a page needs. */
export async function requireCtx(opts: { allowUnonboarded?: boolean } = {}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  let { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (!profile) { const r = await supabase.from('profiles').insert({ user_id: user.id }).select('*').single(); profile = r.data; }
  if (!profile) throw new Error('Profile unavailable');
  if (!profile.onboarded_at && !opts.allowUnonboarded) redirect('/onboarding');
  const { data: subs } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  const isPro = hasProAccess(subs ?? []);
  return { supabase, user, profile: profile as Profile, subs: (subs ?? []) as Sub[], isPro, today: todayIn(profile.timezone) };
}
export type Ctx = Awaited<ReturnType<typeof requireCtx>>;

export const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
