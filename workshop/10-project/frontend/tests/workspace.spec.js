import { test, expect } from '@playwright/test';

const sections = {
  company_overview: 'Verified fixture company overview.',
  stock_price_analysis: 'Verified fixture price analysis.',
  financial_health: 'Verified fixture financial health.',
  market_sentiment: 'Verified fixture market sentiment.',
  integrated_insights: 'Completed report after an early socket closure.',
};
async function preview(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore sample workspace' }).click();
  await page.locator('#main-content').waitFor();
}
async function navigate(page, name) {
  await page.locator('#main-content').waitFor();
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click();
}
async function signIn(page) {
  await page.route('**/api/login', route => route.fulfill({ json: { token: 'workshop-test-token' } }));
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Open your workspace' }).click();
  await expect(page.getByRole('heading', { name: 'A clearer view starts here.' })).toBeVisible();
}
async function mockAnalysis(page, { fail = false, emptyHistory = false } = {}) {
  let calls = 0;
  await page.route('**/api/analyze', route => {
    expect(route.request().postDataJSON()).toEqual({ ticker: 'AAPL' });
    return route.fulfill({ json: { job_id: 'test-job' } });
  });
  await page.routeWebSocket('**/ws/progress/*', socket => {
    socket.send(JSON.stringify({ agent: 'orchestrator', status: 'completed', detail: 'Price snapshot fetched' }));
    socket.close();
  });
  await page.route('**/api/report/test-job', route => route.fulfill({ json: ++calls < 2
    ? { ticker: 'AAPL', status: 'running' }
    : fail ? { ticker: 'AAPL', status: 'error', error: 'Model server unavailable. Please try again.' }
    : { ticker: 'AAPL', status: 'completed', sections } }));
  await page.route('**/api/history/AAPL', route => route.fulfill({ json: { points: emptyHistory ? [] : [
    { date: '2025-01-01', close: 100 }, { date: '2025-02-01', close: 110 }, { date: '2025-03-01', close: 120 },
  ] } }));
}

test('sample workspace needs no backend and has no browser errors', async ({ page }) => {
  const errors = [];
  const apiRequests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('/api/')) apiRequests.push(r.url()); });
  await preview(page);
  await expect(page.getByRole('heading', { name: 'Which company is on your mind?' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore sample report', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Apple Inc.', exact: true })).toBeVisible();
  await expect(page.getByText('SAMPLE REPORT · ILLUSTRATIVE DATA')).toBeVisible();
  await page.getByRole('button', { name: 'Financials', exact: true }).click();
  await expect(page.getByText('A complete financial review', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '1M', exact: true }).click();
  await expect(page.getByRole('button', { name: '1M', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
});

test('watchlist additions, duplicate protection, removal, and persistence', async ({ page }) => {
  await preview(page);
  await navigate(page, 'Watchlist');
  await page.getByLabel('Add a company', { exact: true }).fill('AMZN');
  await page.getByRole('button', { name: 'Add to watchlist' }).click();
  await expect(page.getByText('Amazon.com, Inc.', { exact: true })).toBeVisible();
  await page.getByLabel('Add a company', { exact: true }).fill('AMZN');
  await page.getByRole('button', { name: 'Add to watchlist' }).click();
  await expect(page.getByRole('status')).toContainText('already on your watchlist');
  await page.reload();
  await page.getByRole('button', { name: 'Explore sample workspace' }).click();
  await navigate(page, 'Watchlist');
  await expect(page.getByText('Amazon.com, Inc.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove AMZN from watchlist' }).click();
  await expect(page.getByText('Amazon.com, Inc.', { exact: true })).toHaveCount(0);
});

test('invalid ticker and sample-mode analysis give actionable feedback', async ({ page }) => {
  await preview(page);
  await page.getByLabel('Company ticker', { exact: true }).fill('BAD TICKER!');
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a valid ticker');
  await page.getByLabel('Company ticker', { exact: true }).fill('AAPL');
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByRole('status')).toContainText("You're in sample mode");
});

