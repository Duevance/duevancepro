'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { APP_URL, requireCtx, type Ctx } from '@/lib/session';
import { validateInvoiceForm } from '@/lib/validation';
import { FREE_ACTIVE_LIMIT, isFreePlanLimitError, PLAN_LIMIT_MESSAGE } from '@/lib/plan';
import { isValidCurrency } from '@/lib/money';
import { safeNext, validatePassword } from '@/lib/auth';
import { isValidTimezone } from '@/lib/dates';
import { guessMapping, missingRequired, parseCsv, validateRows, type Mapping, type RowIssue } from '@/lib/csv';
import { offerFor, isSupportedCountry } from '@/lib/pricing';
import { ensureRazorpayPlan } from '@/lib/billing/service';
import { createRazorpaySubscription, cancelRazorpay, fetchRazorpayState, verifyPaymentSignature } from '@/lib/billing/razorpay';
import { STAGES } from '@/lib/reminders';

export type FormState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; data?: Record<string, unknown> } | null;
const fail = (error: string, fieldErrors?: Record<string, string>): FormState => ({ ok: false, error, fieldErrors });

type EventName = 'signup_completed' | 'first_invoice_created' | 'first_csv_import' | 'first_reminder_action' | 'invoice_marked_paid' | 'free_limit_reached' | 'checkout_initiated' | 'subscription_activated' | 'subscription_cancelled';
async function track(ctx: Pick<Ctx, 'supabase' | 'user'>, name: EventName) { try { await ctx.supabase.from('product_events').insert({ user_id: ctx.user.id, name }); } catch { /* analytics must never break a request */ } }

/* ---------- auth (email + password) ---------- */
const emailOk = (e: string) => z.email().max(254).safeParse(e).success;
const readEmail = (fd: FormData) => String(fd.get('email') ?? '').trim().toLowerCase();
const authFail = (msg: string) => /rate|too many|seconds/i.test(msg) ? 'Too many attempts. Wait a minute and try again.' : null;

export async function signUp(_p: FormState, fd: FormData): Promise<FormState> {
  const email = readEmail(fd), password = String(fd.get('password') ?? '');
  if (!emailOk(email)) return fail('Enter a valid email address.', { email: 'Enter a valid email address.' });
  const pw = validatePassword(password, email); if (pw) return fail(pw, { password: pw });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${APP_URL()}/auth/callback` } });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return fail('An account with this email already exists. Sign in instead.');
    return fail(authFail(error.message) ?? (/password/i.test(error.message) ? 'That password was rejected. Try a longer, less common one.' : 'We could not create your account. Try again.'));
  }
  if (data.session) redirect('/onboarding'); // email confirmation is switched off in Supabase
  return { ok: true, message: `We sent a confirmation link to ${email}. Open it to activate your account, then sign in.` };
}
export async function signIn(_p: FormState, fd: FormData): Promise<FormState> {
  const email = readEmail(fd), password = String(fd.get('password') ?? '');
  if (!emailOk(email) || !password) return fail('Enter your email and password.');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/not confirmed/i.test(error.message)) return fail('Confirm your email first. Check your inbox for the confirmation link.');
    return fail(authFail(error.message) ?? 'Incorrect email or password.');
  }
  redirect(safeNext(String(fd.get('next') ?? '')));
}
export async function requestPasswordReset(_p: FormState, fd: FormData): Promise<FormState> {
  const email = readEmail(fd);
  if (!emailOk(email)) return fail('Enter a valid email address.', { email: 'Enter a valid email address.' });
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${APP_URL()}/auth/recovery` });
  if (error && authFail(error.message)) return fail(authFail(error.message)!);
  return { ok: true, message: 'If an account exists for that email, a reset link is on its way. It expires soon and works once.' }; // same answer either way: no account enumeration
}
/** Used on the reset page, where the emailed link has already created a recovery session. */
export async function setNewPassword(_p: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('This reset link has expired. Request a new one.');
  const password = String(fd.get('password') ?? ''); const pw = validatePassword(password, user.email ?? ''); if (pw) return fail(pw, { password: pw });
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(/same/i.test(error.message) ? 'Choose a password you have not used before.' : 'Could not update your password. Request a new link and try again.');
  redirect('/dashboard');
}
/** Confirms the password by signing in on a throwaway client that never touches the user's cookies. */
async function passwordIsCorrect(email: string, password: string): Promise<boolean> {
  if (!password) return false;
  const probe = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  return !error;
}
export async function changePassword(_p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  if (!(await passwordIsCorrect(ctx.user.email ?? '', String(fd.get('current') ?? '')))) return fail('Your current password is not correct.', { current: 'Your current password is not correct.' });
  const password = String(fd.get('password') ?? ''); const pw = validatePassword(password, ctx.user.email ?? ''); if (pw) return fail(pw, { password: pw });
  const { error } = await ctx.supabase.auth.updateUser({ password });
  return error ? fail('Could not update your password. Try again.') : { ok: true, message: 'Password updated.' };
}

