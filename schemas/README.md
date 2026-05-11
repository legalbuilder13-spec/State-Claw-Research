# JSON Schemas — data contracts

Every structured object that crosses an architectural boundary in Agentic-Law-OS is governed by a JSON Schema in this directory. The rule engine (`rules/`) enforces these contracts; the orchestrator (`plugins/agentic-law-os/`) validates against them at every service seam.

All schemas use **JSON Schema 2020-12** (`$schema: "https://json-schema.org/draft/2020-12/schema"`). All schemas reject unknown top-level properties (`additionalProperties: false` on the root object) unless explicitly permitted.

## Conventions (from PRD §11)

- **IDs are ULIDs** — 26-char Crockford Base32. Use the shared `#/$defs/ulid` in `_defs.schema.json`.
- **Timestamps are ISO-8601 with timezone.** Naive datetimes are rejected. Use `#/$defs/iso8601Timestamp`.
- **Hashes are SHA-256.** Two flavors:
  - `#/$defs/sha256Hex` — bare 64-char lowercase hex (used internally, e.g., in DB columns).
  - `#/$defs/sha256Prefixed` — `sha256:` prefix + hex (used at tool/API boundaries to make the algorithm explicit).
- **doc_id is typed**: `<source_category>:<jurisdiction>:<identifier>`. Validates by `#/$defs/docId`.
- **Jurisdiction codes are ISO-3166-2-style**: `US`, `US-CA`, `US-CA:los-angeles-county`. Validates by `#/$defs/jurisdictionCode`.

## File index

| Schema | Owner / Produced by | Consumer / Validated at | Rules enforced |
|---|---|---|---|
| [`_defs.schema.json`](_defs.schema.json) | (shared types) | every other schema via `$ref` | — |
| [`task-spec.schema.json`](task-spec.schema.json) | Tier 1 Intake (orchestrator) | every sub-agent (frozen for the run) | R1, R2 (jurisdictions enum) |
| [`claim.schema.json`](claim.schema.json) | Drafter sub-agent | Renderer; Critic; Verifier | R3, R4, R6, R13 |
| [`claim-ledger.schema.json`](claim-ledger.schema.json) | Orchestrator (append-only) | Audit chain; every sub-agent | (all — every claim must be ledger-entered) |
| [`verifier-output.schema.json`](verifier-output.schema.json) | Verifier sub-agent | Orchestrator (`before_agent_finalize`) | R5, R10 |
| [`confidence-output.schema.json`](confidence-output.schema.json) | Confidence sub-agent | Orchestrator (`before_agent_finalize`) | R11 |
| [`classification-output.schema.json`](classification-output.schema.json) | Classification sub-agent | Renderer | R12 |
| [`completeness-output.schema.json`](completeness-output.schema.json) | Orchestrator | Renderer (`before_agent_finalize`) | R15, R7, R9, R10 |
| [`citation.schema.json`](citation.schema.json) | Drafter | Renderer | R6, R14 |
| [`source-categories.schema.json`](source-categories.schema.json) | (config + enum source) | every schema referencing source categories | R1, R14 |
| [`deliverable.schema.json`](deliverable.schema.json) | Renderer (final output) | Channel adapter (Slack, Discord, web, etc.) | R4, R6, R11, R12, R13, R14, R15; W1, W2, W3, W4 |

## Cross-schema references

Every schema that needs a shared type uses `$ref` pointing at `_defs.schema.json`. Pattern:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agentic-law-os/schemas/<name>.schema.json",
  "type": "object",
  "required": ["id", "created_at", ...],
  "properties": {
    "id":          { "$ref": "_defs.schema.json#/$defs/ulid" },
    "created_at":  { "$ref": "_defs.schema.json#/$defs/iso8601Timestamp" },
    ...
  },
  "additionalProperties": false
}
```

## Validation runtime

The orchestrator's plugin uses [Ajv](https://ajv.js.org/) v8 with these compile flags:
- `strict: true`
- `allErrors: true` (collect every violation per validate call, don't short-circuit)
- `strictTypes: true`
- `strictTuples: true`
- `useDefaults: false` (no implicit defaults — explicit-only)

Validation failures produce per-property error paths that map directly to revise-loop instructions for the Drafter (`/claims/3/cites/0/section`). The schemas use clear `description` text on every property because Ajv surfaces them in error messages.

## Adding a new schema

1. Pick the filename: `<noun>.schema.json` (always include `.schema.json`).
2. Set `$id` to `https://agentic-law-os/schemas/<name>.schema.json`.
3. Use shared types from `_defs.schema.json` where possible — do NOT duplicate type definitions.
4. Set `additionalProperties: false` on the root object.
5. Add a row to the table above.
6. If the schema enforces a rule, update the rule's "Enforcement point" line to mention this schema.
7. Add at least one valid and one invalid fixture to the Phase 4 test suite.

## Why not Protocol Buffers / Avro?

Considered. Rejected because:
- The data crosses LLM boundaries — JSON Schema's ergonomic mapping to TypeBox / Pydantic / Zod beats a proto compilation step in this context.
- The Drafter's output is a structured-but-evolving artifact — additive schema changes need to be cheap; JSON Schema additions are cheaper than proto field additions.
- Ajv runtime is fast enough at our deliverable rate (single-digit deliverables per minute peak).

Reconsider in Phase 6+ if the ingestion worker's per-span throughput becomes a bottleneck (Postgres COPY is faster with binary formats).
