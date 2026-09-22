# Swarm research workspace

A responsive React frontend for the Finance Research Swarm workshop. The interface includes a research composer, agent activity, company watchlist, local report library, historical price charts, and Markdown report export.

## Run locally

From this directory:

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). Choose **Explore sample workspace** to explore without a backend. The Apple report and its generated chart are explicitly labeled as illustrative data.

For live research, start the existing backend from the repository root:

```sh
uv run uvicorn --app-dir workshop/10-project/backend main:app --reload --port 8000
```

Configure and run the model provider required by the backend. Then sign in using the workshop credentials `admin` / `admin`. These credentials are a demonstration, not production authentication.

Vite binds to `127.0.0.1:5173` and proxies `/api` and `/ws` to `127.0.0.1:8000`. It stops if the frontend port is occupied rather than silently choosing a different port. File polling is enabled to support development in Windows-mounted WSL folders.

Run the frontend and backend in the same environment: both in Windows terminals, or both in WSL. Windows and WSL have separate loopback interfaces. A WSL preview can occupy the Windows-forwarded frontend port while being unable to reach a Windows-only backend, causing correct credentials to return a server error. Stop duplicate preview servers before restarting.

To verify actual login with the two services running and Google Chrome installed:

```sh
node scripts/verify-login.mjs
```

This check uses the real login endpoint with the workshop credentials and saves a screenshot in `qa-artifacts/login-connected.png`. It does not start a research job.

To verify a complete live research job and all agent progress updates in Chrome:

```sh
node scripts/verify-research.mjs
```

This starts an actual MSFT analysis and saves elapsed time, progress events, and a screenshot in `qa-artifacts/`. See the [backend pipeline notes](../backend/README.md) for latency measurements and model settings.

## Build and test

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

The tests use Chromium at desktop and mobile viewport sizes. They cover sample mode, login errors, watchlist persistence, report polling after an early WebSocket closure, report export and search, failed jobs, empty price history, keyboard interaction, responsive overflow, storage recovery, cancellation, and automated WCAG AA accessibility checks.

API-backed test flows use controlled HTTP and WebSocket fixtures. They do not require or validate a running LLM or a market-data provider. To use an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path before running the tests.

```sh
npx playwright show-report
```

Playwright MCP is also installed for interactive browser testing:

```sh
npx @playwright/mcp --headless
```

## Interface behavior

- **Research:** choose a ticker and run the connected agent pipeline. Report polling remains authoritative even if the progress socket closes early.
- **Stop waiting:** stops monitoring locally; it does not cancel the backend job.
- **Watchlist:** add and remove up to 100 ticker symbols. Quick access fills the research composer.
- **Library:** retains up to 20 completed reports in this browser's local storage. Export Markdown for a permanent copy.
- **Charts:** period controls filter the price history returned by the API. The latest available close is not presented as a live quote.
- **Keyboard:** `Ctrl/Cmd + K` focuses research. Escape closes help or the mobile navigation. Buttons and inputs have visible focus indicators.
- **Sample mode:** makes no market-data or model requests. Sample reports are separate from completed live research.

The frontend is styled as a product workspace; the backend uses a bounded parallel research pipeline with workshop authentication and in-memory jobs.
