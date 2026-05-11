---
name: definitions-first
description: |
  Procedural enforcement of R9 DefinitionsFirst. Run by the Statute sub-agent
  (and the Regulation sub-agent for regulatory analysis) before analyzing any
  operative provision: locate, retrieve, and consume the chapter's Definitions
  section. Captures the legislative or regulatory definitions of every term
  the operative provisions use that may have a special-meaning binding.
argument-hint: "[jurisdiction] [chapter_doc_id]"
when_to_use:
  - "Before any operative-statute or operative-regulation retrieval — automatic step of statute-research and regulation-research skills."
  - "When the analysis turns on the precise meaning of a term that may be defined in the chapter."
  - "When R9 DefinitionsFirst validator amends the plan to insert this step."
---

# /definitions-first — Retrieve chapter Definitions before operative analysis

## Pre-conditions

- The chapter under analysis has been identified (per `statute-research` Step 1).
- `kb_chapter_structure_get` has returned the chapter's structure metadata, including the Definitions section identifier or the `definitions_inline` marker.

## Workflow

### Step 1: Locate the Definitions section

From the chapter structure metadata, identify the Definitions section's `doc_id` (or range of `doc_id`s for chapters where definitions span multiple sections). For California Labor Code Chapter 2 (Division 3, Part 1), definitions are at §§ 2750–2773. For other chapters, the structure varies.

If the chapter's metadata indicates `definitions_inline: true`, the chapter inlines definitions in the operative sections rather than having a separate Definitions block. Skip to Step 3.

If the chapter has no Definitions section AND is not marked inline, mark the requirement `definitions_not_applicable` with a documented reason and report back. R15 will treat this criterion as N/A.

### Step 2: Retrieve the Definitions section

Use `kb_statutes_get` to retrieve every section in the Definitions range. Each section's content enters `retrieval_log` with `doc_id`, `hash`, `current_through`, and the full text.

For multi-section definitions blocks, retrieve as a single batch when possible.

### Step 3: Index the defined terms

Parse the retrieved Definitions section text and extract the defined terms. The standard pattern is:

```
"<term>" means <definition text>. (jurisdictional variant: "as used in this chapter, <term> means...")
```

Build a structured `defined_terms` index:

```json
[
  { "term": "employer", "definition_doc_id": "ca-lab-2750", "section": "2750(a)", "definition_text": "...", "scope": "chapter | section | subdivision" },
  { "term": "employee", "definition_doc_id": "ca-lab-2750", "section": "2750(b)", ... },
  ...
]
```

The `scope` field captures whether the definition applies chapter-wide, section-wide, or subdivision-wide. Many definitions are scoped — "as used in this subdivision, X means..." — and the Drafter must respect that scope.

### Step 4: Apply R8 to the Definitions section

The Definitions section itself often cross-references other codes' definitions ("as defined in Government Code section X"). Trace each cross-reference one hop per R8. The cross-referenced definitions enter the index alongside the local ones.

### Step 5: Surface to the Drafter

The `defined_terms` index is loaded into the Drafter's context as a read-only reference. Every operative-provision claim in the draft must use the term as defined; the Critic re-checks this against the index.

If the index is empty (e.g., the chapter has no separate Definitions section and no inline definitions either — rare but possible), surface this fact prominently to the Drafter: "Chapter has no defined-term index; rely on plain meaning per the canon of construction skill."

## Output Format

```json
{
  "chapter_doc_id": "ca-lab-division-3-part-1-chapter-2",
  "definitions_block": [{ "doc_id": "ca-lab-2750", "section_range": "2750-2773", "current_through": "2026-04-01" }],
  "definitions_inline": false,
  "defined_terms": [
    { "term": "employer", "definition_doc_id": "ca-lab-2750", "section": "2750(a)", "scope": "chapter", "definition_text": "..." },
    { "term": "employee", ... }
  ],
  "cross_referenced_definitions": [
    { "source_chapter": "ca-lab-...", "imported_term": "wage", "from_code": "Gov. Code", "from_section": "..." }
  ],
  "status": "complete | definitions_not_applicable"
}
```

## Anti-patterns specific to this skill

- ❌ **Skipping the Definitions section because it "looks long."** Definitions sections are often dense; that's the point. Skipping them produces analyses that apply everyday meaning to defined terms.
- ❌ **Assuming a definition is chapter-wide when it's subdivision-scoped.** A definition that says "as used in this subdivision, X means..." applies only to that subdivision. Using that definition in another subdivision is a misapplication.
- ❌ **Quoting the definition without anchoring (R4 violation).** When the Drafter cites a defined term, any quoted text from the definition must be anchored. Paraphrased definitions are fine if R3 traces to the retrieved section.
- ❌ **Loading only the first section of a multi-section Definitions block.** CA Lab. Code Chapter 2's definitions span §§ 2750–2773; partial retrieval misses load-bearing terms.
- ❌ **Treating a cross-referenced definition as out of scope.** When a definition imports from another code (Government Code, etc.), R8 requires tracing one hop. The imported definition is in scope for THIS analysis.
- ❌ **Using a definition from training memory when the corpus version differs.** The chapter's Definitions section may have been amended; rely only on the version retrieved this session per R3.
