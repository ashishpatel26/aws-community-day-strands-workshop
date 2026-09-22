import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { analyze, getReport, openProgressSocket } from "../api.js";
import Icon, { Brand } from "../components/Icon.jsx";
import AgentProgressPanel from "../components/AgentProgressPanel.jsx";
const PriceChart = lazy(() => import("../components/PriceChart.jsx"));
import ReportSections, { SECTIONS } from "../components/ReportSections.jsx";
import { COMPANIES, SAMPLE_REPORT, companyFor } from "../data/sample.js";

function readSaved(key, fallback, validate) {
  try { const data = JSON.parse(localStorage.getItem(key)); return validate(data) ? data : fallback; } catch { return fallback; }
}
const validReport = r => r && typeof r.id === "string" && typeof r.ticker === "string" && typeof r.createdAt === "string" && r.sections && SECTIONS.every(s => typeof r.sections[s.key] === "string");
const NAV = [{ id: "workspace", label: "Workspace", icon: "grid" }, { id: "reports", label: "Research library", icon: "file" }, { id: "watchlist", label: "Watchlist", icon: "star" }];
const tickerPattern = /^[A-Z^][A-Z0-9.^=-]{0,14}$/;
function CompanyMark({ company, small = false }) { return <span className={`company-mark mark-${company.color} ${small ? "mark-small" : ""}`}>{company.mark}</span>; }

