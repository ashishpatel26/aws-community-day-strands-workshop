# Strands Agents Hands-On Workshop
**AWS Community Day — 26 September 2026 — 4 hours**

Audience: mixed beginner→intermediate. Format: hands-on, attendees code on own
laptops. Primary model: local Ollama (`qwen3.5:4b`). Fallback: Amazon Bedrock
(swap `OllamaModel` → `BedrockModel`, one line, covered in Module 5).

**Teaching approach**: don't read Strands like a book — read it like an
architecture spec. Every module below follows one pattern:

```
Problem → Concept → Abstraction → Minimal code → Execution flow → Failure modes → Production implications
```

Each module opens with the **5 Questions** (what problem does this solve,
what's the abstraction, what's the minimum code, what happens internally,
when would you NOT use it) before any script runs. The code is the *proof*
of the mental model, not the starting point.

---

## The architecture map (show this first, before any code)

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

If an attendee can point at any box in this diagram and say what it does
and which script demonstrated it, the workshop worked. That's the bar —
not "did they memorize the API."

The agent loop itself (draw this on Module 1's whiteboard):

```
User → Agent → LLM ─┬─ final answer ──────────► User
                     └─ tool call → Tool → Tool result → LLM ─┬─ another tool
                                                                └─ final answer
```

Every module from here is one branch of this loop getting deeper.

---

## Pre-Workshop (send 3-5 days before, not during the 4 hours)

Attendees must arrive with this done — do not spend workshop time on installs.

**setup.md to distribute:**
1. Install `uv` (Python package manager): https://docs.astral.sh/uv/
2. Install Ollama: https://ollama.ai
3. `ollama pull qwen3.5:4b` (~3.4GB — do this on home wifi, not conference wifi)
4. `ollama pull nomic-embed-text` (274MB)
5. Clone/download workshop repo, `uv sync` (run from repo root, once — all
   module folders share the same `.venv`)
6. Verify: `ollama list` shows both models; `uv run 0-verify_setup.py` prints OK
7. Minimum hardware: 8GB RAM, GPU strongly preferred — `qwen3.5:4b` fits fully
   on most consumer GPUs (confirmed 100% GPU in testing), CPU-only is usable
   but slower. If a laptop can't run it at all, pair with a neighbor or use
   the Bedrock fallback path in Module 5.
8. Optional: if using the Bedrock fallback, also follow
   `workshop/08-production/BEDROCK_SETUP.md` beforehand (AWS CLI config +
   model access grant can take time to clear — see that doc's known issues).

Write `0-verify_setup.py` (repo root): pings ollama, runs one trivial
`agent("say OK")` call, confirms strands import + model reachable. Catches
env problems before minute 1.

**Folder layout** — matches the 8-stage reading order from SDK-Reading.md.
Run each script from inside its own folder, some write relative-path files
like `tools/` or `mem0_data/`:
```
workshop/
  WORKSHOP.md                          this file
  model_provider.py                    shared: Ollama primary, Bedrock fallback
  test_model_provider.py               unit tests for the fallback logic
  01-quickstart/                       Stage 1 — Agent/model/tools shape
    1-structured_output.py
  02-agent-loop/                       Stage 2 — the loop itself
    1-weather_forecaster.py
  03-tools/                            Stage 3 — custom, vended, agent-as-tool
    1-file_operations.py
    2-teachers_assistant.py
  04-model-providers/                  Stage 4 — concept only, see below
  05-state-memory/                     Stage 5 — session vs long-term memory
    1-knowledge_base_agent.py
    2-memory_agent.py
  06-mcp/                              Stage 6 — MCP server/client
    1-mcp_calculator.py
  07-multi-agent/                      Stage 7 — Workflow, Graph
    1-agents_workflows.py
    2-graph_loops.py
  08-production/                       Stage 8 — deployment, meta-tooling, vision
    1-meta_tooling.py
    2-multimodal_optional.py
    BEDROCK_SETUP.md
    MODEL_PRICING.md
```

`04-model-providers` has no dedicated script — it's a concept-only stage per
SDK-Reading.md ("don't spend hours studying every provider"). The
abstraction it teaches (`Agent` doesn't change when the model does) is
proven live in `08-production` when `model_provider.py` swaps Ollama for
Bedrock — same code, different backend.

---

## Timing Overview (4h = 240min, assume 30-person room)

| Time | Block |
|---|---|
| 0:00–0:15 | Welcome, architecture map (above), troubleshoot stragglers' setup |
| 0:15–1:00 | Module 1: Agent Basics & the Agent Loop (45min) |
| 1:00–1:50 | Module 2: Tools — Custom, Vended, MCP, Agent-as-Tool (50min) |
| 1:50–2:00 | Break (10min) |
| 2:00–2:50 | Module 3: Multi-Agent Patterns (50min) |
| 2:50–3:30 | Module 4: State & Memory (40min) |
| 3:30–3:50 | Module 5: Production — model swap, deployment map (20min) |
| 3:50–4:00 | Wrap: the architect-level mental model, Q&A, resources |

Buffer built in: each module's "you try" exercise is the first thing cut if
running behind — demo the solution instead of live-coding it.

---

## Module 1 — Agent Basics & the Agent Loop (45 min)

### The 5 Questions (answer before opening any file)
1. **What problem does this solve?** Turning an LLM (stateless text-in,
   text-out) into something that can *act* — call functions, return
   structured data, chain steps — without you hand-writing that control flow.
2. **What's the abstraction?** `Agent(model=model, tools=tools)`, then
   `result = agent("do something")`. Three moving parts: model, tools, the
   loop that ties them together.
3. **What's the minimum code?** `01-quickstart/1-structured_output.py` —
   nine lines to a working agent.
4. **What happens internally?** Prompt → Agent → Model → (tool call? →
   Tool → Tool result → Model again) → final answer → User. This *is* the
   agent loop — draw it, don't just say it.
5. **When would you NOT use an agent?** When the task is a fixed, known
   sequence of steps with no reasoning or branching needed — that's just a
   function. Agents earn their cost when the *next step depends on what
   just happened*.

### Run it
- **[10min] Concept**: Strands runs inside your own process — it's a
  library, not a hosted platform. That's why `OllamaModel`/`BedrockModel`
  are interchangeable: the agent logic doesn't change when the model
  provider does (this becomes the whole point of Module 5).
- **[10min] Demo + run**: `01-quickstart/1-structured_output.py` — agent
  returns a validated Pydantic object instead of raw text. Why this beats
  regex-parsing LLM output: the model is *constrained* to the schema, not
  hoping its text matches a pattern you wrote after the fact.
- **[10min] Demo + run**: `02-agent-loop/1-weather_forecaster.py` — single
  agent, HTTP tools (`strands.vended_tools.http_request`/`web_fetch`),
  autonomous multi-step API chaining. Best "wow" opener — real API, real
  data, the agent visibly reasons through 2 HTTP calls unprompted. This is
  the agent loop from the architecture map, live.
- **[15min] Exercise**: attendees modify `1-weather_forecaster.py` to answer
  a different city, then add a second tool of their choice and get the
  agent to use both. Ask them to predict, before running: *will the agent
  call both tools, or just one?* — then verify. This builds the "what
  happens internally" muscle.

**Failure mode to mention**: an agent with no tools and a vague prompt will
confidently make things up rather than admit it doesn't know — the loop
still runs, it just never branches into a tool call. Tools aren't optional
plumbing, they're what keeps the loop honest.

Checkpoint: everyone has run ≥2 working agents and can draw the agent loop
from memory by 1:00.

---

## Module 2 — Tools: Custom, Vended, MCP, Agent-as-Tool (50 min)

### The 5 Questions
1. **What problem does this solve?** An LLM alone can't read a file, call an
   API, or run code. Tools are the mechanism through which an agent moves
   beyond text generation into acting on external systems.
2. **What's the abstraction?** Four mechanisms, one interface — the agent
   doesn't care which kind of tool it's calling:
   ```
                    TOOLS
                      │
          ┌───────────┼────────────┐
          │           │            │
        Custom      Vended        MCP
         Tools       Tools        Tools
          │           │            │
          └───────────┼────────────┘
                      │
                Agent-as-tool
   ```
3. **What's the minimum code?** `@tool` decorator on a plain function —
   `03-tools/2-teachers_assistant.py`'s `math_assistant` is the clearest
   example (an agent wrapped as a tool for another agent).
4. **What happens internally?** Model decides "I need tool X" → emits a
   structured tool call → Strands executes it → result goes back into the
   conversation → model continues. The model never runs code itself, it
   only ever asks Strands to.
5. **When would you NOT use MCP specifically?** If the function is local,
   simple, and tightly coupled to this one application — a custom `@tool`
   function is simpler than standing up a protocol server for it. MCP earns
   its cost when the tool needs to be *reusable across different agents/apps*.

### Run it
- **[10min] Demo**: `03-tools/1-file_operations.py` —
  `file_read`/`file_write`/`editor` (vended tools). Flag the Windows gotcha
  up front (`BYPASS_TOOL_CONSENT`) so nobody hits the console-hang bug live.
- **[15min] Demo + run**: `03-tools/2-teachers_assistant.py` — the
  **agent-as-tool** pattern: one orchestrator routing to specialist agents
  wrapped as tools. This is the centerpiece of the module — walk the `@tool`
  decorator carefully, this pattern reappears as the foundation of Module 3.
- **[10min] Demo**: `06-mcp/1-mcp_calculator.py` — MCP server/client.
  **Tool vs MCP, the distinction that matters**:
  ```
  Custom Tool → function inside your application
  MCP         → standard protocol → external tool server → reusable capability
  ```
  Needs two terminals — pre-start both before demoing, don't fumble it live.
- **[15min] Exercise**: attendees add a 3rd specialist agent to the
  Teacher's Assistant and get the orchestrator to route to it correctly.

**Failure mode to mention**: a tool with an ambiguous docstring gets called
at the wrong time, or not at all — the model routes on the tool's
*description*, not its implementation. A bad tool description is a bug,
even if the function itself is correct.

Checkpoint: everyone has a working multi-tool orchestrator and can state the
tool-vs-MCP distinction unprompted by 1:50.

---

## Break (10 min)
Good spot — Module 3 has the heaviest concepts of the day.

---

## Module 3 — Multi-Agent Patterns (50 min)

### The 5 Questions
1. **What problem does this solve?** One agent, one system prompt, one
   toolset gets unwieldy fast — mixing "research the web" and "write
   polished prose" logic in one prompt fights itself. Splitting into
   specialized agents that hand off work keeps each one simple.
2. **What's the abstraction?** Two patterns today, ordered by how much
   control you give up:
   ```
   Workflow:  A → B → C → D          (deterministic, you wrote the order)
   Graph:     A → (B|C) → D           (dynamic routing, conditions decide)
   ```
   (Agents-as-Tools from Module 2 is actually the third pattern — you
   already built it.)
3. **What's the minimum code?** String-chaining agent outputs —
   `07-multi-agent/1-agents_workflows.py`'s `run_research_workflow`
   function is three `Agent()` calls in sequence, nothing fancier.
4. **What happens internally?** Workflow: no magic, each agent's output
   becomes the next agent's input, full stop. Graph: `GraphBuilder` adds
   *conditions* on edges — a node's result decides which edge fires next,
   which is how a revise-loop becomes possible.
5. **When would you NOT use a graph?** If the steps are always the same
   order with no branching, Workflow is simpler and has nothing to debug —
   graphs earn their complexity when the *next step depends on evaluating
   the last one's output*.

### Run it
- **[15min] Demo + run**: `07-multi-agent/1-agents_workflows.py` —
  sequential pipeline (Researcher→Analyst→Writer). Emphasize
  `callback_handler=None` and that this is the simplest multi-agent
  pattern that exists: no framework magic, just passing strings.
- **[20min] Demo + run**: `07-multi-agent/2-graph_loops.py` —
  write/review/revise loop with `GraphBuilder`, a deterministic non-LLM node
  (`QualityChecker`), loop guards (`max_node_executions`,
  `execution_timeout`). Hardest concept today — draw the graph on a
  whiteboard/slide *before* showing code:
  ```
        writer
          │
          ▼
   quality_checker ──REVISE──► back to writer
          │
       APPROVED
          │
          ▼
      finalizer
  ```
- **[15min] Exercise**: attendees change `QualityChecker`'s `min_words`
  threshold and observe the loop behavior change; stretch goal — add a
  second deterministic check (e.g. banned-word filter).

**Failure mode to mention**: a graph with no execution guard can loop
forever if the condition never resolves to "done" — `max_node_executions`
and `execution_timeout` aren't optional safety theater, they're the only
thing standing between a bug and an infinite bill (doubly true once this
runs against a paid model instead of free local Ollama).

Checkpoint: everyone has seen a working feedback loop graph and can explain
why the loop guard exists by 2:50.

---

## Module 4 — State & Memory (40 min)

### The 5 Questions
1. **What problem does this solve?** An LLM call is stateless by default —
   ask it something, get an answer, ask again with no memory of the first.
   Real assistants need to remember facts across separate invocations, not
   just within one conversation.
2. **What's the abstraction?**
   ```
   Agent
    ├── Conversation state   (within one session)
    ├── Session               (one user's ongoing interaction)
    └── Long-term memory       (persists across sessions entirely)
   ```
   Ask, for every memory design: *what does the agent remember, where is it
   stored, when does it disappear, how does a new call access it?*
3. **What's the minimum code?**
   `05-state-memory/1-knowledge_base_agent.py` — explicit, code-defined
   store/retrieve routing. No framework magic, just an if/else and a
   local file-backed `memory` tool call.
4. **What happens internally?** Store: content gets embedded (turned into a
   vector) and saved. Retrieve: the query gets embedded too, and the
   store returns whatever's closest by similarity — this is why the
   *embedding model* matters as much as the chat model.
5. **When would you NOT use vector memory?** If you just need the last N
   messages of *this* conversation, that's session state, not memory — far
   simpler, no embeddings, no vector store. Reach for mem0/vector search
   only when facts need to survive across sessions or be searched by
   meaning rather than recency.

### Run it
- **[10min] Demo**: `05-state-memory/1-knowledge_base_agent.py` —
  code-defined store/retrieve routing, deterministic not tool-autonomous.
  Simpler mental model than mem0, good bridge into it.
- **[20min] Demo (not hands-on — too fragile for 30 laptops at once)**:
  `05-state-memory/2-memory_agent.py` — mem0 + local Ollama embeddings,
  FAISS vector store. Be upfront: this took real debugging to get working
  locally (dimension mismatches inside mem0's own internals — the packaged
  `strands_tools.mem0_memory` tool hardcodes an embedding dimension that
  doesn't match the embedder it's configured with). Show it running, explain
  *why* it needed a hand-rolled config instead of the packaged tool, point
  attendees to the script to try later rather than live-debugging FAISS
  dimension mismatches in front of 30 people.
- **[10min] Demo**: `08-production/1-meta_tooling.py` — agent writes and
  hot-loads its own tool at runtime (this stage jumps ahead to Production
  since meta-tooling is closer to that concern than pure memory — but it's
  a natural, fun closer for the memory module too). Note the small-model
  reliability caveat (local models can be shaky on 3+-step tool chains —
  a real limitation of running small models locally, not a Strands bug).

No exercise this module — mem0 setup fragility makes hands-on risky at scale.
Attendees follow along, ask questions, try it after the workshop.

**Failure mode to mention**: retrieval returning "nothing relevant" isn't
always a bug — if the stored fact and the query don't share enough semantic
similarity (wrong embedding model, too-strict `min_score`), the agent
correctly says "I don't know" about something that *is* in memory. Debug
the retrieval score before assuming the store is broken.

Checkpoint: everyone can explain the store→embed→search→retrieve flow by
3:30, even if they haven't run mem0 themselves.

---

## Module 5 — Production (20 min)

### The 5 Questions
1. **What problem does this solve?** Getting from "works on my laptop" to
   something a team can rely on — different model provider, observability,
   deployment target.
2. **What's the abstraction?** The agent logic doesn't fundamentally change
   when the model provider changes — that's the whole architectural point
   of Module 1 paying off here:
   ```
                    Agent
                      │
                      ▼
               Model Interface
                      │
          ┌───────────┼───────────┐
          │           │           │
       Ollama     Bedrock      OpenAI
          │           │           │
         LLM         LLM         LLM
   ```
3. **What's the minimum code?** `workshop/model_provider.py`'s
   `get_model()` — tries Ollama, falls back to Bedrock (or vice versa) with
   zero changes needed in any of the example scripts that call it.
4. **What happens internally?** Every script imports `get_model()` instead
   of constructing a model directly — the swap happens in one file, once,
   and every script downstream picks it up automatically.
5. **When would you NOT swap to Bedrock?** If local/offline/free is a hard
   requirement (privacy, cost, no reliable internet) — Ollama stays primary.
   Bedrock earns its place when you need bigger models than a laptop can
   run, or don't want every teammate installing and babysitting Ollama.

### Run it
- **[8min]** Show the swap live: `model_provider.py`'s `get_model()` —
  Ollama primary today, Bedrock secondary. Explain *why* fallback logic
  beats a hard model choice: production code shouldn't die because one
  provider had a bad five minutes. Full setup: `08-production/BEDROCK_SETUP.md`.
  **Known status**: Bedrock access is still account-gated as of last test
  (see Known Issues below) — demo the fallback triggering cleanly rather
  than forcing a live Bedrock call if it's still blocked.
- **[7min]** Deployment map — one slide, which target fits which use case:
  ```
  Production Agent
  │
  ├── Bedrock AgentCore   → managed, Bedrock-native
  ├── Docker/Fargate/ECS  → containerized, portable
  ├── Lambda              → event-driven, serverless
  └── EC2/EKS             → full control, most ops overhead
  ```
  Not a deep dive — point at `/docs/user-guide/deploy/` for the real detail.
- **[5min]** Resources: strandsagents.com/docs, repo link, how to reach you.

**Failure mode to mention**: swapping providers silently changes behavior —
different models have different tool-calling reliability (we hit this
directly: a bigger local model wandered off-script and hit a token limit
where a smaller one answered correctly). Never assume "same code, same
provider-swap" means "same output quality" — re-test after every swap.

---

## Closing: the architect-level mental model (5 min, end of Module 5)

Don't ask attendees to remember individual APIs. Ask them to draw this:

```
                         USER
                           │
                           ▼
                    ┌─────────────┐
                    │    AGENT    │
                    │ Agent Loop  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           MODEL         TOOLS        STATE
              │            │            │
        Ollama/Bedrock   Custom/MCP    Session/Memory
                           │
                           ▼
                  ┌─────────────────┐
                  │ MULTI-AGENT     │
                  │ Workflow/Graph  │
                  └────────┬────────┘
                           │
                           ▼
                    PRODUCTION LAYER
```

If they can map each box to a script from today, they understand Strands —
they don't need to have memorized the whole API surface.

---

## Known Issues / Live-Demo Landmines (read before you go live)

- **`08-production/2-multimodal_optional.py`**: local Ollama models used
  here have no vision. Don't demo unless you've pulled a vision model and
  re-tested — currently cut from the agenda entirely, keep it that way
  unless you fix it beforehand. Recommended cheap Bedrock vision model in
  `08-production/MODEL_PRICING.md` if Bedrock access clears in time.
- **`06-mcp/1-mcp_calculator.py`**: needs server running in a separate
  terminal before the client. Pre-start it before your demo block, don't do
  it live.
- **`05-state-memory/2-memory_agent.py`**: works, but only after bypassing
  `strands_tools`' built-in mem0 tool and hand-configuring `mem0.Memory`
  directly (dimension mismatches in the packaged tool). Demo from the
  already-fixed script; if an attendee tries the naive
  `strands_tools.mem0_memory` approach they will hit the same wall you did —
  have the explanation ready.
- **`08-production/1-meta_tooling.py`**: small local models sometimes
  narrate tool calls as text instead of invoking them, or mangle a 3rd
  chained call. The script has a deterministic fallback built in so the
  demo doesn't stall — don't remove it.
- **Model choice matters more than expected**: swapping the local Ollama
  model from `qwen2.5:7b` → `qwen3.5:9b` → `qwen3.5:4b` produced three
  different behaviors — 9b ran partly on CPU (slow, 53%/47% split) and went
  off-script on a simple weather query until it hit a token limit; 4b runs
  100% GPU and stayed on-task. Bigger isn't automatically better for
  tool-calling reliability — test the actual model you'll demo with, not
  just the biggest one you can fit.
- **Windows attendees**: `strands_tools.shell` / `python_repl` import
  POSIX-only modules (`pty`, `fcntl`) and crash on import on Windows. Already
  dropped from `08-production/1-meta_tooling.py` /
  `03-tools/2-teachers_assistant.py`. If any attendee is on Windows and
  adds these tools back in during an exercise, they'll hit this — know the
  fix (drop those two tools) on the spot.
- **`editor`/`file_write` tools**: need `BYPASS_TOOL_CONSENT=true` set before
  they're imported, or they hang on an interactive y/n prompt that breaks
  under most terminals (including Windows). Already set in every script that
  uses them — flag it if attendees copy the pattern into new code.
- **Bedrock**: as of last test, every model/region/API combination tried
  (Anthropic, Qwen, OpenAI, AI21; `ap-south-1` and `us-east-1`;
  InvokeModel/Converse) returns the same account-level
  `ValidationException: Operation not allowed`. The old "Model access"
  console page has been retired — AWS says serverless models auto-enable on
  first invoke, but that isn't triggering for this account. This needs an
  AWS Support case, not a console click. **Don't promise a live Bedrock
  demo** — show the fallback triggering cleanly instead, that's still a
  legitimate and useful thing to demonstrate.

---

## What Still Needs Doing Before 26 Sep

- [ ] Write `0-verify_setup.py` (setup-check script, see Pre-Workshop section)
- [ ] Write and distribute `setup.md` to registered attendees, 3-5 days out
- [x] Bedrock fallback documented — `08-production/BEDROCK_SETUP.md`
- [ ] Open AWS Support case re: account-wide `Operation not allowed` on
      every Bedrock model — do this soon, support tickets take time
- [ ] Decide: pull a vision model and re-enable the multimodal module, or
      leave cut from agenda (current plan: leave cut, mention it exists)
- [ ] Slides: 1 architecture map (this doc's top section), 1 graph-loop
      diagram, 1 deploy-options comparison — everything else is live code
- [ ] Dry-run the full 4hr flow solo, time each module for real