test('login distinguishes rejected credentials and service outage', async ({ page }) => {
  await page.route('**/api/login', route => route.fulfill({ status: 401, json: { detail: 'Invalid' } }));
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill('wrong');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Open your workspace' }).click();
  await expect(page.getByRole('alert')).toContainText("Those credentials didn't match");
  await page.route('**/api/login', route => route.abort('connectionrefused'));
  await page.getByRole('button', { name: 'Open your workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('research service is unavailable');
});

test('analysis waits for completed report despite early WebSocket closure, saves, searches, exports', async ({ page }) => {
  await mockAnalysis(page);
  await signIn(page);
  await page.getByLabel('Company ticker', { exact: true }).fill('aapl');
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByText('Connecting the dots on AAPL')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The bigger picture' })).toBeVisible();
  await expect(page.getByText(sections.integrated_insights, { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('AAPL-research.md');
  const stream = await download.createReadStream();
  let content = ''; for await (const chunk of stream) content += chunk;
  expect(content).toContain(sections.integrated_insights);
  expect(content).toContain(sections.financial_health);
  await navigate(page, 'Research library');
  await expect(page.getByText('1 saved report', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search saved reports' }).fill('missing-company');
  await expect(page.getByRole('heading', { name: 'No matching research' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Open Apple Inc. (AAPL) report' }).click();
  await expect(page.getByText(sections.integrated_insights, { exact: true })).toBeVisible();
});

test('failed analysis recovers and an empty price response has a retry', async ({ page }) => {
  await mockAnalysis(page, { fail: true });
  await signIn(page);
  await page.getByLabel('Company ticker', { exact: true }).fill('AAPL');
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByRole('alert')).toContainText('Model server unavailable');
  await expect(page.getByRole('button', { name: 'Run analysis' })).toBeEnabled();
  await mockAnalysis(page, { emptyHistory: true });
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByText('No price history is available for this symbol.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry price history' })).toBeVisible();
});

test('help dialog supports Escape and keyboard shortcut focuses research', async ({ page, isMobile }) => {
  await preview(page);
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'How it works' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByLabel('Company ticker', { exact: true })).toBeFocused();
});

test('all key views fit the viewport and screenshots capture the design', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Explore sample workspace' }).click();
  await page.screenshot({ path: testInfo.outputPath('workspace.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Explore sample report', exact: true }).click();
  await page.getByRole('img', { name: /Illustrative AAPL closing prices/ }).waitFor();
  await page.screenshot({ path: testInfo.outputPath('report.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('corrupt stored data falls back to a usable workspace', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('swarm-reports-v1', JSON.stringify([{ id: 'bad', sections: null }]));
    localStorage.setItem('swarm-watchlist-v1', JSON.stringify([null]));
  });
  await preview(page);
  await expect(page.getByRole('heading', { name: 'A clearer view starts here.' })).toBeVisible();
  await navigate(page, 'Watchlist');
  await expect(page.getByText('Apple Inc.', { exact: true })).toBeVisible();
});

test('stopping a running job releases the composer', async ({ page }) => {
  await page.route('**/api/analyze', route => route.fulfill({ json: { job_id: 'slow-job' } }));
  await page.route('**/api/report/slow-job', route => route.fulfill({ json: { status: 'running' } }));
  await page.routeWebSocket('**/ws/progress/*', socket => socket.close());
  await signIn(page);
  await page.getByLabel('Company ticker', { exact: true }).fill('NVDA');
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await page.getByRole('button', { name: 'Stop waiting' }).click();
  await expect(page.getByRole('status')).toContainText('Stopped waiting');
  await expect(page.getByRole('button', { name: 'Run analysis' })).toBeEnabled();
});

test('login, workspace and sample report pass WCAG AA automated checks', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  async function check() {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
  }
  await page.goto('/');
  await check();
  await page.getByRole('button', { name: 'Explore sample workspace' }).click();
  await check();
  await page.getByRole('button', { name: 'Explore sample report', exact: true }).click();
  await check();
});

test('small phone, tablet and laptop layouts avoid horizontal page overflow', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Viewport sweep runs once in the desktop browser.');
  await preview(page);
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Which company is on your mind?' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Workspace overflow at ${width}px`).toBe(true);
    await page.getByRole('button', { name: 'Explore sample report', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'The bigger picture' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Report overflow at ${width}px`).toBe(true);
    await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  }
});

test('an unavailable backend gives login startup guidance instead of a generic server error', async ({ page }) => {
  await page.route('**/api/login', route => route.fulfill({ status: 500, contentType: 'text/plain', body: '' }));
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Open your workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('backend is running on port 8000');
  await expect(page.getByRole('button', { name: 'Open your workspace' })).toBeEnabled();
});
