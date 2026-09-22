import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Icon from "./Icon.jsx";
export const SECTIONS = [
  { key: "integrated_insights", label: "Overview", icon: "spark" },
  { key: "company_overview", label: "Company", icon: "building" },
  { key: "stock_price_analysis", label: "Price analysis", icon: "chart" },
  { key: "financial_health", label: "Financials", icon: "layers" },
  { key: "market_sentiment", label: "Sentiment", icon: "globe" },
];

// Keep generated headings beneath the report's own heading, and contain wide data.
const markdownComponents = {
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  h4: ({ children }) => <h5>{children}</h5>,
  h5: ({ children }) => <h6>{children}</h6>,
  h6: ({ children }) => <h6>{children}</h6>,
  a: ({ href, title, children }) => href
    ? <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  table: ({ children }) => (
    <div className="report-table-scroll" role="region" aria-label="Report data table" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
  pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
};

export default function ReportSections({ sections }) {
  const [active, setActive] = useState(SECTIONS[0].key);
  const content = sections[active] || "This agent did not return a section. Try a new analysis for a complete report.";

  return (
    <section className="report-sections panel">
      <div className="report-tabs" aria-label="Report sections">
        {SECTIONS.map(section => (
          <button key={section.key} aria-pressed={active === section.key} onClick={() => setActive(section.key)}>
            <Icon name={section.icon} size={17}/>{section.label}
          </button>
        ))}
      </div>
      <article className="report-prose">
        <div className="overline">RESEARCH PERSPECTIVE</div>
        <h2>{active === "integrated_insights" ? "The bigger picture" : SECTIONS.find(s => s.key === active).label}</h2>
        <div className="report-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} skipHtml>
            {content}
          </ReactMarkdown>
        </div>
      </article>
      <div className="report-disclaimer">
        <Icon name="info" size={16}/>
        <span>AI-generated research can contain errors. Verify material claims against original sources.</span>
      </div>
    </section>
  );
}