export default function Dashboard({ sampleMode, onLogout }) {
  const [page, setPage] = useState("workspace");
  const [ticker, setTicker] = useState("");
  const [activeTicker, setActiveTicker] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({});
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [reports, setReports] = useState(() => readSaved("swarm-reports-v1", [], a => Array.isArray(a) && a.every(validReport)));
  const [watchlist, setWatchlist] = useState(() => readSaved("swarm-watchlist-v1", ["AAPL", "NVDA", "MSFT"], a => Array.isArray(a) && a.length <= 100 && a.every(t => typeof t === "string" && tickerPattern.test(t))));
  const [libraryQuery, setLibraryQuery] = useState("");
  const inputRef = useRef(null);
  const helpRef = useRef(null);
  const pendingFocus = useRef(false);
  const jobRef = useRef(null);
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => { try { localStorage.setItem("swarm-reports-v1", JSON.stringify(reports)); } catch { setNotice("Your browser couldn't save the research library. You can still export this report."); } }, [reports]);
  useEffect(() => { try { localStorage.setItem("swarm-watchlist-v1", JSON.stringify(watchlist)); } catch { setNotice("Your browser couldn't save the watchlist. Changes will last for this session."); } }, [watchlist]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 6000); return () => clearTimeout(timer); }, [notice]);
  function cleanupJob() {
    const job = jobRef.current;
    if (job) { job.cancelled = true; clearTimeout(job.timer); job.controller.abort(); job.ws?.close(); jobRef.current = null; }
  }
  useEffect(() => () => cleanupJob(), []);
  useEffect(() => {
    const shortcut = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); focusResearch(); }
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const sidebar = document.querySelector('.sidebar');
    const previous = document.activeElement;
    sidebar.querySelector('button')?.focus();
    const trapFocus = event => {
      if (event.key !== 'Tab' || document.querySelector('dialog[open]')) return;
      const items = [...sidebar.querySelectorAll('button:not([disabled]), a[href]')].filter(el => el.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => { document.removeEventListener('keydown', trapFocus); if (sidebar.contains(document.activeElement)) previous?.focus(); };
  }, [menuOpen]);
  useEffect(() => { if (pendingFocus.current && inputRef.current) { inputRef.current.focus(); pendingFocus.current = false; } }, [page, report]);
  function navigate(next) { setPage(next); setMenuOpen(false); setLibraryQuery(""); }
  function focusResearch(symbol = "") {
    setPage("workspace"); setReport(null); setMenuOpen(false); if (symbol) setTicker(symbol);
    pendingFocus.current = true;
    if (inputRef.current) { inputRef.current.focus(); pendingFocus.current = false; }
  }
  function toggleWatch(symbol) { setWatchlist(prev => prev.includes(symbol) ? prev.filter(t => t !== symbol) : [...prev, symbol].slice(0, 100)); }
  function openSample() { setReport(SAMPLE_REPORT); setPage("workspace"); setError(""); }
  function openReport(item) { setReport(item); setPage("workspace"); setError(""); }
  function stopWaiting() { cleanupJob(); setBusy(false); setNotice("Stopped waiting. The research job may continue on the server."); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const symbol = ticker.trim().toUpperCase();
    if (!tickerPattern.test(symbol)) { setError("Enter a valid ticker, such as AAPL, BRK-B, or ^GSPC."); inputRef.current?.focus(); return; }
    setError("");
    if (sampleMode) { setNotice("You're in sample mode. Open the example report below, or sign in to run live research."); return; }
    cleanupJob();
    setTicker(symbol); setActiveTicker(symbol); setBusy(true); setProgress({}); setReport(null);
    const job = { cancelled: false, controller: new AbortController(), startedAt: Date.now(), timer: null, ws: null };
    jobRef.current = job;
    try {
      const { job_id: jobId } = await analyze(symbol, AbortSignal.any([job.controller.signal, AbortSignal.timeout(20000)]));
      if (job.cancelled) return;
      try { job.ws = openProgressSocket(jobId, event => { if (!job.cancelled && event.agent) setProgress(prev => ({ ...prev, [event.agent]: event })); }); } catch { /* Polling also works when WebSocket is unavailable. */ }
      const poll = async () => {
        if (job.cancelled) return;
        try {
          const final = await getReport(jobId, AbortSignal.any([job.controller.signal, AbortSignal.timeout(15000)]));
          if (job.cancelled) return;
          if (final.status === "error") throw new Error(final.error || "Research could not be completed. Try another symbol or start again.");
          if (final.status === "completed") {
            if (!final.sections) throw new Error("The report arrived without any sections. Please start the analysis again.");
            const result = { id: jobId, ticker: symbol, sections: Object.fromEntries(SECTIONS.map(s => [s.key, typeof final.sections[s.key] === "string" ? final.sections[s.key] : ""])), createdAt: new Date().toISOString() };
            setReport(result); setReports(prev => [result, ...prev.filter(r => r.id !== jobId)].slice(0, 20));
            setNotice(`${symbol} research is ready and saved to your library.`); setBusy(false); cleanupJob(); return;
          }
          if (Date.now() - job.startedAt > 600000) throw new Error("This analysis is taking longer than expected. Check your model server and try again.");
          job.timer = setTimeout(poll, 2000);
        } catch (err) { if (!job.cancelled) { setError(err.message || "The report couldn't be retrieved. Please try again."); setBusy(false); cleanupJob(); } }
      };
      await poll();
    } catch (err) { if (!job.cancelled) { setError(err.message || "Research couldn't start. Please try again."); setBusy(false); cleanupJob(); } }
  }
  function exportReport() {
    const content = `# ${report.ticker} — Research report\n\n${report.sample ? 'SAMPLE REPORT — illustrative content only\n\n' : ''}Generated: ${report.createdAt}\n\n` + SECTIONS.map(s => `## ${s.label}\n\n${report.sections[s.key] || "No content available."}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${report.ticker}-research${report.sample ? "-sample" : ""}.md`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Your research report has been exported.");
  }
  const currentCompany = report ? companyFor(report.ticker) : null;
  const filteredReports = reports.filter(r => `${r.ticker} ${companyFor(r.ticker).name}`.toLowerCase().includes(libraryQuery.toLowerCase()));

  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><Brand/><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><Icon name="close"/></button></div>
      <div className="workspace-switch"><span className="workspace-avatar">R</span><div><strong>Research workspace</strong><span>Personal workspace</span></div><span className="workspace-tag">W</span></div>
      <span className="nav-label">WORKSPACE</span>
      <nav aria-label="Main navigation">{NAV.map(item => <button key={item.id} className={`nav-item ${page === item.id ? "selected" : ""}`} aria-label={item.label} aria-current={page === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><Icon name={item.icon}/><span>{item.label}</span>{item.id === "reports" && reports.length > 0 && <span className="nav-count">{reports.length}</span>}</button>)}</nav>
      <div className="sidebar-watchlist"><div className="watchlist-label"><span className="nav-label">QUICK ACCESS</span><button className="icon-button" aria-label="Manage watchlist" onClick={() => navigate("watchlist")}><Icon name="plus" size={16}/></button></div>{watchlist.slice(0, 4).map(t => <button className="quick-company" key={t} onClick={() => focusResearch(t)}><CompanyMark company={companyFor(t)} small/><span>{t}</span><Icon name="chevron" size={14}/></button>)}{!watchlist.length && <p className="sidebar-empty">Add a company to your watchlist.</p>}</div>
      <div className="sidebar-bottom"><div className="edition-panel"><Icon name="spark" size={20}/><strong>Better together.</strong><p>One question.<br/>Four research perspectives.</p><span>WORKSHOP EDITION</span></div><button className="nav-item help-button" onClick={() => helpRef.current.showModal()}><Icon name="help"/><span>How it works</span><Icon name="up" size={15}/></button><div className="profile"><span className="profile-avatar">{sampleMode ? "G" : "A"}</span><div><strong>{sampleMode ? "Guest explorer" : "Workshop admin"}</strong><span>{sampleMode ? "Sample workspace" : "Personal account"}</span></div><button className="icon-button" aria-label={sampleMode ? "Back to sign in" : "Sign out"} onClick={onLogout}><Icon name="logout" size={18}/></button></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumbs"><button className="icon-button menu-toggle" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Icon name="menu"/></button><span>Workspace</span><Icon name="chevron" size={14}/><strong>{report && page === "workspace" ? `${report.ticker} research` : NAV.find(n => n.id === page).label === "Workspace" ? "Overview" : NAV.find(n => n.id === page).label}</strong></div><div className="topbar-actions">{busy && <button className="active-job-button" onClick={() => focusResearch()}><span className="status-dot"/>{activeTicker} · Researching</button>}<button className="global-search" onClick={() => focusResearch()}><Icon name="search" size={16}/><span>Find a company</span><kbd>⌘ K</kbd></button><span className="environment-badge"><span className="status-dot"/>{sampleMode ? "Sample mode" : "Workshop"}</span><span className="topbar-avatar">{sampleMode ? "G" : "A"}</span></div></header>
      <main id="main-content" className="main-content" tabIndex={-1}>
        {page === "workspace" && !report && <>
          <div className="page-heading"><div><div className="overline">YOUR RESEARCH DESK <span className="overline-divider"/> {date}</div><h1>A clearer view starts here<span>.</span></h1><p>Go from a company ticker to a connected investment perspective.</p></div><span className="heading-mark" aria-hidden="true"><Icon name="layers" size={34}/></span></div>
          <div className="workspace-grid"><div className="research-column"><section className="research-composer panel"><div className="composer-title"><span className="small-brand-mark"><Icon name="spark" size={21}/></span><span>Start a new analysis</span><span className="small-badge">MULTI-AGENT RESEARCH</span></div><h2>Which company is on your mind?</h2><p>Your research team will take it from here.</p><form onSubmit={handleSubmit}><label htmlFor="ticker" className="field-label">Company ticker</label><div className="ticker-input-wrap"><Icon name="search" size={22}/><input id="ticker" ref={inputRef} value={ticker} onChange={e => { setTicker(e.target.value.toUpperCase()); if (error) setError(""); }} placeholder="e.g. AAPL" maxLength={15} autoComplete="off" spellCheck="false" disabled={busy} aria-invalid={!!error} aria-describedby={error ? "research-error" : "ticker-hint"}/><button className="button primary" type="submit" disabled={busy || !ticker.trim()}>{busy ? "Researching…" : "Run analysis"}<Icon name={busy ? "clock" : "arrow"} size={18}/></button></div><div className="suggestions" id="ticker-hint"><span>Try a company</span>{COMPANIES.slice(0, 4).map(c => <button type="button" key={c.ticker} disabled={busy} onClick={() => { setTicker(c.ticker); inputRef.current?.focus(); }}>{c.ticker}<Icon name="up" size={12}/></button>)}</div></form><div className="composer-footer"><span><Icon name="layers" size={15}/>4 specialist agents</span><span><Icon name="file" size={15}/>5 research perspectives</span></div></section>
          {error && <div id="research-error" className="error-banner" role="alert"><Icon name="info"/><span>{error}</span></div>}
          {busy && <div className="running-banner" role="status"><span className="loading-ring"/><div><strong>Connecting the dots on {activeTicker}</strong><span>Your agents are reviewing the company. This may take a few minutes.</span></div><button className="text-button" onClick={stopWaiting}>Stop waiting</button></div>}
          <section className="sample-feature"><div className="sample-feature-copy"><span className="overline">A LITTLE INSPIRATION</span><h2>Meet your next research report.</h2><p>Explore a complete example, from company fundamentals to the bigger picture.</p><button className="text-button" disabled={busy} onClick={openSample}>Explore sample report<Icon name="arrow" size={17}/></button></div><div className="sample-document" aria-hidden="true"><div><span className="document-logo">A</span><span>AAPL<span>Company research</span></span><Icon name="up" size={16}/></div><div className="document-line"/><div className="document-line short"/><svg viewBox="0 0 180 55" fill="none"><path d="M0 44 12 39 23 42 36 27 46 32 59 28 70 35 84 20 93 24 104 15 119 21 130 13 141 16 153 7 167 12 180 2" stroke="currentColor" strokeWidth="2"/></svg><span className="document-caption">ILLUSTRATIVE REPORT</span></div></section>
          </div><AgentProgressPanel progress={progress} busy={busy} failed={!!error}/></div>
          <section className="recent-section"><div className="section-heading"><div><h2>Recent research</h2><p>Your ideas, with a little more perspective.</p></div><button className="text-button" onClick={() => navigate("reports")}>View library<Icon name="arrow" size={16}/></button></div>{reports.length ? <div className="research-table"><div className="table-heading"><span>COMPANY</span><span>CREATED</span><span>STATUS</span><span/></div>{reports.slice(0, 3).map(item => <ReportRow key={item.id} item={item} onOpen={() => openReport(item)}/>)}</div> : <div className="empty-research"><span className="empty-file"><Icon name="file" size={23}/></span><div><h3>A fresh page for your next idea.</h3><p>Your completed research will appear here. Start with a company above.</p></div><button className="text-button" onClick={() => focusResearch()}>Start researching<Icon name="arrow" size={16}/></button></div>}</section>
          <div className="bottom-note"><Icon name="lock" size={14}/><span>Reports are saved in this browser. Live research uses your connected model.</span><span className="bottom-note-right">THINK IN PERSPECTIVES.</span></div>
        </>}
        {page === "workspace" && report && <>
          <div className="report-back-row"><button className="text-button" onClick={() => setReport(null)}><span className="back-arrow"><Icon name="arrow" size={16}/></span>Back to workspace</button><span className={`small-badge ${report.sample ? "sample-badge" : ""}`}>{report.sample ? "SAMPLE REPORT · ILLUSTRATIVE DATA" : "RESEARCH COMPLETE"}</span></div>
          <div className="report-title-row"><div className="report-company"><CompanyMark company={currentCompany}/><div><div className="overline">{report.ticker} <span className="overline-divider"/> {currentCompany.sector}</div><h1>{currentCompany.name}</h1><p>{report.sample ? "An example of your connected research report." : `Research completed ${new Date(report.createdAt).toLocaleString()}`}</p></div></div><div className="report-actions"><button className="button secondary" onClick={() => toggleWatch(report.ticker)}><Icon name={watchlist.includes(report.ticker) ? "check" : "star"} size={17}/>{watchlist.includes(report.ticker) ? "Watching" : "Watch"}</button><button className="button primary" onClick={exportReport}><Icon name="download" size={17}/>Export report</button></div></div>
          <div className="report-layout"><div className="report-main"><section className="panel report-chart"><div className="panel-heading"><h2>Price performance</h2><span className="small-badge">{report.ticker}</span></div><Suspense fallback={<div className="chart-skeleton" role="status">Loading chart…</div>}><PriceChart ticker={report.ticker} sample={report.sample}/></Suspense></section><ReportSections key={report.id} sections={report.sections}/></div><div className="report-context"><AgentProgressPanel completed={!report.sample}/><div className="research-context-note"><Icon name="info" size={21}/><h3>{report.sample ? "A preview of the possibilities" : "A starting point for your thinking"}</h3><p>{report.sample ? "This example uses illustrative content and generated prices. Sign in to create research with your connected agents." : "Use this report to inform your own research. Check source data, assumptions, and the date of every material claim."}</p><button className="text-button" onClick={() => focusResearch()}>Research another company<Icon name="arrow" size={16}/></button></div></div></div>
        </>}
        {page === "reports" && <><div className="page-heading"><div><div className="overline">YOUR KNOWLEDGE, CONNECTED</div><h1>Research library<span>.</span></h1><p>A home for every company you've looked into.</p></div><button className="button primary" onClick={() => focusResearch()}><Icon name="plus" size={18}/>New analysis</button></div><div className="library-toolbar"><span>{reports.length} saved {reports.length === 1 ? "report" : "reports"}</span><label className="library-search"><Icon name="search" size={18}/><span className="sr-only">Search saved reports</span><input placeholder="Search by company or ticker" value={libraryQuery} onChange={e => setLibraryQuery(e.target.value)}/></label></div>{filteredReports.length ? <div className="research-table"><div className="table-heading"><span>COMPANY</span><span>CREATED</span><span>STATUS</span><span/></div>{filteredReports.map(item => <ReportRow key={item.id} item={item} onOpen={() => openReport(item)}/>)}</div> : <div className="library-empty panel"><Icon name="file" size={36}/><h2>{libraryQuery ? "No matching research" : "Your next idea belongs here."}</h2><p>{libraryQuery ? "Try another company name or ticker." : "Run your first analysis to build a personal library of company research."}</p><button className="button secondary" onClick={libraryQuery ? () => setLibraryQuery("") : () => focusResearch()}>{libraryQuery ? "Clear search" : "Start an analysis"}<Icon name="arrow" size={17}/></button></div>}<div className="library-sample-row"><div><span className="small-badge sample-badge">SAMPLE</span><strong>See what a completed report looks like</strong><span>Apple Inc. · 5 research perspectives</span></div><button className="text-button" onClick={openSample}>Open example<Icon name="arrow" size={17}/></button></div><p className="storage-note">Up to 20 recent reports are stored in this browser. Export reports to keep a permanent copy.</p></>}
        {page === "watchlist" && <><div className="page-heading"><div><div className="overline">KEEP YOUR IDEAS CLOSE</div><h1>On your radar<span>.</span></h1><p>A focused list of companies to explore next.</p></div><span className="watchlist-total">{watchlist.length} companies</span></div><form className="watchlist-add" onSubmit={e => { e.preventDefault(); const input = e.currentTarget.elements.symbol; const value = input.value.trim().toUpperCase(); if (!tickerPattern.test(value)) { setNotice("Enter a valid company ticker, such as AAPL or BRK-B."); return; } if (watchlist.includes(value)) { setNotice(`${value} is already on your watchlist.`); return; } if (watchlist.length >= 100) { setNotice("Your watchlist is full. Remove a company before adding another."); return; } setWatchlist(prev => [...prev, value]); input.value = ""; setNotice(`${value} added to your watchlist.`); }}><label htmlFor="watchlist-symbol">Add a company</label><div><input id="watchlist-symbol" name="symbol" placeholder="Enter a ticker, e.g. AMZN" maxLength={15} required autoComplete="off"/><button className="button primary" type="submit"><Icon name="plus" size={17}/>Add to watchlist</button></div></form><div className="watchlist-companies">{watchlist.map(t => { const company = companyFor(t); return <div className="watchlist-company" key={t}><CompanyMark company={company}/><div className="watchlist-company-name"><strong>{company.name}</strong><span>{t} · {company.sector}</span></div><button className="button secondary" disabled={busy} onClick={() => focusResearch(t)}>Research<Icon name="arrow" size={16}/></button><button className="icon-button remove-watch" aria-label={`Remove ${t} from watchlist`} onClick={() => toggleWatch(t)}><Icon name="close" size={17}/></button></div>; })}{!watchlist.length && <div className="library-empty panel"><Icon name="star" size={32}/><h2>Make room for your next idea.</h2><p>Add a company above to keep it close.</p></div>}</div></>}
      </main><footer className="workspace-footer"><span>Swarm · Finance research workspace</span><span>{sampleMode ? "Sample data. Real possibilities." : "Workshop edition · Research, not financial advice."}</span></footer>
    </div>
    {notice && <div className="toast" role="status"><Icon name="info" size={19}/><span>{notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice("")}><Icon name="close" size={16}/></button></div>}
    <dialog ref={helpRef} className="help-dialog" aria-labelledby="help-title" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}><div className="dialog-heading"><Brand/><button className="icon-button" aria-label="Close help" onClick={() => helpRef.current.close()}><Icon name="close"/></button></div><span className="overline">A MORE CONNECTED WAY TO RESEARCH</span><h2 id="help-title">One ticker. Four perspectives.</h2><p>Enter a company ticker to start a research job. A research lead coordinates specialists in company strategy, financial analysis, and market sentiment.</p><ol><li><strong>Choose a company.</strong><span>Use its exchange ticker, such as AAPL or MSFT.</span></li><li><strong>Follow the research.</strong><span>Agent activity appears while the model works.</span></li><li><strong>Connect the insights.</strong><span>Read five report sections, explore historical prices, and export a copy.</span></li></ol><div className="demo-note"><Icon name="info" size={18}/><p>This workshop uses demo credentials. Live research needs the backend and model server. Sample mode works independently.</p></div><button className="button primary" onClick={() => helpRef.current.close()}>Got it<Icon name="check" size={17}/></button></dialog>
  </div>;
}
function ReportRow({ item, onOpen }) {
  const company = companyFor(item.ticker);
  return <button className="research-row" aria-label={`Open ${company.name} (${item.ticker}) report`} onClick={onOpen}><span className="row-company"><CompanyMark company={company} small/><span><strong>{company.name}</strong><span>{item.ticker}</span></span></span><span className="row-date">{new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span><span className="complete-badge"><Icon name="check" size={13}/>Complete</span><Icon name="up" size={18}/></button>;
}
