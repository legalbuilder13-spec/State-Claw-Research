# Research Methodology — Parts I–XIV

This document is the operational manual for the agent. Every sub-agent's behavior, every rule's enforcement, every deliverable's structure traces back to one or more of the 14 parts below. It is generalized for any gig-economy vertical and source-profile-aware (works under Profile B Lexis-free or Profile A Lexis-enabled).

The methodology is the *what* and the *why*; the [rules](../../rules/), [schemas](../../schemas/), and [skills](../../skills/) are the *how*.

## Index

| Part | Topic | Primary enforcement |
|---|---|---|
| I | Pre-research preparation | Tier 1 Intake + R1 R14 |
| II | Research methodology — the 7-step sequence per state | `statute-research` skill + R7 R8 R9 R10 |
| III | Statutory structure — the 9 standard sections | Extraction sub-agent output schema |
| IV | Interpretation framework | Drafter + Critic + W4 |
| V | Applicability analysis | `applicability-analysis` skill |
| VI | Requirement-type categorization | `requirement-type-categorization` skill |
| VII | Verification protocol — the screenshot-and-compare gate | Verifier sub-agent + R5 R10 |
| VIII | Hallucination prevention | Drafter schema + Critic + R3 R4 |
| IX | Confidence ratings | Confidence sub-agent (rule-based) + R11 |
| X | Company-specific overlay | Classification sub-agent + R12 |
| XI | Anti-patterns (see [ANTI-PATTERNS.md](ANTI-PATTERNS.md)) | Distributed across all rules |
| XII | Output discipline | Renderer + R6 |
| XIII | Knowing when research is complete | Orchestrator + R15 |
| XIV | The layered analysis approach (capstone) | Orchestrator default plan |

---

## Part I — Pre-research preparation

Before a single retrieval fires, the agent must satisfy a pre-flight checklist. **A research deliverable produced without pre-flight is by construction unreliable.**

### Source restrictions

The agent operates under **closed-world retrieval**. No web access except an explicit allowlist from the active source profile (PRD §3, R1 SourceAllowlist). Law-firm blogs, news articles, vendor sites, and Wikipedia are orientation-only, never citation sources (R14 NoLawFirmCitation).

### Pre-flight checklist (Tier 1)

Captured by [`docs-escalation-response`](../../skills/docs-escalation-response/SKILL.md):

1. ✓ **Verbatim question captured.** Original text saved byte-for-byte; no paraphrase, no typo-correction.
2. ✓ **Jurisdictions named.** Explicit in the message, or the operator's default per `company-context/company.yaml`. Ambiguous → clarify before proceeding.
3. ✓ **Source profile selected.** Default B per company config; A only when explicitly required.
4. ✓ **Company context loaded.** `company-context/` pack version-hashed for reproducibility.
5. ✓ **Topic classified.** Mapped to the enum in `schemas/task-spec.schema.json`.
6. ✓ **Output type selected.** Slack response / memo / chart / research trail.
7. ✓ **`requires_fresh` set.** True when the question references currently-pending events.

Pre-flight failures return a clarification request to the requester. Never proceed on assumptions.

### Intake hygiene

The verbatim question is echoed at the top of every deliverable. The Critic later compares the deliverable's answer to the verbatim question to detect drift (the agent answering a different question than was asked).

---

## Part II — Research methodology: the 7-step sequence per state

Implemented by [`statute-research`](../../skills/statute-research/SKILL.md). For each jurisdiction in scope:

1. **Identify the controlling chapter** via `kb_chapter_structure_get`.
2. **Retrieve the Definitions section** before any operative provision (R9 [DefinitionsFirst](../../rules/R9.DefinitionsFirst.md), `definitions-first` skill).
3. **Retrieve the operative provisions** via keyword + structural search.
4. **Trace cross-references** one hop each (R8 [CrossRefTrace](../../rules/R8.CrossRefTrace.md), `cross-reference-trace` skill).
5. **Search for delegations** and retrieve implementing regulations (R7 [RegSearchOnDelegation](../../rules/R7.RegSearchOnDelegation.md), `regulation-research` skill).
6. **Retrieve exemptions** when the analysis turns on whether one applies.
7. **Confirm currency** of every retrieval (R10 [CurrencyTag](../../rules/R10.CurrencyTag.md)).

