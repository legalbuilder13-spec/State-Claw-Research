---
name: citator-profile-a
description: |
  Lexis citator chain for Profile A (Lexis-enabled). Per PRD §8, replaces the
  free citator chain with Lexis+ Shepardize for litigation-grade citation
  analysis. Optionally runs Brief Analysis on long-form deliverables to
  surface authorities the Drafter may have missed. Opt-in; requires a Lexis+
  subscription seat.
argument-hint: "[case_doc_id or case_citation_string]"
when_to_use:
  - "TaskSpec.source_profile == 'A' AND the deliverable cites case law."
  - "Highest-stakes deliverables where litigation-grade citator confidence is required."
  - "Auditor re-running Shepardize on a delivered memo."
---

# /citator-profile-a — Lexis citator (Shepardize) + Brief Analysis

## Pre-conditions

- TaskSpec.source_profile = "A".
- The deliverable's cites[] include at least one `kind: "case_law"` entry.
- Lexis+ session is authenticated (per `source-profiles/profile-a-lexis.yaml`'s `lexis_access` block — Chrome MCP session or Playwright credentials).
- Active source profile YAML has `citator_chain` configured with `lexis_shepards` enabled and primary.

## Workflow

### Step 1: For each case cite, run Shepardize

Submit the case to Lexis+ Shepardize via the configured access method:

- **Chrome MCP session:** invoke the Lexis+ web UI via the Chrome MCP, navigate to the case's Shepardize page, extract the treatment signal and the per-citing-decision list.
- **Playwright credentials:** programmatic Lexis+ navigation.

Tool: `kb_lexis_shepardize_get({ case_citation })` (Phase 3 KB MCP server deliverable; dispatches to one of the two access methods).

Record:
- Signal status: positive | neutral | caution | negative | warning | overruled.
- Per-citing-decision list with treatment markers.
- Lexis+ Shepardize URL for click-through verification.

### Step 2: Treatment status classification

Map Lexis+ Shepardize signals to the same treatment-status enum as Profile B:

| Lexis signal | Treatment status |
|---|---|
| Positive | good_law |
| Neutral / Caution | good_law (with caveat noted in deliverable) |
| Warning (questioned validity) | negative_treatment |
| Negative | negative_treatment |
| Overruled | overruled |
| Superseded by statute | superseded |
| Depublished | depublished |

### Step 3: Brief Analysis (optional)

For long-form deliverables (memo, chart), submit the draft analysis to Lexis+ Brief Analysis. The service returns:

- Suggested authorities the Drafter may have missed.
- Similar cases for parallel reasoning.
- Counter-arguments raised in opposing briefs.

Tool: `kb_lexis_brief_analysis_get({ draft_text, jurisdiction })`.

Brief Analysis output is informational; it does not replace R3 / R4 / R5. Suggested authorities trigger a re-retrieval pass (the agent retrieves the suggested authorities through normal kb tools, so the deliverable's anchors remain in retrieval_log).

### Step 4: Cross-check Profile B sources for backup

Even with Lexis active, the Profile B free chain remains in the allowlist (per `profile-a-lexis.yaml`). For each case, also run CourtListener + Scholar + CAP. If Lexis says "good_law" but the free chain shows negative_treatment, surface the conflict for review — this is rare but informationally important.

### Step 5: Audit-trail logging

Lexis queries are billable; log every query (input case + cost-bearing event timestamp) for cost tracking and audit.

### Step 6: Surface to deliverable

Citator results enter per-cite metadata, similar to Profile B but with the Lexis-specific signal and URL:

```json
"cites": [
  {
    "kind": "case_law",
    "name": "Dynamex Operations W. v. Superior Court",
    ...,
    "citator_results": {
      "shepardize": {
        "signal": "positive",
        "total_citing": 412,
        "shepardize_url": "https://plus.lexis.com/...",
        "checked_at": "2026-05-11T..."
      },
      "free_chain_cross_check": {
        "courtlistener": "good_law",
        "google_scholar": "good_law",
        "cap": "good_law"
      },
      "treatment_status": "good_law",
      "confidence": "HIGH"
    }
  }
]
```

## Output Format

See Step 6 above. The Lexis-specific block is `cites[].citator_results.shepardize`; the free chain cross-check is preserved as `cites[].citator_results.free_chain_cross_check`.

## Anti-patterns specific to this skill

- ❌ **Skipping the free-chain cross-check.** Even with Lexis active, the Profile B sources are still useful as independent verification. Drop them only if cost is a concern.
- ❌ **Relying on Brief Analysis suggestions without R3 retrieval.** Brief Analysis surfaces *suggested* authorities; the Drafter must still retrieve them through kb tools to satisfy R3. A suggested authority that's never retrieved cannot be cited.
- ❌ **Treating Lexis "Warning" as conclusory negative.** Lexis's Warning signal indicates questioned validity, not overruled. The deliverable should annotate with the specific concern (often a circuit split or distinguishing case), not strip the cite entirely.
- ❌ **Submitting the entire draft to Brief Analysis on every run.** Brief Analysis is cost-bearing; reserve for high-stakes memos. The skill's default is to skip Brief Analysis for Slack-response and short-memo deliverables.
- ❌ **Caching Shepardize results across runs.** Negative treatment can land overnight (R10 7-day threshold for case law). Cached results are out of bounds; every run re-queries.
- ❌ **Logging Lexis queries to public stores.** Lexis ToS prohibits redistribution of query results. The audit chain may log the *event* (query ran, signal received) but should not log the *content* of the Shepardize report.
