import { chromium } from 'playwright';

// Opt-in integration check: requires the actual frontend and backend.
// It signs in with workshop credentials and never starts an analysis job.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Open your workspace' }).click();
  const response = await loginResponse;
  if (response.status() !== 200) throw new Error(`Actual login endpoint returned ${response.status()}`);
  await page.getByRole('heading', { name: 'A clearer view starts here.' }).waitFor();
  await page.getByText('Workshop admin', { exact: true }).waitFor();
  await page.screenshot({ path: 'qa-artifacts/login-connected.png', fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: real admin/admin login through the Vite proxy; authenticated workspace visible; no page errors.');
} finally {
  await browser.close();
}
