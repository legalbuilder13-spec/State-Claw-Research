# Slack-response deliverable template

This template is consumed by the Renderer (`plugins/agentic-law-os/renderer/`) when `TaskSpec.output_type === "slack_response"`. Curly-brace placeholders are filled from the `deliverable.schema.json` payload.

The rendered output is a single Slack message (using Slack mrkdwn) with optional thread-attached evidence cards.

---

## Template

```mrkdwn
:warning: *{stamp}*

> *Question (verbatim):* {verbatim_question}
> *Jurisdictions:* {jurisdictions | join: ", "}
> *Confidence:* *{confidence.aggregate}*   |   *Completeness:* *{completeness.aggregate}*
> *Sources current through:* {min_current_through}{if any stale: " :warning:"}

*Bottom line*
{bottom_line}

*Analysis*
{analysis}

*Citations*
{cites | bluebook_render | each: "• {.}"}

{if references.length > 0:}
*Orientation consulted* _(not citation sources — informational only)_
{references | each: "• {title} ({kind}) — _{consulted_for}_"}
{end}

*Classification risk overlay*
{classification_overlay.categories | sort_by_severity_desc | each:
  "{status_emoji}  *{category_name}* — {severity if flagged}
  {rationale}"}

{if verify_flags.length > 0:}
*Verify before relying* ({verify_flags.length} of 3 max)
{verify_flags | each:
  ":mag:  *{topic}* ({location_in_draft})
  Why: {why_flagged}
  How: {suggested_verification}"}
{end}

{if coverage_matrix exists and multi-state:}
*Coverage*
{coverage_matrix | each: "{status_emoji} {jurisdiction}: {status} ({retrievals} retrievals{if gaps: "; " + gaps.join(", ")})"}
{end}

{if warnings.length > 0:}
{warnings | each: ":warning: *{rule_id}*: {message}"}
{end}

{if canon_conflicts.length > 0:}
*Canon conflicts declared*
{canon_conflicts | each:
  ":scales: *{question}*
  Considered: {canons_considered | each: "{canon} → {outcome}" | join: "; "}
  Applied: *{applied}*
  Rationale: {rationale}"}
{end}

{if confidence.aggregate == "MEDIUM":}
:yellow_circle:  *MEDIUM confidence* — review the verify flags and unresolved items above before relying.
{end}

_Audit:_ `claim_ledger={claim_ledger_id}`{if include_audit_trail: " · " + audit_trail_url}
```

## Rendering rules

1. **Stamp is mandatory.** Always at the top, always bold-italic, always preceded by `:warning:`.
2. **Bottom line is required.** Per the Drafter schema, `bottom_line` minLength is 10. Always rendered first under the question.
3. **Citations use Bluebook by default** unless `render_options.citation_style` overrides.
4. **References block is conditional** — only shown when `references.length > 0`. When shown, it's clearly labeled as non-authoritative.
5. **Classification overlay is mandatory.** Sorted by severity descending (critical → high → medium → low). Cleared categories appear at the bottom in a smaller block.
6. **Verify flags are conditional.** Shown only when `verify_flags.length > 0`. Max 3 per R13. Each flag renders as a 3-line block: topic + location, why, how.
7. **Coverage matrix is conditional.** Shown when `TaskSpec.jurisdictions.length > 1`. Each state renders with status emoji (✅ complete, ⚠️ partial, ❌ failed).
8. **Warnings (W1–W4) are conditional.** Shown after coverage, before canons. Plain text with `:warning:` prefix.
9. **Canon conflicts (W4) are conditional.** Shown when `canon_conflicts.length > 0`. Each conflict renders with the question, every considered canon + outcome, the applied canon, and the rationale.
10. **MEDIUM confidence banner is conditional.** When `confidence.aggregate === "MEDIUM"`, append a yellow-circle banner explaining the partial confidence.

## Status emoji map

| Status | Emoji |
|---|---|
| classification.flagged + severity=critical | `:red_circle:` |
| classification.flagged + severity=high | `:orange_circle:` |
| classification.flagged + severity=medium | `:yellow_circle:` |
| classification.flagged + severity=low | `:white_circle:` |
| classification.cleared | `:white_check_mark:` |
| coverage_matrix.complete | `:white_check_mark:` |
| coverage_matrix.partial | `:warning:` |
| coverage_matrix.failed | `:x:` |

## Length constraints

- Hard cap: 3000 mrkdwn characters per Slack message (Slack's limit is higher, but this preserves readability).
- If the rendered body exceeds 3000 characters, the Renderer:
  1. Posts the **header block + Bottom line + Citations + Classification overlay** as the top-level message.
  2. Posts the **full Analysis** as a threaded reply.
  3. Posts each **verify flag, canon conflict, and warning** as separate threaded replies.

## Example output

```
:warning: *DRAFT FOR COUNSEL REVIEW*

> *Question (verbatim):* Does CA AB5 apply to per-diem nurses booking through our platform?
> *Jurisdictions:* US-CA
> *Confidence:* *HIGH*   |   *Completeness:* *complete*
> *Sources current through:* 2026-04-01

*Bottom line*
California's ABC test (Lab. Code § 2775) presumptively applies to per-diem
nurses, but the healthcare-staffing exemption at § 2783(j) likely satisfies
its conditions for nurses booking direct facility shifts. The marketplace
defense under Prong B requires consistent application of the technology-not-
healthcare framing.

*Analysis*
[full analysis text]

*Citations*
• Cal. Lab. Code § 2775(a)
• Cal. Lab. Code § 2783(j)(1)–(8)
• Dynamex Operations W. v. Superior Court, 4 Cal. 5th 903, 957 (2018)

*Classification risk overlay*
:red_circle:  *abc_test* — *critical*
  Question is squarely about Prong B of the CA ABC test.
:orange_circle:  *staffing_agency_statutes* — *high*
  Conclusion turns on whether <Company> is characterized as a staffing agency under state licensing definitions.
:white_check_mark:  *common_law_agency* — _cleared_
  ABC test displaces common-law agency in CA for this analysis.

*Verify before relying* (1 of 3 max)
:mag:  *applicability of § 2783(j) post-2024-amendments* (paragraph 4, sentence 2)
  Why: The cited 2018 Dynamex line addressed delivery drivers; per-diem-nurse application post-2024 § 2783 amendments is by analogy.
  How: Search CourtListener for 'Cal. Lab. 2775 OR 2783 per diem nurse 2024..2026' for direct authority.

_Audit:_ `claim_ledger=01J9XK7E5N0VRBT4FGAQYZ8MWP`
```
