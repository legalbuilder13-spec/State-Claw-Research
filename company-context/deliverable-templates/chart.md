# Chart deliverable template

Consumed when `TaskSpec.output_type === "chart"`. Renders multi-state surveys as a structured comparison table — the canonical format for "what does the law require across N states?" deliverables.

---

## Template

```markdown
# {chart_title}

**{stamp}**

| Question (verbatim): | {verbatim_question} |
|---|---|
| Jurisdictions surveyed: | {jurisdictions | join: ", "} |
| Confidence (aggregate): | {confidence.aggregate} |
| Completeness: | {completeness.aggregate} |
| Sources current through: | {min_current_through} |
| Rendered: | {rendered_at | date_format} |
| Audit: | `{claim_ledger_id}` |

---

## Coverage summary

{coverage_matrix | render_summary}

| Jurisdiction | Status | Retrievals | Current through |
|---|---|---|---|
{coverage_matrix | each: "| {jurisdiction} | {status} | {retrievals} | {current_through} |"}

---

## Comparison chart

{chart_body}

The chart's column structure is question-driven. For an IC-classification
survey, columns are typically:

| Jurisdiction | Test applied | Codification | Burden | Exemptions | Key cite | Pinpoint |
|---|---|---|---|---|---|---|
| US-CA | ABC | Lab. Code § 2775 | Hiring entity | § 2783 occupations | Dynamex (2018) | 4 Cal. 5th 957 |
| US-IL | Variant ABC | 820 ILCS 175/30 | Employing unit | Exemptions enumerated | Carpetland (2003) | 776 N.E.2d 188 |
| US-MA | ABC (strictest) | Mass. Gen. Laws c. 149 § 148B | Employer | Narrow | Athol Daily News (2003) | 786 N.E.2d 365 |
| ... | ... | ... | ... | ... | ... | ... |

For other survey types (licensing, joint employer, etc.) the Renderer picks
the column structure from `chart-templates/<topic>.yaml` (operator-extensible).

---

## Per-jurisdiction notes

{per_jurisdiction_notes}

For every jurisdiction in the chart, a paragraph of nuance the row doesn't
capture — exemption applicability to `<Company>`'s fact pattern, recent
amendments, contested interpretations, pending litigation.

### US-CA

{ca_notes}

### US-IL

{il_notes}

### [other jurisdictions]

...

---

## Classification risk overlay

| Category | Status | Severity | Rationale |
|---|---|---|---|
{classification_overlay.categories | each: "| {category_name} | {status} | {severity_or_dash} | {rationale} |"}

This overlay applies to the survey as a whole. Per-jurisdiction risk
implications are in the per-jurisdiction-notes sections.

---

## Items flagged for verification

{verify_flags | enumerate | each:
  "**Flag {index + 1}:** {topic} (location: {location_in_draft})

  *Why:* {why_flagged}

  *How:* {suggested_verification}
"}

---

## Coverage limitations

{if any state in coverage_matrix is partial or failed:}
**This survey has incomplete coverage.** The following gaps mean the chart
above does not represent a complete picture for these jurisdictions:

{coverage_matrix | filter: status != "complete" | each:
  "- *{jurisdiction}* ({status}): {gaps | join: "; "}"}

**Recommended next steps:** {coverage_remediation_recommendation}
{end}

---

## Citations

{cites | grouped_by_jurisdiction | each:
  "### {jurisdiction}

  {cites_for_jurisdiction | bluebook_render | enumerate | each: "{index + 1}. {.}"}
"}

---

## Audit chain

- **deliverable_id:** `{id}`
- **claim_ledger_id:** `{claim_ledger_id}`
- **task_spec_id:** `{task_spec_id}`
- **company-context version hash:** `{company_context_version_hash}`

---

*{stamp}*
```

## Rendering rules

1. **The coverage table appears first.** Reviewer can see at a glance which states are complete, partial, or failed before reading anything else.
2. **Column structure is topic-driven.** A new survey topic that doesn't have a template gets a generic 4-column structure (Jurisdiction / Rule / Authority / Notes) that the Drafter can extend.
3. **Per-jurisdiction notes appear AFTER the table** because the table is for skimming and the notes are for depth. Reviewer who only has 30 seconds reads the table; reviewer who needs to act reads the notes.
4. **Coverage limitations are surfaced prominently** when any state in the matrix is partial or failed (per W1).
5. **Citations are grouped by jurisdiction** at the end — easier to navigate than a flat citation list.
6. **Chart-templates/ extensions.** Operators can drop topic-specific YAML files (e.g., `chart-templates/staffing-agency-licensing.yaml`) defining custom column structures. Renderer reads these.

## When to use this vs. memo

| Use chart | Use memo |
|---|---|
| 4+ jurisdictions | 1–3 jurisdictions |
| Comparison is the point | Single-jurisdiction depth |
| Reviewer will scan rows | Reviewer will read paragraphs |
| Question is "which states require X?" | Question is "how does X apply to us?" |

## Chart-template authoring

Place chart column-structure YAML files at `company-context/chart-templates/<topic>.yaml`:

```yaml
# chart-templates/staffing-agency-licensing.yaml
columns:
  - id: jurisdiction
    label: "Jurisdiction"
  - id: licensing_required
    label: "Licensing required?"
    type: yes_no
  - id: license_threshold
    label: "Threshold (workers, hours, etc.)"
  - id: licensing_authority
    label: "Issuing authority"
  - id: penalty
    label: "Penalty for noncompliance"
  - id: exemptions
    label: "Statutory exemptions"
  - id: key_cite
    label: "Primary cite"
```

The Drafter fills each column for each state in scope; the Renderer renders the
filled table.