/* ---------- profile / onboarding ---------- */
const profileSchema = z.object({
  business_name: z.string().trim().max(120),
  default_currency: z.string().trim().toUpperCase().refine(isValidCurrency, 'Choose a valid currency.'),
  timezone: z.string().trim().refine(isValidTimezone, 'Choose a valid timezone.'),
});
export async function saveProfile(_p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx({ allowUnonboarded: true });
  const parsed = profileSchema.safeParse({ business_name: fd.get('business_name') ?? '', default_currency: fd.get('default_currency'), timezone: fd.get('timezone') });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const first = !ctx.profile.onboarded_at;
  const { error } = await ctx.supabase.from('profiles').update({ ...parsed.data, onboarded_at: ctx.profile.onboarded_at ?? new Date().toISOString() }).eq('user_id', ctx.user.id);
  if (error) return fail('Could not save your settings. Try again.');
  if (first) await track(ctx, 'signup_completed');
  revalidatePath('/', 'layout');
  const next = String(fd.get('next') ?? '');
  if (first && ['/invoices/new', '/import', '/dashboard'].includes(next)) redirect(next);
  return { ok: true, message: 'Settings saved.' };
}

/* ---------- invoices ---------- */
export async function saveInvoice(_p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const v = validateInvoiceForm(fd);
  if (!v.ok) return fail('Fix the highlighted fields.', v.errors);
  const id = String(fd.get('id') ?? '');
  const q = id ? ctx.supabase.from('invoices').update(v.value).eq('id', id).eq('user_id', ctx.user.id).select('id') : ctx.supabase.from('invoices').insert({ ...v.value, user_id: ctx.user.id }).select('id');
  const { data, error } = await q;
  if (error) {
    if (isFreePlanLimitError(error)) { await track(ctx, 'free_limit_reached'); return fail(PLAN_LIMIT_MESSAGE); }
    if (error.code === '23505') return fail('You already have an invoice with this number.', { invoice_no: 'This invoice number is already used.' });
    return fail('Could not save the invoice. Try again.');
  }
  if (!data?.length) return fail('Invoice not found.');
  if (!id) await track(ctx, 'first_invoice_created');
  revalidatePath('/invoices'); revalidatePath('/dashboard');
  redirect('/invoices?saved=1');
}

async function mutate(id: string, patch: Record<string, unknown>, log?: 'marked_paid', event?: EventName) {
  const ctx = await requireCtx();
  const { data, error } = await ctx.supabase.from('invoices').update(patch).eq('id', id).eq('user_id', ctx.user.id).select('id');
  if (error) { if (isFreePlanLimitError(error)) { await track(ctx, 'free_limit_reached'); return PLAN_LIMIT_MESSAGE; } return 'Could not update the invoice.'; }
  if (!data?.length) return 'Invoice not found.';
  if (log) await ctx.supabase.from('reminders_log').insert({ user_id: ctx.user.id, invoice_id: id, action_type: log });
  if (event) await track(ctx, event);
  revalidatePath('/invoices'); revalidatePath('/dashboard'); revalidatePath('/activity');
  return null;
}
export async function markPaid(_p: FormState, fd: FormData): Promise<FormState> { const e = await mutate(String(fd.get('id')), { status: 'paid', paid_at: new Date().toISOString() }, 'marked_paid', 'invoice_marked_paid'); return e ? fail(e) : { ok: true, message: 'Marked as paid.' }; }
export async function reopenInvoice(_p: FormState, fd: FormData): Promise<FormState> { const e = await mutate(String(fd.get('id')), { status: 'open', paid_at: null }); return e ? fail(e) : { ok: true, message: 'Invoice reopened.' }; }
export async function archiveInvoice(_p: FormState, fd: FormData): Promise<FormState> { const e = await mutate(String(fd.get('id')), { archived_at: new Date().toISOString() }); return e ? fail(e) : { ok: true, message: 'Archived.' }; }
export async function restoreInvoice(_p: FormState, fd: FormData): Promise<FormState> { const e = await mutate(String(fd.get('id')), { archived_at: null }); return e ? fail(e) : { ok: true, message: 'Restored.' }; }
export async function deleteInvoice(_p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { error } = await ctx.supabase.from('invoices').delete().eq('id', String(fd.get('id'))).eq('user_id', ctx.user.id);
  if (error) return fail('Could not delete the invoice.');
  revalidatePath('/invoices'); revalidatePath('/dashboard'); redirect('/invoices?deleted=1');
}

