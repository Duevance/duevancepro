import { requireCtx } from '@/lib/session';
import { ActionForm, Field, PasswordField, SubmitButton } from '@/components/forms';
import { changePassword, deleteAccount, saveProfile } from '@/app/actions';
import { supportedCurrencies } from '@/lib/money';
import { COMMON_TIMEZONES } from '@/lib/dates';
export const metadata = { title: 'Settings' };

export default async function Settings() {
  const { profile, user, isPro } = await requireCtx();
  const zones = [...new Set([profile.timezone, ...COMMON_TIMEZONES])];
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p>Signed in as {user.email}</p></div></div>
      <div className="cols"><div className="span-6">
        <ActionForm action={saveProfile} className="panel"><h2>Business</h2>
          <Field name="business_name" label="Business name" defaultValue={profile.business_name} hint="Used to sign your reminders." maxLength={120} />
          <Field name="default_currency" label="Default currency"><select id="f-default_currency" name="default_currency" defaultValue={profile.default_currency}>{supportedCurrencies().map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field name="timezone" label="Timezone" hint="Decides when an invoice becomes overdue."><select id="f-timezone" name="timezone" defaultValue={profile.timezone}>{zones.map(z => <option key={z}>{z}</option>)}</select></Field>
          <SubmitButton pending="Saving…">Save settings</SubmitButton></ActionForm></div>
        <div className="span-6">
          <section className="panel"><h2>Your data</h2><p className="muted">Download everything Duevance holds about you as JSON: profile, invoices, activity, templates and subscription records.</p><a className="btn btn-line" href="/api/account/export">Download my data</a>
            <p className="small muted" style={{ marginTop: 14 }}>{isPro ? <>Invoice spreadsheet: <a href="/api/export">export invoices as CSV</a>.</> : 'CSV export of invoices is part of Pro.'}</p></section>
          <ActionForm action={changePassword} className="panel" ><h2>Password</h2>
            <PasswordField name="current" label="Current password" autoComplete="current-password" />
            <PasswordField label="New password" autoComplete="new-password" hint="At least 8 characters." />
            <SubmitButton pending="Updating…">Change password</SubmitButton></ActionForm>
          <ActionForm action={deleteAccount} className="panel" confirm="This permanently deletes your account and all invoices. This cannot be undone. Continue?" ><h2>Delete account</h2>
            <p className="muted">Permanently deletes your profile, invoices, history and templates, and cancels any active subscription. For your security, confirm with your password.</p>
            <Field name="confirm" label={`Type ${user.email} to confirm`} autoComplete="off" />
            <PasswordField label="Your password" autoComplete="current-password" />
            <SubmitButton className="btn btn-danger" pending="Deleting…">Delete my account</SubmitButton></ActionForm></div></div>
    </>
  );
}
