---
name: canon-application
description: |
  Applies canons of construction to interpret statutory text. Per PRD §6
  Methodology Part IV, the agent applies canons from a catalog of 17 named
  canons. When multiple canons fire on the same question and produce different
  outcomes, this skill enforces W4 CanonConflictDeclared by requiring an
  explicit declaration of which canon won and why.
argument-hint: "[claim_id]"
when_to_use:
  - "The analysis turns on the meaning of statutory language (most statutory-interpretation questions)."
  - "Two retrieved provisions seem to conflict, or the same provision admits multiple readings."
  - "The Drafter must take a position on what a statutory term means; the Critic flagged a position that is not clearly text-supported."
---

# /canon-application — Apply canons of construction (Methodology IV.3)

## Pre-conditions

- The relevant statutory text has been retrieved and is in `retrieval_log`.
- The chapter's Definitions section has been retrieved per R9 (defined terms take precedence over canon-based interpretation).
- The question is one of statutory interpretation, not pure factual application.

## Workflow

### Step 1: Identify the interpretive question

State the precise question of interpretation:

- "Does subdivision (b)'s exemption list exhaust the exemptions, or is it illustrative?"
- "Does 'control' in § 2775(a)(1) require day-to-day supervision, or does any contractual control suffice?"
- "Does the statute's silence about per-diem workers preserve common-law treatment, or does it impliedly include them?"

A well-stated interpretive question is half the analysis.

### Step 2: Consult the defined terms

Before reaching for canons, check whether the chapter's Definitions section resolves the question. Defined terms have legislative force; canons of construction yield to them. If the term is defined, the question is answered — record the definition and move on.

### Step 3: Identify candidate canons

For the interpretive question, identify the canons that could apply. The catalog (drawn from PRD §6 Part IV):

1. **Plain meaning rule** — statute's text controls unless absurd
2. **Expressio unius est exclusio alterius** — explicit listing excludes unlisted
3. **Ejusdem generis** — general term following specifics takes meaning from specifics
4. **Noscitur a sociis** — word known by the company it keeps
5. **Constitutional avoidance** — interpret to avoid constitutional questions
6. **Rule against surplusage** — give every word effect
7. **Remedial-statute liberal construction** — remedial statutes construed liberally
8. **Statute-in-derogation-of-common-law strict construction** — strict when in derogation
9. **In pari materia** — read related statutes together
10. **Rule of lenity** — ambiguity in penal statutes goes to defendant
11. **Absurdity doctrine** — plain meaning yields if it produces absurd result
12. **Presumption against extraterritorial application**
13. **Presumption against retroactivity**
14. **Presumption in favor of judicial review**
15. **Deference to administrative interpretation** (Chevron; *Loper Bright* post-2024 changes)
16. **Departmental construction canon** — long-standing agency interpretation gets weight
17. **Expressio unius negated** — when the legislature uses a default catch-all phrase, expressio unius does NOT apply

For each candidate, compute the outcome it would produce.

### Step 4: Detect conflicts

Compare outcomes across applied canons:

- If only one canon fires (or multiple canons produce the same outcome), no conflict; the analysis cites the controlling canon.
- If 2+ canons fire and produce different outcomes, W4 CanonConflictDeclared applies. Proceed to Step 5.

### Step 5: Resolve the conflict explicitly

Pick the controlling canon and articulate the rationale. Per W4, the rationale must:

- Name every canon considered.
- State the outcome each canon would produce.
- Identify which canon was applied.
- Justify the choice with concrete evidence: textual structure, legislative history (where retrieved), parallel jurisdictional authority, or doctrinal hierarchy.

The justification should not be a mere assertion ("we chose expressio unius"); it should be an argument ("the enumeration's exhaustive numbered structure (b)(1) through (b)(8), combined with the absence of any catch-all language like 'or other circumstances,' signals legislative intent to enumerate exhaustively; expressio unius is the better fit").

### Step 6: Surface to the Drafter

Emit the canon-application record into the Drafter's context. The Drafter incorporates the chosen interpretation into the relevant claim and populates `canon_applied[]` and (when applicable) `deliverable.canon_conflicts[]`.

## Output Format

```json
{
  "claim_id": "claim-007",
  "interpretive_question": "Does subdivision (b)'s exemption list exhaust the exemptions?",
  "definitions_consulted": true,
  "definitions_dispositive": false,
  "canons_considered": [
    { "canon": "expressio_unius_est_exclusio_alterius", "outcome": "exemption does NOT apply because (b)'s list does not include this worker's situation" },
    { "canon": "ejusdem_generis", "outcome": "exemption MAY apply because the unlisted situation is of the same kind as listed ones" }
  ],
  "applied": "expressio_unius_est_exclusio_alterius",
  "rationale": "Subdivision (b) is structured as an exhaustive numbered list at (b)(1)-(b)(8) with no catch-all language. The legislature's explicit choice of an exhaustive enumeration signals intent for expressio unius; ejusdem generis applies to general-following-specific structures, which this is not.",
  "supporting_cite": { "kind": "case_law", "name": "Soto v. Castlerock", "reporter": "Cal. App. 5th", "volume": "...", ... }
}
```

## Anti-patterns specific to this skill

- ❌ **Skipping defined terms.** Canons are tiebreakers for textual ambiguity; they don't override legislative definitions. R9 retrieval → Step 2 check → only if undefined, apply canons.
- ❌ **Cherry-picking the supportive canon.** When two canons fire, the Drafter cannot just pick the one that supports the desired conclusion without W4 declaration. The W4 declaration is non-optional.
- ❌ **Asserting a canon without evidence.** "We apply expressio unius" is not an analysis; it's a label. The rationale must explain why the canon is the right fit for THIS statute's structure.
- ❌ **Treating canons as legislative mandates.** Canons are interpretive defaults; jurisdiction-specific case law may have modified them (e.g., CA's case law on rule of lenity differs from federal practice). Check jurisdictional weight.
- ❌ **Applying canons before retrieving the statute's full text.** A canon based on partial retrieval may mis-interpret the structure. Retrieve fully, then interpret.
- ❌ **Using federal canons for state interpretation without checking jurisdictional adoption.** Some canons (Chevron pre-2024) were federal-specific. Check state-court adoption before applying.
