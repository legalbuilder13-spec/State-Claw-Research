---
name: docs-escalation-response
description: |
  Top-level entry point for any inbound legal-research escalation. Loaded by the
  orchestrator at Tier-1 intake when the message has been classified as a
  research request (vs. a non-research message routed elsewhere). Walks the
  orchestrator through TaskSpec construction, plan generation, sub-agent
  dispatch, and final delivery. Other skills are loaded by sub-agents as the
  plan unfolds; this skill is the spine.
argument-hint: "[escalation_message_id]"
when_to_use:
  - "An inbound message from a channel adapter has been classified as a legal-research request."
  - "Any time the agent is asked to research, analyze, opine on, or check the legality of a fact pattern."
  - "Routing fallback when no more specific skill matches the inbound message."
---

# /docs-escalation-response — Top-level escalation handler

## Pre-conditions

- Inbound message has been captured by a channel adapter and routed to the orchestrator.
- The message has been classified as a research request (not a contract-review, not a marketing-review — those have their own entry-point skills).
- The orchestrator has access to `company-context/`, `source-profiles/`, and `schemas/`.

## Workflow

### Step 1: Tier-1 intake

Capture the original message verbatim. Do NOT paraphrase. This becomes `TaskSpec.verbatim_question` (PRD §6 Methodology Part I).

Extract from the message (LLM-assisted, with explicit fallback to operator clarification):

- **Jurisdictions** — explicit ("California", "CA") or implicit (operator's home jurisdiction default per `company-context/company.yaml`). If ambiguous, return a clarification request to the requester rather than guessing.
- **Topic** — match against the topic enum in `schemas/task-spec.schema.json`. If multiple topics, the most specific wins.
- **Output type** — heuristic based on message complexity, jurisdiction count, and channel:
  - Single jurisdiction, conversational tone, Slack channel → `slack_response`
  - Multi-jurisdiction (≥4 states), formal tone → `chart`
  - Single jurisdiction, formal tone, long question → `memo`
  - Reviewer explicitly asks for transparency → `research_trail`
- **`requires_fresh`** — set true if the question references "currently pending," "as of today," "this week," "the latest amendment," or names a specific bill number that may be in flux.
- **Source profile** — default per `company-context/company.yaml` (typically B); override if the question explicitly names Lexis-only material.

### Step 2: Pre-flight checklist

Before dispatching the plan, run the Tier-1 pre-flight checklist:

1. ✓ Jurisdictions are non-empty and all are in `corpus_freshness` (or marked for ingestion).
2. ✓ Source profile is loaded; profile YAML parses.
3. ✓ Company-context pack is loaded; risk-taxonomy.yaml is parsed; current version hash is computed.
4. ✓ Verbatim question is captured.
5. ✓ Output type is set.

Any failure → return clarification request or error to the requester. Do NOT guess.

### Step 3: TaskSpec freeze

Construct `TaskSpec` per `schemas/task-spec.schema.json`. Set `frozen_at` to now. The TaskSpec is now immutable for the run.

### Step 4: Plan construction

Build an 11-layer plan per PRD §6 Methodology Part XIV:

1. Tier-1 intake (already complete — Step 1–3 above)
2. Definitions retrieval (per `definitions-first` skill — R9)
3. Operative-statute retrieval (per `statute-research` skill)
4. Cross-reference trace (per `cross-reference-trace` skill — R8)
5. Regulation retrieval if delegation detected (per `regulation-research` skill — R7)
6. Applicability analysis (per `applicability-analysis` skill — Part V)
7. Canon application (per `canon-application` skill — Part IV)
8. Requirement-type categorization (per `requirement-type-categorization` skill — Part VI)
9. Drafter sub-agent (composes the draft)
10. Verifier sub-agent (R5 anchor verification per `verification-gate` skill)
11. Critic + Confidence + Classification + Renderer

Each step is conditional — Step 5 only fires if Step 4 detects a delegation; Step 6 only fires if the question turns on threshold / conjunction / exemption.

### Step 5: Dispatch

Dispatch the plan to sub-agents per the OpenClaw `api.runtime.subagent.run(...)` interface. Each sub-agent loads the skill named in its dispatch.

### Step 6: Aggregate and gate

After all sub-agents complete, run R15 CompletenessGate, R11 LowConfidenceGate, R12 ClassificationOverlay (each via its respective sub-agent or check).

If any blocking rule fails after revise loops are exhausted, emit a "research incomplete" notice using `company-context/deliverable-templates/research-trail.md` (abbreviated).

### Step 7: Render and deliver

Pass the validated deliverable to the Renderer, which uses the appropriate template from `company-context/deliverable-templates/`. Deliver via the original channel adapter.

### Step 8: Audit chain finalize

Append `deliverable_rendered` and `delivery_sent` events to the claim ledger. Compute and persist the head hash. Trigger any anchor-to-external-bucket process per `claim-ledger.schema.json`.

## Output Format

The skill itself produces no artifact; it orchestrates other skills' outputs. The final deliverable conforms to `schemas/deliverable.schema.json`.

## Anti-patterns specific to this skill

- ❌ **Paraphrasing the inbound message.** TaskSpec.verbatim_question must be byte-for-byte identical to what the requester wrote. Even minor cleanup (fixing typos, adding punctuation) discards information the agent will need later for drift detection.
- ❌ **Guessing jurisdictions.** If the message doesn't name a jurisdiction and the operator's default isn't clearly applicable, ask. Don't default-to-CA because most prior requests were CA.
- ❌ **Skipping the pre-flight checklist.** Pre-flight failures are easier to surface to the requester than mid-run failures. Skipping pre-flight to "save time" produces worse outcomes than asking a clarification question.
- ❌ **Hardcoding the plan.** The 11-layer plan is the default; specific question types modify it. A pure statute-interpretation question with no delegations skips Steps 5 (regulation) and 6 (applicability). The skill is a template, not a rigid sequence.
- ❌ **Mutating the TaskSpec mid-run.** Once `frozen_at` is set, TaskSpec is immutable. If the requester clarifies mid-run, that becomes a new TaskSpec (with a reference to the original), not a mutation.
- ❌ **Silent escalation to R11.** If the plan reaches a point where R11 will fire (e.g., a known unresolvable gap), don't let it fire silently — emit an early notice to the requester so they can decide whether to proceed.
