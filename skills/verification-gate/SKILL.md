---
name: verification-gate
description: |
  Procedural enforcement of R5 HashEcho and PRD §6 Methodology Part VII (the
  screenshot-and-compare gate). Run by the Verifier sub-agent before every
  deliverable: independently re-fetch every anchored span, exact-match it
  against the live corpus, surface any discrepancy. Acts as the second
  reader of the Drafter's output.
argument-hint: "[claim_ledger_id]"
when_to_use:
  - "After the Drafter has produced its final draft and before the Renderer is invoked."
  - "When the Critic flagged a potential anchor mismatch that warrants formal re-verification."
  - "Anytime the audit chain needs to confirm anchor fidelity after the fact (auditor reruns)."
---

# /verification-gate — Independent anchor re-verification (R5)

## Pre-conditions

- The Drafter has produced at least one revision of the deliverable.
- Every anchored quote in the draft has a `(doc_id, char_start, char_end, hash)` tuple.
- `retrieval_log` is populated with every span the Drafter retrieved this session.
- The Verifier sub-agent has access to `kb_span_get_by_hash` and `kb_span_recompute_hash`.

## Workflow

### Step 1: Build the anchor inventory

Scan the draft for every anchored quote. The inventory is a flat list:

```json
[
  { "anchor": { "doc_id": "...", "char_start": 0, "char_end": 90, "hash": "sha256:..." }, "asserted_text": "..." },
  ...
]
```

Each entry pairs the anchor metadata with the text the Drafter asserted at that anchor.

### Step 2: Re-fetch each span by hash

For each entry, call `kb_span_get_by_hash(anchor.hash)`. The tool returns either:

- The historically-retrieved span (from `retrieval_log` snapshot): the text the Drafter saw at retrieval time.
- `NOT_FOUND` if the hash is not in `retrieval_log` (forged anchor or stale corpus reference).

### Step 3: Compare asserted text to fetched text

For each successfully-fetched span, normalize both the asserted text and the fetched text:

- Collapse runs of whitespace.
- Apply Unicode NFC.
- Normalize smart quotes / em-dashes to ASCII.

Then check whether the asserted text is a contiguous substring of the fetched text.

- If yes: status `pass`.
- If no: status `text_mismatch`. Record the diff.

For `NOT_FOUND` results from Step 2: status `hash_not_found`.

### Step 4: Recompute the live hash (corpus drift check)

For each successfully-fetched span, call `kb_span_recompute_hash({ doc_id, char_start, char_end })` to compute the live hash of those characters as they exist in the corpus *right now*.

If the live hash differs from the anchored hash: status `corpus_drift`. This typically means the corpus was re-ingested mid-session.

- If the live text is semantically identical (whitespace normalization differences only): log W2 and allow.
- If the live text is materially different: trigger R10 refresh path; the orchestrator decides whether to restart the run with fresh content.

### Step 5: Per-anchor staleness check (R10)

For each anchor, also check `current_through` against the staleness threshold for the source kind. Status `stale_annotated` if over threshold but TaskSpec.requires_fresh is false; status `stale_blocking` if over and requires_fresh is true.

### Step 6: Compose the Verifier output

Aggregate per-anchor results into a `verifier-output` artifact per `schemas/verifier-output.schema.json`. Include summary counts for fast orchestrator dispatch decisions.

### Step 7: Surface to orchestrator

If any anchor has status other than `pass`:

- `hash_not_found` or `text_mismatch`: orchestrator triggers a Drafter revise loop with the failing anchors named in the instructions.
- `corpus_drift`: orchestrator decides between W2 (semantic identity) and R10 refresh (material change).
- `stale_blocking`: R10 refresh is triggered.
- `stale_annotated`: deliverable proceeds with annotation; no block.

If all anchors pass: proceed to Critic / Confidence / Classification.

## Output Format

Per `schemas/verifier-output.schema.json`. Key fields:

```json
{
  "id": "...",
  "claim_ledger_id": "...",
  "verified_at": "2026-05-11T...",
  "anchors": [
    {
      "anchor": { "doc_id": "ca-lab-2775", "char_start": 0, "char_end": 90, "hash": "sha256:abcd..." },
      "asserted_text": "a person providing labor or services for remuneration shall be considered an employee",
      "live_text": "a person providing labor or services for remuneration shall be considered an employee",
      "live_hash": "sha256:abcd...",
      "current_through": "2026-04-01",
      "status": "pass",
      "staleness_status": "fresh"
    }
  ],
  "summary": { "total": 5, "passed": 5, "hash_not_found": 0, "text_mismatch": 0, "corpus_drift": 0, "stale_annotated": 0, "stale_blocking": 0 },
  "duration_ms": 2150
}
```

## Anti-patterns specific to this skill

- ❌ **Trusting the Drafter's hash without re-computation.** The whole point of R5 is independent verification. The Verifier must re-fetch via `kb_span_get_by_hash`, not assume the Drafter's anchor is correct.
- ❌ **Skipping normalization.** Whitespace and Unicode normalization is part of the comparison. Without it, harmless whitespace differences produce false `text_mismatch` results.
- ❌ **Over-normalizing.** Case and punctuation are NOT normalized. "the worker" is a different quote from "the Worker" or "the worker."
- ❌ **Reporting only failures.** The Verifier reports every anchor's status (pass and non-pass). The summary counts drive orchestrator dispatch; partial reporting breaks that.
- ❌ **Batching too aggressively.** Each `kb_span_get_by_hash` is a single keyed lookup; batching saves marginal time. The Verifier prioritizes correctness over latency — if a batched implementation would conceal partial failures, prefer per-anchor calls.
- ❌ **Treating corpus_drift as a hard fail when it's a normalization difference.** Re-ingestion sometimes changes whitespace, line endings, or Unicode form. The Verifier checks semantic identity before failing.
- ❌ **Returning a single status when there are multiple failures.** The Verifier's job is to surface ALL failures in one pass so the Drafter can fix them in one revision. Per-anchor results, not just an aggregate.