For multi-state surveys, the sequence runs per jurisdiction. Per-state coverage is rolled up into W1 [PartialAcrossStates](../../rules/W1.PartialAcrossStates.md)'s coverage matrix.

---

## Part III — Statutory structure: the 9 standard sections

Most statutes — across jurisdictions — fit a recognizable 9-section structure. The Extraction sub-agent uses this template to parse retrieved sections into typed components:

1. **Definitions.** Defined terms with chapter / section / subdivision scope.
2. **Findings and legislative purpose.** Often dispositive for canon application (Part IV).
3. **Scope / applicability.** Who is covered, who is excluded.
4. **Operative provisions.** The substantive rules.
5. **Exemptions and carve-outs.** Conditions under which the operative provisions do not apply.
6. **Implementing-regulation authority.** Agency delegations (R7 trigger).
7. **Enforcement mechanism.** Who enforces, what penalties.
8. **Private right of action.** Whether private plaintiffs can sue.
9. **Effective date and savings.** When the statute takes effect; what prior law survives.

Not every chapter has all 9; some chapters compress into 3–4. The Extraction sub-agent surfaces presence/absence per section.

---

## Part IV — Interpretation framework

When statutory text is ambiguous, the agent applies named canons of construction per [`canon-application`](../../skills/canon-application/SKILL.md). Operator words ("shall," "may," "must") get rigorous treatment; modal strength changes meaning.

### The ambiguity ladder

Before reaching for canons:

1. **Plain meaning rule.** If text + defined terms produce a clear meaning, stop.
2. **Defined-term resolution.** Apply the chapter's Definitions section (R9).
3. **Structural canons.** Apply textual canons (expressio unius, ejusdem generis, noscitur a sociis, surplusage).
4. **Substantive canons.** Apply substantive canons (constitutional avoidance, rule of lenity, remedial liberal construction, derogation strict construction).
5. **Extrinsic aids.** Legislative history, parallel jurisdiction interpretations, agency interpretations (subject to Loper Bright limits post-2024).

### The 17 canons

Catalog in [`canon-application`](../../skills/canon-application/SKILL.md). When two canons fire on the same question and produce different outcomes, W4 [CanonConflictDeclared](../../rules/W4.CanonConflictDeclared.md) requires explicit declaration.

### Operator words

- **"shall"** — mandatory obligation. Failure to satisfy fails the gate.
- **"must"** — equivalent to shall in most jurisdictions; some courts treat as stronger.
- **"may"** — permissive. Optional behavior; non-exercise is not a breach.
- **"should"** — typically advisory in statutes; mandatory in regs and standards.
- **"will"** — predictive in some contexts, mandatory in others; jurisdictional reading required.

The Drafter must respect the actual modal in the statute. Substituting a stronger or weaker modal in a paraphrase is grounds for revise (R3 + W2).

---

## Part V — Applicability analysis

Implemented by [`applicability-analysis`](../../skills/applicability-analysis/SKILL.md). The skill enforces three gate shapes:

### Thresholds

"This section applies to employers with 50 or more employees." Per-fact-pattern evaluation. When the metric can't be computed from the fact pattern, the analysis records the gap as a verify_flag (R13).

### Conjunction

ABC test: ALL THREE prongs must be satisfied for the hiring entity to overcome the employee presumption. Each prong evaluated separately; failure of any single prong fails the whole gate.

### Disjunction

"A staffing agency is licensed if ANY of (1) X OR (2) Y OR (3) Z." Success of any one element passes the gate.

### Exemptions

The most common gate shape in statutory analysis. "A person is treated as an employee under (a) UNLESS the hiring entity establishes (b)(1)-(b)(8) (the exemption conditions)." The exemption gate inverts the conjunction logic: ALL of the exemption conditions must be satisfied for the rule NOT to apply.

When the analysis turns on an exemption, the Drafter sets `relies_on_exemption: true` on the claim. R15 verifies the exemption provisions are in `retrieval_log`.

---

## Part VI — Requirement-type categorization

Implemented by [`requirement-type-categorization`](../../skills/requirement-type-categorization/SKILL.md). For "what must the company do?" questions, extract every distinct requirement and tag by type:

- **Disclosure** — inform a party.
- **Operational** — do or refrain from doing something.
- **Technical** — meet a specific configuration.
- **UI** — implement a specific user-interface element.

Each requirement is paired with implementation surfaces (app / contract / process / document / backend) for the compliance / engineering team.

---

