# Phase 4 — Legal Plugin Pack Status

**Phase scope** (PRD §17): Tier-1 intake plugin (TaskSpec build/freeze), orchestrator plugin (11-layer plan + claim ledger + audit chain), rule engine R1/R2/R4/R5/R6/R10/R11/R12/R13/R14/R15, Statute + Verifier + Confidence sub-agents, Renderer, MCP config registration.

**Phase 4 done-criterion** (PRD §17): _A Slack message to OpenClaw with a California IC-classification escalation produces a Slack-format response with verified citations, classification overlay, and confidence rating._

---

## What landed in this commit (scaffold)

| Deliverable                                                                                       | Status    | Where                                                                                                |
| ------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| Layout decision (single bundled plugin)                                                           | ✓ shipped | [`docs/legal/DECISIONS.md` D2](DECISIONS.md)                                                         |
| Plugin manifest + package + tsconfig + entry                                                      | ✓ shipped | [`extensions/agentic-law-os/`](../../extensions/agentic-law-os/)                                     |
| Workspace integration                                                                             | ✓ no-op   | `extensions/*` glob in [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) auto-picks the new package |
| TaskSpec runtime validator (TypeBox mirror of `schemas/task-spec.schema.json`)                    | ✓ shipped | [`src/intake/task-spec.ts`](../../extensions/agentic-law-os/src/intake/task-spec.ts)                 |
| Tier-1 intake registration shell                                                                  | ✓ stub    | [`src/intake/tier1-intake.ts`](../../extensions/agentic-law-os/src/intake/tier1-intake.ts)           |
| Orchestrator + claim-ledger writer                                                                | ✓ stubs   | [`src/orchestrator/`](../../extensions/agentic-law-os/src/orchestrator/)                             |
| Rule engine: R1, R2, R4, R5, R6, R10, R11, R12, R13, R14, R15 (each with hook target + reasoning) | ✓ stubs   | [`src/rules/`](../../extensions/agentic-law-os/src/rules/)                                           |
| Sub-agents: Statute, Verifier, Confidence, Renderer                                               | ✓ stubs   | [`src/subagents/`](../../extensions/agentic-law-os/src/subagents/)                                   |
| MCP config upsert (registers `agentic-law-os-kb` in `.openclaw/mcp-config.json`)                  | ✓ stub    | [`src/mcp-config/apply.ts`](../../extensions/agentic-law-os/src/mcp-config/apply.ts)                 |
| Plugin config schema (source profile, jurisdictions, rule profile, DB env, MCP command)           | ✓ shipped | [`openclaw.plugin.json#configSchema`](../../extensions/agentic-law-os/openclaw.plugin.json)          |
| README + acceptance criterion + dataflow diagram                                                  | ✓ shipped | [`README.md`](../../extensions/agentic-law-os/README.md)                                             |

## What does NOT land in this scaffold (still pending Phase 4 implementation)

Every stub carries a `TODO(phase-4):` marker naming the OpenClaw hook, sub-agent surface, or runtime API it needs. Order of attack (driven by what unblocks the next):

1. **`src/mcp-config/apply.ts`** — register the kb-mcp server first so the rest of the plugin has tools to call.
2. **`src/intake/tier1-intake.ts`** — TaskSpec construction; everything downstream reads from it.
3. **`src/orchestrator/claim-ledger.ts`** — Postgres writer for `ledger_entries`. Hash-chain triggers in the schema do the validation; the writer just supplies `prev_hash` + payload.
4. **`src/orchestrator/orchestrator.ts`** — plan dispatcher. Iterates layers, calls sub-agents, persists claims.
5. **`src/subagents/statute.ts`** — wires `skills/statute-research/SKILL.md` into a sub-agent run with the `kb_*` tools.
6. **R1 + R2** — simplest rules; `before_tool_call` hook on the kb\_\* surface. Get one working end-to-end before tackling the harder gates.
7. **`src/subagents/verifier.ts`** + R5 HashEcho — closes the anchor verification loop.
8. **`src/subagents/confidence.ts`** + R11 — rule-based scorer; small.
9. **`src/subagents/renderer.ts`** + R6 + R12 + R14 — `message_sending` rules and the deliverable template apply pass.
10. **R4, R10, R13, R15** — finish the last-mile gates.
11. **Smoke test**: a Slack message with a CA IC-classification escalation → verified Slack response.

## Things to confirm before writing implementation

These are sub-decisions the scaffold deliberately did not make:

- **OpenClaw's `api.hooks.register(...)` call signature** — the stubs document the hook _names_ per [`docs/legal/PLUGIN-SDK-NOTES.md`](PLUGIN-SDK-NOTES.md) but the exact API shape (priority value type, return-action enum) needs to be read from `src/plugins/types.ts` or the hook-types subpath. Should be a 5-minute lookup.
- **`api.runtime.subagent.run(...)` parameter shape** — same. Documented in `docs/plugins/sdk-runtime.md`; verify before wiring `subagents/*.ts`.
- **Where the claim ledger Postgres pool lives** — likely created lazily on first use; the plugin shouldn't open the pool at startup if it might run outside an environment with `DATABASE_URL`. Consider a `runtime-api.ts` lazy boundary.
- **Hot-reload behavior** — `definePluginEntry` accepts a `reload` option. Decide whether the legal plugin should be reload-safe in development (probably yes) before adding mutable state.

## Dependency notes

The scaffold's `package.json` declares:

- `ajv` + `ajv-formats` — JSON Schema runtime validation for the Drafter's output schema (R3/R4 workaround per [`PHASE-0-REPORT.md` §4 #6](PHASE-0-REPORT.md)). Pinned versions chosen for stability.
- `pg` + `@types/pg` — Postgres client for the claim ledger. Same connection pattern as `apps/mcp-kb/`.
- `typebox` — already used by the rest of the legal stack and `legal-spike`; matches root `overrides`.

No new root devDeps. No build-script changes.

## Next concrete commit

`pnpm install --frozen-lockfile=false` to pick up the new workspace member, then `pnpm plugins:inventory:gen` to regenerate the inventory doc (per [`PHASE-0-REPORT.md` §3](PHASE-0-REPORT.md)). Then start at item #1 in the order above.
