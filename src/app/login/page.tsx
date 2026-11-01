import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { ActionForm, Field, PasswordField, SubmitButton } from '@/components/forms';
import { signIn } from '@/app/actions';
import { safeNext } from '@/lib/auth';
export const metadata = { title: 'Sign in' };
const ERRORS: Record<string, string> = {
  expired: 'That link has expired or was already used. Request a new one, or sign in with your password.',
  invalid: 'That link is not valid. Request a new one, or sign in with your password.',
  config: 'Sign-in is not configured on this deployment yet.',
};
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; reset?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthShell>
      <ActionForm action={signIn}>
        <h1 style={{ fontSize: '2.2rem', letterSpacing: '-.03em' }}>Sign in</h1>
        <p className="muted">Welcome back. Use your email and password.</p>
        {sp.error && <p className="notice notice-error" role="alert">{ERRORS[sp.error] ?? ERRORS.invalid}</p>}
        <input type="hidden" name="next" value={safeNext(sp.next)} />
        <Field name="email" label="Email address" type="email" required autoComplete="email" inputMode="email" />
        <PasswordField autoComplete="current-password" />
        <SubmitButton pending="Signing in…">Sign in</SubmitButton>
        <p className="small" style={{ marginTop: 18 }}><Link href="/forgot-password">Forgot your password?</Link></p>
        <p className="small muted">New to Duevance? <Link href="/signup">Create an account</Link></p>
      </ActionForm>
    </AuthShell>
  );
}