/* ---------- reminders ---------- */
const logSchema = z.object({ invoiceId: z.uuid(), action: z.enum(['prepared', 'link_opened', 'copied', 'marked_sent']), channel: z.enum(['email', 'whatsapp', 'copy']).nullable(), stage: z.enum(STAGES) });
/** Records what the user did. Only 'marked_sent' (explicit confirmation) carries a sent_at timestamp. */
export async function logReminder(input: z.input<typeof logSchema>): Promise<{ ok: boolean }> {
  const ctx = await requireCtx(); const p = logSchema.safeParse(input); if (!p.success) return { ok: false };
  const { error } = await ctx.supabase.from('reminders_log').insert({ user_id: ctx.user.id, invoice_id: p.data.invoiceId, action_type: p.data.action, channel: p.data.channel, stage: p.data.stage, sent_at: p.data.action === 'marked_sent' ? new Date().toISOString() : null });
  if (error) return { ok: false };
  await track(ctx, 'first_reminder_action'); revalidatePath('/activity'); revalidatePath('/dashboard');
  return { ok: true };
}
export async function saveTemplate(_p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  if (!ctx.isPro) return fail('Saving custom templates is part of the Pro plan.');
  const p = z.object({ stage: z.enum(STAGES), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(4000) }).safeParse({ stage: fd.get('stage'), subject: fd.get('subject'), body: fd.get('body') });
  if (!p.success) return fail('Add a subject and a message (under 4000 characters).');
  const { error } = await ctx.supabase.from('reminder_templates').upsert({ user_id: ctx.user.id, ...p.data }, { onConflict: 'user_id,stage' });
  return error ? fail('Could not save the template.') : { ok: true, message: 'Template saved for this tone.' };
}
export async function resetTemplate(_p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx(); const stage = String(fd.get('stage'));
  await ctx.supabase.from('reminder_templates').delete().eq('user_id', ctx.user.id).eq('stage', stage);
  return { ok: true, message: 'Reset to the default template.' };
}

/* ---------- CSV import ---------- */
async function analyse(ctx: Ctx, text: string, mappingJson: string) {
  const parsed = parseCsv(text); if (parsed.error) return { error: parsed.error } as const;
  let mapping: Mapping = guessMapping(parsed.headers);
  try { const m = JSON.parse(mappingJson || '{}'); if (m && typeof m === 'object') mapping = Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === 'string' && parsed.headers.includes(v as string))) as Mapping; } catch { /* keep guess */ }
  const missing = missingRequired(mapping);
  const { data: existing } = await ctx.supabase.from('invoices').select('invoice_key').eq('user_id', ctx.user.id);
  const v = validateRows(parsed.rows, mapping, { defaultCurrency: ctx.profile.default_currency, existingKeys: new Set((existing ?? []).map(r => r.invoice_key as string)) });
  return { parsed, mapping, missing, v } as const;
}
export async function previewImport(text: string, mappingJson: string) {
  const ctx = await requireCtx(); const a = await analyse(ctx, text, mappingJson);
  if ('error' in a) return { error: a.error };
  return { headers: a.parsed.headers, mapping: a.mapping, missing: a.missing, total: a.v.total, validCount: a.v.valid.length, sample: a.v.valid.slice(0, 8).map(x => ({ line: x.line, ...x.row })), issues: a.v.issues.slice(0, 200), issueCount: a.v.issues.length };
}
export type ImportResult = { error?: string; inserted?: number; duplicates?: number; invalid?: number; limited?: number; issues?: RowIssue[] };
export async function commitImport(text: string, mappingJson: string): Promise<ImportResult> {
  const ctx = await requireCtx(); const a = await analyse(ctx, text, mappingJson);
  if ('error' in a) return { error: a.error };
  if (a.missing.length) return { error: 'Map all required columns first.' };
  const issues: RowIssue[] = [...a.v.issues]; let rows = a.v.valid; let limited = 0;
  if (!ctx.isPro) {
    const { count } = await ctx.supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', ctx.user.id).eq('status', 'open').is('archived_at', null);
    let room = Math.max(0, FREE_ACTIVE_LIMIT - (count ?? 0)); const keep: typeof rows = [];
    for (const r of rows) { if (r.row.status === 'paid') keep.push(r); else if (room > 0) { room--; keep.push(r); } else { limited++; issues.push({ line: r.line, invoice_no: r.row.invoice_no, kind: 'error', messages: [`Not imported: ${PLAN_LIMIT_MESSAGE}`] }); } }
    rows = keep; if (limited) await track(ctx, 'free_limit_reached');
  }
  let inserted = 0; let raced = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const payload = chunk.map(r => ({ ...r.row, user_id: ctx.user.id, paid_at: r.row.status === 'paid' ? new Date().toISOString() : null }));
    const { data, error } = await ctx.supabase.from('invoices').upsert(payload, { onConflict: 'user_id,invoice_key', ignoreDuplicates: true }).select('id');
    if (error) { if (isFreePlanLimitError(error)) { limited += chunk.length; chunk.forEach(r => issues.push({ line: r.line, invoice_no: r.row.invoice_no, kind: 'error', messages: [`Not imported: ${PLAN_LIMIT_MESSAGE}`] })); continue; } return { error: 'The import stopped because of a database error. Rows already imported are kept; run the import again to continue (duplicates are skipped).', inserted }; }
    inserted += data?.length ?? 0; raced += chunk.length - (data?.length ?? 0);
  }
  if (inserted) await track(ctx, 'first_csv_import');
  revalidatePath('/invoices'); revalidatePath('/dashboard');
  return { inserted, duplicates: a.v.issues.filter(i => i.kind === 'duplicate').length + raced, invalid: a.v.issues.filter(i => i.kind === 'error').length, limited, issues: issues.sort((x, y) => x.line - y.line).slice(0, 300) };
}

