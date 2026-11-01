'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { commitImport, previewImport, type ImportResult } from '@/app/actions';
import type { RowIssue } from '@/lib/csv';
import { FIELDS, FIELD_LABEL, REQUIRED, MAX_CSV_BYTES, type Field } from '@/lib/csv';
import { formatMoney } from '@/lib/money';

type Preview = { headers: string[]; mapping: Record<string, string>; missing: string[]; total: number; validCount: number; issueCount: number;
  sample: { line: number; customer_name: string; invoice_no: string; due_date: string; status: string; amount: number; currency: string }[]; issues: RowIssue[] };
type Step = 'upload' | 'map' | 'preview' | 'done';
const ORDER: Step[] = ['upload', 'map', 'preview', 'done']; const LABELS = ['Upload', 'Map columns', 'Review', 'Done'];

export function ImportWizard() {
  const [step, setStep] = useState<Step>('upload'); const [text, setText] = useState(''); const [fileName, setFileName] = useState('');
  const [prev, setPrev] = useState<Preview | null>(null); const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null); const [result, setResult] = useState<ImportResult | null>(null); const [pending, start] = useTransition();

  async function onFile(f: File | undefined) {
    setError(null); if (!f) return;
    if (f.size > MAX_CSV_BYTES) return setError('That file is larger than 2 MB. Split it into smaller files.');
    if (!/\.(csv|txt)$/i.test(f.name) && f.type && !f.type.includes('csv') && !f.type.includes('text')) return setError('Choose a .csv file.');
    const t = await f.text(); setText(t); setFileName(f.name);
    start(async () => { const r = await previewImport(t, ''); if ('error' in r && r.error) return setError(r.error); const p = r as unknown as Preview; setPrev(p); setMapping(p.mapping); setStep('map'); });
  }
  function runPreview() { setError(null); start(async () => { const r = await previewImport(text, JSON.stringify(mapping)); if ('error' in r && r.error) return setError(r.error); setPrev(r as unknown as Preview); setStep('preview'); }); }
  function runImport() { setError(null); start(async () => { const r = await commitImport(text, JSON.stringify(mapping)); if (r.error && r.inserted === undefined) return setError(r.error); setResult(r); setStep('done'); }); }
  const missing = REQUIRED.filter(f => !mapping[f]);

  return (
    <div style={{ maxWidth: 900 }}>
      <ol className="steps" aria-label="Import progress">{ORDER.map((s, i) => <li key={s} aria-current={s === step ? 'step' : undefined} className={ORDER.indexOf(step) > i ? 'done' : ''}>{i + 1}. {LABELS[i]}</li>)}</ol>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {step === 'upload' && (
        <div className="dropzone"><h2>Choose a CSV file</h2><p className="muted" style={{ margin: '0 auto 16px' }}>Up to 2 MB and 2,000 rows. The first row must be column headings. Dates use YYYY-MM-DD.</p>
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>{pending ? 'Reading…' : 'Select CSV file'}<input type="file" accept=".csv,text/csv,text/plain" className="sr" onChange={e => onFile(e.target.files?.[0])} disabled={pending} /></label>
          <p style={{ margin: '18px auto 0' }}><a href="/api/template">Download the sample template</a></p></div>)}
      {step === 'map' && prev && (
        <div className="panel"><h2>Match your columns</h2><p className="muted">We matched what we could from <strong>{fileName}</strong>. Required fields are marked. Optional fields can stay unmapped; if no currency column is mapped, your default currency is used.</p>
          <div className="grid-2">{FIELDS.map(f => <div className="field" key={f}><label htmlFor={`m-${f}`}>{FIELD_LABEL[f]}{REQUIRED.includes(f) && <span className="req"> (required)</span>}</label>
            <select id={`m-${f}`} value={mapping[f] ?? ''} onChange={e => setMapping(m => { const n = { ...m }; if (e.target.value) n[f] = e.target.value; else delete n[f]; return n; })}><option value="">Not mapped</option>{prev.headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>)}</div>
          {missing.length > 0 && <p className="notice notice-warn">Map these required fields to continue: {missing.map(f => FIELD_LABEL[f as Field]).join(', ')}.</p>}
          <div className="actions"><button className="btn btn-primary" disabled={pending || missing.length > 0} onClick={runPreview}>{pending ? 'Checking…' : 'Check my data'}</button><button className="btn btn-line" onClick={() => setStep('upload')}>Choose another file</button></div></div>)}
      {step === 'preview' && prev && (
        <div className="panel"><h2>Review before importing</h2>
          <p><strong>{prev.validCount}</strong> of {prev.total} rows are ready to import. <strong>{prev.issueCount}</strong> {prev.issueCount === 1 ? 'row needs' : 'rows need'} attention and will be skipped; nothing is dropped silently.</p>
          {prev.sample.length > 0 && <div className="tablewrap"><table><thead><tr><th>Line</th><th>Customer</th><th>Invoice</th><th>Due</th><th>Status</th><th className="num">Amount</th></tr></thead><tbody>{prev.sample.map(r => <tr key={r.line}><td>{r.line}</td><td>{r.customer_name}</td><td>{r.invoice_no}</td><td>{r.due_date}</td><td>{r.status}</td><td className="num">{formatMoney(r.amount, r.currency)}</td></tr>)}</tbody></table></div>}
          {prev.issues.length > 0 && <><h3 style={{ marginTop: 22 }}>Rows that will be skipped</h3><div className="tablewrap"><table><thead><tr><th>Line</th><th>Invoice</th><th>Type</th><th>Why</th></tr></thead><tbody>{prev.issues.map(i => <tr key={i.line}><td>{i.line}</td><td>{i.invoice_no ?? '—'}</td><td>{i.kind === 'duplicate' ? 'Duplicate' : 'Error'}</td><td>{i.messages.join(' ')}</td></tr>)}</tbody></table></div>{prev.issueCount > prev.issues.length && <p className="small muted">Showing the first {prev.issues.length} of {prev.issueCount}.</p>}</>}
          <div className="actions" style={{ marginTop: 20 }}><button className="btn btn-primary" disabled={pending || prev.validCount === 0} onClick={runImport}>{pending ? 'Importing…' : `Import ${prev.validCount} invoice${prev.validCount === 1 ? '' : 's'}`}</button><button className="btn btn-line" onClick={() => setStep('map')}>Back to columns</button></div>
          <p className="hint">The Free plan allows 10 open invoices. Rows beyond that limit are reported as skipped, never silently dropped.</p></div>)}
      {step === 'done' && result && (
        <div className="panel"><h2>Import finished</h2>
          <ul className="list"><li><span>Imported</span><strong>{result.inserted ?? 0}</strong></li><li><span>Skipped as duplicates</span><strong>{result.duplicates ?? 0}</strong></li><li><span>Skipped because of errors</span><strong>{result.invalid ?? 0}</strong></li><li><span>Skipped because of the Free plan limit</span><strong>{result.limited ?? 0}</strong></li></ul>
          {result.error && <p className="notice notice-error" role="alert">{result.error}</p>}
          {result.issues && result.issues.length > 0 && <details><summary>See skipped rows</summary><div className="tablewrap"><table><tbody>{result.issues.map(i => <tr key={`${i.line}-${i.kind}`}><td>Line {i.line}</td><td>{i.invoice_no ?? '—'}</td><td>{i.messages.join(' ')}</td></tr>)}</tbody></table></div></details>}
          {(result.limited ?? 0) > 0 && <p className="notice notice-info">Upgrade to Pro for unlimited active invoices, then import the skipped rows again. Duplicates are skipped automatically. <Link href="/billing">See Pro</Link></p>}
          <div className="actions" style={{ marginTop: 16 }}><Link className="btn btn-primary" href="/invoices">View invoices</Link><button className="btn btn-line" onClick={() => { setStep('upload'); setResult(null); setText(''); }}>Import another file</button></div></div>)}
    </div>
  );
}
