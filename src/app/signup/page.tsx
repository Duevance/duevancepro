import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { ActionForm, Field, PasswordField, SubmitButton } from '@/components/forms';
import { signUp } from '@/app/actions';
export const metadata = { title: 'Create your account' };
export default function Signup() {
  return (
    <AuthShell>
      <ActionForm action={signUp}>
        <h1 style={{ fontSize: '2.2rem', letterSpacing: '-.03em' }}>Create your account</h1>
        <p className="muted">Free for up to 10 active invoices. No card needed.</p>
        <Field name="email" label="Email address" type="email" required autoComplete="email" inputMode="email" />
        <PasswordField autoComplete="new-password" hint="At least 8 characters." />
        <SubmitButton pending="Creating account…">Create account</SubmitButton>
        <p className="small muted" style={{ marginTop: 18 }}>By continuing you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
        <p className="small muted">Already have an account? <Link href="/login">Sign in</Link></p>
      </ActionForm>
    </AuthShell>
  );
}