## Part VII — Verification protocol: the screenshot-and-compare gate

The Verifier sub-agent runs the [`verification-gate`](../../skills/verification-gate/SKILL.md) skill before every delivery. The protocol is a literal re-retrieval and exact-substring match.

For each anchored quote in the draft:

1. Re-fetch the span via `kb_span_get_by_hash`.
2. Re-compute the live hash of the (doc_id, char_start, char_end) tuple.
3. Compare asserted text against fetched text (post-normalization).
4. Check `current_through` against R10 staleness threshold.
5. Report per-anchor status: pass / hash_not_found / text_mismatch / corpus_drift / stale_blocking.

Under Profile A, the equivalent gate uses Lexis+ Shepardize for case-law anchors. Under Profile B, the free citator chain handles negative-treatment detection; per-statute anchor verification uses the same `kb_span_get_by_hash` mechanism.

**The protocol is independent.** The Verifier doesn't share the Drafter's context. It only sees the structured anchor list + the tools to re-fetch.

---

## Part VIII — Hallucination prevention

The architecture's load-bearing chapter. Five mechanisms:

### 1. Source Inventory (R1 + R14)

The active source profile's YAML is the canonical allowlist. Tools that target sources not in the allowlist are blocked at `before_tool_call`. Citations in the deliverable are restricted to citation-eligible kinds (statutes, regs, case law, treatises).

### 2. Retrieval Log (R3)

Every retrieval is logged. Every claim must cite a retrieved doc_id. Assertions without retrieval backing are stripped at the Drafter's output gate.

### 3. Quoting Rule (R4)

Every quoted span must carry an anchor: `(doc_id, char_start, char_end, hash)`. Unanchored quotes are rejected by Drafter schema AND Renderer schema AND Critic exact-match (three independent enforcement points).

### 4. Citator (R10 + the citator skills)

Every case cite is run through Profile A's Shepardize OR Profile B's free chain. Negative treatment is surfaced; cases with adverse treatment are not silently relied on.

### 5. Self-audit (Critic)

A separate sub-agent re-reads the draft, compares paraphrases to anchored spans (W2 ParaphraseDriftCheck), checks for canon-application drift (W4), and scans for terminology violations (`terminology.yaml`).

---

## Part IX — Confidence ratings

Implemented by R11 [LowConfidenceGate](../../rules/R11.LowConfidenceGate.md). The Confidence sub-agent rates every deliverable HIGH / MEDIUM / LOW via a deterministic checklist over the run's artifacts.

### Why rule-based, not model-judged

The model is not asked "how confident are you?" — that question reliably elicits over-confident or sycophantically-hedged responses. Instead, nine concrete criteria are checked (definitions retrieved, operatives backed, cross-refs resolved, delegations resolved, currency confirmed, verifier passed, revise count low, verify-flags count low, classification overlay complete).

### The LOW gate

A LOW rating blocks delivery. The agent emits a structured "research incomplete" notice instead, listing the specific failing criteria and recommended next steps. This is **better than hedging** — a clean "I can't answer this yet, here's why" forces a decision; a hedged answer invites the reviewer to skim and rely.

### HIGH / MEDIUM / LOW thresholds

| Criterion | HIGH | MEDIUM | LOW |
|---|---|---|---|
| Definitions retrieved | All chapters | All inline + suspect | Missing chapter |
| Operative provisions backed | All claims | ≥80% claims | <80% claims |
| Cross-refs resolved | All resolved or skipped | ≥1 unresolved | ≥3 unresolved |
| Delegations resolved | All or none required | ≥1 with reason | Unresolved no reason |
| Currency confirmed | All fresh | Some stale annotated | Stale + requires_fresh |
| Verifier passed | All anchors pass | ≤1 minor mismatch | ≥2 unresolved mismatches |
| Drafter revise count | 0–1 | 2 | >2 |
| Verify flags | 0 | 1–2 | ≥3 |
| Classification overlay | All covered | All covered | Missing categories |

Aggregate: HIGH if all HIGH; MEDIUM if any MEDIUM and none LOW; LOW if any LOW.

---

## Part X — Company-specific overlay

Implemented by R12 [ClassificationOverlay](../../rules/R12.ClassificationOverlay.md) and [`classification-overlay`](../../skills/classification-overlay/SKILL.md). Every deliverable includes a structured block addressing every category in `company-context/risk-taxonomy.yaml`, either flagged with severity + rationale or explicitly cleared with rationale.

