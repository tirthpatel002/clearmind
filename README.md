# Clearmind

**The memory layer you can see, correct and trust.**

AI assistants now remember things about you, but you can't see what they remember or fix it when it's wrong, and you can't control which agent reads what. Clearmind is a personal memory layer that makes memory *legible* and *governed*:

- **See it.** Every memory has tags, a confidence score and when it was learned.
- **Correct it.** A correction replaces the old version. The old version is kept as history, and recall only ever returns the current one, so stale facts can't come back.
- **Control it.** Agents read only through grants you consented to: which agent, which scopes (work, health…), for what purpose, until when. A purpose is required on every read, every attempt (allowed or denied) is logged, and you can revoke at any time.
- **Learn from it.** Clearmind spots **conflicts** (two flight times), **patterns** (3+ similar facts over 2+ days, shown with their evidence), and **agent lessons** that Nemotron distils from an agent's failed runs. Confidence rises when you confirm a fact and decays over time.

Track: **Personal AI** · Nebius × NVIDIA hackathon, Oct 2026.

## NVIDIA Nemotron on Nebius Token Factory

Clearmind's reasoning runs on Nebius Token Factory through its OpenAI-compatible API:

| Job | Model on Token Factory | Why |
|---|---|---|
| Answering from memory (`ask`, web "An agent asks") | `nvidia/Nemotron-3-Ultra-550b-a55b` | The strongest Nemotron on Token Factory. It answers **only** from memories the policy allowed and cites their ids (~0.8 s per answer). |
| Distilling agent lessons from failed runs | `nvidia/Nemotron-3-Ultra-550b-a55b` (via agentmemory's distiller) | Turns an agent's trace (tool calls and errors) into a reusable "when X, do Y" lesson. |
| Hybrid recall embeddings | `Qwen/Qwen3-Embedding-8B` | Cosine similarity blended 50/50 with BM25, with a minimum-similarity threshold of 0.5. |

You can override the model with `CLEARMIND_CHAT_MODEL` (for example `nvidia/nemotron-3-super-120b-a12b`). Every call is metered into `spend.jsonl` in the data directory, and a hard spend cap (`CLEARMIND_SPEND_CAP_USD`, default $1) stops calls before they go over. A full demo seed costs about **$0.002**.

## Architecture

```mermaid
flowchart LR
  U[You<br/>web app / CLI] -->|remember · correct · confirm| CM
  A[Agents<br/>calendar-agent, shopping-agent] -->|ask with purpose + scope| P
  subgraph CM[Clearmind]
    P[Access policy<br/>grants · consent · expiry · revoke] --> L[(Access log<br/>node:sqlite)]
    P -->|allowed scopes only| R[Hybrid recall<br/>BM25 + Qwen3 cosine ≥ 0.5]
    R --> M[(Memories<br/>current + replaced history)]
    LE[Learning<br/>conflicts · patterns · confidence] --> M
    D[Lesson distiller] --> LS[(Agent lessons)]
  end
  R -->|allowed memories as context| N[Nemotron-3 Ultra<br/>Nebius Token Factory]
  D --> N
  R -. embeddings .-> Q[Qwen3-Embedding-8B<br/>Nebius Token Factory]
  N -->|answer + cited memory ids| A
```

The pieces:
- **agentmemory** (the library underneath) provides storage (SQLite), retrieval, the lesson distiller and supersession.
- **Clearmind** adds the user-facing memory model, the access policy, the learning layer, the Nebius wiring, the CLI and the web app.

## Repository layout

A pnpm workspace with three packages. The core library never imports the server or the app.

```
packages/clearmind/   @clearmind/core: the library (no HTTP, no DOM)
  src/                index, store, policy, learning, abstain, config, types, format, cli,
                      providers/nebius
  tests/              vitest unit tests
server/               @clearmind/server: thin HTTP layer on one port (127.0.0.1)
  src/                index (serve), app (request pipeline), auth, http, static (serves app/dist),
                      routes/{state,memories,access,insights,graph,import,session}, cli (bin)
  tests/              API tests
app/                  @clearmind/app: the web UI, built with Vite
  index.html
  src/                main, api (fetch + stale-reply guard), state, actions (delegated events), dom,
                      views/{overview,memory,access,insights,log,import,onboarding},
                      components/, styles/{tokens,layout,components}.css
scripts/              seed, demo, scale, bench (import @clearmind/core)
eval/                 how the benchmark numbers were produced (see bench branch)
```

## Setup

Requirements: Node ≥ 22.5 and pnpm (via corepack). The repo expects `agentmemory` checked out next to it (`../agentmemory`, worktree `supersession`); `@clearmind/core` links it with `link:`.

```bash
git clone <clearmind> && cd clearmind
corepack pnpm install
corepack pnpm typecheck                  # core, server, app, scripts
corepack pnpm test                       # unit + API tests (vitest projects)
# Keys live outside the repo. Load them per process:
#   NEBIUS_API_KEY=...   (in e.g. ~/.secrets/hackathon.env)
node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/seed.ts ./data   # realistic 14-day demo data
```

**Demo web research (Tavily, demo-only).** `scripts/tavily-research.ts` turns `demo/judges.json` (public name/title/company from Devpost) and `demo/tavily-questions.json` (per judge: background, public LinkedIn/X/GitHub, talks, writing, projects and public views on agents/memory/open models; queries carry full name, company and title, with one name+title-keyword fallback and a match: confident|uncertain flag, plus 24 shared questions on Token Factory, AI Cloud, Nebius, Nemotron, NemoClaw/OpenShell/Hermes Agent, Tavily, agent memory tools, LongMemEval/LoCoMo and the hackathon) into one markdown file per question under `tavily/` (`tavily/judges/<slug>/<topic>.md`, `tavily/sponsors/<topic>.md`, `tavily/INDEX.md`). Each file has YAML frontmatter (question, query, fetchedAt, tool, searchDepth, creditsUsed, sources, `visibleTo`: `[judge-<slug>]` for a judge's own files, `[workspace]` otherwise) and the full Tavily answer and results with links. It never writes memory; the ingest loads the files.

```bash
./node_modules/.bin/tsx scripts/tavily-research.ts                         # default: dry run, prints plan + credit estimate
./node_modules/.bin/tsx scripts/tavily-research.ts --mock --out /tmp/tv    # offline MOCK files (mock: true)
node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/tavily-research.ts --run --max-credits 300  # live; skips existing files unless --force
```

**Production** (one port: built UI + API):

```bash
corepack pnpm --filter @clearmind/app build      # writes app/dist
node --env-file=$HOME/.secrets/hackathon.env --import tsx server/src/cli.ts serve --dir ./data --user tirth --port 8790
# open http://127.0.0.1:8790
```

**Development** (Vite with hot reload, proxying `/api` to a running server):

```bash
node --env-file=$HOME/.secrets/hackathon.env --import tsx server/src/cli.ts serve --dir ./data --user tirth --port 8790
CLEARMIND_API=http://127.0.0.1:8790 corepack pnpm --filter @clearmind/app dev
```

If `app/dist` is missing, the server answers `/` with 503 and a hint to build.

Without a key, everything except `ask` and lesson distillation works offline: pass `--offline`, and recall falls back to BM25.

CLI: `remember, update, recall, list, history, confirm, conflicts, patterns, lessons, grant, grants, revoke, read, log, ask, serve`. Run `corepack pnpm cli help` for usage.

## Demo flow (3 minutes)

1. **Correct a memory.** The standup moved from 10:00 to 11:30; the old version goes to "Corrected history".
2. **An agent asks without a purpose → DENIED** (and logged).
3. **Grant access with consent:** calendar-agent, scope `work`, purpose `schedule-meetings`, expires in 1 hour.
4. **The agent asks again → ALLOWED.** Nemotron answers "11:30 IST" and cites the memory; the log shows which memories it saw.
5. **Revoke → DENIED** again.
6. **What Clearmind learned:**
   - a flight-time conflict
   - patterns (paneer tikka, oat flat white, gym runs), each with evidence across days
   - a calendar-agent lesson: "convert to the participant's timezone".

## Benchmark

Headline numbers come only from official, widely used datasets: **LongMemEval** (LongMemEval-S cleaned, MIT) and **MemoryAgentBench** (FactConsolidation). Offline replay, k=10, one fresh store per case; full table and method in the `bench` branch (`bench/RESULTS.md`).

| dataset (category) | metric | agentmemory (before) | Clearmind | 
|---|---|---|---|
| LongMemEval-S (knowledge_update, 53) | newest version ranked first | 0.528 | **1.000** |
| LongMemEval-S (knowledge_update, 53) | hit@1 | 0.472 | **0.849** |
| MemoryAgentBench FactConsolidation (75) | newest version ranked first | 0.507 | **1.000** |
| MemoryAgentBench FactConsolidation (75) | hit@1 | 0.507 | **0.987** |

BM25 retriever; Qwen3-Embedding-8B results are in `bench/RESULTS.md`. Abstention (LongMemEval `_abs`): thresholds were tuned on a seeded 50-question LongMemEval-S dev subset only (3 `_abs`); those ids are excluded from headline scoring, and the held-out LongMemEval-S score is reported separately.

Not headline numbers:
- **LoCoMo** cases are included for reference only; LoCoMo is licensed **non-commercial** (CC BY-NC 4.0).
- The 81 access-policy cases are **our own stress test (synthetic, not an official benchmark)**. On them Clearmind leaks 0% where a store without a policy layer leaks by construction.

## What was built during the hackathon

**Pre-existing ([agentmemory](https://github.com/tirthpatel002/agentmemory), by the same author):**
- SQLite store
- lexical and embedding retrievers
- OpenAI-compatible embedders
- the trace → lesson distiller, validator and merger

**Built during the hackathon:**
- In agentmemory:
  - **supersession** (`remember / supersede / current / history`, where recall skips replaced versions; branch `supersession`)
  - the **HybridRetriever** (BM25 + cosine; branch `hybrid-recall`)
- Clearmind itself, all of it:
  - the memory model with keys, confirmations and decaying confidence
  - the **access policy** (grants, consent, scopes, purposes, expiry, revoke, audit log)
  - the **learning layer** (conflict detection, pattern detection with evidence and a distinct-day rule, Nemotron lesson distillation for agents)
  - the **Nebius Token Factory integration** (Nemotron chat, Qwen3 embeddings, spend ledger with a hard cap)
  - the policy-enforced **`ask`**
  - the CLI, the web app and the demo seed

## Safety notes

- Keys are never stored in the repo. They are read from the environment only.
- The server binds to `127.0.0.1`.
- Memories are passed to the model as data. The system prompt tells Nemotron to treat them as data, not instructions.

License: MIT
