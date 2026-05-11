# Rule Engine — R1–R15 + W1–W4

The rule engine is the anti-hallucination defense in depth for Agentic-Law-OS. **15 blocking rules** and **4 warnings**, each enforced at a specific architectural seam in the agent loop. This is what makes the system "refuse rather than fabricate."

Rules are not advisory. Every blocking rule fires at a specific OpenClaw hook and either blocks the operation, rewrites the payload, or escalates to a sub-agent. Silent degradation is never an acceptable outcome — a rule violation produces an explicit rule-ID, a fix recommendation, and an audit-chain entry.

## Severity ladder

| Severity | Behavior | Recovery |
|---|---|---|
| **Blocking (R1–R15)** | The operation is rejected. The agent receives an error result naming the rule ID, the failing condition, and the suggested fix. No partial answer is produced. | If the violation is recoverable (e.g., a Drafter missing an anchor), the orchestrator allows up to 2 `before_agent_finalize` revise loops before escalating. If still failing after 2 revisions, R11 LowConfidenceGate fires and the deliverable is blocked with "research incomplete." |
| **Warning (W1–W4)** | Surfaced to the user with the deliverable; annotates but does not block. Warnings are persisted to the audit log alongside the artifact they decorate. | None — warnings are informational, not gates. |

## Enforcement-point taxonomy

Each rule has a fixed enforcement point in the agent loop. This table is the load-bearing seam map between the rule specs in this directory and the plugin code that will enforce them in Phase 4.

| Point in the agent loop | Rules enforced here | OpenClaw hook (Phase 0 confirmed) |
|---|---|---|
| Tier-1 intake (inbound message) | (R1, R2 pre-flight; R14 source-category lock) | `message_received`, `inbound_claim` |
| Orchestrator plan validation | R7, R9, R15 | `before_agent_run` |
| Pre-tool-call (per KB tool) | R1, R2 | `before_tool_call` |
| Post-tool-call (retrieval log) | R10 | `after_tool_call` |
| Drafter sub-agent output validation | R3, R4, R13 | sub-agent post-process |
| Statute / Regulation sub-agent | R8 | sub-agent post-process |
| Verifier sub-agent | R5, R10 | `api.runtime.subagent.run(...)` |
| Critic sub-agent | R3, R4 re-check; W2 | `api.runtime.subagent.run(...)` |
| Confidence sub-agent | R11 | `api.runtime.subagent.run(...)` |
| Renderer (pre-delivery) | R6, R12, R14, R15 | `before_agent_finalize`, `message_sending` |

OpenClaw's plugin SDK was confirmed to expose every one of these hooks in Phase 0 — see [`docs/legal/PLUGIN-SDK-NOTES.md`](../docs/legal/PLUGIN-SDK-NOTES.md) §5.

## Blocking rules

| ID | Name | One-line spec | Enforcement | File |
|---|---|---|---|---|
| R1 | SourceAllowlist | KB tools may only return content from sources in the active source profile's allowlist. | `before_tool_call` | [R1.SourceAllowlist.md](R1.SourceAllowlist.md) |
| R2 | JurisdictionLock | KB tools may only operate on jurisdictions named in the active TaskSpec. | Tool param schema + `before_tool_call` | R2.JurisdictionLock.md |
| R3 | NoMemoryStatutes | The Drafter may not state statute text from training memory; every assertion traces to a retrieved span. | Drafter output schema + Critic re-check | R3.NoMemoryStatutes.md |
| R4 | QuotingRule | Every quoted span must carry a `(doc_id, char_start, char_end, hash)` anchor pointing to a span retrieved this session. | Drafter schema; Renderer; Critic; Verifier | [R4.QuotingRule.md](R4.QuotingRule.md) |
| R5 | HashEcho | The Verifier sub-agent independently re-fetches every anchored span and exact-matches against the source. | Verifier sub-agent | R5.HashEcho.md |
| R6 | PinpointCite | Every substantive claim carries a pinpoint citation (title + section + subdivision, plus reporter/page for cases). | Renderer schema | R6.PinpointCite.md |
| R7 | RegSearchOnDelegation | When a statute delegates to a regulation ("the agency shall promulgate rules…"), the implementing reg must be retrieved before the analysis closes. | Orchestrator plan validation | R7.RegSearchOnDelegation.md |
| R8 | CrossRefTrace | Every cross-reference in a retrieved statutory section is traced one hop before analysis closes. | Statute sub-agent | R8.CrossRefTrace.md |
| R9 | DefinitionsFirst | The Definitions section of a statutory chapter is retrieved and consumed before analysis of operative provisions. | Orchestrator | R9.DefinitionsFirst.md |
| R10 | CurrencyTag | Every retrieved span carries `current_through` metadata; spans older than the configurable staleness threshold are flagged or refreshed. | Verifier | R10.CurrencyTag.md |
| R11 | LowConfidenceGate | A LOW-confidence determination from the Confidence sub-agent blocks delivery; the agent emits "research incomplete" instead. | Confidence sub-agent | R11.LowConfidenceGate.md |
| R12 | ClassificationOverlay | Every deliverable surfaces the company-context classification risk overlay — every category in `risk-taxonomy.yaml` is either flagged or explicitly cleared. | Renderer | R12.ClassificationOverlay.md |
| R13 | VerifyFlagCap | The Drafter may emit at most 3 verify flags per deliverable; more than 3 means the research is insufficient (escalate to R11). | Drafter schema | R13.VerifyFlagCap.md |
| R14 | NoLawFirmCitation | Citations may only be `citation_eligible` source categories (primary statute, primary regulation, case law, secondary treatise); orientation-only sources are stripped at render time. | Renderer schema | R14.NoLawFirmCitation.md |
| R15 | CompletenessGate | The 7-criterion completeness check (definitions, operative provisions, exemptions, regulations, cross-refs, currency, classification) must pass before delivery. | Orchestrator | R15.CompletenessGate.md |

