import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const runtime = 'nodejs';

/** Full personal-data export (JSON). Available on every plan. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const [profile, invoices, reminders, subscriptions, templates] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id), supabase.from('invoices').select('*').eq('user_id', user.id),
    supabase.from('reminders_log').select('*').eq('user_id', user.id), supabase.from('subscriptions').select('provider,provider_subscription_id,plan,status,current_period_end,created_at').eq('user_id', user.id),
    supabase.from('reminder_templates').select('*').eq('user_id', user.id),
  ]);
  const body = JSON.stringify({ exported_at: new Date().toISOString(), account: { id: user.id, email: user.email }, profile: profile.data, invoices: invoices.data, reminders_log: reminders.data, subscriptions: subscriptions.data, reminder_templates: templates.data }, null, 2);
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="duevance-account-data.json"', 'Cache-Control': 'no-store' } });
}
