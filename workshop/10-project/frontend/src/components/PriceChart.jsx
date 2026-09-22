import { useEffect, useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SAMPLE_POINTS } from "../data/sample.js";
import Icon from "./Icon.jsx";
const ranges = { "1M": 30, "3M": 90, "6M": 180, ALL: Infinity };
export default function PriceChart({ ticker, sample = false, compact = false }) {
  const [points, setPoints] = useState(sample ? SAMPLE_POINTS : null);
  const [error, setError] = useState("");
  const [range, setRange] = useState("3M");
  const [attempt, setAttempt] = useState(0);
  const gradientId = useId().replaceAll(":", "");
  useEffect(() => {
    if (sample) { setPoints(SAMPLE_POINTS); setError(""); return; }
    const controller = new AbortController();
    setPoints(null); setError("");
    fetch(`/api/history/${encodeURIComponent(ticker)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        if (controller.signal.aborted) return;
        if (data.error) { setError(String(data.error)); return; }
        const valid = (Array.isArray(data.points) ? data.points : []).filter(p => typeof p.close === "number" && Number.isFinite(p.close) && !Number.isNaN(Date.parse(p.date))).sort((a, b) => a.date.localeCompare(b.date));
        if (!valid.length) setError("No price history is available for this symbol.");
        else setPoints(valid);
      }).catch(() => { if (!controller.signal.aborted) setError("Price history couldn't be loaded. Please try again."); });
    return () => controller.abort();
  }, [ticker, sample, attempt]);
  const cutoff = points?.length ? Date.parse(points.at(-1).date) - ranges[range] * 86400000 : 0;
  const visible = points?.filter(p => Date.parse(p.date) >= cutoff) || [];
  const first = visible[0]?.close;
  const last = visible.at(-1)?.close;
  const change = first ? ((last - first) / first) * 100 : 0;
  return <div className={`price-module ${compact ? "compact-chart" : ""}`}>
    <div className="price-heading"><div><div className="price-label">{sample ? "Illustrative share price" : "Last available close"} <span>USD</span></div><div className="price-value">{last != null ? `$${last.toFixed(2)}` : "—"}{last != null && <span className={`price-change ${change < 0 ? "negative" : ""}`}>{change >= 0 ? "+" : ""}{change.toFixed(2)}% <span>in period</span></span>}</div></div>
    <div className="range-control" aria-label="Chart time range">{Object.keys(ranges).map(r => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}</div></div>
    {error ? <div className="chart-message" role="status"><Icon name="chart"/><p>{error}</p><button className="text-button" onClick={() => setAttempt(n => n + 1)}>Retry price history <Icon name="arrow" size={16}/></button></div> : !points ? <div className="chart-skeleton" role="status"><div/><div/><div/><span>Loading price history…</span></div> : <div className="chart-wrap" role="img" aria-label={`${sample ? "Illustrative " : ""}${ticker} closing prices from ${visible[0]?.date} to ${visible.at(-1)?.date}, ending at ${last?.toFixed(2)} US dollars`}>
      <ResponsiveContainer width="100%" height="100%"><AreaChart data={visible} margin={{ top: 14, right: 2, bottom: 0, left: -18 }}><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#25876b" stopOpacity={.19}/><stop offset="100%" stopColor="#25876b" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9ece7" strokeDasharray="3 5"/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#6b756e" }} minTickGap={45} tickMargin={12} tickFormatter={d => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}/><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#6b756e" }} domain={["auto", "auto"]} tickFormatter={v => `$${Math.round(v)}`} tickCount={4} width={64}/><Tooltip contentStyle={{ border: "1px solid #dde4dc", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 20px #1b352010" }} formatter={v => [`$${Number(v).toFixed(2)}`, "Close"]}/><Area type="monotone" dataKey="close" stroke="#267c5f" strokeWidth={2.2} fill={`url(#${gradientId})`} isAnimationActive={false}/></AreaChart></ResponsiveContainer>
    </div>}
    <div className="chart-caption"><span>{sample ? "Sample data · Jan – Mar 2025" : points?.length ? `As of ${points.at(-1).date} · Historical data` : "Historical price data"}</span><span>{sample ? "For illustration only" : "Prices may be delayed"}</span></div>
  </div>;
}
