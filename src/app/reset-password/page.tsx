import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { ActionForm, PasswordField, SubmitButton } from '@/components/forms';
import { setNewPassword } from '@/app/actions';
import { createClient } from '@/lib/supabase/server';
export const metadata = { title: 'Choose a new password' };
export default async function ResetPassword() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=expired');
  return (
    <AuthShell>
      <ActionForm action={setNewPassword}>
        <h1 style={{ fontSize: '2.2rem', letterSpacing: '-.03em' }}>Choose a new password</h1>
        <p className="muted">For {user.email}.</p>
        <PasswordField label="New password" autoComplete="new-password" hint="At least 8 characters." />
        <SubmitButton pending="Saving…">Update password</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
