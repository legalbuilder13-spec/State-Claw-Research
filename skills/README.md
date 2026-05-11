# Skills

Skills are procedural recipes the agent loads at runtime. Each skill is a Markdown file with YAML frontmatter following OpenClaw's `skills/<name>/SKILL.md` convention. The orchestrator's planner instructs a sub-agent to load the appropriate skill before acting; the skill's workflow becomes the sub-agent's working contract for the operation.

This directory ships the legal-research skills that the rule engine and sub-agents need. They live alongside OpenClaw's existing personal-productivity skills (`skills/notion/`, `skills/slack/`, etc.) — no conflict; the legal-research skills are namespaced by their domain.

## Skill index

| Skill | When loaded | Owning sub-agent | Enforces |
|---|---|---|---|
| [`docs-escalation-response/`](docs-escalation-response/SKILL.md) | Top-level entry; every escalation | Orchestrator | (orchestrates everything) |
| [`statute-research/`](statute-research/SKILL.md) | Any analysis needing statutory retrieval | Statute | Methodology II.2 (7-step sequence) |
| [`regulation-research/`](regulation-research/SKILL.md) | When R7 RegSearchOnDelegation fires | Regulation | R7 procedurally |
| [`definitions-first/`](definitions-first/SKILL.md) | Loaded by Statute sub-agent before operative-section analysis | Statute | R9 procedurally |
| [`cross-reference-trace/`](cross-reference-trace/SKILL.md) | After any statute / reg retrieval | Statute / Regulation | R8 procedurally |
| [`canon-application/`](canon-application/SKILL.md) | When the analysis involves statutory interpretation | Drafter | W4 procedurally; Methodology IV.3 |
| [`applicability-analysis/`](applicability-analysis/SKILL.md) | When the analysis turns on threshold / conjunction / exemption | Drafter | Methodology V |
| [`requirement-type-categorization/`](requirement-type-categorization/SKILL.md) | When extracting requirements from a statute | Statute / Regulation | Methodology VI |
| [`verification-gate/`](verification-gate/SKILL.md) | Before delivery | Verifier | R5 + Methodology VII |
| [`citator-profile-b/`](citator-profile-b/SKILL.md) | When TaskSpec.source_profile = "B" and case-law check needed | Verifier | Free citator chain |
| [`citator-profile-a/`](citator-profile-a/SKILL.md) | When TaskSpec.source_profile = "A" | Verifier | Lexis citator |
| [`classification-overlay/`](classification-overlay/SKILL.md) | Before delivery | Classification | R12 + Methodology X |

## Skill file format

Every skill in this directory follows OpenClaw's convention with YAML frontmatter plus a structured Markdown body:

```markdown
---
name: <skill-name>
description: <one-paragraph description; the model reads this when deciding whether to load>
argument-hint: "[<args>]"
when_to_use:
  - "<bulleted list of trigger conditions>"
---

# /<skill-name> -- <Human-readable title>

## Pre-conditions

What must be true before this skill runs (e.g., TaskSpec frozen, source profile loaded, certain retrievals already in retrieval_log).

## Workflow

### Step 1: <name>
<what the sub-agent does, with exact tool calls when applicable>

### Step 2: <name>
...

## Output Format

<the structured artifact the skill produces; references schemas/ when the output is schema-bound>

## Anti-patterns specific to this skill

- ❌ Anti-pattern: <what not to do, with rationale>
- ❌ Anti-pattern: <what not to do, with rationale>
```

## How the orchestrator selects a skill

1. The orchestrator's planner identifies the sub-agent needed for the next step (Statute / Regulation / Verifier / etc.).
2. The planner inspects the sub-agent's task: is it a statute retrieval? A regulation search? A canon-of-construction interpretation?
3. The planner matches the task description against each skill's `when_to_use` list.
4. The first matching skill is loaded; the sub-agent's prompt includes the skill's content as a binding workflow.

The planner can load **more than one skill** for the same sub-agent invocation when their workflows compose (e.g., Statute sub-agent loads `statute-research` AND `definitions-first` AND `cross-reference-trace` for a single chapter analysis).

## Adding a new skill

1. Pick the directory name: `<noun-phrase>/SKILL.md` (lowercase-hyphenated).
2. Author per the file format above.
3. Add a row to the index in this README.
4. Update the relevant rule file's "Enforcement point" line if the skill implements a rule procedurally.
5. Add `when_to_use` triggers that don't overlap with existing skills — overlapping triggers produce ambiguous plans.
6. Open a PR. Code review should verify the workflow is concrete (no "do whatever makes sense" steps) and the output format is bound to a schema where applicable.

## How skills relate to the rest of the system

- **Rules** (`rules/`) are gates. Skills are recipes that produce outputs that pass through those gates.
- **Schemas** (`schemas/`) are output contracts. Skills produce outputs validating against those contracts.
- **Company-context** (`company-context/`) is operator configuration. Skills consult it when applicable (especially `classification-overlay`).
- **Source profiles** (`source-profiles/`) select retrieval backends. Skills typically don't care which profile is active; the tools they call do.

## See also

- [`docs/legal/PLUGIN-SDK-NOTES.md`](../docs/legal/PLUGIN-SDK-NOTES.md) — how OpenClaw's plugin SDK exposes skills.
- [`docs/legal/PRD-OPENCLAW-FORK.md`](../docs/legal/PRD-OPENCLAW-FORK.md) §10 — original PRD treatment.
- [`rules/README.md`](../rules/README.md) — enforcement-point taxonomy.