/* ---------- sample data ---------- */
export async function loadSampleData(): Promise<FormState> {
  const ctx = await requireCtx({ allowUnonboarded: true });
  const d = (n: number) => { const t = new Date(`${ctx.today}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const c = ctx.profile.default_currency;
  const rows = [
    ['Sample: Northwind Studio', 'INV-S-1001', 1850, c, -45], ['Sample: Harbor & Co', 'INV-S-1002', 640, c, -18], ['Sample: Bluebird Labs', 'INV-S-1003', 2200, c, -5],
    ['Sample: Fieldnote Ltd', 'INV-S-1004', 980, c, 3], ['Sample: Orchard Works', 'INV-S-1005', 1500, c, 21],
  ].map(([n, no, amt, cur, due]) => ({ user_id: ctx.user.id, customer_name: n as string, customer_email: 'billing@sample.invalid', invoice_no: no as string, amount: amt as number, currency: cur as string, issue_date: d((due as number) - 30), due_date: d(due as number), is_sample: true }));
  const { error } = await ctx.supabase.from('invoices').upsert(rows, { onConflict: 'user_id,invoice_key', ignoreDuplicates: true });
  if (error) return fail(isFreePlanLimitError(error) ? PLAN_LIMIT_MESSAGE : 'Could not add sample data.');
  revalidatePath('/dashboard'); revalidatePath('/invoices'); redirect('/dashboard');
}
export async function removeSampleData(): Promise<FormState> {
  const ctx = await requireCtx(); await ctx.supabase.from('invoices').delete().eq('user_id', ctx.user.id).eq('is_sample', true);
  revalidatePath('/dashboard'); revalidatePath('/invoices'); return { ok: true, message: 'Sample data removed.' };
}

/* ---------- billing (Razorpay, INR and USD) ---------- */
const billingReady = () => !!(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function startCheckout(_p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  if (ctx.isPro) return fail('You already have an active Pro plan.');
  if (ctx.subs.some(s => s.status === 'pending' && Date.now() - new Date(s.created_at).getTime() < 3600_000)) return fail('A checkout is already in progress. Use “Refresh status” on the Billing page, or try again in an hour.');
  const country = String(fd.get('country') ?? '').toUpperCase();
  if (!isSupportedCountry(country)) return fail('Choose your billing country.');
  const offer = offerFor(country);
  if (!billingReady()) return fail('Checkout is not configured on this deployment yet. Contact support.');
  await ctx.supabase.from('profiles').update({ billing_country: country }).eq('user_id', ctx.user.id);
  await track(ctx, 'checkout_initiated');
  try {
    const planId = await ensureRazorpayPlan(offer.currency, offer.amount);
    const s = await createRazorpaySubscription(ctx.user.id, planId);
    const { error } = await createAdminClient().from('subscriptions').insert({ user_id: ctx.user.id, provider: 'razorpay', provider_subscription_id: s.id, status: 'pending' });
    if (error) return fail('We could not start checkout. Nothing was charged. Try again.');
    return { ok: true, data: { razorpay: { subscriptionId: s.id, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, email: ctx.user.email } } };
  } catch { return fail(offer.currency === 'USD' ? 'We could not start checkout in USD. International payments may not be enabled on this Razorpay account yet. Nothing was charged.' : 'We could not start checkout. Nothing was charged. Try again in a moment or contact support.'); }
}
/** Called after the Razorpay modal succeeds. It checks the payment signature, then re-reads the subscription from Razorpay. Pro is never granted from the browser's say-so. */
export async function confirmRazorpayCheckout(paymentId: string, subscriptionId: string, signature: string): Promise<FormState> {
  const ctx = await requireCtx();
  if (!verifyPaymentSignature(paymentId, subscriptionId, signature, process.env.RAZORPAY_KEY_SECRET)) return fail('We could not verify the payment. If you were charged, contact support with your payment ID.');
  if (!ctx.subs.some(s => s.provider === 'razorpay' && s.provider_subscription_id === subscriptionId)) return fail('That subscription does not belong to this account.');
  return syncSubscription();
}
export async function syncSubscription(): Promise<FormState> {
  const ctx = await requireCtx(); const admin = createAdminClient(); let changed = 0;
  for (const s of ctx.subs.filter(x => x.provider === 'razorpay' && ['pending', 'active', 'past_due'].includes(x.status))) {
    try {
      const st = await fetchRazorpayState(s.provider_subscription_id);
      const patch: Record<string, unknown> = { status: st.status }; if (st.currentPeriodEnd) patch.current_period_end = st.currentPeriodEnd;
      await admin.from('subscriptions').update(patch).eq('id', s.id).eq('user_id', ctx.user.id); changed++;
      if (st.status === 'active' && s.status !== 'active') await track(ctx, 'subscription_activated');
    } catch { /* provider unreachable: leave as is */ }
  }
  revalidatePath('/billing');
  return { ok: true, message: changed ? 'Billing status refreshed.' : 'No pending subscription to refresh.' };
}
export async function cancelSubscription(): Promise<FormState> {
  const ctx = await requireCtx(); const s = ctx.subs.find(x => x.provider === 'razorpay' && (x.status === 'active' || x.status === 'past_due'));
  if (!s) return fail('There is no active subscription to cancel.');
  const admin = createAdminClient();
  try {
    const before = await fetchRazorpayState(s.provider_subscription_id);
    if (before.currentPeriodEnd) await admin.from('subscriptions').update({ current_period_end: before.currentPeriodEnd }).eq('id', s.id); // remember the paid-through date
    await cancelRazorpay(s.provider_subscription_id, true); // cancels at the end of the paid cycle
    await admin.from('subscriptions').update({ cancel_requested_at: new Date().toISOString() }).eq('id', s.id).eq('user_id', ctx.user.id);
    await track(ctx, 'subscription_cancelled');
  } catch { return fail('We could not cancel with Razorpay. Nothing was changed. Try again or contact support.'); }
  revalidatePath('/billing'); return { ok: true, message: 'Cancellation scheduled. Pro stays active until the end of the paid period.' };
}

/* ---------- account deletion ---------- */
export async function deleteAccount(_p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  if (String(fd.get('confirm') ?? '').trim().toLowerCase() !== (ctx.user.email ?? '').toLowerCase()) return fail('Type your account email exactly to confirm.', { confirm: 'Type your account email exactly.' });
  if (!(await passwordIsCorrect(ctx.user.email ?? '', String(fd.get('password') ?? '')))) return fail('Your password is not correct.', { password: 'Your password is not correct.' }); // re-authentication
  for (const s of ctx.subs.filter(x => x.provider === 'razorpay' && ['active', 'past_due', 'pending'].includes(x.status))) { try { await cancelRazorpay(s.provider_subscription_id, false); } catch { /* best effort; the subscription may already be over */ } }
  const { error } = await createAdminClient().auth.admin.deleteUser(ctx.user.id); // cascades to every table
  if (error) return fail('Could not delete the account. Nothing was removed. Contact support.');
  const supabase = await createClient(); await supabase.auth.signOut();
  redirect('/?deleted=1');
}