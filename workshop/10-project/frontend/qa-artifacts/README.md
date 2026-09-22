# Frontend design and browser verification

Verified on September 22, 2026 using Chromium through Playwright MCP and a repeatable Playwright test suite.

## Design changes

- Consistent ivory and forest-green palette, self-hosted Manrope typography, and reusable controls.
- Persistent desktop navigation and a collapsible mobile drawer with keyboard focus handling.
- Research composer with visible labels, ticker shortcuts, validation, and clear loading/error feedback.
- Coordinated agent activity, an editable local watchlist, and a searchable report library.
- Report reader with section navigation, historical chart ranges, styled Markdown, and Markdown export.
- Explicitly labeled sample mode that works without backend or market-data requests.
- Lazy-loaded workspace and charts, with a roughly 152 kB initial JavaScript bundle (49 kB gzip).

## Screenshots

| View | Desktop | Mobile |
| --- | --- | --- |
| Sign-in | [Screenshot](login-desktop.png) | [Screenshot](login-mobile.png) |
| Workspace | [Screenshot](workspace-desktop.png) | [Screenshot](workspace-mobile.png) |
| Sample report | [Screenshot](report-desktop.png) | [Screenshot](report-mobile.png) |
| Formatted Markdown | [Screenshot](report-markdown-desktop.png) | [Screenshot](report-markdown-mobile.png) |

The charts shown in the sample report use generated illustrative prices, not financial quotes.

## Verification scope

- Production build: `npm run build`.
- Browser regression suite: `npm run test:e2e`.
- Desktop viewport: 1440 × 1000; mobile viewport: 390 × 664 with the iPhone 13 device profile in Chromium.
- Additional layout sweep: 320, 375, 768, and 1024 px. Workspace and report have no horizontal page overflow.
- Automated accessibility: axe checks tagged WCAG 2 A, WCAG 2 AA, and WCAG 2.1 AA on sign-in, workspace, sample report, and formatted Markdown.
- Markdown regression checks in Windows Chrome: heading hierarchy, emphasis, nested lists, tables, quotes, links, code, every report tab, plain text compatibility, unchanged Markdown export, unsafe HTML/URL handling, and mobile overflow.
- Interactive MCP walkthrough: sign-in, sample workspace, report, responsive views, and console inspection. No browser console errors or warnings were reported.
- API-backed tests use controlled HTTP and WebSocket fixtures. These verify the UI contract and do not validate a live model or market-data provider.

## Issues resolved during verification

- Report status is polled independently of WebSocket lifetime because the backend may finish its progress stream before the report is ready.
- Navigation and report buttons keep stable accessible names when counts or mobile visibility change.
- Text contrast was adjusted after automated checks; report body text uses a 16 px reading size.
- Corrupt browser storage falls back to a usable workspace.
- Empty history responses show an explanation and retry action.
- Vite file polling handles missed change notifications on Windows-mounted WSL folders.

Sample mode, the original workshop credentials, and local browser storage remain appropriate for workshop use. The redesign does not turn the backend into a production authentication or account system.

## Final results

- **Production build:** passed.
- **Browser suite:** 33 passed, 0 failed, 1 intentionally skipped (the duplicate mobile instance of the desktop viewport sweep).
- **Automated accessibility:** no violations from the selected WCAG AA rules on the audited screens and Markdown report at desktop and mobile sizes.
- **MCP console check:** 0 errors, 0 warnings.

The Playwright HTML report is generated in `../playwright-report/` and can be opened with `npx playwright show-report` from the frontend directory.

## Live research latency verification

The optimized backend was verified through real sign-in and an MSFT analysis in
Windows Chrome using `node scripts/verify-research.mjs`. The complete report
rendered in **26.6 seconds**. All three specialists reported started/completed
events, the research lead's terminal event arrived after them, every section was
populated, and the browser reported no page errors. This check uses actual local
Ollama inference and provider data rather than the regression suite's fixtures.

See the [screenshot](research-live.png), [timing and progress events](research-live.json),
and [backend measurements and settings](../../backend/README.md).
