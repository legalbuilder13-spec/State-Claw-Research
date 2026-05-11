---
name: classification-overlay
description: |
  Procedural enforcement of R12 ClassificationOverlay. Run by the Classification
  sub-agent before delivery: address every category in
  `company-context/risk-taxonomy.yaml` and emit a structured overlay with each
  category flagged (with severity + rationale) or explicitly cleared (with
  rationale). Missing categories fail R12.
argument-hint: "[claim_ledger_id]"
when_to_use:
  - "Before every deliverable is rendered, regardless of output type."
  - "When the Drafter has finalized claims and the Verifier has confirmed anchors."
  - "When R12 validator surfaces missing-category errors in a revise loop."
---

# /classification-overlay — Company-context risk overlay (R12, Methodology X)

## Pre-conditions

- The Drafter's final claims are in the claim ledger.
- `company-context/risk-taxonomy.yaml` is loaded; its content hash is captured (becomes `taxonomy_version`).
- `company-context/risk-vectors.yaml` is loaded; the Classification sub-agent uses its check questions as guidance.
- `company-context/terminology.yaml` is loaded; rationale text must conform to it (no banned terms; preferred terms where applicable).

## Workflow

### Step 1: Enumerate categories

Read every top-level and nested category from `risk-taxonomy.yaml`. The Phase 1 default has ~12 categories spanning:

- `worker_classification.*` (abc_test, common_law_agency, joint_employer_flsa, joint_employer_state, marketplace_contractor_statutes, borello_multi_factor, economic_realities_test)
- `control_indicators.*` (behavioral_control, financial_control, relationship_indicators)
- `licensing.*` (staffing_agency_licensing, professional_employer_organization, industry_specific_licensing)
- `other.*` (conversion_fee_prohibition, hcf_policy_compliance, background_check_obligations, hipaa_baa_required, consumer_protection_disclosure, data_privacy)

Operators with custom taxonomies have different categories.

### Step 2: For each category, run the relevant check vector

Map each category to its `risk-vectors.yaml` vector(s). For each, ask the question against the deliverable's subject matter and retrieved evidence:

- **Flagged** if the deliverable's subject matter implicates the risk. Example: deliverable about CA AB5 IC analysis flags `worker_classification.abc_test`.
- **Cleared** if the deliverable's subject matter does NOT implicate the risk. Example: same deliverable clears `other.hipaa_baa_required` because the analysis doesn't involve PHI.

### Step 3: Per-jurisdiction conditional clearance

Some categories are jurisdiction-conditional (per `risk-taxonomy.yaml`'s `jurisdictions` field on each category). When `TaskSpec.jurisdictions` doesn't intersect with a category's jurisdictions list, auto-clear with the standard rationale "category applies only in [list]; TaskSpec jurisdictions [list] do not intersect."

### Step 4: Severity assignment for flagged categories

For each flagged category, assign severity per `risk-taxonomy.yaml`'s `severity_when_flagged` default, then refine based on the deliverable's specifics:

- **critical** — the deliverable's conclusion depends directly on the category's analysis.
- **high** — the category materially affects the analysis but isn't the central question.
- **medium** — the category is implicated but not load-bearing.
- **low** — the category is touched only tangentially.

The severity refinement is the Classification sub-agent's judgment; the rationale text explains it.

### Step 5: Compose rationale text

Each category (flagged or cleared) requires a one-sentence rationale. Constraints:

- Min length: 10 chars (schema-enforced).
- Conform to `terminology.yaml`:
  - Never use banned terms ("employee," "staffing agency," etc.).
  - Prefer preferred terms.
- Specific to this deliverable: avoid generic boilerplate ("category applies"). State *why* the category does or doesn't apply to *this* subject matter.

### Step 6: Auto-clearance shortcuts

For commonly-cleared categories with deliverable-type signals, apply heuristics to speed up the workflow:

| Category | Auto-clear when |
|---|---|
| hipaa_baa_required | Vertical isn't healthcare AND no PHI in fact pattern. |
| conversion_fee_prohibition | No conversion-fee clauses in scope. |
| consumer_protection_disclosure | No consumer-facing disclosure obligations in scope. |
| industry_specific_licensing | Question doesn't mention licensing. |

Auto-clearances still require a rationale — the heuristics just save the Classification sub-agent's reasoning budget.

### Step 7: Critic re-check

After composing the overlay, the Critic verifies:

- Every category in `risk-taxonomy.yaml` is present in the overlay.
- Each rationale conforms to `terminology.yaml`.
- Severity assignments are consistent with rationale text.
- Flagged categories with severity=critical have substantive cite_refs.

### Step 8: Emit `classification-output` artifact

Per `schemas/classification-output.schema.json`. The Renderer consumes this artifact to render the deliverable's classification block.

## Output Format

Per `schemas/classification-output.schema.json`:

```json
{
  "id": "...",
  "claim_ledger_id": "...",
  "computed_at": "2026-05-11T...",
  "taxonomy_version": "sha256:...",
  "categories": {
    "worker_classification.abc_test": {
      "status": "flagged",
      "severity": "critical",
      "rationale": "Question is squarely about Prong B of the CA ABC test as applied to per-diem nurses under <Company>'s marketplace model.",
      "cite_refs": ["ca-lab-2775", "ca-lab-2783"]
    },
    "worker_classification.joint_employer_flsa": {
      "status": "cleared",
      "rationale": "Question does not involve federal wage-and-hour exposure with a co-employer; FLSA joint-employer analysis is not implicated."
    },
    "other.hipaa_baa_required": {
      "status": "cleared",
      "rationale": "Question does not involve PHI handling; HIPAA BAA requirements are not implicated."
    },
    ...
  },
  "completeness": {
    "taxonomy_category_count": 12,
    "covered_count": 12,
    "missing_categories": []
  }
}
```

## Anti-patterns specific to this skill

- ❌ **Boilerplate clearance rationales.** "Not applicable" is rejected (10-char minimum is schema-enforced, but the substantive rule is clarity). Each clearance must specifically state why the category doesn't apply to this subject.
- ❌ **Using banned terminology.** The terminology.yaml's never_use list is non-negotiable in rationale text. "Clipboard Health employs nurses" in a rationale is a regression that R12 + Critic must catch.
- ❌ **Skipping categories the operator hasn't faced before.** Every category in the taxonomy must appear — even those that always clear for the operator's vertical. The Critic verifies this; missing categories fail R12.
- ❌ **Severity drift over time.** Two deliverables that touch the same risk category should produce similar severity ratings. The Classification sub-agent should consult prior-positions when available to maintain consistency.
- ❌ **Hardcoding categories in the skill.** The skill reads the live taxonomy YAML; operators editing the taxonomy should see the change reflected on the next run without skill updates.
- ❌ **Treating the classification overlay as boilerplate the reviewer skims past.** The overlay is the most-read part of the deliverable for an in-house team. Author rationale text as if a partner is reading it (because someone like that often is).
