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
- *"Slack + CLI + VS Code is enough":* rejected — workable for in-house-only use but blocks outside-counsel collaboration patterns that already exist at CBH.
- *"Move web UI into v1 scope":* rejected — stretches v1 by ~1 week and pulls focus from the load-bearing rule-engine + ingestion work. Phase 7 deferral keeps v1 on track.

**Renumbers:** What the PRD §17 called "Phase 7+ — Future" (Profile A / Lexis-enabled, Hermes Curator, etc.) shifts to "Phase 8+." Web chat UI is the singular Phase 7 deliverable.

