---
name: applicability-analysis
description: |
  Applicability analysis per PRD §6 Methodology Part V. Run by the Drafter when
  the question turns on whether a statute or regulation applies to the facts:
  thresholds (does the company hit the size / revenue / activity trigger?),
  conjunction (are all required elements present?), and exemptions (does any
  carve-out apply?).
argument-hint: "[statute_doc_id] [fact_pattern_ref]"
when_to_use:
  - "The analysis turns on whether a statute or regulation applies to the company's fact pattern."
  - "The statute imposes obligations only above a threshold (employee count, gross receipts, hours worked, etc.)."
  - "The statute conjoins multiple required elements ('A AND B AND C')."
  - "The statute has enumerated exemptions and the question is whether one applies."
---

# /applicability-analysis — Thresholds, conjunction, exemptions

## Pre-conditions

- The operative statute / regulation has been retrieved (R3).
- The Definitions section has been retrieved (R9) — defined terms underlie threshold and exemption interpretation.
- `company-context/fact-pattern.md` and `company-context/factual-baseline.md` are in the Drafter's context.

## Workflow

### Step 1: Extract the applicability gate

From the retrieved provision, extract the structural gate the law applies through. The three common shapes:

**A. Threshold gate.** "This section applies to employers with 50 or more employees." → Extract: threshold metric (employee count), threshold value (50), comparison (≥).

**B. Conjunction gate.** "A worker is an employee unless the hiring entity establishes ALL OF the following: (1) ..., (2) ..., (3) ...." → Extract: list of required elements; conjunction operator (AND).

**C. Disjunction gate.** "A staffing agency is licensed if EITHER (1) ... OR (2) ... OR (3) ...." → Extract: list of alternatives; disjunction operator (OR).

**D. Combined.** Most statutes combine these (ABC test: conjunction of three prongs, each itself with thresholds or sub-conjunctions).

### Step 2: Apply the gate to the fact pattern

For each gate element, evaluate the fact pattern:

- For threshold gates: compute the metric from the fact pattern (or note inability to compute and flag for verification).
- For conjunction gates: evaluate each element separately and conjoin. Failure of any single element fails the whole gate.
- For disjunction gates: evaluate each alternative; success of any one element passes the gate.
- For exemption gates (the typical "unless" structure): evaluate the exemption conditions; if all conditions met, the rule does NOT apply (exemption succeeds).

Be explicit about each evaluation. The output is not "the law applies" but rather "Element 1: SATISFIED because [fact]. Element 2: SATISFIED because [fact]. Element 3: NOT SATISFIED because [fact]. Therefore the gate FAILS." → conclusion follows from the explicit chain.

### Step 3: Note where evaluation is uncertain

For each gate element, evaluation falls into one of:

- ✓ **Satisfied** with high confidence (the fact pattern clearly meets the condition).
- ✗ **Not satisfied** with high confidence (the fact pattern clearly does not meet the condition).
- ⚠️ **Uncertain** (the fact pattern doesn't clearly establish; verification needed).

Uncertain elements become verify_flags (R13 caps at 3). If a gate's evaluation hinges on uncertain elements and there are 3+ such uncertainties, R11 LowConfidenceGate is the better surface — escalate rather than deliver.

### Step 4: Set relies_on_exemption

If the analysis concluded that the rule applies/doesn't apply because an exemption was satisfied/not satisfied, set `relies_on_exemption: true` on the claim. R15 CompletenessGate verifies that the exemption provisions were retrieved.

### Step 5: Build the applicability conclusion claim

The output of this skill is one or more claims (per `schemas/claim.schema.json`) of `kind: "conclusion"` that explicitly state the applicability outcome and the chain of reasoning. The Drafter incorporates these into the analysis.

## Output Format

```json
{
  "operative_provision": "ca-lab-2775(a)",
  "gate_shape": "exemption_conjunction",
  "gate_elements": [
    {
      "element": "Prong A: worker is free from the control and direction of the hiring entity",
      "evaluation": "satisfied",
      "fact_basis": "Per fact-pattern.md, workers choose when/where/whether to accept each booking; no <Company>-imposed supervision of clinical work.",
      "confidence": "HIGH"
    },
    {
      "element": "Prong B: worker performs work outside the usual course of the hiring entity's business",
      "evaluation": "uncertain",
      "fact_basis": "Question turns on characterization of <Company>'s business as technology vs. service-providing.",
      "confidence": "MEDIUM",
      "verify_flag_candidate": true
    },
    {
      "element": "Prong C: worker customarily engaged in an independently established trade",
      "evaluation": "satisfied",
      "fact_basis": "Per fact-pattern.md, workers may work for competitors; worker bears own credentialing and equipment.",
      "confidence": "HIGH"
    }
  ],
  "gate_outcome": "EXEMPTION INDETERMINATE (Prong B uncertain)",
  "applicability_conclusion": "Cal. Lab. Code § 2775(a)'s employee presumption is rebutted only if all three ABC prongs are satisfied; Prong B's evaluation is uncertain for <Company>'s fact pattern.",
  "relies_on_exemption": true,
  "verify_flags_emitted": 1
}
```

## Anti-patterns specific to this skill

- ❌ **Skipping element-by-element evaluation in favor of a conclusory sentence.** "We meet the ABC test" is not an analysis; it's a label. The skill requires explicit per-element evaluation.
- ❌ **Treating a partial fact pattern as a complete one.** When the fact pattern doesn't establish an element, the evaluation is "uncertain" — not "satisfied" because of "the spirit" of the fact pattern. Spirit doesn't satisfy threshold gates.
- ❌ **Conflating threshold gates with conjunction gates.** A 50-employee threshold is one element; an ABC test is three. Conflating them produces analyses that miss elements.
- ❌ **Setting relies_on_exemption: false when the analysis turns on an exemption.** Mis-setting this flag causes R15's exemption-completeness criterion to be skipped. The Critic re-checks against the claim text.
- ❌ **Suppressing uncertainty.** When an element is genuinely uncertain, the verify_flag is the right surface. Don't hedge it away in prose ("the worker may or may not be free from control"); structure the uncertainty as a flag with a concrete next step (R13).
- ❌ **Conjunction without explicit operator.** A statute that says "the employer shall (1) post a notice; (2) provide a copy; (3) retain a signed acknowledgment" is conjunction — all three required. The skill must surface the operator explicitly even when the statute uses unnumbered prose.
