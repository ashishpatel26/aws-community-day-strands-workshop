import Icon from "./Icon.jsx";
export const AGENTS = [
  { id: "orchestrator", label: "Research lead", role: "Connects the bigger picture", icon: "layers" },
  { id: "company_strategist", label: "Company strategist", role: "Business model & competitive edge", icon: "building" },
  { id: "financial_analyst", label: "Financial analyst", role: "Fundamentals & financial health", icon: "chart" },
  { id: "market_analyst", label: "Market analyst", role: "Sentiment & market context", icon: "globe" },
];
export default function AgentProgressPanel({ progress = {}, busy = false, completed = false, failed = false }) {
  return <section className="agent-panel panel" aria-labelledby="agents-heading">
    <div className="panel-heading"><h2 id="agents-heading">Your research team</h2><span className="count-badge">04</span></div>
    <p className="panel-description">Four perspectives. Working together.</p>
    <div className="agent-list">{AGENTS.map(agent => {
      const state = progress[agent.id];
      const status = completed ? "completed" : failed && state?.status !== "completed" ? "paused" : state?.status || "idle";
      const active = busy && ["started", "tool_call"].includes(status);
      const label = status === "completed" ? "Complete" : status === "error" ? "Failed" : status === "paused" ? "Paused" : active ? "Working" : busy ? "Queued" : "Ready";
      return <div className={`agent-row ${active ? "agent-active" : ""}`} key={agent.id}>
        <span className="agent-icon"><Icon name={agent.icon}/></span><div className="agent-copy"><h3>{agent.label}</h3><p>{active && state?.detail ? state.detail : agent.role}</p></div>
        <span className={`agent-state state-${label.toLowerCase()}`} title={label} aria-label={`${agent.label}: ${label}`}>{status === "completed" ? <Icon name="check" size={15}/> : <i/>}<span>{label}</span></span>
      </div>;
    })}</div>
    <div className="agent-footer"><span className="status-dot"/><span>{busy ? "Research in progress" : completed ? "Research completed" : "Coordinated by Strands Agents"}</span></div>
  </section>;
}
