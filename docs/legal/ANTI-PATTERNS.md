# Anti-Patterns

The comprehensive **DON'T list** for the Agentic-Law-OS agent. Per PRD §6 Methodology Part XI. Each anti-pattern names a behavior that has been observed in production legal-AI systems, identifies the failure mode it produces, and names the rule(s) that prevent it.

This document is the aggregate; per-rule and per-skill files in [`../../rules/`](../../rules/) and [`../../skills/`](../../skills/) each carry their own anti-patterns section for the specific component.

## Index by category

1. [Retrieval & citation anti-patterns](#1-retrieval--citation-anti-patterns)
2. [Quoting & paraphrasing anti-patterns](#2-quoting--paraphrasing-anti-patterns)
3. [Statutory-analysis anti-patterns](#3-statutory-analysis-anti-patterns)
4. [Interpretation & canon-application anti-patterns](#4-interpretation--canon-application-anti-patterns)
5. [Confidence & uncertainty anti-patterns](#5-confidence--uncertainty-anti-patterns)
6. [Classification & company-context anti-patterns](#6-classification--company-context-anti-patterns)
7. [Output & rendering anti-patterns](#7-output--rendering-anti-patterns)
8. [Multi-state & jurisdiction anti-patterns](#8-multi-state--jurisdiction-anti-patterns)
9. [Operational & audit anti-patterns](#9-operational--audit-anti-patterns)

---

## 1. Retrieval & citation anti-patterns

### 1.1 Citing from training memory
**Don't:** Make a statutory or regulatory assertion based on what the model "knows" without a corresponding retrieval this session.
**Why:** The model has memorized large chunks of statutes and case law. Memorized versions are often outdated (pre-amendment) or paraphrased (one word changed). Citing from memory produces wrong answers that look right.
**Prevented by:** [R3 NoMemoryStatutes](../../rules/R3.NoMemoryStatutes.md). The Drafter schema requires every assertion claim to have at least one cite to a doc_id in `retrieval_log`.

### 1.2 Citing law-firm blogs as authority
**Don't:** Put `kind: "law_firm_blog"` (or any orientation-only category) in the deliverable's `cites[]` array.
**Why:** Law-firm blogs look authoritative — attorney bylines, footnotes — but they are not primary sources, they are not subject to peer review, and they age unpredictably. A reader following a blog cite is functionally reading the blog author's opinion as authority.
**Prevented by:** [R14 NoLawFirmCitation](../../rules/R14.NoLawFirmCitation.md). The Renderer schema rejects orientation-only kinds in `cites[]`; they go in `references[]` (clearly labeled non-authority).

### 1.3 Retrieving from non-allowlisted sources
**Don't:** Call a KB tool whose target source is not in the active source profile's allowlist.
**Why:** The allowlist is the system's closed-world boundary. A retrieval from outside it produces content that cannot be cited (R14) and that the Verifier cannot re-validate (no kb_span_get_by_hash entry for it).
**Prevented by:** [R1 SourceAllowlist](../../rules/R1.SourceAllowlist.md). The `before_tool_call` hook blocks tools targeting non-allowlisted sources.

### 1.4 Stopping at the index page
**Don't:** Treat an index, table-of-contents, or search-results page as authority.
**Why:** Indexes are navigation, not law. Citing "see Justia's California Labor Code index" is functionally citing nothing.
**Prevented by:** Source-categories enum classifies `index_only` as orientation-only; R14 strips them from cites.

---

## 2. Quoting & paraphrasing anti-patterns

### 2.1 Quoting without an anchor
**Don't:** Use quotation marks around any text without a structured anchor pointing at the source span.
**Why:** Unanchored quotes are attestations the agent can't back up. The most common LLM hallucination pattern is: paraphrase → harden into quote → reader trusts the quote.
**Prevented by:** [R4 QuotingRule](../../rules/R4.QuotingRule.md). Three independent enforcement points (Drafter schema, Renderer schema, Critic exact-match) make this mechanically impossible.

### 2.2 Paraphrase masquerading as quote
**Don't:** Put quotation marks around a paraphrase, even with an anchor that points at a real source span.
**Why:** The reader trusts that quoted text is verbatim. A paraphrase in quotes is a deeper misrepresentation than an unanchored quote — the anchor confers false authority on the paraphrased text.
**Prevented by:** Verifier sub-agent re-fetches each anchored span and exact-substring matches against the asserted text. Mismatch blocks delivery.

### 2.3 Hardening a paraphrase across revisions
**Don't:** Rewrite a paraphrase between revise loops without checking against the source.
**Why:** A paraphrase that was accurate in revision 1 can drift in revision 2 as the Drafter "improves" the prose, losing load-bearing qualifiers in the process.
**Prevented by:** [W2 ParaphraseDriftCheck](../../rules/W2.ParaphraseDriftCheck.md). The Critic compares revision N to revision N-1 (and to source) using embedding similarity + BLEU.

### 2.4 Scare-quoting without an anchor
**Don't:** Use quotation marks for emphasis (`the so-called "independent" contractor`) without anchoring the quoted word.
**Why:** Scare quotes are quotes. R4 applies. If "independent" really appears in the cited statute, anchor it; otherwise rewrite with italics or angle brackets.
**Prevented by:** R4 schema fires on any quotation marks not associated with an anchor.

### 2.5 Substituting "shall" for "may" (or vice versa)
**Don't:** Change the modal in a paraphrase. "The statute requires" when the statute says "may" is wrong; "the statute permits" when the statute says "shall" is wrong.
**Why:** Modal strength is load-bearing in legal text. Substituting modals changes the legal effect of the assertion.
**Prevented by:** Critic re-check against source span; R5 exact-substring match catches modal substitution.

---

## 3. Statutory-analysis anti-patterns

### 3.1 Skipping the Definitions section
**Don't:** Analyze operative provisions before retrieving and consuming the chapter's Definitions section.
**Why:** Defined terms have legislative force. Applying everyday meaning to a defined term produces analyses that miss the operative legal content.
**Prevented by:** [R9 DefinitionsFirst](../../rules/R9.DefinitionsFirst.md) + [`definitions-first` skill](../../skills/definitions-first/SKILL.md).

### 3.2 Stopping at the statute when the operative content is in the regulation
**Don't:** Conclude the analysis when the statute delegates to an agency, without retrieving the implementing regulation.
**Why:** Most statutory delegations exist because the operational detail belongs in the reg. An analysis that stops at the statute misses the operative content.
**Prevented by:** [R7 RegSearchOnDelegation](../../rules/R7.RegSearchOnDelegation.md) + [`regulation-research` skill](../../skills/regulation-research/SKILL.md).

### 3.3 Silently skipping cross-references
**Don't:** Skip a cross-reference because "it doesn't look important." If you skip, record the reason.
**Why:** The operative content in cross-references is often what the reader cares about. Silent omission produces analyses that miss the answer.
**Prevented by:** [R8 CrossRefTrace](../../rules/R8.CrossRefTrace.md). Every cross-reference is traced one hop or explicitly skipped with reason.

### 3.4 Concluding "the rule applies" without checking exemptions
**Don't:** Apply a statute's operative rule without checking whether any statutory exemption applies.
**Why:** Statutes typically have carve-outs. CA Lab. Code § 2775(a) presumptively makes the worker an employee; § 2775(b) lists exemption conditions; § 2783 enumerates 75+ occupation-specific exemptions. Skipping the exemption analysis can flip the answer.
**Prevented by:** [R15 CompletenessGate](../../rules/R15.CompletenessGate.md) criterion 3. Drafter sets `relies_on_exemption: true` when the analysis turns on an exemption; R15 verifies the exemption provisions are retrieved.

### 3.5 Element-skipping in conjunction tests
**Don't:** Evaluate "we meet the ABC test" without explicit per-prong evaluation.
**Why:** ABC test is three prongs, all of which must be satisfied. Skipping an element produces wrong conclusions that look right.
**Prevented by:** [`applicability-analysis` skill](../../skills/applicability-analysis/SKILL.md). The skill's workflow requires per-element evaluation with fact-pattern basis and confidence per element.

---

## 4. Interpretation & canon-application anti-patterns

### 4.1 Cherry-picking the supportive canon
**Don't:** Apply a canon of construction because it produces the desired outcome, without considering competing canons.
**Why:** Most ambiguous statutes admit multiple canons. The choice between them is the analytical work; cherry-picking masks the choice.
**Prevented by:** [W4 CanonConflictDeclared](../../rules/W4.CanonConflictDeclared.md). The Drafter must declare the conflict, name all considered canons, and justify the choice.

### 4.2 Using federal canons without checking state adoption
**Don't:** Apply a canon developed in federal practice (e.g., Chevron pre-2024) to a state-court analysis without checking whether the state has adopted the canon.
**Why:** Canons of construction vary jurisdictionally. Federal canons aren't automatically state canons.
**Prevented by:** `canon-application` skill's jurisdictional-weight check.

### 4.3 Plain meaning over defined terms
**Don't:** Apply the plain-meaning rule to a term that's been defined in the chapter.
**Why:** Defined terms displace plain meaning within their scope. Plain meaning is only a default when no definition controls.
**Prevented by:** `canon-application` skill's ambiguity-ladder Step 2 (defined-term resolution before canons).

### 4.4 Treating policy preferences as canons
**Don't:** Assert "the rule should be construed broadly to protect workers" as a canon.
**Why:** Some jurisdictions have remedial-statute liberal-construction canons that apply specifically; the assertion above conflates the canon with a policy preference. Always name the actual canon.
**Prevented by:** W4's enforcement that named canons be declared.

---

## 5. Confidence & uncertainty anti-patterns

### 5.1 Hedging instead of escalating
**Don't:** Write a deliverable full of "may," "could," "potentially," and "arguably" when the underlying uncertainty really means the research is insufficient.
**Why:** Hedging hides the gap. The reviewer can't tell if the analysis is genuinely about a doctrinally split question or if the agent doesn't have enough material.
**Prevented by:** [W3 HedgeDensity](../../rules/W3.HedgeDensity.md) + [R11 LowConfidenceGate](../../rules/R11.LowConfidenceGate.md). High hedge density triggers a warning; structurally-detected low confidence blocks delivery.

### 5.2 Producing a hedged answer when R11 should fire
**Don't:** Lower confidence below threshold (5+ verify flags, 3+ unresolved cross-refs) and still deliver a hedged answer.
**Why:** The agent is essentially asking the reviewer to do the research themselves. An incomplete-response is more useful: clear "I don't know yet, here's why."
**Prevented by:** R11 LowConfidenceGate. LOW rating blocks Renderer; emits structured "research incomplete" notice.

### 5.3 More than 3 verify flags
**Don't:** Emit 4+ verify_flag entries in a deliverable.
**Why:** At 4+ flags, the deliverable's signal-to-noise ratio breaks down. The reviewer either rejects the draft or skims past the flags.
**Prevented by:** [R13 VerifyFlagCap](../../rules/R13.VerifyFlagCap.md). Schema rejects deliverables with >3 flags; Drafter must consolidate or escalate to R11.

### 5.4 "Verify this" without a concrete next step
**Don't:** Issue a verify_flag without a specific suggested_verification.
**Why:** A flag without an actionable next step is a hedge in structured form.
**Prevented by:** Schema requires `verify_flag.suggested_verification.minLength: 30` and `why_flagged.minLength: 50`.

---

## 6. Classification & company-context anti-patterns

### 6.1 Skipping the classification overlay
**Don't:** Deliver a deliverable without addressing every category in `company-context/risk-taxonomy.yaml`.
**Why:** A research deliverable without operator-specific risk mapping is functionally a generic legal-research output. The team needs to know which company-context risks the deliverable's subject implicates.
**Prevented by:** [R12 ClassificationOverlay](../../rules/R12.ClassificationOverlay.md). Render fails if any taxonomy category is missing from the overlay.

### 6.2 Boilerplate clearance rationales
**Don't:** Write "N/A" or "not applicable" without explaining why.
**Why:** Generic clearances are indistinguishable from "I didn't check." Each clearance must specifically state why this risk doesn't apply to *this* subject.
**Prevented by:** Schema `rationale.minLength: 10` + Critic re-check for boilerplate patterns.

### 6.3 Using banned terminology in classification rationales
**Don't:** Write "Clipboard Health employs nurses" in a rationale (or any analogous violation of `terminology.yaml`).
**Why:** Terminology rules apply to every word the agent produces, including the rationale text in classification overlays. Banned terms here are just as load-bearing as in the main analysis.
**Prevented by:** Critic re-check against `terminology.yaml`'s never_use list.

### 6.4 Severity drift across deliverables
**Don't:** Rate the same risk category as critical in one deliverable and low in another, without doctrinal reason for the change.
**Why:** Inconsistent severity ratings reduce reviewer trust. Tunable: the Classification sub-agent should consult prior-positions for severity consistency.
**Prevented by:** Quarterly review of severity-assignment patterns; Critic surfaces large deltas.

---

## 7. Output & rendering anti-patterns

### 7.1 Missing the "DRAFT FOR COUNSEL REVIEW" stamp
**Don't:** Render a deliverable without the stamp at the top (and bottom for memos).
**Why:** Every output is a draft. Without the stamp, the reviewer may treat the output as final legal advice. PRD §3 non-goal 2.
**Prevented by:** Schema requires `stamp` field; Renderer always renders it.

### 7.2 Missing pinpoint fields in citations
**Don't:** Cite "Cal. Lab. Code § 2775" when the asserted text references subdivision (b)(1)(A).
**Why:** A section-level cite for subdivision-level content is technically wrong. The reader can't find the cited proposition.
**Prevented by:** [R6 PinpointCite](../../rules/R6.PinpointCite.md). Schema requires per-kind pinpoint fields; missing fields fail render.

### 7.3 Burying load-bearing content in footnotes
**Don't:** Move the controlling cite to a footnote when the body asserts the proposition.
**Why:** Modern legal-AI deliverables don't use footnotes the way memos do. Cite inline; reserve footnotes for tangential context (and v1 doesn't support footnotes at all).
**Prevented by:** Deliverable schema's flat `cites[]` array per claim.

### 7.4 Producing an answer to a different question than was asked
**Don't:** Drift away from the verbatim question in the deliverable.
**Why:** The agent sometimes "helpfully" expands the question to a related one. The reviewer asked about CA AB5 prong B; the agent answered about ABC tests generally. The reviewer gets neither.
**Prevented by:** Critic re-check of deliverable's bottom_line against verbatim_question.

---

## 8. Multi-state & jurisdiction anti-patterns

### 8.1 Quiet omission of states
**Don't:** In a multi-state survey, omit a state because the corpus is thin or the research was hard.
**Why:** The reviewer asked about N states and expects to see N states. Omission produces partial coverage masquerading as complete.
**Prevented by:** [W1 PartialAcrossStates](../../rules/W1.PartialAcrossStates.md). Schema requires every state in TaskSpec.jurisdictions to appear in coverage_matrix; the matrix is rendered prominently above the analysis.

### 8.2 Cross-jurisdictional reference creep
**Don't:** Helpfully add "and in Illinois the rule is..." when the question is about CA.
**Why:** R2 JurisdictionLock and the verbatim-question fidelity together establish the scope. Expanding the scope is the agent helpfully producing different research than was asked for.
**Prevented by:** [R2 JurisdictionLock](../../rules/R2.JurisdictionLock.md). Tools targeting out-of-scope jurisdictions are blocked at `before_tool_call`.

### 8.3 Treating federal regs as in scope for state-only TaskSpec
**Don't:** Cross-reference 29 CFR in an analysis where TaskSpec.jurisdictions is [US-CA] only.
**Why:** R2 blocks. But more importantly: cross-jurisdiction references should be explicitly skipped with a documented reason, not silently traced.
**Prevented by:** [R8 CrossRefTrace](../../rules/R8.CrossRefTrace.md) per-cross-ref jurisdiction check.

---

## 9. Operational & audit anti-patterns

### 9.1 Mutating the TaskSpec mid-run
**Don't:** Update TaskSpec.jurisdictions or topic after the orchestrator has dispatched the plan.
**Why:** TaskSpec is frozen for the run for reproducibility. Mid-run mutations break the audit chain.
**Prevented by:** Schema `frozen_at` field; orchestrator treats TaskSpec as immutable after that point. Clarifications mid-run produce a new TaskSpec referencing the original, not a mutation.

### 9.2 Skipping the audit chain
**Don't:** Render a deliverable without appending the corresponding events to the claim ledger.
**Why:** The audit chain is what makes the deliverable defensible. A run that skips ledger appends is unreproducible.
**Prevented by:** Orchestrator-side enforcement; the Renderer requires claim_ledger_id to be populated and the ledger to have an "deliverable_rendered" event.

### 9.3 Caching citator results across runs
**Don't:** Reuse Shepardize or free-citator results from a prior run.
**Why:** Negative treatment can land overnight (R10 7-day threshold for case law). Cached results are out of bounds.
**Prevented by:** R10 + the citator skills require re-query per run.

### 9.4 Logging Lexis content to public stores
**Don't:** Put the full text of a Shepardize report into the audit chain or a public artifact.
**Why:** Lexis ToS prohibits redistribution of query results. The audit chain may log the event metadata, not the content.
**Prevented by:** `citator-profile-a` skill's audit-trail-logging rules.

### 9.5 Treating the deliverable as final legal advice
**Don't:** Send the deliverable to a client or use it without human-counsel review.
**Why:** PRD §3 non-goal 2. The agent produces research drafts; counsel produces advice. Every deliverable is stamped "DRAFT FOR COUNSEL REVIEW" for exactly this reason.
**Prevented by:** Stamp; banner on incomplete responses; client-facing disclaimers in deliverable templates.

---

## How to add an anti-pattern

When a new failure mode is observed in production:

1. Determine which rule (or new rule) prevents it.
2. Add a per-rule anti-pattern entry in the relevant rule file's ## Anti-patterns specific to this skill section.
3. Add an aggregated entry to this file under the right category.
4. If the failure mode doesn't have a preventing rule, propose a new rule or warning per the [`rules/README.md`](../../rules/README.md) "Add a new rule" workflow.

The Critic and Verifier sub-agents are tuned against this document. New anti-patterns should produce test cases that drive their tuning.
