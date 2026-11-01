'use client';
import { useEffect, useRef } from 'react';

const ROWS = [
  { n: 'Northwind Studio', no: 'INV-1042', amt: 1850, late: 46 },
  { n: 'Harbor & Co', no: 'INV-1051', amt: 640, late: 18 },
  { n: 'Bluebird Labs', no: 'INV-1057', amt: 2200, late: 5 },
];
const LOOP = 12, STEP = 2.2; // seconds; must match the CSS (12s) and --d offsets
const TOTAL = ROWS.reduce((a, r) => a + r.amt, 0);
const sm = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
/** Share of an invoice still overdue at loop phase p (mirrors the CSS keyframes). */
const remaining = (p: number) => (p < 0.34 ? 1 : p < 0.48 ? 1 - sm((p - 0.34) / 0.14) : p < 0.96 ? 0 : sm((p - 0.96) / 0.04));
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export function Ledger() {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]); const lateRef = useRef<HTMLElement>(null); const paidRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const late = lateRef.current, paid = paidRef.current; if (!late || !paid) return;
    const set = (el: HTMLElement, v: number) => { const t = money(v); if (el.textContent !== t) el.textContent = t; };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { set(late, 0); set(paid, TOTAL); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (now: number) => {
      let overdue = 0;
      ROWS.forEach((r, i) => {
        // read the real CSS animation clock so numbers and visuals never drift apart
        const anim = rowRefs.current[i]?.getAnimations().find(a => (a as CSSAnimation).animationName === 'lg-row');
        const T = anim && anim.currentTime != null ? Number(anim.currentTime) / 1000 : (now - t0) / 1000; // seconds since the row's animation began (delay included)
        const tt = T - i * STEP; const p = tt <= 0 ? 0 : (tt % LOOP) / LOOP;
        overdue += r.amt * remaining(p);
      });
      set(late, overdue); set(paid, TOTAL - overdue); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="ledger" role="img" aria-label="Demo: three overdue invoices moving from overdue, to reminder sent, to paid, on a loop">
      <header><strong>Follow-up board</strong><span className="demo-tag">Demo data</span></header>
      <div className="lg-totals" aria-hidden="true">
        <div className="lg-total late"><small>Overdue</small><b ref={lateRef}>{money(TOTAL)}</b></div>
        <div className="lg-total paid"><small>Collected</small><b ref={paidRef}>{money(0)}</b></div>
      </div>
      {ROWS.map((r, i) => (
        <div className="lg-row" key={r.no} ref={el => { rowRefs.current[i] = el; }} style={{ ['--d' as string]: `${i * STEP}s` }} aria-hidden="true">
          <div className="lg-top"><b>{r.n}</b><span className="lg-amt">{money(r.amt)}</span></div>
          <div className="lg-sub"><span>{r.no}</span><span className="lg-stack"><i className="s1">{r.late} days overdue</i><i className="s2">Reminder sent</i><i className="s3">Paid</i></span></div>
          <div className="lg-track"><span className="lg-fill" /><span className="lg-node" /><span className="lg-node" /><span className="lg-node" /><span className="lg-head" /></div>
        </div>))}
    </div>
  );
}
