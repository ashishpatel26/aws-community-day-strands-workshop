# Strands Agents Workshop — College Edition
**4 hours · 60-100 students · mixed Python/CS background · Ollama or Bedrock (student's choice)**

Adapted from `WORKSHOP.md` (AWS Community Day version). Same repo/scripts,
different pacing, more scaffolding, more TA support. Read the original's
"Known Issues" section too — those landmines still apply.

---

## Design decisions vs the original

| Axis | Community Day | College Edition | Why |
|---|---|---|---|
| Audience | pro/mixed AWS users | mixed-skill students, some first agent ever | more concept time, slower ramp |
| Room | 30 | 60-100 | need TAs, pair programming, can't 1:1 debug everyone |
| Model | Ollama primary | **student picks Ollama OR Bedrock** at setup | RAM-poor laptops use Bedrock; avoids "my laptop can't run 7B" being a blocker |
| Module 3 (Graph loops) | full 50min, hands-on | **cut to a 10min demo, no hands-on** | hardest concept in the whole curriculum; with 100 mixed-skill students it stalls the room |
| Module 4 (mem0) | demo-only already | **cut to 10min, one demo, no meta-tooling** | mem0 fragility + 7B reliability caveats aren't worth stage time here |
| Exercises | solo | **pair programming** | 60-100 people means uneven pace; pairing keeps stragglers moving and halves TA load |
| TAs | not mentioned | **required: 1 per ~15-20 students** (4-6 TAs) | this room size cannot run on one presenter |

---

## Pre-Workshop (send 5-7 days before — longer lead time than the pro version)

College students are more likely to skip prep or hit install issues without
warning; front-load harder and add a checkpoint.

**setup.md to distribute, with a "pick your path" fork:**

1. Install `uv`: https://docs.astral.sh/uv/
2. **Path A — Ollama (recommended if ≥16GB RAM):**
   - Install Ollama: https://ollama.ai
   - `ollama pull qwen2.5:7b` (4.7GB, home wifi only)
   - `ollama pull nomic-embed-text` (274MB)
3. **Path B — Bedrock (recommended if <16GB RAM, or Mac/Chromebook with no
   local GPU):**
   - We issue a scoped temporary AWS credential (IAM user, `bedrock:InvokeModel`
     only, auto-expires day after workshop) — distribute via email 2 days
     before, not on the form; credentials leak if sent too early and forgotten.
   - Students run `aws configure` with the issued keys, region `ap-south-1`.
   - No model pull needed — biggest single risk-reduction for this room size.
4. Clone/download workshop repo, `uv sync` from repo root (once, shared `.venv`)
5. Verify: `uv run 0-verify_setup.py --provider ollama` or `--provider bedrock`
   — must print OK. **This is the RSVP gate**: require a screenshot of the OK
   output before workshop day (Google Form). No screenshot = arrive 30min early
   for TA-assisted setup, or pair with someone who's verified.
6. Minimum hardware for Ollama path: 16GB RAM (bump from 8GB in the pro
   version — 7B models on 8GB laptops choke under classroom-wifi + Chrome tabs
   load in practice).

Write `0-verify_setup.py` to accept `--provider {ollama,bedrock}` and branch
accordingly — one script, one message to students, less confusion than two
separate scripts.

**Pairing announcement**: tell students in the pre-work email they'll pair
for exercises — let them pick a partner in advance if they want, reduces
awkward pairing-up time on the day.

---

## Room logistics (60-100 people)

- **TAs: 4-6**, roaming, not at a fixed desk. Give each a laminated card of
  the "Known Issues" section from `WORKSHOP.md` — most questions repeat.
- **Seating**: pairs at each table/bench if possible; one laptop can be the
  "driver," swap roles between Module 2 and Module 3.
- **A visible progress signal**: sticky notes (green = working, red = stuck)
  or a physical card on each laptop lid. At this scale you cannot ask "who's
  stuck?" and expect an honest show of hands — you need a passive signal TAs
  scan for while walking the room.
- **Mic + projector mandatory** — 100-person room, no one hears you unminced.
- **Slides**: same 3 as the pro version (architecture overview, graph-loop
  diagram [now demo-only], deploy-options comparison) — add a 4th: the
  Ollama-vs-Bedrock decision slide, shown once at 0:10.

---

## Timing (4h = 240min, 60-100 students, 2 exercises max — mixed skill needs slack)

| Time | Block |
|---|---|
| 0:00–0:20 | Welcome, hook demo, architecture overview, Ollama/Bedrock check-in (20, not 15 — bigger room, more stragglers) |
| 0:20–1:10 | Module 1: Fundamentals (50min) |
| 1:10–2:10 | Module 2: Tool Use (60min) — the centerpiece, most exercise time |
| 2:10–2:25 | Break (15min — not 10; 100 people need more time to move) |
| 2:25–2:55 | Module 3: Multi-Agent Patterns — **demo only, 30min, no hands-on** |
| 2:55–3:30 | Module 4: Memory & State — **demo only, 35min** |
| 3:30–3:50 | Module 5: Production Concerns — conceptual only, no live Bedrock swap needed since half the room is already on Bedrock (20min) |
| 3:50–4:00 | Wrap, mini-challenge winner shoutout, resources |

Buffer: if Module 1 or 2 exercises run long, Module 3's demo is the thing you
compress (talk over slides faster), never cut Module 2's hands-on — that's
where mixed-skill students actually build confidence.

---

## Module-by-module changes

### Module 1 — Fundamentals (50 min, was 45)
Same content as pro version (`1-structured_output.py`,
`2-weather_forecaster.py`) but:
- **[+5min] Concept**: add "what is an API/HTTP request" before the weather
  demo — pro audience skips this, students may not have it.
- Exercise: pair up, one drives. Both must be able to explain what changed
  when done (verbal check by TA walking by), not just "it ran."

### Module 2 — Tool Use (60 min, was 50) — centerpiece
- Keep all 3 demos (`file_operations`, `teachers_assistant`, `mcp_calculator`).
- Exercise extended to 25min (from 15): adding a 3rd specialist agent is a
  real "aha" moment for this audience — give it room. Pairs present their
  specialist's name to their table group, not the whole room (time).
- Flag `BYPASS_TOOL_CONSENT` and the Windows `shell`/`python_repl` crash
  up front — with 100 laptops you will have both OS types and this bites
  hard at scale.

### Module 3 — Multi-Agent Patterns (30 min, was 50) — **demo-only**
- `1-agents_workflows.py`: run live, explain the pipeline pattern (10min).
- `2-graph_loops.py`: **do not livecode**. Show the graph diagram slide
  first, then run the finished script once, narrate what's happening
  (15min). This is the single highest-risk item for stalling a 100-person
  mixed-skill room — the pro version already calls it "the hardest concept
  today" for a smaller, more experienced crowd.
- 5min Q&A buffer instead of exercise.

### Module 4 — Memory & State (35 min, was 40) — **demo-only, drop meta-tooling**
- `1-knowledge_base_agent.py`: quick demo (10min).
- `2-memory_agent.py`: demo (15min), same "don't let them set this up live"
  caveat as the pro version, now for a much larger room where it'd be worse.
- **Cut `3-meta_tooling.py` entirely** — self-writing-tools plus 7B
  reliability caveats is too much nuance to land with 100 mixed-skill
  students in a compressed slot; it's a "watch me on YouTube later" topic.
- 10min: talk through what mem0 solves conceptually, point to the script
  for later.

### Module 5 — Production Concerns (20 min, unchanged in length, lighter in content)
- Skip the live Bedrock swap demo — roughly half the room is already running
  on Bedrock from Module 1, so the "why deploy to cloud" motivation is
  already felt, not just told.
- Keep the deploy-options slide (Bedrock AgentCore, Docker, Lambda, etc.) —
  one slide, framed as "here's what happens after this workshop."
- Resources + how to keep learning (Discord/Slack, docs link, office hours
  if you're offering any).

---

## Mini-challenge (new — replaces some Module 3/4 hands-on time)

Announce at 0:20, due by 3:50: "Best custom tool added to the Teacher's
Assistant from Module 2." Small prize (stickers, swag, extra credit letter
if a professor is sponsoring). Gives mixed-skill students something to
return to during any dead time, and gives TAs something concrete to look at
when circulating.

---

## What Still Needs Doing Before the Workshop

- [ ] Write `0-verify_setup.py` with `--provider {ollama,bedrock}` flag
- [ ] Set up scoped temporary IAM credentials for Bedrock-path students
      (auto-expiring, `bedrock:InvokeModel` only) — do NOT reuse your own
      AWS account credentials
- [ ] Google Form for setup-verification screenshot, 5-7 days out
- [ ] Recruit and brief 4-6 TAs; give them the "Known Issues" cheat card
- [ ] Confirm room has mic + projector + enough power outlets for 60-100
      laptops (often the real bottleneck, not wifi)
- [ ] Print/prepare green/red status cards or sticky notes for tables
- [ ] Decide mini-challenge prize
- [ ] Dry-run the compressed Module 3/4 demo-only flow, time it for real —
      demo-only sections drift long more easily than hands-on ones because
      there's no natural "everyone's done" checkpoint
