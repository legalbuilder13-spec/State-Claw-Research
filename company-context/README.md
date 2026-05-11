# Company Context Pack

Drop-in directory that defines the operator's business model, fact pattern, terminology rules, risk taxonomy, and deliverable templates. Loaded on every run via `TaskSpec.company_context_ref`. **Edit the YAML and Markdown files in place to match your company.**

This directory ships with **generic gig-economy marketplace placeholders** (`<Company>`, `<Co>`, etc.). You — the operator — replace the placeholders with your company's specifics before the agent produces useful deliverables.

## Files

| File | Owner | Purpose |
|---|---|---|
| [`company.yaml`](company.yaml) | Operator | Identity + business model. Two-sided marketplace defaults. |
| [`fact-pattern.md`](fact-pattern.md) | Operator | Standing fact pattern the agent treats as ground truth for every analysis. |
| [`terminology.yaml`](terminology.yaml) | Operator | always-use and never-use word lists. Enforced by the Critic and Renderer. |
| [`verb-principle.yaml`](verb-principle.yaml) | Operator | Preferred and avoided verbs. Subset of terminology, specifically for verb choice (which has outsized classification implications). |
| [`risk-taxonomy.yaml`](risk-taxonomy.yaml) | Operator | The N categories every deliverable's classification overlay (R12) must address. |
| [`risk-vectors.yaml`](risk-vectors.yaml) | Operator | Mandatory check vectors — questions the agent asks itself before closing every analysis. |
| [`high-risk-jurisdictions.yaml`](high-risk-jurisdictions.yaml) | Operator | Jurisdictions that warrant heightened scrutiny. Drives orchestrator's depth-of-analysis decision. |
| [`factual-baseline.md`](factual-baseline.md) | Operator | What the company explicitly does **NOT** do. Catches "the agent's helpful elaboration drifted into something we don't actually do." |
| [`prior-positions/README.md`](prior-positions/README.md) | Operator | Drop prior memos and position papers here; the agent reads them for consistency. |
| [`deliverable-templates/slack-response.md`](deliverable-templates/slack-response.md) | Operator | Template for Slack-format responses. |
| [`deliverable-templates/memo.md`](deliverable-templates/memo.md) | Operator | Template for full memos. |
| [`deliverable-templates/chart.md`](deliverable-templates/chart.md) | Operator | Template for multi-state charts. |
| [`deliverable-templates/research-trail.md`](deliverable-templates/research-trail.md) | Operator | Template for research-trail / audit-style deliverables. |

## How the pack is consumed

1. **R12 ClassificationOverlay** reads `risk-taxonomy.yaml` to enumerate every category the deliverable must address.
2. **Renderer** reads `deliverable-templates/<output_type>.md` to format the final output.
3. **Critic sub-agent** reads `terminology.yaml` and `verb-principle.yaml` to enforce word-choice rules on Drafter outputs.
4. **Classification sub-agent** reads `risk-vectors.yaml` to systematically check every vector before closing.
5. **Orchestrator** reads `high-risk-jurisdictions.yaml` to set depth (more retrievals + tighter R10 thresholds) for high-risk jurisdictions.
6. **Statute / Regulation sub-agents** read `factual-baseline.md` and `fact-pattern.md` to ground every analysis in the operator's actual operations rather than abstract business models.

## Versioning

The pack is content-hashed at TaskSpec construction (`task_spec.company_context_ref.version_hash`). This makes deliverables reproducible: an audit can re-load the exact version of the pack the agent used.

Changes to the pack take effect on the next TaskSpec, not within an active run.

## Editing pattern

1. Replace `<Company>` / `<Co>` / `<Worker Type>` / `<Customer Type>` placeholders in [`company.yaml`](company.yaml).
2. Author [`fact-pattern.md`](fact-pattern.md) describing your actual operations in 1–2 pages. Be specific — vague fact patterns produce vague analyses.
3. Author [`factual-baseline.md`](factual-baseline.md): what you do NOT do. Equally important.
4. Customize [`risk-taxonomy.yaml`](risk-taxonomy.yaml) for your actual exposure. The defaults are gig-economy generic; remove categories that don't apply and add ones that do.
5. Customize [`terminology.yaml`](terminology.yaml) with your industry's terms. Worker-classification language matters most.
6. Edit [`deliverable-templates/`](deliverable-templates/) so outputs look the way your team expects.
7. Drop prior memos into [`prior-positions/`](prior-positions/) for the agent to consult.

## Adjacent verticals

The PRD §2 lists verticals this pack is designed to support with edits: rideshare, delivery, on-demand services, freelance marketplaces, healthcare staffing platforms, home-services marketplaces, last-mile logistics. The structure of the pack (these 13 files) doesn't change between verticals — only the values.

## What NOT to put here

- **Code** — this directory is content only. Code lives in `plugins/agentic-law-os/` (Phase 4+).
- **Per-matter context** — matter-specific facts go in the operator's matter system (Notion, internal wiki). The agent reads matter context via the Notion + Google Drive MCPs (Phase 6+).
- **Credentials** — environment configuration belongs in `.env`, not here.
- **Live data** — corpus data lives in Postgres (managed by the ingestion worker). This directory is configuration only.
