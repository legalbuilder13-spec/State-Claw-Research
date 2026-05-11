---
name: statute-research
description: |
  The 7-step research sequence per state, per PRD §6 Methodology Part II. Run
  by the Statute sub-agent on every statutory analysis. Encodes the
  procedural order — definitions first, then operative provisions, then
  exemptions, then cross-refs — that R9, R8, and R15 enforce.
argument-hint: "[jurisdiction] [topic_keywords]"
when_to_use:
  - "The TaskSpec topic is statutory in nature (worker_classification, licensing_staffing_agency, joint_employer, wage_hour_compliance, etc.)."
  - "The orchestrator's plan includes a statute-retrieval step."
  - "After an inbound message has been classified as research (loaded by docs-escalation-response Step 3+)."
---

# /statute-research — 7-step research sequence per state

## Pre-conditions

- TaskSpec is frozen.
- Active source profile is loaded.
- For each jurisdiction in TaskSpec.jurisdictions, `corpus_freshness` confirms the statute corpus is ingested for that jurisdiction.

## Workflow

### Step 1: Identify the controlling chapter

For the jurisdiction + topic combination, identify the chapter (or chapters) of the code where the operative law lives. For California Labor Code IC questions: Division 3, Part 1, Chapter 2 (§ 2750 et seq.). For Illinois Day & Temporary Labor Services Act: 820 ILCS 175. The corpus's `chapter-structure` metadata is the authoritative source.

Tool: `kb_chapter_structure_get({ jurisdiction, topic })` returns the chapter boundaries and the recommended entry section.

### Step 2: Retrieve the Definitions section (R9)

Before any operative-provision retrieval, retrieve the chapter's Definitions section. For CA Labor Code Chapter 2, that's §§ 2750–2773. Pass the retrieved section content to the Drafter's context as read-only reference.

Tool: `kb_statutes_get({ jurisdiction, code, sections })` for the definitions block.

If the chapter is marked `definitions_inline` in chapter-structure metadata, skip this step (the inline definitions will come with the operative provisions).

### Step 3: Retrieve the operative provisions

Identify and retrieve the sections that contain the operative law for the question. Use a combination of (a) keyword search via `kb_statutes_search` and (b) chapter-structure index for breadth.

Tool: `kb_statutes_search({ jurisdiction, query, limit })` → ranked list. Pick top results that match the topic; retrieve each via `kb_statutes_get`.

The retrieved sections enter the Drafter's context. The Drafter's claim ledger must cite these sections (R3) when asserting any operative-statute proposition.

### Step 4: Trace cross-references (R8)

Pass each retrieved section to the `cross-reference-trace` skill's procedure. Every cross-reference is either traced (target retrieved) or explicitly skipped with a recorded reason. R8 fails if any cross-ref is left silently unresolved.

### Step 5: Search for delegations (R7)

Pass each retrieved section to the `regulation-research` skill's detection procedure. Any delegation clause triggers a regulation-retrieval pass.

### Step 6: Retrieve exemptions

If the analysis turns on an exemption (the Drafter signals this with `relies_on_exemption: true` on the claim), retrieve every exemption provision relevant to the question. For CA Lab. Code Chapter 2, the principal exemptions are at § 2783 (75+ enumerated occupations) and § 2776 (B2B exemption). Don't read the operative-provision and stop — exemptions are where many analyses live or die.

Tool: `kb_statutes_get({ jurisdiction, code, sections: [exemption_section_list] })`.

### Step 7: Confirm currency (R10)

For every retrieved section, verify the `current_through` metadata is within R10's threshold for the active source profile. If stale and TaskSpec.requires_fresh is true, trigger a synchronous re-ingestion (per R10). If stale and requires_fresh is false, proceed but mark every cite for "current through" annotation in the deliverable.

## Output Format

The Statute sub-agent emits a `statute-research-output` artifact (not formally schema-bound in v1; recommended for Phase 4):

```json
{
  "jurisdiction": "US-CA",
  "chapter": "Lab. Code Division 3 Part 1 Chapter 2",
  "definitions": [{ "doc_id": "...", "section_range": "2750-2773" }],
  "operative_provisions": [{ "doc_id": "...", "section": "2775" }, ...],
  "cross_refs_traced": [{ "from": "2775", "to": "2776", "status": "resolved", "doc_id": "..." }, ...],
  "delegations": [{ "section": "2810.5", "agency": "Labor Commissioner", "status": "reg_search_pending" }, ...],
  "exemptions_retrieved": [{ "doc_id": "...", "section": "2783" }, ...],
  "currency": [{ "doc_id": "...", "current_through": "2026-04-01" }, ...]
}
```

The Drafter consumes this artifact to compose claims.

## Anti-patterns specific to this skill

- ❌ **Reading the operative provision before the Definitions section.** R9 enforces this procedurally, but the skill encodes the operational order. Reading "the worker is an employee" before learning what "worker" means in the chapter is the classic failure mode.
- ❌ **Stopping at section 2775 when the analysis turns on § 2783's exemption.** The presumption of employment is half the analysis; the exemption is the other half. Step 6 is non-optional when `relies_on_exemption` is true.
- ❌ **Treating every keyword hit as relevant.** `kb_statutes_search` returns ranked results; the Drafter must judge which are actually on-point. Retrieving a long-tail keyword hit creates noise in the claim ledger without adding analytical value.
- ❌ **Skipping cross-reference tracing because "it looks the same."** A cross-reference to a different code (e.g., from Lab. Code to Unemp. Ins. Code) may have very different operative content. R8 requires the trace even when the surface phrasing is similar.
- ❌ **Hardcoding section numbers.** Section numbers change with recodifications. Use `kb_chapter_structure_get` and topic-keyed search rather than memorized section numbers.
- ❌ **Inferring currency from memory.** R10 currency comes from corpus metadata, never from training memory. "I think CA Lab. Code § 2775 was last amended in 2024" is exactly the kind of statement R3 strips.
