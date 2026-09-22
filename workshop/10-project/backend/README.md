# Research pipeline

Run from the repository root, in the same environment as the frontend:

```sh
uv run uvicorn --app-dir workshop/10-project/backend main:app --reload --port 8000
```

The project uses the shared model resolver: local `qwen3.5:4b` through Ollama,
with the existing Bedrock fallback. The other workshop examples are unchanged.

## How reports are generated

1. Fetch company information and news concurrently. One company-info response
   supplies the business summary, financial metrics and price snapshot.
2. Run fresh company, financial and market agents concurrently, with one
   response each and a backend-wide concurrency limit.
3. Format the price snapshot directly from provider values. Ask the research
   lead to synthesize all three findings and the snapshot in one final response.
4. Publish all five sections before sending the terminal WebSocket event.

This replaces the web app's sequential model-directed tool calls and handoffs.
The `workshop/07-multi-agent/3-swarm.py` example still demonstrates that pattern.
The report API and frontend section names are unchanged. Each new job fetches
current provider data; completed reports are not silently served from a cache.

Agent responses are concise (requested maximum 140 words per section), with a
600-token ceiling. Ollama thinking is disabled by default for lower latency.
This changes response depth; it is not a claim of equivalent research quality.
Truncated or empty responses produce an error rather than an incomplete report.
Missing news is identified as a limitation; unavailable core data fails early.

## Settings

Set these in the backend terminal before starting or restarting it:

| Variable | Default | Purpose |
| --- | --- | --- |
| `RESEARCH_CONCURRENCY` | `3` | Maximum simultaneous model requests across jobs; accepts 1–8. |
| `RESEARCH_MAX_TOKENS` | `600` | Maximum output tokens per response; minimum 256. |
| `RESEARCH_THINK` | `false` | Set to `true` to enable Ollama thinking; increase the token budget and timeout too. |
| `RESEARCH_AGENT_TIMEOUT` | `120` | Seconds allowed per model response, after acquiring a slot. |
| `RESEARCH_JOB_TIMEOUT` | `300` | Seconds allowed for the whole job, including queuing. |

Ollama is kept loaded for 15 minutes after requests. Its own inference scheduler
may still serialize requests; application concurrency does not change the
Ollama server's memory or parallelism settings. See the official
[thinking documentation](https://docs.ollama.com/capabilities/thinking) and
[Ollama concurrency and keep-alive documentation](https://docs.ollama.com/faq).

Backend logs include `research_timing` with data-fetch time, each agent's elapsed
time, and total time. Model timings include time queued inside the provider;
overlapping durations must not be summed to obtain total latency.

## Verification

```sh
uv run pytest workshop -q
uv run ruff check workshop/10-project/backend
```

The offline suite covers data-request reuse, concurrent execution, the shared
concurrency limit, isolated job state, cancellation, timeouts, missing data,
truncated output, and report/progress publication order.

With the frontend, backend and Ollama running, launch a real Chrome integration
check from `frontend/`:

```sh
node scripts/verify-research.mjs
```

This starts one actual MSFT research job. Set `RESEARCH_TEST_TICKER` to use another
ticker. It checks every specialist's progress, all five report sections, Markdown
rendering and price tables, and saves timing evidence and a screenshot under
`frontend/qa-artifacts/`.

## Measured local latency

On September 22, 2026, one MSFT run through each workflow used the same local
`qwen3.5:4b` model and live yfinance data:

| Workflow | Total time | Model calls | Generated tokens |
| --- | ---: | ---: | ---: |
| Previous sequential workflow | 217.426 s | 11 | 3,699 |
| Parallel, concise workflow | 21.249 s | 4 | 684 |

That is approximately 90% less elapsed time in this single-run comparison.
These are observational timings, not a statistical benchmark or a latency
guarantee. Model-provider initialization and startup probing were excluded from
both timings; cold model loads, provider response times, output depth and GPU
contention affect results. No Ollama server settings or model weights changed.

Raw measurements: [baseline](qa-artifacts/latency-baseline.json),
[optimized](qa-artifacts/latency-optimized.json). The saved
[report](qa-artifacts/latency-report.md) is a generated output sample for inspection,
not verified financial guidance.

A separate live Chrome run against the restarted backend displayed the complete
report in **26.6 seconds** (including frontend polling and rendering), with all
specialist events received and no browser errors. Evidence:
[browser timing](../frontend/qa-artifacts/research-live.json) and
[screenshot](../frontend/qa-artifacts/research-live.png).

Final checks: **22 Python tests passed**, **33 frontend tests passed** (one
intentional duplicate viewport check skipped), and backend lint/format checks passed.
