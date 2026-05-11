---
name: cross-reference-trace
description: |
  Procedural enforcement of R8 CrossRefTrace. Run by the Statute and
  Regulation sub-agents after every section retrieval: scan the retrieved
  text for cross-references, classify each (internal_section, external_code,
  cross_jurisdictional), and either trace one hop or record an explicit skip.
argument-hint: "[doc_id]"
when_to_use:
  - "After any statute or regulation section is retrieved (automatic post-process step in statute-research and regulation-research)."
  - "When R8 validator amends the plan to require additional cross-ref tracing."
---

# /cross-reference-trace — One-hop cross-reference resolution

## Pre-conditions

- A statute or regulation section is in `retrieval_log` and is the parent for which cross-refs are being traced.
- The active source profile's allowlist includes sources for cross-jurisdictional retrievals (Profile B allows local corpus per-jurisdiction; cross-state references trigger R2 JurisdictionLock if the target jurisdiction is out of TaskSpec).
- The trace-depth budget for this run (default 3 hops, 10 total cross-ref retrievals) has not been exhausted.

## Workflow

### Step 1: Extract cross-references

Run a two-pass detection over the parent section's text:

1. **Regex pass.** Use `r8-config.json`'s pattern catalog covering common cross-reference phrasings:
   - `subdivision \(?[a-z0-9]+\)?`
   - `section \d+`
   - `\d+ U\.?S\.?C\.? §? \d+`
   - `\d+ C\.?F\.?R\.? §? \d+`
   - `\d+ ILCS \d+`
   - `Section \d+ of the [\w ]+ Code`
   - `(Cal|Mass|N\.J|Minn|Ill)\.? (Lab|Gov|Civ|Penal|Welf|Health|Pub|Educ)\.? Code §? \d+`
   - (per-jurisdiction extensions from `source-profiles/profile-{a,b}.yaml`'s `citation_token_patterns_extra`)

2. **LLM disambiguation pass.** For each regex match, ask a small classifier: "Is this a real cross-reference to operative law, or is it (a) a quoted reference from a cited case, (b) a section-label of the current section itself, (c) a non-operational mention like a heading?" Filter out false positives.

### Step 2: Classify each cross-reference

Per remaining cross-reference, assign a kind:

- `internal_section` — same code, same jurisdiction (e.g., "subdivision (b)" or "section 2776"). Resolves to a sibling section in the same code.
- `external_code` — same jurisdiction, different code (e.g., "Section 12940 of the Government Code"). Requires a separate kb query.
- `cross_jurisdictional` — different jurisdiction (e.g., a state statute referencing 29 CFR). Subject to R2 JurisdictionLock.

### Step 3: Apply R2 to cross-jurisdictional references

For each `cross_jurisdictional` reference, check whether the target jurisdiction is in `TaskSpec.jurisdictions`:

- If yes: proceed with retrieval (Step 4).
- If no: record as `skipped` with reason "target jurisdiction not in TaskSpec.jurisdictions [<list>]". W1 may surface if the skipped reference materially affects the analysis.

### Step 4: Retrieve each unresolved cross-reference

For each remaining cross-reference, retrieve the target section via the appropriate KB tool:
- `internal_section` → `kb_statutes_get` with same `(jurisdiction, code)` and target `section`.
- `external_code` → `kb_statutes_get` with target `(jurisdiction, code, section)`.

Each retrieval enters `retrieval_log` and may itself contain cross-references (Step 1 fires on each new retrieval, but R8 caps the trace at depth 3 per chain to prevent infinite recursion).

### Step 5: Explicit skip with reason

The Drafter may mark a cross-reference as `skipped` with a recorded reason when the cross-reference is not relevant to the question at hand (e.g., "subdivision (c) addresses appellate procedure, not the substantive question"). Skips are surfaced in the deliverable's `cross_refs` block so a reviewer can audit.

### Step 6: Loop check

If the trace exceeds depth 3 or 10 total retrievals for this run, terminate the chain and annotate the deliverable with `cross_ref_limit_reached: { chain: [...], reason: "depth or total cap" }`. Manual review is recommended.

### Step 7: Surface to Drafter

Emit the trace results as a structured artifact loaded into the Drafter's context.

## Output Format

```json
{
  "parent_doc_id": "ca-lab-2775",
  "cross_refs": [
    { "kind": "internal_section", "target_section": "2776", "target_doc_id": "ca-lab-2776", "status": "resolved", "depth": 1 },
    { "kind": "external_code", "target_code": "Gov.", "target_section": "12940", "target_doc_id": "ca-gov-12940", "status": "resolved", "depth": 1 },
    { "kind": "cross_jurisdictional", "target_jurisdiction": "US", "target": "29 CFR 541", "status": "skipped", "skip_reason": "US not in TaskSpec.jurisdictions [US-CA]", "depth": 1 },
    { "kind": "internal_section", "target_section": "Z (appellate procedure)", "status": "skipped", "skip_reason": "subdivision addresses appellate procedure, not substantive question", "depth": 1 }
  ],
  "trace_depth_max": 3,
  "trace_total_retrieved": 5,
  "limit_reached": false
}
```

## Anti-patterns specific to this skill

- ❌ **Treating section-label tokens as cross-references.** The text "§ 2775(b)(1)(A)" inside § 2775's own text is just a label — not a cross-reference to a different section. The LLM disambiguation pass catches this; the regex pass alone would false-positive.
- ❌ **Stopping the trace before reaching out-of-jurisdiction references.** Some references (e.g., a state statute incorporating a federal regulation by reference) materially affect the analysis. Even when the target is out of TaskSpec.jurisdictions, document the skip with a clear reason rather than silently omitting.
- ❌ **Recursively tracing without depth limit.** Statutes can form cross-reference cycles; without the depth cap, the agent loops forever. The cap is procedural enforcement; W1 surfaces when reached.
- ❌ **Treating "see also" as operative cross-reference.** "See also section X" is informational; it doesn't bind the operative law of the current section. The LLM disambiguation pass should classify this as non-operative; if it can't, default to treating as cross-reference and tracing one hop (over-inclusion is safer than under-inclusion).
- ❌ **Skipping without recording a reason.** Every skip needs a documented rationale. R8 enforces this — silent skips are treated as failures.
- ❌ **Citing a cross-referenced section without retrieving it.** R3 still applies — the Drafter cannot cite section X without retrieving it. Either trace and retrieve, or explicitly skip and don't cite.
