'use client';
import { useMemo, useState } from 'react';
import { logReminder, saveTemplate, resetTemplate } from '@/app/actions';
import { ActionForm, SubmitButton } from './forms';
import { STAGES, STAGE_LABEL, buildMessage, mailtoUrl, whatsappUrl, type Stage, type Vars } from '@/lib/reminders';

type T = { subject: string; body: string };
export function Composer({ invoiceId, vars, email, phone, initialStage, custom, isPro }: { invoiceId: string; vars: Vars; email: string | null; phone: string | null; initialStage: Stage; custom: Partial<Record<Stage, T>>; isPro: boolean }) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const initial = (s: Stage) => buildMessage(s, vars, custom[s] ?? null);
  const [msg, setMsg] = useState(initial(initialStage));
  const [note, setNote] = useState<string | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'copy'>(email ? 'email' : 'whatsapp');
  const mail = useMemo(() => (email ? mailtoUrl(email, msg.subject, msg.body) : null), [email, msg]);
  const wa = useMemo(() => whatsappUrl(phone, msg.body), [phone, msg.body]);

  function pick(s: Stage) { setStage(s); setMsg(initial(s)); setNote(null); }
  async function record(action: 'link_opened' | 'copied' | 'marked_sent', ch: 'email' | 'whatsapp' | 'copy') {
    if (!prepared) { setPrepared(true); await logReminder({ invoiceId, action: 'prepared', channel: null, stage }); }
    return logReminder({ invoiceId, action, channel: ch, stage });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(`${msg.subject}\n\n${msg.body}`); await record('copied', 'copy'); setNote('Message copied to your clipboard.'); }
    catch { setNote('Your browser blocked copying. Select the text and copy it manually.'); }
  }
  async function markSent() {
    if (!window.confirm(`Record this reminder as sent via ${channel}? Only confirm if you actually sent it.`)) return;
    const r = await record('marked_sent', channel); setNote(r.ok ? 'Recorded as sent by you. It now appears in your activity history.' : 'Could not record that. Try again.');
  }
  return (
    <div className="composer">
      <section className="panel" aria-labelledby="c1"><h2 id="c1">Message</h2>
        <div className="tones" role="group" aria-label="Tone">{STAGES.map(s => <button key={s} type="button" aria-pressed={stage === s} onClick={() => pick(s)}>{STAGE_LABEL[s]}</button>)}</div>
        <div className="field"><label htmlFor="subj">Subject</label><input id="subj" value={msg.subject} onChange={e => setMsg({ ...msg, subject: e.target.value })} /></div>
        <div className="field"><label htmlFor="body">Message</label><textarea id="body" style={{ minHeight: 280 }} value={msg.body} onChange={e => setMsg({ ...msg, body: e.target.value })} /><p className="hint">Edit freely. Nothing is sent from Duevance. You send it from your own email or WhatsApp.</p></div>
        {isPro ? (
          <ActionForm action={saveTemplate} className="notice notice-info">
            <input type="hidden" name="stage" value={stage} /><input type="hidden" name="subject" value={custom[stage]?.subject ?? ''} /><input type="hidden" name="body" value={custom[stage]?.body ?? ''} />
            <p className="small" style={{ margin: '0 0 8px' }}>Custom templates keep placeholders such as {'{{customer_name}}'}, {'{{invoice_no}}'}, {'{{amount}}'} and {'{{due_date}}'}. Edit the template text below, then save it for the {STAGE_LABEL[stage].toLowerCase()} tone.</p>
            <TemplateEditor stage={stage} custom={custom[stage]} />
          </ActionForm>
        ) : <p className="notice notice-info small">Pro lets you save your own templates for each tone. <a href="/billing">See Pro</a></p>}
        {isPro && custom[stage] && <ActionForm action={resetTemplate}><input type="hidden" name="stage" value={stage} /><SubmitButton className="btn btn-quiet btn-sm">Reset to default template</SubmitButton></ActionForm>}
      </section>
      <section className="panel" aria-labelledby="c2"><h2 id="c2">Send it</h2>
        <p className="muted small">These buttons open your own apps with the message filled in. Duevance cannot tell if you press send.</p>
        <div className="actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {mail ? <a className="btn btn-primary" href={mail} onClick={() => { void record('link_opened', 'email'); setNote('Your email app should open with a draft. Duevance cannot confirm it was sent.'); }}>Open email draft</a> : <button className="btn btn-primary" disabled>Open email draft (no customer email)</button>}
          {wa ? <a className="btn btn-ink" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => { void record('link_opened', 'whatsapp'); setNote('WhatsApp should open in a new tab. Duevance cannot confirm it was sent.'); }}>Open in WhatsApp</a> : <button className="btn btn-ink" disabled>{phone ? 'WhatsApp needs a country code (+…)' : 'WhatsApp (no customer phone)'}</button>}
          <button type="button" className="btn btn-line" onClick={copy}>Copy message</button>
        </div>
        {note && <p className="notice notice-info" role="status">{note}</p>}
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '22px 0' }} />
        <h3>After you send it</h3>
        <div className="field"><label htmlFor="ch">Sent via</label><select id="ch" value={channel} onChange={e => setChannel(e.target.value as typeof channel)}><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="copy">Another way</option></select></div>
        <button type="button" className="btn btn-quiet" onClick={markSent}>I sent this reminder</button>
      </section>
    </div>
  );
}

import { DEFAULT_TEMPLATES } from '@/lib/reminders';
function TemplateEditor({ stage, custom }: { stage: Stage; custom?: T }) {
  const t = custom ?? DEFAULT_TEMPLATES[stage];
  return (
    <div key={stage + (custom ? 'c' : 'd')}>
      <div className="field"><label htmlFor="tsub">Template subject</label><input id="tsub" name="subject" defaultValue={t.subject} /></div>
      <div className="field"><label htmlFor="tbody">Template message</label><textarea id="tbody" name="body" defaultValue={t.body} /></div>
      <SubmitButton className="btn btn-quiet btn-sm">Save as my template</SubmitButton>
    </div>
  );
}
