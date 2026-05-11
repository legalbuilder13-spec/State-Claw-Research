# Research-trail deliverable template

Consumed when `TaskSpec.output_type === "research_trail"`. Renders a transparency-focused output — every step the agent took, in order, with retrievals, sub-agent dispatches, rule blocks, and revise loops surfaced explicitly. Used for audit, training, and high-stakes deliverables where the reviewer wants to see the agent's reasoning trail, not just the conclusions.

This template is also produced automatically by the orchestrator whenever R11 LowConfidenceGate or R15 CompletenessGate fails — the "research incomplete" notice is essentially an abbreviated research trail showing what was attempted and what failed.

---

## Template

```markdown
# RESEARCH TRAIL

**{stamp}**

| | |
|---|---|
| **Original question:** | {verbatim_question} |
| **Requested by:** | {requester.display_name} via {requester.channel} on {created_at | date_format} |
| **TaskSpec ID:** | `{task_spec_id}` |
| **Claim Ledger:** | `{claim_ledger_id}` |
| **Source profile:** | {source_profile} |
| **Jurisdictions:** | {jurisdictions | join: ", "} |
| **Topic:** | {topic} |
| **Confidence:** | {confidence.aggregate} |
| **Completeness:** | {completeness.aggregate} |
| **Rendered:** | {rendered_at | date_format} |

---

## I. Plan dispatched

The orchestrator constructed and dispatched the following plan at run start
(amended {plan_amendment_count} times during the run due to R7 / R8 / R9
validators).

{dispatched_plan | each: "{index + 1}. {step_kind}: {step_description}"}

---

## II. Sub-agents involved

{subagents_dispatched | each:
  "### {subagent_name}

  - **Dispatched:** {dispatched_at | date_format}
  - **Completed:** {completed_at | date_format}
  - **Duration:** {duration_ms}ms
  - **Result kind:** {result_kind}
  - **Skill loaded:** `{skill_path}`
"}

---

## III. Retrievals performed

In order of execution. Every retrieval is logged to `retrieval_log` and
referenced by `doc_id` in the citations and quotes below.

| # | Tool | Source | Jurisdiction | doc_id | Result | Duration |
|---|---|---|---|---|---|---|
{retrieval_log | enumerate | each: "| {index + 1} | {tool_name} | {source} | {jurisdiction} | `{doc_id}` | {result_summary} | {duration_ms}ms |"}

---

## IV. Rule violations and revise loops

{if rule_violations.length > 0:}
The following rule violations fired during this run. Each was either resolved
(via revise loop or auto-amendment) or escalated to R11 LowConfidenceGate.

{rule_violations | each:
  "**{rule_id}** at step {step_index} ({rule_violations[i].rule_name})

  *Where:* {rule_violations[i].enforcement_point}

  *Why:* {rule_violations[i].failure_mode}

  *Resolution:* {rule_violations[i].resolution} ({rule_violations[i].iterations} iteration{rule_violations[i].iterations > 1 ? "s" : ""})

"}
{else:}
No rule violations fired. The Drafter produced a deliverable that passed
every rule's enforcement point on the first attempt.
{end}

---

## V. Verifier results

The Verifier sub-agent independently re-fetched every anchored span and
exact-matched the asserted text against the live source. Summary:

| Status | Count |
|---|---|
| pass | {verifier_output.summary.passed} |
| hash_not_found | {verifier_output.summary.hash_not_found} |
| text_mismatch | {verifier_output.summary.text_mismatch} |
| corpus_drift | {verifier_output.summary.corpus_drift} |
| stale_annotated | {verifier_output.summary.stale_annotated} |
| stale_blocking | {verifier_output.summary.stale_blocking} |

Per-anchor results:

| Anchor | Asserted text | Status | Notes |
|---|---|---|---|
{verifier_output.anchors | each: "| `{anchor.doc_id}:{anchor.char_start}-{anchor.char_end}` | _{asserted_text_short}_ | {status} | {reason if reason} |"}

---

## VI. Confidence determination

The Confidence sub-agent rated each criterion. Aggregate: **{confidence.aggregate}**.

| Criterion | Level | Rationale |
|---|---|---|
{confidence.criteria | each: "| {criterion_name} | {level} | {rationale} |"}

---

## VII. Completeness check (R15)

| Criterion | Status | Notes |
|---|---|---|
{completeness.criteria | each: "| {criterion_name} | {status} | {reason if status != "pass"} |"}

---

## VIII. Classification overlay (R12)

The Classification sub-agent addressed every category in `risk-taxonomy.yaml`.

| Category | Status | Severity | Rationale |
|---|---|---|---|
{classification_overlay.categories | each: "| {category_name} | {status} | {severity_or_dash} | {rationale} |"}

---

## IX. Warnings raised (W1–W4)

{warnings | each:
  "**{rule_id}** — {message}

  Claim: `{claim_id if claim_id}`

  Details: {details | json_pretty}
"}

---

## X. Canon conflicts declared (W4)

{canon_conflicts | each:
  "### Question: {question}

  **Canons considered:**

  {canons_considered | each: "- *{canon}* → {outcome}"}

  **Applied:** *{applied}*

  **Rationale:** {rationale}

  **Supporting cite:** {cite if cite}
"}

---

## XI. Final deliverable

{rendered_deliverable_body}

---

## XII. Audit anchors

- **deliverable_id:** `{id}`
- **claim_ledger_id:** `{claim_ledger_id}`
- **task_spec_id:** `{task_spec_id}`
- **company-context version hash:** `{company_context_version_hash}`
- **rules version:** `{rules_version}`
- **schemas version:** `{schemas_version}`
- **source-profile in effect:** `{source_profile}` (version hash `{source_profile_version_hash}`)

The claim ledger is hash-chained; the head hash at delivery time was:

```
{claim_ledger_head_hash}
```

Re-running this exact research with the same inputs and the same versioned
configs is expected to produce a deliverable with the same conclusions
(retrieval ordering may differ; conclusions should not).

---

*{stamp}*
```

