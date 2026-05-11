---
name: requirement-type-categorization
description: |
  Categorizes the requirements imposed by a statute or regulation into typed
  buckets per PRD §6 Methodology Part VI: disclosure requirements, operational
  requirements, technical requirements, UI requirements. Used by the Drafter
  when the analysis is "what does this law require us to do?" rather than
  "does this law apply?"
argument-hint: "[statute_doc_id]"
when_to_use:
  - "The question is what the statute requires the company to do (compliance perspective)."
  - "The orchestrator needs to extract structured obligations from retrieved text."
  - "A deliverable is being prepared that will be handed to a compliance / engineering team for implementation."
---

# /requirement-type-categorization — Typed requirements extraction (Methodology VI)

## Pre-conditions

- The operative statute / regulation has been retrieved (R3).
- The applicability analysis (`applicability-analysis` skill) has confirmed that the statute applies to the company's fact pattern.

## Workflow

### Step 1: Extract every requirement

For the operative provision, extract every distinct requirement imposed on the company. A "requirement" is anything the statute commands the company to do, refrain from doing, or be capable of doing. Format each as:

```json
{
  "raw_text": "<verbatim or paraphrased requirement text from the statute>",
  "modal_strength": "shall | must | should | may",
  "doc_id": "<source>",
  "section_subdivision": "<section + subdivision pinpoint>"
}
```

### Step 2: Classify each requirement

Assign each requirement to a category. The four types per Methodology VI:

**A. Disclosure requirement.** The company must inform a party (worker, customer, regulator, public) of something. Examples: "the employer shall provide a wage statement showing X." "The platform shall display the rate offered before booking." "The company shall file an annual report with the agency."

**B. Operational requirement.** The company must operate its business in a specified way. Examples: "the employer shall not retaliate against a worker for X." "The platform shall verify worker licensing through primary-source verification." "The company shall maintain records of bookings for three years."

**C. Technical requirement.** A specific technical configuration is mandated. Examples: "wage statements shall be in a font no smaller than 10 point." "Worker identification must be confirmed by government-issued photo ID."

**D. UI requirement.** A specific user-interface element is mandated. Examples: "the app shall display the rate offered before the worker accepts the booking." "Disclosures shall be in a separate signature block."

A single statutory requirement may map to multiple types. Tag with all applicable.

### Step 3: Assess implementability

For each requirement, identify implementation surfaces:

- **App / platform** — the company's own product needs a change.
- **Contract** — the company's customer contracts need a clause change.
- **Process** — internal operational workflow.
- **Document** — a form, notice, or disclosure document.
- **Backend / data** — record-keeping, reporting, or audit requirements.
- **No action required** — the requirement is met by the company's current operations (rare but possible).

### Step 4: Identify cross-references between requirements

Many requirements are interrelated: a disclosure requirement may require a separate operational requirement (the disclosure must be in writing; the writing must be retained for X years). Surface these chains.

### Step 5: Compile the requirements matrix

The skill's primary output is a structured matrix the compliance / engineering team can act on:

```json
{
  "statute_doc_id": "ca-lab-2810.5",
  "applies_to_company": true,
  "requirements": [
    {
      "id": "req-001",
      "raw_text": "The employer shall provide each employee, at the time of hire, a written notice ...",
      "types": ["disclosure", "technical"],
      "modal_strength": "shall",
      "section_subdivision": "2810.5(a)",
      "implementation_surfaces": ["document", "process"],
      "depends_on": [],
      "satisfied_today": false,
      "notes": "Notice content + required form set by Labor Commissioner regs (per R7 reg-search; reg doc_id 8-ccr-11760)"
    },
    {
      "id": "req-002",
      "raw_text": "The employer shall retain a copy of the notice for three years.",
      "types": ["operational", "backend"],
      "modal_strength": "shall",
      "section_subdivision": "2810.5(b)",
      "implementation_surfaces": ["backend"],
      "depends_on": ["req-001"]
    }
  ]
}
```

### Step 6: Surface to Drafter

The Drafter consumes the matrix when composing the deliverable's "what does the law require us to do?" sections. For chart-format deliverables, the requirements matrix maps directly to the chart's columns.

## Output Format

See Step 5 above.

## Anti-patterns specific to this skill

- ❌ **Lumping multiple requirements into one.** "The statute requires X, Y, and Z" should be three separate entries, not one. Each implementation surface is different.
- ❌ **Treating "may" as "must."** Modal strength matters: a permissive "may" requirement does not impose an obligation; conflating modals overstates the compliance burden.
- ❌ **Skipping the "satisfied today" assessment.** When the company already does X for unrelated reasons, the requirement is informationally important but operationally trivial. The reviewer needs to know this distinction.
- ❌ **Missing R7-style delegations to regs.** A statutory requirement often has its operational detail in the implementing regulation. If the regulation hasn't been retrieved (R7), the requirements matrix will be incomplete. Re-run after reg retrieval.
- ❌ **Listing the same requirement multiple times because it appears in multiple sections.** Some statutes restate the same obligation in different sections (e.g., "as set forth in subdivision (b)" later restated in (c)). Resolve to the operative-section requirement and reference the secondary mentions in `notes`.
- ❌ **Treating exemption-conditional requirements as unconditional.** Some requirements apply only when an exemption fails. Tag conditional requirements with their applicability gate (results from `applicability-analysis`).
