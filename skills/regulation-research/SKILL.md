---
name: regulation-research
description: |
  Implementing-regulation research. Loaded by the Regulation sub-agent when R7
  RegSearchOnDelegation has flagged a delegation clause in a retrieved
  statutory section. Retrieves the implementing regulation(s) from the
  jurisdiction's administrative code, traces their cross-refs and definitions
  (R8, R9 apply equally to regs), and reports back to the Statute sub-agent.
argument-hint: "[jurisdiction] [agency] [statute_doc_id]"
when_to_use:
  - "The Statute sub-agent or orchestrator has detected a delegation clause in a retrieved statutory section (R7)."
  - "The analysis directly references a regulation (e.g., 'under 29 C.F.R. § 541.100')."
  - "Cross-reference tracing (R8) has surfaced a reg-to-statute or statute-to-reg link."
---

# /regulation-research — Implementing-regulation retrieval

## Pre-conditions

- The statutory section containing the delegation clause has been retrieved and is in `retrieval_log`.
- The agency named in the delegation has been disambiguated against `company-context/agency-registry.yaml` (the Statute sub-agent's R7 detection pass handles this).
- The active source profile's allowlist includes the appropriate regulation source (for Profile B: `local_corpus_state_admin`).

## Workflow

### Step 1: Identify the regulation set

Map the agency (from R7's detection) to its administrative-code location:
- Labor Commissioner (CA) → Cal. Code Regs. title 8
- Department of Labor (federal) → 29 C.F.R.
- IRS (federal) → 26 C.F.R.
- Department of Industrial Relations (CA) → Cal. Code Regs. title 8
- (operator-specific agencies → operator-edited mapping)

Tool: `kb_regs_chapter_structure_get({ jurisdiction, agency })` returns the relevant CCR title or chapter.

### Step 2: Search for sections implementing the delegation

Within the identified administrative-code section, search for regulations that implement the specific statutory delegation. Use both keyword search and structural index — implementing regs typically reference the statute by section number.

Tool: `kb_regs_search({ jurisdiction, agency, query, statute_ref })` returns ranked results. The `statute_ref` parameter narrows results to regs that cite the originating statute.

### Step 3: Apply R9 to the reg's Definitions

Regulations frequently have their own Definitions section (separate from the statute's). Retrieve the reg's Definitions before analyzing operative reg provisions. (R9 applies to regs the same way it applies to statutes.)

### Step 4: Retrieve operative regulation sections

Pull the reg sections that implement the delegation. Each retrieved section enters `retrieval_log`.

### Step 5: Apply R8 to reg cross-references

Trace each cross-reference one hop. Regulations cross-reference both other regs in the same title and statutory sections; both kinds need to be traced.

### Step 6: Confirm currency (R10)

Regulations amend more frequently than statutes (R10's default threshold is 30 days for regs vs. 90 days for statutes). Confirm `current_through` is within threshold; trigger refresh if `requires_fresh` and stale.

### Step 7: Report back to Statute sub-agent

Emit a `regulation-research-output` artifact pointing back to the originating statute section. The orchestrator uses this to update R15 CompletenessGate's "regulations" criterion.

If the search returns nothing — no implementing reg exists for this delegation in the active source profile — emit a structured `delegation_unresolved` with the reason. This is acceptable (some delegations are dormant) but R7 + R15 will surface it in the deliverable's coverage block.

## Output Format

```json
{
  "originating_statute_doc_id": "ca-lab-2810.5",
  "delegation_clause_excerpt": "The Labor Commissioner shall adopt regulations specifying the form of the notice...",
  "agency": "Labor Commissioner",
  "regulation_set": "Cal. Code Regs. tit. 8",
  "implementing_regs": [{ "doc_id": "8-ccr-11760", "section": "11760" }],
  "definitions_retrieved": [{ "doc_id": "8-ccr-...", "section_range": "..." }],
  "cross_refs_traced": [...],
  "currency": [{ "doc_id": "8-ccr-11760", "current_through": "2026-04-15" }],
  "status": "resolved | unresolved",
  "unresolved_reason": "..." // only when status=unresolved
}
```

## Anti-patterns specific to this skill

- ❌ **Treating informal agency guidance as implementing regulations.** Opinion letters, FAQs, and policy memos are agency_guidance, not promulgated regulations. R14 governs whether they're citable (typically `orientation_only`); R7 is satisfied only by promulgated regulations. If only informal guidance exists, the delegation is `unresolved` with that reason.
- ❌ **Stopping at the first reg hit.** A single delegation may be implemented by multiple regulations across multiple sections. Pull all of them.
- ❌ **Assuming federal regs implement state delegations.** A CA Labor Commissioner delegation is implemented by CA-specific regs (CCR tit. 8), not federal 29 CFR. Cross-jurisdictional regulation implementation is the exception, not the rule.
- ❌ **Skipping R8 cross-refs on regs.** Regs cross-reference each other heavily; skipping the trace misses operative content.
- ❌ **Inferring an agency hasn't promulgated rules.** If the search returns nothing, the response is "no implementing reg located in the active profile's allowlist" — not "the agency has not promulgated rules." Source profile B may not include every administrative source.
- ❌ **Citing informal agency guidance in the deliverable.** Even when accessed, agency guidance under Profile B goes in `references[]`, not `cites[]` (R14).
