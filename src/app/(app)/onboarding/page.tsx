import { redirect } from 'next/navigation';
import { requireCtx } from '@/lib/session';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { saveProfile } from '@/app/actions';
import { supportedCurrencies } from '@/lib/money';
import { COMMON_TIMEZONES } from '@/lib/dates';
export const metadata = { title: 'Welcome' };

export default async function Onboarding() {
  const { profile } = await requireCtx({ allowUnonboarded: true });
  if (profile.onboarded_at) redirect('/dashboard');
  const guess = 'UTC';
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head"><div><h1>Welcome to Duevance</h1><p>Duevance helps you see which invoices are unpaid and prepare polite follow-ups. It never sends messages for you. Two quick settings, then you are in.</p></div></div>
      <ActionForm action={saveProfile} className="panel">
        <Field name="business_name" label="Business name" hint="Optional. It signs your reminders." maxLength={120} />
        <Field name="default_currency" label="Default currency"><select id="f-default_currency" name="default_currency" defaultValue="USD">{supportedCurrencies().map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field name="timezone" label="Timezone" hint="Decides when an invoice becomes overdue."><select id="f-timezone" name="timezone" defaultValue={guess}>{COMMON_TIMEZONES.map(z => <option key={z}>{z}</option>)}</select></Field>
        <fieldset style={{ border: 0, padding: 0, margin: '0 0 18px' }}><legend style={{ fontWeight: 600, marginBottom: 8 }}>What would you like to do first?</legend>
          {[['/dashboard', 'Look around first'], ['/invoices/new', 'Add an invoice'], ['/import', 'Import a CSV']].map(([v, l], i) => <label key={v} style={{ display: 'flex', gap: 10, padding: '6px 0' }}><input type="radio" name="next" value={v} defaultChecked={i === 0} /> {l}</label>)}</fieldset>
        <SubmitButton pending="Saving…">Continue</SubmitButton></ActionForm>
    </div>
  );
}
