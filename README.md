# Clearmind

Clearmind is a multi-user personal AI memory layer. It stores versioned, sourced memories and entities for each user: a correction replaces the old version (which is kept as history), every memory records where it came from, and each user's data stays private to them, with agents reading only through grants that user consented to. Recall is fast and hybrid (BM25 plus embeddings). Answers come from NVIDIA Nemotron on Nebius Token Factory and cite the memories they used. Live web research uses Tavily.

Track: Personal AI, Nebius x NVIDIA Global AI Hackathon (Oct 2026). Licence: MIT.

## Quick start

Requirements: Node >= 22.5 and pnpm (via corepack). The workspace links the `agentmemory` library from a sibling checkout (`../agentmemory`).

```bash
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test
```

Set these environment variables (names only; keep values outside the repo):

- `NEBIUS_API_KEY`: Nebius Token Factory key (chat and embeddings). Without it, use `--offline`; recall falls back to BM25 and `ask` is unavailable.
- `TAVILY_API_KEY`: needed only for live Tavily research.
- Optional: `CLEARMIND_CHAT_MODEL`, `CLEARMIND_EMBED_MODEL`, `CLEARMIND_SPEND_CAP_USD`, `CLEARMIND_DATA_DIR`, `CLEARMIND_PORT`, `CLEARMIND_ACCESS_TOKEN`. The full list is read in `packages/clearmind/src/config.ts`.

Seed demo data, build the web app, and run the server:

```bash
corepack pnpm seed ./data                          # realistic demo data
corepack pnpm build                                # builds app/dist
corepack pnpm serve --dir ./data --user alex --port 8790
# open http://127.0.0.1:8790
corepack pnpm demo                                 # scripted demo run
corepack pnpm cli help                             # CLI usage
```

For UI development, run the server as above and then `CLEARMIND_API=http://127.0.0.1:8790 corepack pnpm dev`.

## How it works

- **Memory model** (`packages/clearmind`, `@clearmind/core`): memories with keys, tags, sources and confidence. Corrections supersede older versions, and recall returns only the current one.
- **Access policy**: agents read with a stated purpose and scope through consented, expiring, revocable grants. Every attempt, allowed or denied, is logged.
- **Recall**: BM25 blended with `Qwen/Qwen3-Embedding-8B` embeddings from Token Factory.
- **Answers**: Nemotron (default `nvidia/Nemotron-3-Ultra-550b-a55b`) answers only from the allowed memories and cites their ids. It abstains when the memories don't support an answer.
- **Learning**: conflicts, patterns and agent lessons distilled from failed runs.
- **Server and app**: `server/` is a thin HTTP layer bound to 127.0.0.1 that also serves the Vite web app in `app/`.
- **Spend control**: model calls are metered, and a spend cap (`CLEARMIND_SPEND_CAP_USD`) stops them before they go over.

```
packages/clearmind/   @clearmind/core: library (no HTTP, no DOM)
server/               @clearmind/server: HTTP API + CLI (server/src/cli.ts)
app/                  @clearmind/app: web UI (Vite)
scripts/              seed, demo, bench, scale, Tavily research
eval/                 LongMemEval harness
```

## Read next

1. [packages/clearmind/README.md](packages/clearmind/README.md): the core library API and its files.
2. [eval/README.md](eval/README.md): how the evaluation harness runs.
3. [CHANGELOG.md](CHANGELOG.md): opt-in features added recently.
4. [hackathon.md](hackathon.md): hackathon rules and how Clearmind uses the sponsor tech.
5. [docs/README.md](docs/README.md): index of the reference material.

## Safety notes

- Keys are read from the environment only and are never stored in the repo.
- The server binds to `127.0.0.1` by default.
- Memories are passed to the model as data, not instructions.

## License

MIT, see [LICENSE](LICENSE).
