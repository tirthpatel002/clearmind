# Clearmind

A memory layer you can see, correct and trust, for people and AI agents. Built on
[agentmemory](https://github.com/tirthpatel002/agentmemory) (hybrid BM25 + Nebius Qwen3-Embedding-8B recall).

Status: checkpoint 1 (CLI). Blocks done: supersession, access policy.

- **Supersession**: a new version of a memory marks the old one `replaced`; recall only returns the newest.
  `update <id>` or `remember --key k` (same key replaces).
- **Access policy**: agents read only through grants with a scope (tags), allowed purposes, explicit consent,
  optional expiry. A purpose is required on every read. Every grant, read (allowed or denied) and revoke is logged.

```bash
pnpm install
pnpm test
pnpm demo            # offline end-to-end demo
pnpm cli help
```

Secrets are never stored in this repo. Embeddings (optional) read `NEBIUS_API_KEY` from the environment,
e.g. `node --env-file=$HOME/.secrets/hackathon.env`.

License: MIT