## Warnings

| ID | Name | One-line spec | Enforcement | File |
|---|---|---|---|---|
| W1 | PartialAcrossStates | Multi-state survey returning incomplete coverage of named jurisdictions is delivered with a per-state coverage matrix. | Orchestrator | W1.PartialAcrossStates.md |
| W2 | ParaphraseDriftCheck | Cross-revision check: paraphrases drifting from their anchored source between revise loops are flagged. | Critic | W2.ParaphraseDriftCheck.md |
| W3 | HedgeDensity | Hedge-word frequency in the final draft above a configurable threshold ("may," "could," "arguably," "perhaps," …) is annotated. | Critic | W3.HedgeDensity.md |
| W4 | CanonConflictDeclared | The Drafter applied conflicting canons of construction (e.g., *expressio unius* vs. *ejusdem generis*) without explicitly declaring which won and why. | Drafter | W4.CanonConflictDeclared.md |

## Rule-spec file format

Every rule file in this directory follows this exact structure. Future additions must conform.

```markdown
# RX.Name  (or  WX.Name)

**Spec:** [single-sentence formal statement of the rule]
**Enforcement point:** [where in the agent loop / which OpenClaw hook / which sub-agent]
**Severity:** blocking | warning.
**Failure mode:** [exactly what happens when the rule fires — what the model sees, what the user sees, what the audit log records]

## Detail
[2–6 paragraphs explaining the rule's purpose, edge cases, and interactions with adjacent rules. Cite the PRD section that motivated the rule where relevant.]

## Interactions with other rules
[How this rule relates to nearby rules — defense in depth pairings, escalation paths.]

## Test cases
- ✅ Compliant: [scenario] → [expected outcome]
- ❌ Non-compliant: [scenario] → [expected rejection with rule ID and failure-mode text]
- (3–6 cases per rule covering both the obvious failures and the subtle ones)

## Open questions
[Anything that's deliberately left for later — e.g., a threshold not yet tuned, an enforcement detail awaiting a sub-agent design decision.]
```

## Test-case format and runtime behavior

Test cases are written as concrete scenarios — inputs and expected outcomes, not abstract assertions. The Phase 4+ plugin pack's test suite reads these files and synthesizes runtime assertions:

- Every ❌ case becomes a **regression test**: the system must reject this exact pattern with the specified rule ID and failure message.
- Every ✅ case becomes a **smoke test**: this exact pattern must pass cleanly.

If a rule changes, the test suite catches every drift. If a future contributor edits a rule file without updating the test cases, the contract has changed implicitly — which is exactly what we want surfaced in code review.

## Why this many rules?

The PRD §7 grew this list iteratively from observed failure modes in production legal AI. Fifteen blocking rules sounds like a lot; each one represents a specific hallucination pattern that has been observed and is hard to catch without explicit enforcement. Removing a rule means accepting that failure mode.

The four warnings (W1–W4) cover patterns that are *suspicious but not always wrong* — they annotate the output for human review rather than blocking it.

## How to add a new rule

1. Pick an ID. Blocking: next R-number after R15. Warning: next W-number after W4.
2. Create `RX.Name.md` (or `WX.Name.md`) following the format above.
3. Add a row to the table in this README.
4. Add an entry to the enforcement-point taxonomy table if the rule introduces a new hook.
5. Confirm OpenClaw exposes the hook (see [`docs/legal/PLUGIN-SDK-NOTES.md`](../docs/legal/PLUGIN-SDK-NOTES.md)) before assuming it; if not, the rule can't be enforced and the design is wrong.
6. Add at least one ✅ test case and at least three ❌ test cases.
7. If the rule interacts with adjacent rules, update both rule files' "Interactions" sections.
8. Open a PR. Code review should reject any new rule that lacks test cases or that can't point at a documented OpenClaw hook.

## See also

- [`docs/legal/PRD-OPENCLAW-FORK.md`](../docs/legal/PRD-OPENCLAW-FORK.md) §7 — original PRD treatment of the rule engine
- [`docs/legal/PLUGIN-SDK-NOTES.md`](../docs/legal/PLUGIN-SDK-NOTES.md) §5 — per-rule OpenClaw hook coverage
- [`docs/legal/PHASE-0-REPORT.md`](../docs/legal/PHASE-0-REPORT.md) §5 — Phase-0 verified GREEN status for every rule
- `schemas/` — the JSON Schemas the rules reference (claim, deliverable, classification, confidence, etc.)
- `company-context/risk-taxonomy.yaml` — referenced by R12
- `source-profiles/profile-{a,b}.yaml` — referenced by R1
