# Decisions Log

Append-only log of decisions made during the build that **diverge from or extend** the original PRD at [`docs/legal/PRD-OPENCLAW-FORK.md`](PRD-OPENCLAW-FORK.md). Each entry is dated, identified, and self-contained. Do not delete or rewrite entries — supersede with a new entry referencing the old.

Entries here take precedence over the PRD where they conflict.

---

## 2026-05-11

### D1. Web chat UI added as Phase 7 deliverable

**Decision:** Add a minimal web chat surface as a new Phase 7 deliverable, scheduled after v1 ships at end of Phase 6.

**Context:** The PRD §17 ends at Phase 6 with Slack + Discord + VS Code as the user-facing surfaces. It does not include a browser-based chat UI. Slack remains the primary attorney-facing channel for v1.

**Why now:** A web chat surface unlocks sharing access with people outside the CBH Slack workspace — outside counsel, paralegals on temporary engagements, expert witnesses, and (eventually) other in-house teams. Without it, every non-Slack participant becomes a Slack-workspace-membership problem.

**Scope impact:**

- ~5–7 days of new work, deferred until v1 ships.
- Same orchestrator backend (no new agent loop). Thin web frontend (likely Next.js or Vite + React) over the existing HTTP gateway OpenClaw already exposes for the VS Code extension.
- Reuses the Slack-response template at `company-context/deliverable-templates/slack-response.md` as the rendered output payload; the web view just renders the same structured deliverable in a browser layout.
- Auth: WorkOS SSO for v2 (per PRD §16 hardening checklist); basic auth or magic-link for the initial Phase 7 cut.

**Trade-offs considered:**

- _"Slack + CLI + VS Code is enough":_ rejected — workable for in-house-only use but blocks outside-counsel collaboration patterns that already exist at CBH.
- _"Move web UI into v1 scope":_ rejected — stretches v1 by ~1 week and pulls focus from the load-bearing rule-engine + ingestion work. Phase 7 deferral keeps v1 on track.

**Renumbers:** What the PRD §17 called "Phase 7+ — Future" (Profile A / Lexis-enabled, Hermes Curator, etc.) shifts to "Phase 8+." Web chat UI is the singular Phase 7 deliverable.

---

## 2026-05-13

### D2. Phase 4 legal layer ships as a single bundled plugin (`extensions/agentic-law-os/`)

**Decision:** Implement the Phase 4 legal plugin pack as a single bundled OpenClaw plugin at [`extensions/agentic-law-os/`](../../extensions/agentic-law-os/), not split across multiple per-concern plugins (`legal-rules/` + `legal-kb/` + `legal-sub-agents/`).

**Context:** The Phase 0 report ([`PHASE-0-REPORT.md` §1](PHASE-0-REPORT.md)) flagged this as a "<30 min" Phase 1 housekeeping decision and listed it as a remaining item. The PRD §18 file inventory implies a single pack but doesn't make it explicit.

**Why a single plugin:**

1. **Tight coupling along the rule-engine spine.** The intake plugin builds the TaskSpec, which the orchestrator consumes, which dispatches sub-agents that emit claims into the ledger, which the rule engine validates at every seam. R1's allowlist fires on tool calls the orchestrator made for sub-agents the intake plugin classified. Crossing plugin boundaries here means re-serializing the TaskSpec and the active rule profile on every hop — cost without benefit.
2. **Single manifest = single contracts surface.** All R-rules and the rule engine's `before_*`/`after_*` hooks live behind one `openclaw.plugin.json`. Splitting forces us to coordinate hook priorities across N manifests and risks ordering bugs (e.g., R1 SourceAllowlist must fire before R2 JurisdictionLock on the same `before_tool_call`).
3. **Mirrors how OpenClaw's own bundled plugins are organized.** [`extensions/slack/`](../../extensions/slack/), [`extensions/codex/`](../../extensions/codex/), and similar bundled plugins each colocate channel + provider + onboarding + tools in a single directory. The legal layer is at a comparable scope.
4. **Cheaper to refactor later than to combine later.** If a sub-component (e.g., the rule engine) grows to where it deserves its own plugin, extracting it from a single-plugin codebase is a typical refactor. Pre-splitting and then needing to fold things back together is harder.
5. **The KB MCP server stays separate.** [`apps/mcp-kb/`](../../apps/mcp-kb/) is already its own pnpm workspace package and its own deployable service ([`PHASE-3-STATUS.md` §"Phase 3 design decisions"](PHASE-3-STATUS.md)). That's correct: MCP servers are inherently external processes. The legal plugin will register the MCP server in `.openclaw/mcp-config.json`, not import it.

**Trade-offs considered:**

- _"Split into `legal-rules/` + `legal-orchestrator/` + `legal-renderer/`":_ rejected — the rule engine is consumed by every other piece, so a split forces a public-API contract on what is currently internal data flow. Premature abstraction.
- _"Split off the rule engine alone":_ rejected for v1 (same coupling argument). Worth revisiting in Phase 5 when R3/R7/R8/R9 land and the engine has stabilized.
- _"Put it in `apps/legal-orchestrator/` instead of `extensions/`":_ rejected — the legal layer needs OpenClaw plugin SDK seams (`before_tool_call`, `subagent_*`, `before_agent_finalize`) that are only available from inside an `extensions/<id>/` plugin. `apps/` is for standalone services.

**Scope impact:**

- File layout for Phase 4: `extensions/agentic-law-os/{api.ts,index.ts,openclaw.plugin.json,package.json,tsconfig.json,src/{intake,orchestrator,rules,subagents,renderer,mcp-config}/}`.
- The Phase 0 [`extensions/legal-spike/`](../../extensions/legal-spike/) probe stays in tree as a smoke test until Phase 4 lands; then it can be removed.
- Single `@openclaw/agentic-law-os` package version; one entry in [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml); one row in `pnpm plugins:inventory`.

**Renumbers / supersedes:** None. This closes the second of the two Phase 0 carry-over follow-ups.
