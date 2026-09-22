export const COMPANIES = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Consumer technology", mark: "A", color: "stone" },
  { ticker: "NVDA", name: "NVIDIA Corporation", sector: "Semiconductors", mark: "N", color: "lime" },
  { ticker: "MSFT", name: "Microsoft Corporation", sector: "Enterprise software", mark: "M", color: "blue" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Internet services", mark: "G", color: "sand" },
  { ticker: "AMZN", name: "Amazon.com, Inc.", sector: "Retail & cloud", mark: "a", color: "sand" },
];
export const SAMPLE_POINTS = Array.from({ length: 90 }, (_, i) => ({
  date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
  close: Number((174 + i * .24 + Math.sin(i * .44) * 2.8 + Math.sin(i * .17) * 5 + Math.cos(i * 1.9) * 1.4).toFixed(2)),
}));
export const SAMPLE_REPORT = {
  id: "sample-aapl", ticker: "AAPL", sample: true, createdAt: "2025-03-31T16:00:00Z",
  sections: {
    company_overview: "Apple designs consumer devices, software, and services around an integrated ecosystem. Its product portfolio spans iPhone, Mac, iPad, and wearables, supported by subscriptions and digital services.\n\nResearch focus\nAssess customer retention, the pace of device replacement, and how services contribute to recurring revenue. Compare these trends across regions and product categories.",
    stock_price_analysis: "The illustrative chart shows how price history appears in a completed report. These generated values are sample data and do not represent Apple's actual share price.\n\nIn a live analysis, the research team evaluates the retrieved price snapshot alongside company fundamentals. Historical performance does not establish future returns.",
    financial_health: "A complete financial review connects revenue quality with margins, cash generation, and the balance sheet.\n\nKey questions\nHow much of operating cash flow becomes free cash flow? Are repurchases supported by cash generation? How sensitive are margins to changes in product mix?\n\nThis sample contains no verified financial figures. Run a live analysis to retrieve company data.",
    market_sentiment: "A sentiment review considers recent coverage, analyst expectations, and sector developments together.\n\nThemes to investigate\nDevice demand, services growth, competition, and regulatory developments can each shape expectations. Distinguish confirmed company disclosures from market commentary and unverified forecasts.",
    integrated_insights: "Look beyond a single signal.\n\nCompany strategy, financial quality, and market expectations should tell a coherent story. A useful research thesis identifies what must go right, what could go wrong, and which evidence would change the conclusion.\n\nThis is an illustrative report for exploring the workspace, not an investment recommendation. Start a live analysis to generate a report from the connected research agents.",
  },
};
export function companyFor(ticker) { return COMPANIES.find(c => c.ticker === ticker) || { ticker, name: ticker, sector: "Equity", mark: ticker[0], color: "stone" }; }