## Rendering rules

1. **Audience.** This template is for **reviewers who want to verify**, not for action consumers. The deliverable that gets acted on is the Slack response or memo; the research trail is supplementary.

2. **Always rendered as Markdown.** Slack-rendered research trails are too long and break message limits; web view / VS Code extension / memo export are the right surfaces.

3. **Optionally exported as docx + PDF** for matter files, audit packages, board materials, and outside-counsel handoffs.

4. **Auto-generated for failed runs.** When R11 / R15 fail, the orchestrator emits an abbreviated research trail (sections I-V only, plus the failing criteria) as the "research incomplete" notice. The reviewer sees what was attempted and why it didn't complete.

## When to use this vs. other templates

| Use research trail | Use Slack | Use memo | Use chart |
|---|---|---|---|
| Reviewer needs to verify the agent's reasoning | Quick operational answer | Full memo for the file | Multi-state comparison |
| Audit / SOC / litigation discovery | (default) | Position paper | Survey |
| Training the team on agent behavior | | | |
| High-stakes deliverable that will be challenged | | | |
| Failed run (auto-generated) | | | |

## Operator customization

The sections in this template are fixed (auditability requires consistency).
Operators can:

- **Hide sections** they don't want in their default render (e.g., hide §IV
  rule-violations when shipping clean runs to outside counsel) by setting
  `render_options.hide_sections: ["IV"]`.
- **Add a top-level summary section** for non-technical reviewers via
  `render_options.summary_for_humans: true` — Renderer prepends a 5-line
  plain-English summary above §I.
- **Customize the audit anchors block** to add operator-specific identifiers
  (matter ID, deal ID, etc.) by populating `delivery_metadata.matter_id`.
