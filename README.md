# Strands Agents Workshop — AWS Community Day Edition

[![CI](https://github.com/ashishpatel26/aws-community-day-strands-workshop/actions/workflows/ci.yml/badge.svg)](https://github.com/ashishpatel26/aws-community-day-strands-workshop/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.14%2B-blue)](https://www.python.org/)
[![uv](<https://img.shields.io/badge/managed%20with-uv-8A2BE2>)](https://docs.astral.sh/uv/)
[![Strands Agents](https://img.shields.io/badge/Strands-Agents-orange)](https://strandsagents.com/)
[![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![Ollama](<https://img.shields.io/badge/Ollama-local%20first-000000?logo=ollama&logoColor=white>)](https://ollama.ai)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A hands-on, 4-hour Strands Agents workshop. Build agents locally with Ollama, fall back to Amazon Bedrock with a one-line swap — same agent code either way.

Ten stages: nine working scripts, each proving one architectural idea — the agent loop, tools (custom/vended/MCP/agent-as-tool), state & memory, multi-agent patterns (Workflow/Graph/Swarm), and the production layer (hooks, observability, evaluation, A2A) — plus a full-stack capstone app.

---

## Quickstart

```bash
uv sync
ollama pull qwen3.5:4b
ollama pull nomic-embed-text
uv run 0-verify_setup.py
```

`0-verify_setup.py` confirms strands imports, a model is reachable, and a trivial agent call round-trips — catches setup problems before you're mid-demo.

Then run any stage from the repo root:

```bash
uv run workshop/01-quickstart/1-structured_output.py
```

Every script under `workshop/` imports a shared model resolver — Ollama first, Bedrock fallback — so nothing needs editing to run.

**Minimum hardware:** 8GB RAM, GPU strongly preferred (`qwen3.5:4b` fits fully on most consumer GPUs; CPU-only works but is slower).

### mem0 (long-term memory demo)

[`workshop/05-state-memory/2-memory_agent.py`](workshop/05-state-memory/2-memory_agent.py) uses [mem0](https://github.com/mem0ai/mem0) with a local FAISS vector store — no separate install or API key needed, `mem0ai` and `faiss-cpu` are already pulled in by `uv sync`. Two things to know before running it:

- It needs `nomic-embed-text` pulled (covered above) — mem0's embedder is pinned to it directly, bypassing `strands_tools`' packaged mem0 tool (see the script's docstring for why: a hardcoded embedding-dimension mismatch in that packaged tool).
- First run creates `mem0_data/faiss/` in the repo root to persist vectors across runs — already gitignored, safe to delete to reset memory.

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

| Stage | Folder                                                          | Teaches                                                            |
| ----- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1     | [`workshop/01-quickstart/`](workshop/01-quickstart/)           | Agent/model/tools shape                                            |
| 2     | [`workshop/02-agent-loop/`](workshop/02-agent-loop/)           | The agent loop itself                                              |
| 3     | [`workshop/03-tools/`](workshop/03-tools/)                     | Custom, vended, and agent-as-tool patterns                         |
| 4     | [`workshop/04-model-providers/`](workshop/04-model-providers/) | Concept only — no script, proven live in stage 8                  |
| 5     | [`workshop/05-state-memory/`](workshop/05-state-memory/)       | Session state vs. long-term memory (mem0)                          |
| 6     | [`workshop/06-mcp/`](workshop/06-mcp/)                         | MCP server / client                                                |
| 7     | [`workshop/07-multi-agent/`](workshop/07-multi-agent/)         | Workflow, Graph, Swarm                                             |
| 8     | [`workshop/08-production/`](workshop/08-production/)           | Deployment, meta-tooling, vision, Bedrock swap                     |
| 9     | [`workshop/09-advanced/`](workshop/09-advanced/)               | Hooks, observability, evaluation, A2A (guardrails: reference only) |
| 10    | [`workshop/10-project/`](workshop/10-project/)                 | Capstone: full-stack finance research portal (FastAPI + React)     |

## Full facilitator guides

- [`workshop/Readme.md`](workshop/Readme.md) — the complete 4-hour AWS Community Day guide: per-module timing, the 5-Questions teaching framework, live-demo scripts, and known landmines.
- [`workshop/WORKSHOP-COLLEGE.md`](workshop/WORKSHOP-COLLEGE.md) — adapted variant for 60–100 college students: more scaffolding, TA support, adjusted pacing.

This README is the front door. The guides above are where the actual teaching content lives.

---

## Prerequisites

### 1. Install `uv`

[`uv`](https://docs.astral.sh/uv/) is the Python package manager this workshop uses — full official instructions at [docs.astral.sh/uv/getting-started/installation](https://docs.astral.sh/uv/getting-started/installation/).

**macOS / Linux:**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Verify: `uv --version`

### 2. Install Ollama

[Ollama](https://ollama.ai) runs the local model this workshop uses by default — full official instructions and installers at [ollama.com/download](https://ollama.com/download).

**macOS:**

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Or download the `.dmg` from [ollama.com/download](https://ollama.com/download) (requires macOS 14 Sonoma or later).

**Linux:**

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows (PowerShell):**

```powershell
irm https://ollama.com/install.ps1 | iex
```

Or download the installer from [ollama.com/download/windows](https://ollama.com/download/windows) (requires Windows 10 or later).

Verify: `ollama --version`, then pull the models used in this workshop (see [Quickstart](#quickstart)).

### 3. Optional — AWS account

For the Bedrock fallback path only — see [`aws_cli_setup_configuration_guide.md`](aws_cli_setup_configuration_guide.md).

## Known issues

See [`workshop/Readme.md`](workshop/Readme.md#known-issues--live-demo-landmines-read-before-you-go-live) for the full list of live-demo landmines (Bedrock access status, Windows-specific tool caveats, mem0 config notes) before presenting.

## License

MIT — see [LICENSE](LICENSE).
