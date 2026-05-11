# OpenClaw Plugin SDK Reconnaissance

**Phase:** 0 (spike & verify)
**Date:** 2026-05-11
**Purpose:** Determine whether OpenClaw's plugin SDK exposes the architectural seams the Agentic-Law-OS legal layer needs (rule engine R1–R15, sub-agent dispatch, MCP server registration, multi-channel Slack with Codex/OAuth auth).

Where the PRD guessed at OpenClaw internals, this doc records the actual observed shape.

---

## TL;DR verdict

| Capability the fork needs | OpenClaw status | Notes |
|---|---|---|
| Custom plugin scaffolding (`extensions/<id>/`) | GREEN | Manifest is **`openclaw.plugin.json`** (PRD's `plugin.json` guess is wrong) |
| Tool registration (R1, KB tools, etc.) | GREEN | `api.registerTool(...)` with TypeBox `Type.Object(...)` params |
| Pre-tool-call gate (R1 source allowlist, R2 jurisdiction lock) | GREEN | `before_tool_call` hook with `block`/`rewrite`/`requireApproval` decisions |
| Post-tool-call log (retrieval log) | GREEN | `after_tool_call` hook |
| Pre-finalize gate (R6, R11, R12, R14, R15) | GREEN | `before_agent_finalize` + `message_sending` hooks; supports `action: "revise"` |
| Inbound intercept (Tier 1 intake) | GREEN | `message_received`, `inbound_claim` hooks |
| Sub-agent dispatch (Verifier, Critic, Classification, etc.) | GREEN | First-class: `api.runtime.subagent.run(...)`; `subagent_*` hooks for coordination |
| LLM-side output schema enforcement (R3, R4 native) | YELLOW | Not exposed in plugin API. Workaround: `before_agent_finalize` with `revise` action, or verifier sub-agent re-checks against the claim ledger |
| MCP server registration (KB MCP) | GREEN (different path than PRD assumed) | Config-driven via `.openclaw/mcp-config.json` (and/or Codex app-server's native MCP discovery), not plugin-API |
| Slack channel works with Codex/OAuth auth | GREEN | Channels are provider-agnostic; auth is selected at the agent layer |
| Codex harness (GPT-5.4/5.5 via subscription) supports hooks + tools + subagents | GREEN | No restrictions on tool count, hook usage, or subagent dispatch |

**Net:** OpenClaw covers every seam the rule engine R1–R15 needs. R3 and R4 require a small workaround (re-revise via hook instead of `response_format`-style constraint), which is acceptable. There are **no architectural blockers** for Phase 1.

---

## Detailed findings

### Q1. Plugin layout & manifest
Custom plugins live in `extensions/<name>/` (runtime/code) and `skills/<name>/` (procedural recipes; markdown-based). Both are pnpm workspace members and are auto-discovered.

Manifest filename: **`openclaw.plugin.json`** (the PRD's `plugin.json` guess is wrong — record this).

Required schema fields: `id` (string), then optionally `name`, `description`, `version`, `configSchema` (JSON Schema for plugin config), and `contracts` (declares ownership of channels/tools/providers so OpenClaw can discover capabilities without loading runtime code).

Evidence:
- `docs/plugins/building-plugins.md` shows minimal manifest shape
- `extensions/slack/openclaw.plugin.json` has `id`, `channels`, `channelEnvVars`, `configSchema`

### Q2. Tool registration
Tools are registered at runtime via the plugin entry point:

```ts
api.registerTool({
  name: "kb_statutes_search",
  description: "Search the local statute corpus.",
  params: Type.Object({
    jurisdiction: Type.String(),
    query: Type.String(),
    limit: Type.Optional(Type.Number()),
  }),
  execute: async (args, ctx) => { ... },
});
```

Tools must also be declared in `contracts.tools[]` in the manifest so they're discoverable pre-load.

Evidence: `docs/plugins/building-plugins.md` (`definePluginEntry`, `api.registerTool` examples).

### Q3. Hooks / seams for rule enforcement
Hooks fire in priority order, support async returns, and can return decisions like `{ block: true, reason }`, `{ requireApproval: true }`, or `{ rewriteParams: ... }`.

Catalog (from `docs/plugins/hooks.md`):
- `message_received`, `inbound_claim` — Tier 1 intake interception
- `before_prompt_build`, `before_agent_run`, `before_turn` — agent-turn entry
- `before_tool_call`, `after_tool_call` — R1, R2 enforcement and retrieval logging
- `before_agent_finalize` — R6, R11, R12, R14, R15 gates; supports `action: "revise"` for re-revision
- `message_sending` — pre-delivery rewrite of the final response
- `subagent_spawning`, `subagent_delivery_target`, `subagent_spawned`, `subagent_ended` — sub-agent coordination

This is the cleanest possible fit for the rule engine. No agent-loop wrapping required.

### Q4. Output-schema enforcement (R3, R4)
OpenClaw does **not** expose `response_format` / structured-output enforcement in the public plugin API. This is the one yellow item.

Workaround pattern (acceptable for Phase 1):
1. Drafter sub-agent produces a draft.
2. `before_agent_finalize` hook validates the draft against the Drafter's JSON Schema (manually via `ajv` in the plugin).
3. On schema violation, return `{ action: "revise", instructions: "..." }` — the agent will be re-prompted with the violation details and asked to produce a compliant version.
4. Verifier sub-agent independently re-fetches every anchored span and exact-matches against the source; non-matching quotes are stripped.

This is essentially the PRD's design intent — schema enforcement was always going to live at the renderer/critic seam, not as an LLM-side constraint.

### Q5. Sub-agent dispatch
First-class:

```ts
const result = await api.runtime.subagent.run({
  session: "agent:main:subagent:verifier",
  task: { ... },
  modelOverride: ...,
});
```

This is the foundation for Verifier, Critic, Classification, Confidence, and Renderer sub-agents. Each gets its own session id so transcripts and audit logs remain separable.

### Q6. MCP server registration
The plugin SDK does not expose `api.registerMcp(...)`. MCP servers are registered at the **runtime config layer**:
- File: `.openclaw/mcp-config.json` (project-level config)
- The Codex native harness also has its own app-server-driven MCP discovery (see `docs/plugins/codex-native-plugins.md`)

This matches what the PRD §14 actually planned ("Register the MCP server in OpenClaw's MCP config"), so it's not a blocker — just a different mental model than "plugin registers MCP server."

### Q7. Slack ↔ Codex auth independence
Slack is auth-provider-agnostic. The Slack extension declares `channels: ["slack"]` and reads `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET` via `channelEnvVars`. The inference provider (Codex via OAuth, Anthropic API key, etc.) is selected at the agent level, not the channel level. Codex + Slack works.

### Q8. Agent loop entry point
The orchestration is **hook-driven**, not class-extension-driven. The main loop lives under `src/agents/` and walks the hook registry at each phase. We don't need to wrap or fork the loop — we just register hooks.

### Q9. Language & project structure
- TypeScript (ESM), Node ≥22, pnpm 11 (already pinned via `packageManager` in `package.json`)
- After scaffolding a new extension under `extensions/<id>/`, run `pnpm install` at the repo root to refresh workspace links
- Tools and hooks are typed against `@openclaw/plugin-sdk` exports

### Q10. Codex harness specifics
- Supports GPT-5.5 with up to 1M token context
- Tool calling fully supported (PRD's Phase-0 verification item is pre-confirmed)
- All hook categories fire normally under Codex
- One caveat: Codex *native* plugins (a separate concept from `extensions/`) use the Codex app-server's MCP discovery rather than OpenClaw's plugin registry. For us this means the KB MCP server has two possible integration paths — pick the one (OpenClaw `mcp-config.json` vs. Codex app-server MCP) that matches the agent execution mode we settle on in Phase 1.

---

## PRD corrections to apply in Phase 1

1. Manifest file is **`openclaw.plugin.json`**, not `plugin.json` (PRD §18 file inventory).
2. Token persistence path is **`~/.openclaw/agents/<agentId>/agent/auth-profiles.json`**, not `~/.openclaw/auth.json` (PRD §15).
3. Headless OAuth uses **`--device-code`** flag — solves the Railway TTY problem the PRD flagged as a risk (PRD §15, §16).
4. Tool calling on Codex endpoint is **confirmed working** — strike from the Phase 0 verification checklist (PRD §15 v1 verification checklist).
5. Sub-agent dispatch is **first-class via `api.runtime.subagent.run`** — the PRD's Section 5 architecture diagrams can be implemented as drawn.
6. R3 / R4 enforcement requires a `before_agent_finalize` revise loop rather than `response_format` constraint — update PRD §7 rule specs accordingly.
7. MCP server registration is via **`.openclaw/mcp-config.json`** (config-driven), matching PRD §14's intent.

---

## Open items for Phase 1 (not blockers)

- Where exactly the OAuth token file lives on this Mac (verify `<agentId>` once OAuth completes).
- Whether the Codex app-server MCP path or OpenClaw's plugin-config MCP path is the right home for `apps/mcp-kb/`. Decision deferred to Phase 3 (KB MCP server) and dependent on the agent execution model picked in Phase 4.
- Whether `before_agent_finalize`'s `revise` action gives us enough loops (e.g., max 2 revisions before R11 LOW-confidence gate fires).
