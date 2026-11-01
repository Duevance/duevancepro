import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { requestPasswordReset } from '@/app/actions';
export const metadata = { title: 'Reset your password' };
export default function Forgot() {
  return (
    <AuthShell>
      <ActionForm action={requestPasswordReset}>
        <h1 style={{ fontSize: '2.2rem', letterSpacing: '-.03em' }}>Reset your password</h1>
        <p className="muted">Enter your email and we will send a link to choose a new password.</p>
        <Field name="email" label="Email address" type="email" required autoComplete="email" inputMode="email" />
        <SubmitButton pending="Sending…">Send reset link</SubmitButton>
        <p className="small muted" style={{ marginTop: 18 }}><Link href="/login">Back to sign in</Link></p>
      </ActionForm>
    </AuthShell>
  );
}
