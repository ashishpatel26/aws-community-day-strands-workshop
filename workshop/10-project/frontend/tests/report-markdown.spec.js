import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const markdown = `## Microsoft (MSFT) Analysis

### Market Sentiment Analysis

* **Limited Current News Data:** The news feed returned no recent headlines.
* **Valuation Context:** Compare expectations with the company's fundamentals.
  * Separate verified figures from analyst assumptions.

### Financial Health Assessment

**Profitability** should be considered alongside cash flow and balance-sheet strength.

| Research area | What to review | Priority |
| :--- | :--- | ---: |
| Cash flow | Operating cash generation | High |
| Balance sheet | Debt and liquidity | Medium |

> Research perspective: use multiple sources before drawing a conclusion.

1. Review the latest company filing.
2. Compare the assumptions with industry peers.

Read the [company investor relations](https://www.microsoft.com/en-us/Investor/) page.

Use the ticker \`MSFT\`, and replace ~~outdated assumptions~~ with current evidence.

\`\`\`text
Report status: complete
Source verification: required
\`\`\`

---

This content is a rendering test fixture, not an investment recommendation.`;

async function openStoredReport(page, content = markdown) {
  const report = {
    id: 'markdown-fixture', ticker: 'MSFT', sample: true, createdAt: '2026-09-22T12:00:00Z',
    sections: {
      integrated_insights: content,
      company_overview: 'Plain text remains readable.\n\nA second paragraph retains its spacing.',
      stock_price_analysis: '### Price context\n\n- **History:** Review changes over time.',
      financial_health: '### Financial health\n\n- **Cash flow:** Verify reported figures.',
      market_sentiment: '### Market sentiment\n\n- **Sources:** Confirm recent reporting.',
    },
  };
  await page.addInitScript(value => localStorage.setItem('swarm-reports-v1', JSON.stringify([value])), report);
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore sample workspace' }).click();
  await page.locator('#main-content').waitFor();
  await page.getByRole('button', { name: 'Open Microsoft Corporation (MSFT) report' }).click();
  await expect(page.getByRole('heading', { name: 'The bigger picture' })).toBeVisible();
  return page.locator('.report-prose');
}

test('research Markdown renders as an editorial report, not literal syntax', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const prose = await openStoredReport(page);
  await expect(prose.getByRole('heading', { name: 'Microsoft (MSFT) Analysis', level: 3 })).toBeVisible();
  await expect(prose.getByRole('heading', { name: 'Market Sentiment Analysis', level: 4 })).toBeVisible();
  await expect(prose.locator('strong').getByText('Limited Current News Data:', { exact: true })).toBeVisible();
  await expect(prose.locator('ul > li').first()).toContainText('The news feed returned no recent headlines.');
  await expect(prose.locator('ul ul > li')).toHaveText('Separate verified figures from analyst assumptions.');
  await expect(prose.getByRole('table')).toBeVisible();
  await expect(prose.getByRole('columnheader', { name: 'Research area' })).toBeVisible();
  await expect(prose.locator('blockquote')).toContainText('Research perspective');
  await expect(prose.locator('ol > li')).toHaveCount(2);
  await expect(prose.locator('code').getByText('MSFT', { exact: true })).toBeVisible();
  await expect(prose.locator('del')).toHaveText('outdated assumptions');
  await expect(prose.locator('pre')).toContainText('Report status: complete');
  await expect(prose.getByRole('link', { name: 'company investor relations' })).toHaveAttribute('href', 'https://www.microsoft.com/en-us/Investor/');
  await expect(prose).not.toContainText('## Microsoft');
  await expect(prose).not.toContainText('**Limited Current');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  const accessibility = await new AxeBuilder({ page }).include('.report-sections').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.locator('.report-sections').screenshot({
    path: testInfo.outputPath('markdown-report.png'),
    // Tall mobile captures can include fixed elements from outside the viewport.
    style: '.skip-link:not(:focus) { visibility: hidden; }',
  });
});

test('every report tab formats Markdown and plain text still reads naturally', async ({ page }) => {
  const prose = await openStoredReport(page);
  for (const [tab, heading, emphasis] of [
    ['Price analysis', 'Price context', 'History:'],
    ['Financials', 'Financial health', 'Cash flow:'],
    ['Sentiment', 'Market sentiment', 'Sources:'],
  ]) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(prose.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(prose.locator('li strong')).toHaveText(emphasis);
  }
  await page.getByRole('button', { name: 'Company', exact: true }).click();
  await expect(prose.locator('p')).toHaveCount(2);
  await expect(prose.locator('p').nth(1)).toHaveText('A second paragraph retains its spacing.');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report' }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  let text = ''; for await (const chunk of stream) text += chunk;
  expect(text).toContain(markdown);
});

test('generated report content cannot execute raw HTML or unsafe links', async ({ page }) => {
  const prose = await openStoredReport(page, `## Report\n\n<script>window.__markdownExecuted = true</script>\n\n<img src="missing" onerror="window.__markdownExecuted = true">\n\n[Unsafe link](javascript:alert%281%29)\n\n**Safe content remains visible.**`);
  await expect(prose.getByRole('heading', { name: 'Report', exact: true })).toBeVisible();
  await expect(prose.locator('strong')).toHaveText('Safe content remains visible.');
  expect(await page.evaluate(() => window.__markdownExecuted)).toBeUndefined();
  await expect(prose.locator('script, img, iframe')).toHaveCount(0);
  await expect(prose.locator('a[href^="javascript:"], a[href^="data:"]')).toHaveCount(0);
});

test('wide tables and long code remain inside the report on small screens', async ({ page }) => {
  const prose = await openStoredReport(page, '## Detailed research\n\n| Company | A deliberately long comparison heading | Cash generation | Balance sheet | Source verification |\n| --- | --- | --- | --- | --- |\n| MSFT | Enterprise software and cloud infrastructure | Review needed | Review needed | Check the latest company filing |\n\n```text\n' + 'LONG_VALUE_'.repeat(35) + '\n```');
  await expect(prose.getByRole('table')).toBeVisible();
  await expect(prose.locator('pre')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
