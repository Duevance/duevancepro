'use client';
import { createContext, useActionState, useContext, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/app/actions';

const Ctx = createContext<FormState>(null);

export function SubmitButton({ children, pending: pendingLabel, className = 'btn btn-primary' }: { children: ReactNode; pending?: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-busy={pending}>{pending ? (pendingLabel ?? 'Working…') : children}</button>;
}

export function ActionForm({ action, children, className, confirm, resetOnSuccess, onResult }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>; children: ReactNode; className?: string; confirm?: string; resetOnSuccess?: boolean; onResult?: (s: FormState) => void;
}) {
  const [state, run] = useActionState(async (s: FormState, fd: FormData) => { const r = await action(s, fd); onResult?.(r); return r; }, null);
  return (
    <Ctx.Provider value={state}>
      <form action={run} className={className} noValidate onSubmit={e => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} key={resetOnSuccess && state?.ok ? 'ok' : 'form'}>
        {children}
        <div aria-live="polite" className="status-region">
          {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
          {state?.ok && state.message && <p className="notice notice-ok" role="status">{state.message}</p>}
        </div>
      </form>
    </Ctx.Provider>
  );
}

export function Field({ name, label, hint, children, defaultValue, type = 'text', required, ...rest }: {
  name: string; label: string; hint?: string; children?: ReactNode; defaultValue?: string | number | null; type?: string; required?: boolean; [k: string]: unknown;
}) {
  const state = useContext(Ctx); const err = state?.fieldErrors?.[name];
  const id = `f-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && <span className="req"> (required)</span>}</label>
      {children ?? <input id={id} name={name} type={type} defaultValue={defaultValue ?? ''} required={required} aria-invalid={!!err} aria-describedby={err ? `${id}-e` : hint ? `${id}-h` : undefined} {...rest} />}
      {hint && !err && <p className="hint" id={`${id}-h`}>{hint}</p>}
      {err && <p className="field-error" id={`${id}-e`}>{err}</p>}
    </div>
  );
}

/** Small inline form for one-click row actions (mark paid, archive…). */
export function QuickAction({ action, id, label, confirm, className = 'btn btn-quiet btn-sm' }: { action: (s: FormState, fd: FormData) => Promise<FormState>; id: string; label: string; confirm?: string; className?: string }) {
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} onSubmit={e => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <SubmitButton className={className} pending="…">{label}</SubmitButton>
      {state?.error && <span className="notice notice-error inline" role="alert">{state.error}</span>}
    </form>
  );
}

export function PasswordField({ name = 'password', label = 'Password', autoComplete, hint }: { name?: string; label?: string; autoComplete: 'current-password' | 'new-password'; hint?: string }) {
  const state = useContext(Ctx); const err = state?.fieldErrors?.[name]; const [show, setShow] = useState(false); const id = `f-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} required aria-invalid={!!err} aria-describedby={err ? `${id}-e` : hint ? `${id}-h` : undefined} minLength={autoComplete === 'new-password' ? 8 : undefined} maxLength={72} />
      <label className="show-pw"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Show password</label>
      {hint && !err && <p className="hint" id={`${id}-h`}>{hint}</p>}
      {err && <p className="field-error" id={`${id}-e`}>{err}</p>}
    </div>
  );
}
