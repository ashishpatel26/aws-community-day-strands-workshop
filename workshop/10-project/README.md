# 10 — Capstone: Finance Research Swarm Portal

A full-stack app: 3 specialist agents doing real equity research in parallel, synthesized by an orchestrator, behind a web portal. Ported from Strands' official [finance-assistant-swarm-agent](https://github.com/strands-agents/samples/tree/main/python/04-industry-use-cases/finance/finance-assistant-swarm-agent) sample, adapted Ollama-first per this workshop's `model_provider.get_model()` pattern (same resolver every other stage uses).

## Architecture

**System overview** — frontend, backend, and the external services each side talks to:

```
┌────────────────────────┐        HTTP /api/*        ┌──────────────────────────────┐
│   React + Vite (5173)  │ ─────────────────────────▶ │      FastAPI (8000)          │
│                         │ ◀───────────────────────── │                               │
│  Login · Composer       │       WS /ws/progress/*   │  /api/login    /api/analyze  │
│  Activity feed          │ ◀════════════════════════ │  /api/report   /api/history  │
│  Watchlist · Library    │   live progress events    │  /api/searches /api/quote    │
│  Price chart · Export   │                            │                               │
└────────────────────────┘                            └───────────────┬───────────────┘
                                                                         │
                                                          model_provider.get_model()
                                                                         │
                                                        ┌────────────────┴────────────────┐
                                                        ▼                                  ▼
                                                 Ollama (local, primary)          Bedrock (fallback)
                                                        │
                                                        ▼
                                          3 specialist agents + orchestrator
                                                        │
                                                        ▼
                                               yfinance (price/company/
                                               financials/news — external,
                                               free, unauthenticated)
```

**Agent pipeline** — what happens inside the backend for one `/api/analyze` call:

```
User → login (demo) → ticker submit
                          │
                          ▼
              one yfinance fetch (price + company + financials + news)
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
company_strategist  financial_analyst  market_analyst      (run concurrently,
        │                 │                 │               asyncio.gather)
        └─────────────────┼─────────────────┘
                           ▼
                orchestrator synthesizes → 5-section report
                           │
                           ▼
              live progress streamed over WebSocket throughout
```

Data is fetched once (`get_research_snapshot`) and fanned out to the 3 specialists concurrently — no sequential handoffs, no waiting on one agent before the next starts. A semaphore (`RESEARCH_CONCURRENCY`, default 3) caps how many model calls run at once across the whole backend, and each agent call has its own timeout (`RESEARCH_AGENT_TIMEOUT`) plus an overall job timeout (`RESEARCH_JOB_TIMEOUT`).

- **Backend**: FastAPI (`backend/`) — one data fetch, 3 specialist agents analyzing their slice of it in parallel, an orchestrator synthesizing the final report. Runs async end-to-end (no background threads), streams progress events over WebSocket, serves the finished report as JSON.
- **Frontend**: React + Vite (`frontend/`) — login, research composer, live agent activity, watchlist, a local report library (browser storage), price charts, and Markdown export. See [`frontend/README.md`](frontend/README.md) for frontend-specific setup, testing, and UI behavior — this file doesn't duplicate it.

## Demo login

**`admin` / `admin`** — **workshop demo auth only, not a real authentication system.** No hashing, no JWT, no persistence beyond an in-memory token check (`backend/auth.py`). Do not reuse this pattern outside a workshop demo.

## Run it

Two terminals, both from the repo root (shared `.venv` for the backend):

**Backend:**

```bash
uv sync
uv run python -m uvicorn --app-dir workshop/10-project/backend main:app --reload --port 8000
```

(`uv run uvicorn ...` directly can hit a trampoline resolution issue on some setups — `python -m uvicorn` is the reliable form.)

**Frontend:**

```bash
cd workshop/10-project/frontend
npm install
npm run dev
```

Opens `http://127.0.0.1:5173`. Vite proxies `/api` and `/ws` to `127.0.0.1:8000`. Full frontend setup, build, and test instructions: [`frontend/README.md`](frontend/README.md).

## API surface (backend)

| Endpoint                      | Purpose                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `POST /api/login`           | Demo credential check                                                            |
| `POST /api/analyze`         | Kicks off a research run for a ticker, returns`job_id`                         |
| `GET /api/report/{job_id}`  | Poll for the finished 5-section report                                           |
| `WS /ws/progress/{job_id}`  | Live per-agent progress events                                                   |
| `GET /api/history/{ticker}` | Price history for the chart                                                      |
| `GET /api/searches`         | Recently analyzed tickers → job IDs (reload without re-running)                 |
| `GET /api/quote/{ticker}`   | Fast price snapshot, bypasses the research pipeline entirely (for the watchlist) |

## Caveats (read before demoing)

- **yfinance** is free/unauthenticated and can rate-limit or return partial data under load. Tools degrade to `{"error": ...}` rather than crashing the run — a missing news feed, for example, gets narrated by an agent as "no news available," not a stack trace.
- **Local Ollama running 3 concurrent agent calls is genuinely slow**, and each competes for the same model server. `RESEARCH_CONCURRENCY` (default 3) caps how many model calls run at once across the whole backend; `RESEARCH_AGENT_TIMEOUT`/`RESEARCH_JOB_TIMEOUT` bound how long any single run can take. Expect a full analysis to take real time — don't rush a live demo, the wait is expected, not a hang.
- **Bedrock fallback** works automatically via `model_provider.get_model()` if Ollama is unreachable, but is slower under rate limits and costs money per call — fine for a demo, worth mentioning so nobody's surprised by an AWS bill afterward.
- Backend tests (`backend/test_tools.py`) are offline/pure-logic only, wired into CI. The full research flow and the frontend's Playwright suite are **not** part of CI — one needs live Ollama, the other needs a browser; both are meant to run locally.
