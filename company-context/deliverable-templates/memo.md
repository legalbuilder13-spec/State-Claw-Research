# Memo deliverable template

Consumed when `TaskSpec.output_type === "memo"`. Renders to Markdown (and via Pandoc/docx if requested) for long-form deliverables — internal research memos, position papers, structured analyses.

Longer than the Slack template (PRD §17 Phase 6 calls this format out for the docs / counsel-review path).

---

## Template

```markdown
# MEMORANDUM

**{stamp}**

| | |
|---|---|
| **To:** | {requester.display_name} ({requester.email}) |
| **From:** | Agentic-Law-OS (legal-research agent) |
| **Date:** | {rendered_at | date_format: "MMMM D, YYYY"} |
| **Re:** | {bottom_line_short_form} |
| **Jurisdictions:** | {jurisdictions | join: ", "} |
| **Confidence:** | {confidence.aggregate} |
| **Completeness:** | {completeness.aggregate} |
| **Sources current through:** | {min_current_through} |

---

## I. Question Presented

{verbatim_question}

## II. Short Answer

{bottom_line}

## III. Background — Standing Fact Pattern

(Drawn from `company-context/fact-pattern.md`; abbreviated to the facts material
to this analysis.)

{relevant_fact_pattern_excerpts}

## IV. Analysis

{analysis_section_a}

### A. {analysis_subsection_a_title}

{analysis_subsection_a}

### B. {analysis_subsection_b_title}

{analysis_subsection_b}

(Sub-sections continue as needed. The Renderer composes them from the
ordered claims, grouping by `kind` / topic.)

## V. Application to `<Company>`'s Operations

{application_to_fact_pattern}

## VI. Classification Risk Overlay

| Category | Status | Severity | Rationale |
|---|---|---|---|
{classification_overlay.categories | each: "| {category_name} | {status} | {severity if flagged: severity}{else: "—"} | {rationale} |"}

## VII. Items Flagged for Verification

{if verify_flags.length > 0:}
The following items in this analysis warrant independent verification before
the conclusions are relied on. The number of flags is capped at 3 per R13; if
the underlying uncertainty exceeded three issues, the agent would have
escalated to R11 LowConfidenceGate and produced a "research incomplete" notice
instead of this memo.

{verify_flags | enumerate | each:
  "**Flag {index + 1}: {topic}**

  *Location:* {location_in_draft}

  *Why flagged:* {why_flagged}

  *Suggested verification:* {suggested_verification}
"}
{else:}
No items required individual flagging. The analysis is grounded in retrieved
primary sources; reviewer should still apply independent legal judgment before
relying on the conclusion.
{end}

## VIII. Canons of Construction Applied

{if canon_conflicts.length > 0:}
Where multiple canons of construction could have applied, the choice between
them is declared below per W4:

{canon_conflicts | each:
  "**Question:** {question}

  **Canons considered:**

  {canons_considered | each: "- *{canon}* would produce: {outcome}"}

  **Canon applied:** *{applied}*

  **Rationale:** {rationale}
"}
{else:}
Standard canons of construction applied without internal conflict requiring
declaration.
{end}

## IX. Coverage and Limitations

{if coverage_matrix exists:}
This memo addresses {jurisdictions.length} jurisdictions. Coverage per state:

| Jurisdiction | Status | Retrievals | Current through | Gaps |
|---|---|---|---|---|
{coverage_matrix | each: "| {jurisdiction} | {status} | {retrievals} | {current_through} | {gaps | join: "; " | else: "—"} |"}
{end}

This analysis is current through the dates listed above. Material amendments
or new case-law decisions after those dates are not reflected. Negative
treatment of cited cases (overruling, abrogation) was checked via:
{citator_chain_used}

The conclusions above are research outputs, not legal advice. Counsel review
is required before this memo is relied upon for any specific matter.

## X. Citations

{cites | bluebook_full_render | enumerate | each: "{index + 1}. {.}"}

## XI. Orientation Consulted (Not for Citation)

{if references.length > 0:}
The following sources were consulted for orientation only. They are not
citation sources and the analysis does not rely on them as authority.

{references | each: "- {title} ({kind}, {url})"}
{end}

## Appendix A. Methodology

This memo was produced by Agentic-Law-OS following the 14-part research
methodology in `docs/legal/METHODOLOGY.md`. Specifically:
- Statute and regulation retrieval from `{source_profile}` profile sources.
- Cross-references traced one hop (R8).
- Definitions retrieved before operative provisions (R9).
- Anchored quotes verified by independent Verifier sub-agent against the
  source corpus (R5).
- Confidence and completeness assessed by separate sub-agents (R11, R15).

## Appendix B. Audit Trail

This memo is reproducible from the claim ledger:

- **claim_ledger_id:** `{claim_ledger_id}`
- **task_spec_id:** `{task_spec_id}`
- **deliverable_id:** `{id}`
- **company-context version hash:** `{company_context_version_hash}`

Each citation in §X is anchored to a specific span in the corpus; the
Verifier sub-agent independently re-fetched and exact-matched every
anchored span before this memo was rendered.

---

*{stamp}*
```

## Rendering rules

1. **Stamp appears in both header and footer.** Bold; never abbreviated.
2. **Date renders in long form** ("May 11, 2026"), not ISO format, in the memo header.
3. **`bottom_line_short_form`** is a Renderer-extracted 5–10 word summary of `bottom_line`, used as the memo subject ("Re:").
4. **Citations use Bluebook full form** (no short forms). Numbered sequentially.
5. **Application to fact pattern** is its own section because the PRD design distinguishes general legal analysis from application — the agent must produce both.
6. **Classification overlay is a full table** rather than a styled list (Slack format does the latter).
7. **Appendix sections (A and B) are always present** even when content is minimal — they document methodology and audit chain.
8. **Memo is exportable to docx** if `render_options.export_docx === true`. Renderer pipes through Pandoc.

## When to use this template vs. Slack

| Use memo | Use Slack |
|---|---|
| Question requires >5 paragraphs of analysis | Question can be answered in 1–3 paragraphs |
| Multiple operative provisions / cross-jurisdiction | Single statute / single jurisdiction |
| Counsel will quote the analysis verbatim | Quick operational guidance |
| Will be appended to a matter file or board materials | Inline answer to an escalation |
| Reviewer wants Bluebook-formatted citations rather than inline | Inline citations are fine |

The orchestrator's intake heuristic picks between Slack and memo at TaskSpec
construction. Operator can override with explicit `TaskSpec.output_type`.
