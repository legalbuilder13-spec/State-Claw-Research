# Prior Positions

Drop the operator's prior research memos, position papers, and consistent
analyses into this directory. The agent reads them at run start to maintain
consistency with positions the company has already taken.

## File format

Any of:
- `.md` — Markdown research memos
- `.pdf` — Scanned or exported memos (Docling parses these during agent intake)
- `.docx` — Word-format memos
- `.txt` — Plain text

Subdirectories by topic are encouraged once you have more than ~10 files:

```
prior-positions/
├── README.md
├── worker-classification/
│   ├── 2024-03-ab5-prong-b-analysis.md
│   ├── 2024-08-massachusetts-148b-analysis.md
│   └── 2025-01-illinois-staffing-act-applicability.md
├── joint-employer/
│   └── 2024-11-flsa-joint-employer-analysis.md
└── contract-clauses/
    ├── facility-policy-compliance-redline-pattern.md
    └── conversion-fee-rejection-pattern.md
```

## How the agent uses these

1. At Tier 1 intake, the orchestrator's plan validator scans this directory
   for documents whose topic taxonomy matches `TaskSpec.topic` or whose
   jurisdiction matches `TaskSpec.jurisdictions`.
2. Matching prior memos are loaded into the orchestrator's context as
   read-only reference material.
3. The Critic compares the deliverable's conclusions against the prior-memo
   conclusions. **If the new analysis contradicts a prior position, the Critic
   flags it as a warning** with an explicit pointer to which prior memo it
   conflicts with — the reviewer decides whether the contradiction is
   intentional (a policy shift) or unintentional (an inconsistency to fix).

## What belongs here

- ✅ Research memos with a defensible position the company has taken.
- ✅ Analyses where the company committed to a specific reading of an
  ambiguous statute.
- ✅ Contract-clause negotiation patterns (especially redlines and rejections
  the company has made repeatedly).
- ✅ Position papers on regulatory questions.

## What does NOT belong here

- ❌ Drafts that were rejected internally — keep only finalized positions.
- ❌ Matter-specific facts that don't generalize — those belong in the
  matter system (Notion / Drive).
- ❌ Time-sensitive analyses where the underlying law has materially changed
  (move to `archived/` or delete if no longer accurate).
- ❌ Generic legal research that's already in the agent's primary corpus
  (statute / reg ingestion handles that).

## Versioning

Memos in this directory are content-hashed by the orchestrator at TaskSpec
construction. The deliverable's `claim_ledger` records which prior-position
hashes were consulted, making it auditable which memos influenced the
analysis.

When a memo is superseded, move the old version to `archived/` rather than
deleting — the audit chain may reference the historical version.

## Bootstrapping

Start with **3–5 prior memos** that cover the company's most-cited positions.
The agent doesn't need a comprehensive archive on day 1 — it needs enough
to recognize the company's voice and primary positions. Add more over time
as deliverables are produced; the team should review each new deliverable
for "could this become a prior position?" candidates.
