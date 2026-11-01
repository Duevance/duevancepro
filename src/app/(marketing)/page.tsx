import Link from 'next/link';
import { Faq, Ledger, Pricing } from '@/components/Marketing';

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      {sp.deleted && <p className="notice notice-ok wrap" role="status" style={{ marginTop: 16 }}>Your account and data have been deleted.</p>}
      <section className="hero"><div className="wrap hero-grid">
        <div><h1>Get paid. Move forward.</h1>
          <p className="lede">Duevance helps you manage overdue invoices and follow up without the stress. See who owes you, how late it is, and send the right reminder in a minute.</p>
          <div className="cta"><Link className="btn btn-primary" href="/signup">Start free</Link><Link className="btn btn-line" href="#how">See how it works</Link></div>
          <p className="fine">Free for up to 10 active invoices. No card needed.</p></div>
        <Ledger /></div></section>

      <div className="wrap"><p className="audience" aria-label="Who Duevance is for"><span>Freelancers</span><span>Consultants</span><span>Small agencies</span><span>Owner-run businesses</span></p></div>

      <section className="block"><div className="wrap">
        <div className="sect-head"><h2>Unpaid invoices go quiet. Then you lose track.</h2><p>Chasing money is rarely hard. Remembering to do it, and knowing where each invoice stands, is.</p></div>
        <div className="problem">
          <div className="sheet" aria-label="A typical spreadsheet with unclear payment status"><table><thead><tr><th>Client</th><th>Amt</th><th>Paid?</th><th>Chased?</th></tr></thead><tbody>
            <tr><td>Northwind</td><td>1850</td><td className="q">?</td><td className="q">maybe</td></tr><tr><td>Harbor</td><td>640</td><td className="q">?</td><td>—</td></tr><tr><td>Bluebird</td><td>2200</td><td>yes??</td><td className="q">I think</td></tr></tbody></table><p className="small muted" style={{ margin: '12px 0 0' }}>Forgotten invoices, scattered follow-ups, and no clear answer to “who owes me?”.</p></div>
          <div className="mock"><div className="mock-bar"><span>With Duevance</span><span className="demo-tag" style={{ background: '#EFECE5', color: '#4A5370' }}>Demo data</span></div><div className="mock-body stat"><div className="row"><span className="label">Overdue</span><span className="big late">$4,690.00</span></div><div className="row"><span className="label">Due in 7 days</span><span className="big">$980.00</span></div><p className="small muted" style={{ margin: '12px 0 0' }}>One answer, per currency, always current.</p></div></div>
        </div></div></section>

      <section className="block ink on-ink" id="how"><div className="wrap">
        <div className="sect-head"><h2>From overdue to settled in five steps</h2></div>
        <ol className="pipeline">{[['Import invoices', 'Add them one by one or bring in a CSV.'], ['Spot what is overdue', 'Aging is worked out from due dates in your timezone.'], ['Prepare a reminder', 'Friendly, Firm or Final, filled in for you.'], ['Contact the customer', 'Open your email app or WhatsApp. You press send.'], ['Track the outcome', 'Record what you sent and mark invoices paid.']].map(([t, d], i) => <li key={t}><span className="n">{i + 1}</span><h3>{t}</h3><p>{d}</p></li>)}</ol></div></section>

      <section className="block alt" id="showcase"><div className="wrap">
        <div className="sect-head"><h2>Built around the follow-up, not the paperwork</h2><p>Real screens from the app. The figures below are demo data.</p></div>
        <div className="showcase">
          <div className="mock sc-a"><div className="mock-bar"><span>Dashboard</span><span>Demo data</span></div><div className="mock-body"><div className="cols"><div className="stat span-6"><div className="label">Total outstanding</div><div className="row"><span className="big">$6,690.00</span></div><div className="row"><span className="big">€1,200.00</span></div></div><div className="stat span-6"><div className="label">Total overdue</div><div className="row"><span className="big late">$4,690.00</span></div><div className="sub">3 invoices</div></div></div></div></div>
          <div className="mock sc-b"><div className="mock-bar"><span>Reminder composer</span><span>Firm</span></div><div className="mock-body small"><p><strong>Overdue invoice INV-1051 ($640.00)</strong></p><p className="muted">Hi Harbor team, invoice INV-1051 for $640.00 was due on Oct 7, 2026 and is now overdue. Please arrange payment this week…</p><span className="chip chip-info">Email</span> <span className="chip chip-info">WhatsApp</span> <span className="chip">Copy</span></div></div>
          <div className="mock sc-c"><div className="mock-bar"><span>CSV import</span><span>Review</span></div><div className="mock-body small"><p><strong>12 of 14 rows ready.</strong></p><ul className="list"><li><span>Line 6</span><span className="chip chip-late">Due date must be YYYY-MM-DD</span></li><li><span>Line 9</span><span className="chip chip-soon">Duplicate INV-1031</span></li></ul></div></div>
          <div className="mock sc-d"><div className="mock-bar"><span>Invoices</span><span>Demo data</span></div><div className="tablewrap" style={{ border: 0, borderRadius: 0 }}><table><tbody>
            <tr><td><strong>Northwind Studio</strong><br /><span className="small muted">INV-1042</span></td><td><span className="chip chip-late-hard">46 days overdue</span></td><td className="num">$1,850.00</td></tr>
            <tr><td><strong>Fieldnote Ltd</strong><br /><span className="small muted">INV-1060</span></td><td><span className="chip chip-soon">Due in 3d</span></td><td className="num">$980.00</td></tr>
            <tr><td><strong>Orchard Works</strong><br /><span className="small muted">INV-1033</span></td><td><span className="chip chip-paid">Paid</span></td><td className="num">$1,500.00</td></tr></tbody></table></div></div>
        </div></div></section>

      <section className="block" id="features"><div className="wrap">
        <div className="sect-head"><h2>What you get</h2></div>
        <div className="features">{[
          ['Invoices, organised', 'Search, filter, sort, archive and mark paid. Overdue status always comes from the due date, never a stale label.'],
          ['Every currency, kept apart', 'Totals are grouped by currency. Duevance never silently converts or mixes them.'],
          ['Reminders that sound like you', 'Friendly, Firm and Final templates, filled in and editable. The final tone is professional and never threatening.'],
          ['Email and WhatsApp shortcuts', 'One click opens your own app with the message ready. Numbers without a country code are flagged, not guessed.'],
          ['An honest activity history', 'Opening a link is recorded as exactly that. Only the reminders you confirm are recorded as sent.'],
          ['Your data, your controls', 'Import and export CSV, download everything as JSON, or delete your account whenever you like.'],
        ].map(([t, d]) => <article key={t}><h3>{t}</h3><p>{d}</p></article>)}</div></div></section>

      <section className="block alt"><div className="wrap">
        <div className="sect-head"><h2>Your first reminder in three steps</h2></div>
        <ol className="three"><li><h3>Add what is owed</h3><p>Type an invoice or upload a CSV. Sample data is available if you want to look around first.</p></li><li><h3>Pick a tone</h3><p>Duevance suggests Friendly, Firm or Final based on how late the invoice is.</p></li><li><h3>Send and record</h3><p>Send from your own app, then confirm it. Mark the invoice paid when the money arrives.</p></li></ol></div></section>

      <section className="block" id="pricing"><div className="wrap"><div className="sect-head"><h2>Simple pricing</h2><p>Start free. Upgrade when you outgrow 10 active invoices.</p></div><Pricing /></div></section>
      <section className="block alt" id="faq"><div className="wrap"><div className="sect-head"><h2>Questions</h2></div><Faq /></div></section>
      <section className="block ink on-ink cta-final"><div className="wrap"><h2>Get paid. Move forward.</h2><p style={{ fontSize: '1.15rem' }}>Add your first overdue invoice and see where you stand.</p><Link className="btn btn-primary" href="/signup">Start free</Link></div></section>
    </>
  );
}
