import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// Opt-in integration check: starts one real research job using the local model.
// Run with the frontend, backend and model server already running.
const ticker = process.env.RESEARCH_TEST_TICKER || 'MSFT';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const events = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
    try { events.push(JSON.parse(String(payload))); } catch { /* Ignore non-JSON frames. */ }
  }));
  await expect.poll(async () => {
    try {
      const health = await page.request.get('http://127.0.0.1:5173/api/health', { timeout: 5000 });
      return health.ok() ? (await health.json()).workflow : 'unavailable';
    } catch { return 'unavailable'; }
  }, { timeout: 60000, message: 'The updated backend must be running through the Vite proxy.' })
    .toBe('parallel-research');
  await page.goto('http://127.0.0.1:5173');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Open your workspace' }).click();
  await page.getByLabel('Company ticker', { exact: true }).fill(ticker);
  const started = performance.now();
  const accepted = page.waitForResponse(response => response.url().endsWith('/api/analyze'));
  await page.getByRole('button', { name: 'Run analysis' }).click();
  const response = await accepted;
  expect(response.status()).toBe(200);
  const { job_id: jobId } = await response.json();
  await page.getByRole('heading', { name: 'The bigger picture' }).waitFor({ timeout: 330000 });
  const elapsedSeconds = (performance.now() - started) / 1000;
  const report = await (await page.request.get(`http://127.0.0.1:5173/api/report/${jobId}`)).json();
  expect(report.status).toBe('completed');
  expect(Object.values(report.sections).every(text => text.trim().length > 0)).toBe(true);
  expect(report.sections.integrated_insights).not.toBe(report.sections.market_sentiment);
  for (const name of ['company_strategist', 'financial_analyst', 'market_analyst']) {
    expect(events.some(event => event.agent === name && event.status === 'started')).toBe(true);
    expect(events.some(event => event.agent === name && event.status === 'completed')).toBe(true);
  }
  expect(events.filter(event => event.agent === 'orchestrator' && event.status === 'completed')).toHaveLength(1);
  expect(events.at(-1)).toMatchObject({ agent: 'orchestrator', status: 'completed' });
  await expect(page.locator('.report-markdown strong').first()).toBeVisible();
  await page.getByRole('button', { name: 'Price analysis', exact: true }).click();
  await expect(page.locator('.report-markdown table')).toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'qa-artifacts/research-live.png', fullPage: true });
  const result = { ticker, elapsedSeconds, status: report.status, events, browserErrors: errors };
  await writeFile('qa-artifacts/research-live.json', JSON.stringify(result, null, 2));
  console.log(`PASS: ${ticker} live research rendered in ${elapsedSeconds.toFixed(1)}s; all specialists completed; progress stream stayed open; no browser errors.`);
} finally {
  await browser.close();
}
