# Strands Agents Workshop — AWS Community Day Edition

[![Python](https://img.shields.io/badge/python-3.14%2B-blue)](https://www.python.org/)
[![uv](https://img.shields.io/badge/managed%20with-uv-8A2BE2)](https://docs.astral.sh/uv/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A hands-on, 4-hour Strands Agents workshop. Build agents locally with Ollama, fall back to Amazon Bedrock with a one-line swap — same agent code either way.

Nine stages, each a working script, each proving one architectural idea: the agent loop, tools (custom/vended/MCP/agent-as-tool), state & memory, multi-agent patterns (Workflow/Graph/Swarm), and the production layer (hooks, observability, evaluation, A2A).

---

## Quickstart

```bash
uv sync
ollama pull qwen3.5:4b
ollama pull nomic-embed-text
```

Then run any stage from the repo root:

```bash
uv run workshop/01-quickstart/1-structured_output.py
```

Every script under `workshop/` imports a shared model resolver — Ollama first, Bedrock fallback — so nothing needs editing to run.

**Minimum hardware:** 8GB RAM, GPU strongly preferred (`qwen3.5:4b` fits fully on most consumer GPUs; CPU-only works but is slower).

---

## Architecture

```
                         USER
                           │
                           ▼
                    ┌─────────────┐
                    │    AGENT    │
                    │             │
                    │ Agent Loop  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           MODEL         TOOLS        STATE
              │            │            │
        ┌─────┼─────┐   ┌──┼───┐       ├── Session
        │     │     │   │  │   │       └── Memory
     Bedrock Ollama Anthropic MCP Custom
                           │
                           ▼
                     External Systems
                           │
                           ▼
                  ┌─────────────────┐
                  │ MULTI-AGENT     │
                  │                 │
                  │ Graph           │
                  │ Workflow        │
                  │ Agents-as-Tools │
                  └────────┬────────┘
                           │
                           ▼
                    PRODUCTION LAYER
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
       Evaluation    Observability     Deployment
```

One Agent Loop at the center. Everything else — tools, models, state, multi-agent, production — hangs off it.

---

## What's inside

| Stage | Folder | Teaches |
|---|---|---|
| 1 | [`workshop/01-quickstart/`](workshop/01-quickstart/) | Agent/model/tools shape |
| 2 | [`workshop/02-agent-loop/`](workshop/02-agent-loop/) | The agent loop itself |
| 3 | [`workshop/03-tools/`](workshop/03-tools/) | Custom, vended, and agent-as-tool patterns |
| 4 | [`workshop/04-model-providers/`](workshop/04-model-providers/) | Concept only — no script, proven live in stage 8 |
| 5 | [`workshop/05-state-memory/`](workshop/05-state-memory/) | Session state vs. long-term memory (mem0) |
| 6 | [`workshop/06-mcp/`](workshop/06-mcp/) | MCP server / client |
| 7 | [`workshop/07-multi-agent/`](workshop/07-multi-agent/) | Workflow, Graph, Swarm |
| 8 | [`workshop/08-production/`](workshop/08-production/) | Deployment, meta-tooling, vision, Bedrock swap |
| 9 | [`workshop/09-advanced/`](workshop/09-advanced/) | Hooks, observability, evaluation, A2A (guardrails: reference only) |

## Full facilitator guides

- [`workshop/WORKSHOP.md`](workshop/WORKSHOP.md) — the complete 4-hour AWS Community Day guide: per-module timing, the 5-Questions teaching framework, live-demo scripts, and known landmines.
- [`workshop/WORKSHOP-COLLEGE.md`](workshop/WORKSHOP-COLLEGE.md) — adapted variant for 60–100 college students: more scaffolding, TA support, adjusted pacing.

This README is the front door. The guides above are where the actual teaching content lives.

---

## Prerequisites

- [`uv`](https://docs.astral.sh/uv/) — Python package manager
- [Ollama](https://ollama.ai) — local model runtime
- Optional: an AWS account for the Bedrock fallback path — see [`aws_cli_setup_configuration_guide.md`](aws_cli_setup_configuration_guide.md)

## Known issues

See [`workshop/WORKSHOP.md`](workshop/WORKSHOP.md#known-issues--live-demo-landmines-read-before-you-go-live) for the full list of live-demo landmines (Bedrock access status, Windows-specific tool caveats, mem0 config notes) before presenting.

## License

MIT — see [LICENSE](LICENSE).
