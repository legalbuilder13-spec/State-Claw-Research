---
name: citator-profile-b
description: |
  Free citator chain for Profile B (Lexis-free). Per PRD §8, queries
  CourtListener Citations API, Google Scholar 'How cited', and CAP (and
  optionally Casetext / Fastcase if enabled per profile) for each case
  cited in the deliverable. Surfaces negative treatment (overruled,
  abrogated, distinguished by named cases). Best-effort; not
  litigation-grade per PRD §3 non-goal 6.
argument-hint: "[case_doc_id or case_citation_string]"
when_to_use:
  - "TaskSpec.source_profile == 'B' AND the deliverable cites case law."
  - "The Verifier sub-agent's R10 currency pass identified case cites needing citator validation."
  - "Auditor re-running citator checks on a delivered memo."
---

# /citator-profile-b — Free citator chain

## Pre-conditions

- TaskSpec.source_profile = "B".
- The deliverable's cites[] include at least one `kind: "case_law"` entry.
- Active source profile YAML has `citator_chain` configured (CourtListener + Google Scholar + CAP minimum).

## Workflow

### Step 1: For each case cite, query CourtListener Citations API

Call CourtListener's Citations API endpoint with the case's reporter / volume / page (or its CourtListener slug). The API returns a list of citing opinions with treatment markers (positive, neutral, negative).

Tool: `kb_courtlistener_cites_get({ reporter, volume, page })` (Phase 3 KB MCP server deliverable).

Record:
- Total citing opinions count.
- Per-treatment counts (positive, neutral, negative).
- Any specifically-flagged negative-treatment opinions (overruled, abrogated, called into doubt).

### Step 2: For each case cite, query Google Scholar 'How cited'

Scraper-based query against the case's Google Scholar page. Extract the "How cited" section's listed treatments.

Tool: `kb_gscholar_cites_get({ case_name, year })`.

Record same fields as Step 1. Google Scholar's coverage complements CourtListener's; cases CourtListener misses are often in Scholar and vice versa.

### Step 3: For each case cite, query CAP (Caselaw Access Project)

CAP's API is best for older cases (pre-2000 federal and most state appellate). For modern cases, CAP often returns lower hit counts than CourtListener.

Tool: `kb_cap_cites_get({ case_name, year, reporter })`.

### Step 4: Aggregate and classify treatment

Per case, aggregate the three sources:

- **Treatment status:** good_law | negative_treatment | overruled | abrogated | depublished | mixed
- **Best-evidence cite:** the most-recent and most-authoritative cite supporting the treatment status.
- **Confidence:** HIGH if all three sources agree; MEDIUM if two agree and one is silent; LOW if sources conflict.

A case with no negative treatment in any of the three sources is `good_law` with HIGH confidence. A case with explicit "overruled by [X]" in CourtListener is `overruled` regardless of what the other sources say.

### Step 5: Per-case confidence vs. deliverable confidence

If any case's treatment status is `negative_treatment` or worse, surface as a warning on the deliverable:

- If the case is load-bearing to the analysis (the cited proposition depends on the holding): R11 LowConfidenceGate's "verifier_passed" criterion drops. Likely results in MEDIUM or LOW aggregate.
- If the case is supporting (one of several cites for the same proposition): warning annotation but no confidence drop.

### Step 6: Surface to deliverable

Citator results enter the deliverable's per-cite metadata:

```json
"cites": [
  {
    "kind": "case_law",
    "name": "Dynamex Operations W. v. Superior Court",
    ...,
    "citator_results": {
      "courtlistener": { "total_citing": 312, "negative_count": 0, "checked_at": "2026-05-11T..." },
      "google_scholar": { "total_citing": 287, "negative_count": 0, "checked_at": "2026-05-11T..." },
      "cap": { "total_citing": 145, "negative_count": 0, "checked_at": "2026-05-11T..." },
      "treatment_status": "good_law",
      "confidence": "HIGH"
    }
  }
]
```

The Slack template's "Sources current through" line references citator currency. The memo template's §IX includes the citator results explicitly.

## Output Format

See Step 6 above. Surfaced into `deliverable.cites[].citator_results` per cite.

## Anti-patterns specific to this skill

- ❌ **Treating the free citator as litigation-grade.** PRD §3 non-goal 6 is clear: free citator is best-effort. Every deliverable explicitly states this.
- ❌ **Querying only one source.** Single-source citator results have high false-negative rates. The three-source chain catches more.
- ❌ **Skipping older cases because CourtListener has thin coverage.** CAP exists for this reason; for any pre-2000 case, CAP is the primary source. Don't rely on Scholar alone.
- ❌ **Treating "0 citing opinions" as "good_law."** Zero citations may mean the case is too obscure / too recent / not indexed yet — not that no court has questioned it. Distinguish "good_law" from "uncited."
- ❌ **Failing silently when a citator API is unreachable.** If CourtListener returns an error, the deliverable should record the failure and proceed with the remaining sources, NOT default to "good_law" by omission.
- ❌ **Querying citator chain for non-case cites.** Statutes don't get citator chains — they get R10 currency checks. Regulations similarly. The citator chain is strictly for case law.