This is what makes a generic legal-research tool into a company-specific one. The reviewer sees, at a glance, which company-context risks the deliverable's subject matter implicates — without having to mentally translate generic legal output into operator-specific exposure.

The taxonomy is generic gig-economy by default; operators edit `risk-taxonomy.yaml` to add / remove categories. R12's enforcement adapts automatically.

---

## Part XI — Anti-patterns

See [`ANTI-PATTERNS.md`](ANTI-PATTERNS.md) for the comprehensive list. Every individual rule and skill carries its own anti-patterns section; ANTI-PATTERNS.md aggregates them.

---

## Part XII — Output discipline

Implemented by R6 [PinpointCite](../../rules/R6.PinpointCite.md) and the Renderer.

### Citation discipline

- Every citation includes pinpoint identifiers: title + section + subdivision for statutes; reporter + volume + page + court + year for cases; author + edition for treatises.
- Bluebook format by default; ALWD or jurisdictional styles configurable per `company-context/citation-style.yaml`.
- No string cites without specific holding reliance; no "see generally" without pinpoint reference; no "id." or "supra" short forms in v1.

### Deliverable templates

Four standard templates in `company-context/deliverable-templates/`:

- `slack-response.md` — single message with optional thread overflow.
- `memo.md` — long-form (I–XI sections + appendices).
- `chart.md` — multi-state comparison with coverage table.
- `research-trail.md` — full transparency (XII sections; auto-generated for failed runs).

### "DRAFT FOR COUNSEL REVIEW"

Every deliverable carries this stamp. The agent does not produce final legal advice. The reviewer's judgment is the last gate.

---

## Part XIII — Knowing when research is complete

Implemented by R15 [CompletenessGate](../../rules/R15.CompletenessGate.md). Research is "complete" when all 7 criteria pass:

1. **Definitions** retrieved for every chapter under analysis (R9).
2. **Operative provisions** retrieved for every claim (R3).
3. **Exemptions** traced when the analysis turns on whether one applies.
4. **Implementing regulations** retrieved for every delegation (R7).
5. **Cross-references** resolved or explicitly skipped (R8).
6. **Currency** confirmed (R10).
7. **Classification overlay** applied per R12.

Aggregate: complete if all applicable criteria PASS; incomplete if any FAIL.

When incomplete, the agent emits a structured notice listing the failing criteria and recommended next steps. **An incomplete deliverable is never silently downgraded to a hedged one.**

---

## Part XIV — The layered analysis approach (capstone)

The 11-layer orchestrator plan:

1. **Tier 1 Intake** — verbatim capture, jurisdictions, profile, context, output type.
2. **Definitions retrieval** — R9.
3. **Operative-statute retrieval** — `statute-research`.
4. **Cross-reference trace** — R8.
5. **Regulation retrieval** — R7, conditional.
6. **Applicability analysis** — Part V, conditional.
7. **Canon application** — Part IV, conditional.
8. **Requirement-type categorization** — Part VI, conditional.
9. **Drafter** — composes the draft from claim ledger entries.
10. **Verifier** — R5 + R10.
11. **Critic → Confidence → Classification → Renderer → Delivery** — final passes.

Each layer is conditional on the question's shape. A pure interpretation question may skip Layer 5 (no regulation in scope), Layer 6 (no applicability question), and Layer 8 (no requirements being extracted). The 11-layer pattern is the maximum-depth template; specific runs prune to the layers that apply.

The orchestrator's planner makes the pruning decision at TaskSpec construction; subsequent rule-validator passes (R7, R8, R9, R15) re-amend the plan as new evidence surfaces during the run.

---

## See also

- [`PRD-OPENCLAW-FORK.md`](PRD-OPENCLAW-FORK.md) §6 — original PRD treatment of the methodology.
- [`ANTI-PATTERNS.md`](ANTI-PATTERNS.md) — aggregate anti-patterns list.
- [`PLUGIN-SDK-NOTES.md`](PLUGIN-SDK-NOTES.md) — how OpenClaw's plugin SDK supports the architecture.
- [`PHASE-0-REPORT.md`](PHASE-0-REPORT.md) — Phase 0 verification of the design.
- [`../../rules/`](../../rules/) — per-rule specifications with enforcement points.
- [`../../skills/`](../../skills/) — per-skill procedural recipes.
