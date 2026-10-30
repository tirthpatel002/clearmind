# Changelog

Notable changes to Clearmind.

## Unreleased

Opt-in features under `config.features` (omitted = all off, behaviour unchanged). See `packages/clearmind/src/features/config.ts`.

- `time.mode` off|filter|boost (default off): time-aware recall from phrases like "last week", "in March" (`src/time/`).
- `decompose.enabled` (false): rule-based split of compound/comparison questions; recalls are interleaved.
- `adaptiveAbstain.enabled` (false): stricter when query entities appear in no candidate, looser when candidates corroborate.
- `provenance.enabled` (false): source/trust labels (`source:<x>` tag) and spotlighting (datamarked memory blocks) in `ask`.
- `injection.mode` off|flag|drop (off): heuristic prompt-injection screening; fixture suite in `tests/fixtures/injection.json`.
- `conflicts.enabled` (false): conflicting memories (same key / supersession) flagged to the model; `AskResult.conflicts`.
- `citations.evidence` / `citations.required` (false/false): `AskResult.evidence` spans; uncited answers abstain when required.
- `selfCheck.enabled` (false), `onUnsupported` abstain|flag: verifier call; `AskResult.verified`.
