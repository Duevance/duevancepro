import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasProAccess } from '@/lib/plan';
import { toCsv } from '@/lib/csv';
export const runtime = 'nodejs';
const COLS = ['invoice_no', 'customer_name', 'customer_email', 'customer_phone', 'amount', 'currency', 'issue_date', 'due_date', 'status', 'paid_at', 'archived_at', 'invoice_url', 'notes', 'created_at', 'updated_at'];

/** Invoice CSV export is a Pro feature, enforced here on the server. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const { data: subs } = await supabase.from('subscriptions').select('status,current_period_end').eq('user_id', user.id);
  if (!hasProAccess(subs ?? [])) return NextResponse.json({ error: 'CSV export is part of the Pro plan.' }, { status: 403 });
  const { data, error } = await supabase.from('invoices').select(COLS.join(',')).eq('user_id', user.id).order('due_date');
  if (error) return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  return new NextResponse(toCsv((data ?? []) as unknown as Record<string, unknown>[], COLS), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="duevance-invoices.csv"', 'Cache-Control': 'no-store' } });
}
