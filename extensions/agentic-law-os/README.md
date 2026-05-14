# Agentic-Law-OS — Phase 4 Legal Plugin Pack

Single bundled OpenClaw plugin that layers the legal-research stack on top of
the OpenClaw runtime. Per [`docs/legal/DECISIONS.md` D2](../../docs/legal/DECISIONS.md),
the entire legal layer ships as one plugin (intake + orchestrator + rules +
sub-agents + renderer); the KB MCP server is a separate process at
[`apps/mcp-kb/`](../../apps/mcp-kb/).

## Status

**Scaffold landed; subsystems are stubs.** This commit creates the directory
structure, manifest, package, and TypeScript entry points so Phase 4
implementation can fill in handlers without re-litigating layout. Every
subsystem has a `TODO(phase-4):` marker that names the OpenClaw hook,
sub-agent surface, or runtime API it needs.

| Subsystem                                                    | Status     | Files                                                                                                                                    |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin entry + manifest + workspace integration              | scaffolded | [`index.ts`](index.ts), [`openclaw.plugin.json`](openclaw.plugin.json), [`package.json`](package.json), [`tsconfig.json`](tsconfig.json) |
| Tier-1 intake (TaskSpec builder + freezer)                   | stub       | [`src/intake/`](src/intake/)                                                                                                             |
| Orchestrator + claim ledger                                  | stub       | [`src/orchestrator/`](src/orchestrator/)                                                                                                 |
| Rule engine R1, R2, R4, R5, R6, R10, R11, R12, R13, R14, R15 | stubs      | [`src/rules/`](src/rules/)                                                                                                               |
| Sub-agents: Statute, Verifier, Confidence, Renderer          | stubs      | [`src/subagents/`](src/subagents/)                                                                                                       |
| MCP config registration (kb-mcp upsert)                      | stub       | [`src/mcp-config/apply.ts`](src/mcp-config/apply.ts)                                                                                     |

R3 / R7 / R8 / R9 + W1-W4 + Critic + Classification sub-agents are Phase 5 per
[`docs/legal/PRD-OPENCLAW-FORK.md` §17](../../docs/legal/PRD-OPENCLAW-FORK.md).

## How it composes with the rest of the system

```
┌──────────────────────────┐  message_received   ┌────────────────────┐
│ Slack / Discord / VSCode │ ──────────────────► │ Tier-1 Intake      │
└──────────────────────────┘                     │ → builds TaskSpec  │
                                                 │ → freezes + attach │
                                                 └─────────┬──────────┘
                                                           │
                                                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Orchestrator (11-layer plan)                                         │
│                                                                      │
│   ┌─ Statute ─┐    ┌─ Verifier ─┐    ┌─ Confidence ─┐    ┌─ Render ─┐│
│   │ kb_*      │    │ kb_span_   │    │ rule-based   │    │ template ││
│   │ (MCP)     │    │ get_by_    │    │ scorer       │    │ apply    ││
│   │           │    │ hash       │    │              │    │          ││
│   └─────┬─────┘    └──────┬─────┘    └──────┬───────┘    └────┬─────┘│
│         │                 │                 │                 │      │
│         ▼                 ▼                 ▼                 ▼      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ claim_ledger (Postgres, hash-chained, append-only triggers)  │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                                                           │
                                                           ▼ message_sending
┌──────────────────────────────────────────────────────────────────────┐
│ Rule engine fires at every seam:                                     │
│   before_tool_call    : R1 (allowlist), R2 (jurisdiction lock)       │
│   after_tool_call     : R10 (currency tag), retrieval log write       │
│   before_agent_finalize: R4, R11, R13, R15                            │
│   message_sending     : R6 (pinpoint), R12 (overlay), R14 (no firms) │
└──────────────────────────────────────────────────────────────────────┘
```

## Plugin config

See [`openclaw.plugin.json`](openclaw.plugin.json) `configSchema` for the full
list. Defaults are tuned for the v1 CBH-style gig-economy deployment
(`source_profile: profile-b-free`, `default_jurisdictions: [US-CA]`,
`rule_profile: strict`). Override via `.openclaw/config.json` per the standard
OpenClaw plugin-config flow.

## Acceptance criterion (PRD §17 Phase 4)

> A Slack message to OpenClaw with a California IC-classification escalation
> produces a Slack-format response with verified citations, classification
> overlay, and confidence rating.

This scaffold is the substrate; the criterion is met when every
`TODO(phase-4)` marker is replaced with real logic and the smoke test
(`docs/legal/PHASE-4-STATUS.md` — to be written when Phase 4 closes) records
the end-to-end run.
