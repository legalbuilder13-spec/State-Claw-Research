# PRD + Build Plan — Agentic-Law-OS (OpenClaw fork)

**Version:** 1.0
**Owner:** _(your name)_
**Last updated:** 2026-05-10
**Status:** Ready to execute

> **How to use this document.** This is a self-contained PRD and build plan for a new project. You should fork [openclaw/openclaw](https://github.com/openclaw/openclaw), then layer the legal-research capabilities described here on top of OpenClaw's existing plugin/skill architecture. References to "the source repo" mean [marco-clip/Agentic-Law-OS](https://github.com/marco-clip/Agentic-Law-OS) on branch `claude/statutory-research-tool-0kORq`, which contains the rules, schemas, skills, methodology, company-context pack, and Python ingestion worker that need to port into your fork. Every section below is dense and intentionally complete — copy this file into your new project and execute against it.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Product vision & users](#2-product-vision--users)
3. [Goals & non-goals](#3-goals--non-goals)
4. [Why fork OpenClaw (and what stays vs. changes)](#4-why-fork-openclaw-and-what-stays-vs-changes)
5. [Architecture](#5-architecture)
6. [Research methodology (Parts I–XIV)](#6-research-methodology-parts-ixiv)
7. [Anti-hallucination rule engine (R1–R15 + W1–W4)](#7-anti-hallucination-rule-engine-r1r15--w1w4)
8. [Source profiles (A: Lexis / B: Lexis-free)](#8-source-profiles-a-lexis--b-lexis-free)
9. [Company Context Pack](#9-company-context-pack)
10. [Skills (procedural recipes)](#10-skills-procedural-recipes)
11. [JSON schemas (data contracts)](#11-json-schemas-data-contracts)
12. [Database schema](#12-database-schema)
13. [Ingestion pipeline (Python + Docling + Voyage)](#13-ingestion-pipeline-python--docling--voyage)
14. [KB MCP server](#14-kb-mcp-server)
15. [ChatGPT-subscription auth via OpenClaw OAuth](#15-chatgpt-subscription-auth-via-openclaw-oauth)
16. [Infrastructure & deployment (Railway)](#16-infrastructure--deployment-railway)
17. [Phased build plan (weeks 1–6)](#17-phased-build-plan-weeks-16)
18. [File inventory — what to create in the new project](#18-file-inventory--what-to-create-in-the-new-project)
19. [Acceptance criteria & done definitions](#19-acceptance-criteria--done-definitions)
20. [Open decisions & blockers](#20-open-decisions--blockers)
21. [Source material to port from existing branch](#21-source-material-to-port-from-existing-branch)
22. [Starter prompt for a coding agent](#22-starter-prompt-for-a-coding-agent)

---

## 1. Executive summary

**Agentic-Law-OS** is a multi-channel statutory research agent for in-house legal teams at gig-economy companies. The agent ingests primary statutory and regulatory text from official state sources, applies a configurable company fact pattern, traces cross-references, surfaces classification risk, and emits Slack / Discord / VS Code / CLI deliverables — all under a hard-coded rule engine designed to **refuse rather than fabricate**.

The agent is built as a **fork of OpenClaw**, layered with a legal-research plugin pack. OpenClaw provides the multi-channel runtime, plugin system, and (critically) ChatGPT-subscription OAuth auth. We add the legal layer: the methodology, rules, schemas, skills, ingestion pipeline, and knowledge-base MCP server.

Default configuration:

- **Inference**: ChatGPT subscription via OpenClaw's `openai-codex` OAuth flow (GPT-5.4, 1M-token context). API key fallback supported.
- **Source profile**: B (Lexis-free) — local statute + admin-code corpus ingested from official state sources, free citator chain (CourtListener + Google Scholar + optional Casetext / Fastcase).
- **Company context**: generic gig-economy marketplace defaults; operator edits values for their vertical.
- **Company context store**: Notion (primary), Google Drive (secondary).
- **Hosting**: Railway (default) or Hostinger VPS / self-host.

---

## 2. Product vision & users

### Vision

A legal-research agent that an in-house attorney can interact with in the channels they already use — Slack, Discord, VS Code — to get verified, pinpoint-cited answers about state statutory and regulatory requirements, with explicit acknowledgment of uncertainty and gaps. Lower hallucination risk than chat-style legal AI; explicit audit trail; configurable to the company's specific fact pattern and risk tolerance.

### Users

| Primary user | Use cases |
|---|---|
| In-house counsel at gig-economy companies | Responding to operational team escalations, multi-state regulatory surveys, prior-position lookups, classification-risk assessment of contract or policy language |
| Compliance leads | Tracking statutory changes, monitoring high-risk jurisdictions, cross-referencing against playbook positions |
| Outside-counsel-adjacent paralegals / law clerks | First-pass research, citation verification, research trail maintenance |

### Adjacent verticals (with configuration changes)

The Company Context Pack is configurable. The same agent runs for any vertical with similar IC-classification or multi-state regulatory exposure: rideshare, delivery, on-demand services, freelance marketplaces, healthcare staffing platforms, home-services marketplaces, last-mile logistics. Each vertical edits `company-context/` with vertical-specific terminology, fact pattern, classification taxonomy, and high-risk jurisdictions.

### Anti-vision (what this is NOT)

- Not a replacement for human counsel — every output is stamped "DRAFT FOR COUNSEL REVIEW"
- Not a litigation-drafting tool — output formats are research memos, multi-state charts, and Slack-style escalation responses
- Not a Westlaw/Lexis substitute for case-law research — it covers statutes and regulations primarily; case lookup is via free citators
- Not a public-facing tool — it operates on internal channels only, with company-context awareness
- Not a chat interface — it's an agent that produces structured deliverables, not free-form conversation

---

## 3. Goals & non-goals

### Goals

1. **Verified citations only.** Every substantive claim cites a code title + section + subdivision; every quoted span is hash-anchored to a span retrieved this session and re-verified by an independent Verifier sub-agent.
2. **Closed-world retrieval.** No web access except an explicit allowlist (state legislative sites, state admin code sites, Justia, Cornell LII, CourtListener, CAP, etc.). Law-firm blogs and vendor sites are orientation only, never citation sources.
3. **Anti-hallucination defense in depth.** A 15-rule blocking engine + 4 warning rules, enforced at every architectural seam (tool layer, schema validation, ledger insert, pre-render). Documented in `rules/`.
4. **Multi-channel access.** Slack, Discord, VS Code (extension), CLI, all converging on the same agent runtime via OpenClaw's existing adapters.
5. **ChatGPT subscription as the primary inference path.** Use OpenClaw's `openai-codex` OAuth flow; users avoid per-token API billing.
6. **Configurable per company.** Drop-in `company-context/` pack with terminology, verb principle, classification risk taxonomy, fact pattern, factual baseline, and deliverable templates.
7. **Auditable.** Every agent action goes to a hash-chained immutable audit log. Per-citation evidence cards (Profile B) or screenshots (Profile A) are stored in object storage with cryptographic anchors.
8. **Operable on Railway** with optional Hostinger VPS path. Docker-based so the same artifact runs anywhere.

### Non-goals

1. **Lexis is optional, not required.** Profile B (Lexis-free) is the default build target.
2. **No client-facing legal advice.** Outputs are research deliverables for internal review, never sent directly to clients or counterparties.
3. **No predictive judgments.** The agent does not predict how a court would rule; it states what statutes require and where ambiguity lies.
4. **No fine-tuning.** The agent uses prompt engineering + tool calls + retrieval; no model fine-tuning in v1.
5. **No multi-tenant SaaS in v1.** Single-firm / single-deployment focus. Multi-tenancy is a v2 concern.
6. **No real-time citators with negative-treatment SLAs.** The free citator chain is best-effort; for litigation-grade citation analysis, the firm should retain a human-led Shepardizing process.

---

## 4. Why fork OpenClaw (and what stays vs. changes)

### Why fork

OpenClaw is a personal AI assistant runtime with mature multi-channel support (Slack, Discord, iMessage, voice), a plugin/skill architecture, and — critically — an OAuth flow that lets the user authenticate against an OpenAI ChatGPT subscription (Plus / Pro / Team) and use the Codex endpoint with subscription quota rather than per-token API billing. Building these from scratch would take weeks. OpenClaw already does them.

OpenClaw is **not** a legal-domain product. Its existing skills are personal-productivity (notes, reminders, music, calendars, etc.). The fork keeps OpenClaw's runtime, auth, adapters, and plugin model, and adds a legal-research plugin pack on top.

### What stays from OpenClaw (do not replace)

- Multi-channel adapters: Slack, Discord, iMessage, WhatsApp, Telegram, Signal, etc.
- Plugin SDK and `skills/<name>/SKILL.md` convention
- `.agents/skills/` separate namespace for repo-internal automation
- Auth flow: `openclaw onboard --auth-choice openai-codex` for ChatGPT-subscription OAuth
- Auth flow: `openclaw onboard --auth-choice openai-api-key` as fallback
- Model routing via `openai/*` prefix (works regardless of auth method)
- "Prepared runtime facts" pattern (compute small typed values once at startup, pass through context rather than re-discovering)

### What we add (the legal layer)

- Legal-research skills (`skills/statute-research`, `skills/regulation-research`, etc.)
- Rule engine plugin (R1–R15 + W1–W4)
- Claim ledger with hash-chained audit log
- KB MCP server (`kb.statutes.*`, `kb.regs.*`, `kb.cases.*`)
- Python ingestion worker (Docling + Voyage)
- Company Context Pack (`company-context/`)
- Source profile selector (`source-profiles/`)
- Notion + Google Drive Company-Context sub-agent (MCP)
- VS Code extension (thin client over the orchestrator's HTTP API)

### What we avoid

- **Don't rewrite OpenClaw's runtime.** Use its plugin SDK; don't try to swap in a different agent loop.
- **Don't fork the personal-productivity skills.** They stay. They don't conflict.
- **Don't disable OpenClaw's existing auth or onboarding.** Add to it.
- **Don't try to replace OpenClaw's MCP integration.** Use it.

---

## 5. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Tier 0  INTERFACE ADAPTERS  (provided by OpenClaw)                       │
│         Slack · Discord · iMessage · WhatsApp · CLI · Voice              │
│         + new: VS Code extension (thin HTTP client)                      │
└──────────────────────────────────────────────────────────────────────────┘
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Tier 1  INTAKE & ROUTER  (OpenClaw onboarding + new legal-intake plugin) │
│         · Verbatim question capture (no paraphrase)                      │
│         · Jurisdiction(s) lock                                           │
│         · Topic classification                                           │
│         · Loads Company Context Pack                                     │
│         · Loads Source Tier Profile (A or B)                             │
│         · Pre-flight checklist                                           │
│         · Emits typed TaskSpec                                           │
└──────────────────────────────────────────────────────────────────────────┘
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Tier 2  ORCHESTRATOR  (OpenClaw's agent loop + our planner plugin)       │
│         · 11-layer plan (Methodology Part XIV)                           │
│         · Owns claim ledger (append-only, hash-chained)                  │
│         · Enforces rule engine R1–R15                                    │
│         · ChatGPT-subscription auth via OpenClaw OAuth                   │
└──────────────────────────────────────────────────────────────────────────┘
        ▼ fan-out ▼
┌──────────────┬──────────────┬──────────────┬───────────────────────────┐
│ STATUTE      │ REGULATION   │ CASE/CITATOR │ COMPANY-CONTEXT           │
│ sub-agent    │ sub-agent    │ sub-agent    │ sub-agent                 │
│ (skill)      │ (skill)      │ (free chain) │ (Notion + GDrive MCPs)    │
└──────────────┴──────────────┴──────────────┴───────────────────────────┘
        ▼ artifacts feed ▼
┌──────────────┬──────────────┬──────────────┬───────────────────────────┐
│ EXTRACTION   │ INTERPRETA-  │ DRAFTER      │ CLASSIFICATION            │
│              │ TION         │              │ (company-context taxonomy)│
└──────────────┴──────────────┴──────────────┴───────────────────────────┘
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ VERIFIER (hash-anchored evidence cards; R5, R10)                         │
└──────────────────────────────────────────────────────────────────────────┘
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ CRITIC (self-audit harness; R3, R4 re-check; quote-check)                │
└──────────────────────────────────────────────────────────────────────────┘
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ CONFIDENCE → RENDERER → DELIVERY                                         │
│ Rule-based confidence; LOW gate (R11) blocks delivery                    │
└──────────────────────────────────────────────────────────────────────────┘
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Tier 4  MEMORY  (declarative facts · episodic · structured compression · │
│                  Hermes-style Curator on idle)                           │
└──────────────────────────────────────────────────────────────────────────┘
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Tier 5  KNOWLEDGE BASE                                                   │
│         Profile B (default): ingested statute + admin-code corpus +      │
│                              CourtListener case index + approved-domain  │
│                              web allowlist + Notion + Google Drive       │
│         Profile A (opt-in): live Lexis+ via Chrome MCP                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key abstractions

- **TaskSpec** — typed JSON object emitted by Tier 1 and frozen for the rest of the run. Locks jurisdictions, topic, output type, source profile, company context reference. Schema in `schemas/task-spec.schema.json`.
- **Source Profile** — selects retrieval backend. Profile B (Lexis-free) is the default. Profile A (Lexis-enabled) is added later as a configuration layer.
- **Company Context Pack** — drop-in directory the operator authors. Loaded into every TaskSpec. Schema in `company-context/`.
- **Claim Ledger** — append-only ledger maintained by the orchestrator. Every atomic legal claim has an entry with cites, hash anchors, retrieval timestamp, currency. Hash-chained audit log; head hash periodically anchored to a separate R2 bucket.
- **Retrieval Log** — every span retrieved this session. R3 / R4 / R9 validate against this. Citations not in the log are stripped.

---

## 6. Research methodology (Parts I–XIV)

The agent follows a structured 14-part research methodology. The full version lives in `docs/METHODOLOGY.md` (port from the source branch). Summary table:

| Part | Topic | Enforced by |
|---|---|---|
| I | Pre-research preparation (source restrictions, pre-flight checklist, intake) | Tier 1 Intake; rules R1, R14 |
| II | Research methodology — the 7-step research sequence per state | `skills/statute-research/SKILL.md`; rules R7, R8, R9, R10 |
| III | Statutory structure (the 9 standard sections) | Extraction sub-agent's output schema |
| IV | Interpretation framework (operator words, ambiguity ladder, 17 canons of construction) | Drafter + Critic; rule W4 |
| V | Applicability analysis (thresholds, conjunction, exemptions) | `skills/applicability-analysis/SKILL.md` |
| VI | Requirement-type categorization (disclosure / operational / technical / UI) | Extraction sub-agent typed enum |
| VII | Verification protocol (the screenshot-and-compare gate) | Verifier sub-agent; rules R5, R10 |
| VIII | Hallucination prevention (Source Inventory, Quoting Rule, citator, self-audit) | Drafter schema + Critic; rules R3, R4 |
| IX | Confidence ratings (HIGH / MEDIUM / LOW; LOW gate) | Confidence sub-agent (rule-based); rule R11 |
| X | Company-specific overlay (taxonomy, vectors, terminology, verbs, factual baseline) | Classification sub-agent; rule R12 |
| XI | Anti-patterns (the comprehensive DON'T list) | Distributed across all rules |
| XII | Output discipline (pinpoint citations, deliverable templates) | Renderer; rule R6 |
| XIII | Knowing when research is complete (7-criterion completeness gate) | Orchestrator; rule R15 |
| XIV | The layered analysis approach (capstone) | Orchestrator default plan |

The methodology is generalized for any gig-economy vertical and source-profile-aware (works with or without Lexis). It is the operational manual for the agent.

**Action**: port `docs/METHODOLOGY.md` and `docs/ANTI-PATTERNS.md` from the source branch verbatim.

---

## 7. Anti-hallucination rule engine (R1–R15 + W1–W4)

15 blocking rules + 4 warnings, enforced at specific architectural seams.

### Blocking rules (R1–R15)

| ID | Name | Enforcement point | Failure mode |
|---|---|---|---|
| R1  | SourceAllowlist | KB tool layer | Tool returns `SOURCE_NOT_ALLOWED` |
| R2  | JurisdictionLock | Tool schema | `JURISDICTION_VALIDATION_ERROR` |
| R3  | NoMemoryStatutes | Drafter schema + Critic | Sentence stripped + flagged |
| R4  | QuotingRule | Drafter schema | Quote rejected |
| R5  | HashEcho | Verifier sub-agent | Material discrepancy → block |
| R6  | PinpointCite | Renderer schema | Render fails |
| R7  | RegSearchOnDelegation | Orchestrator plan validator | Plan amended |
| R8  | CrossRefTrace | Statute sub-agent | Output incomplete |
| R9  | DefinitionsFirst | Orchestrator | Plan rejected |
| R10 | CurrencyTag | Verifier | Stale flag |
| R11 | LowConfidenceGate | Confidence sub-agent | Deliverable blocked |
| R12 | ClassificationOverlay | Renderer | Render fails |
| R13 | VerifyFlagCap | Drafter schema | Schema violation (>3 flags) |
| R14 | NoLawFirmCitation | Renderer schema | Citation type-rejected |
| R15 | CompletenessGate | Orchestrator | "Research incomplete" output |

### Warnings (W1–W4)

| ID | Name | Enforcement point |
|---|---|---|
| W1 | PartialAcrossStates | Orchestrator |
| W2 | ParaphraseDriftCheck | Critic (cross-revision) |
| W3 | HedgeDensity | Critic |
| W4 | CanonConflictDeclared | Drafter |

### Example rule spec (R4 in full)

```markdown
# R4.QuotingRule

**Spec:** any text in quotation marks must carry a (doc_id, char_start, char_end, hash) anchor pointing to a span retrieved this session.
**Enforcement point:** Drafter output schema.
**Severity:** blocking.
**Failure mode:** the quoted span is rejected; Drafter must rewrite as paraphrase or remove.

## Detail

The Quoting Rule is the single most important rule in the system. A paraphrase converted to a quote is an attestation: "these are the exact words." Most legal hallucinations are paraphrases that hardened into quotes during drafting.

The Drafter's JSON schema requires every quoted span to be wrapped in a structured object with the four anchor fields. The Renderer detects unwrapped quotation marks at output time and rejects them. The Critic independently re-fetches each anchored span and exact-matches it against the source.

## Test cases

- ✅ Compliant: Drafter emits {"text": "the statute requires that the employer", "cites": [{"doc_id":"ca-lab-2775", "span_start": 1023, "span_end": 1062, "hash":"<h>"}]}
- ❌ Non-compliant: Drafter emits "under the statute, employers must" without anchor metadata
- ❌ Non-compliant: Drafter emits a paraphrase that uses "shall" but anchors to a span where the statute uses "may"
```

**Action**: port `rules/` directory (15 rule files + 4 warnings + README) verbatim from the source branch. Implement the rules in TypeScript as part of the OpenClaw plugin.

---

## 8. Source profiles (A: Lexis / B: Lexis-free)

The active source profile selects the retrieval backend. **Profile B is the default** and the recommended initial build target. Profile A is a configuration layer added later.

### Profile B (default)

```yaml
profile: B
description: "Lexis-free; ingested official corpus + free citator chain"
default: true

primary_statute_source: local_corpus_state_official
primary_regulation_source: local_corpus_state_admin
primary_case_source: courtlistener_api
secondary_statute_sources: [state_legislative_official_site, justia, cornell_lii, openstates_api]
secondary_case_sources: [cap_api, google_scholar]
case_citator: free_citator_chain
quote_check: local_quote_match

citator_chain:
  - id: courtlistener
    name: "CourtListener Citations API"
    cost: free
  - id: google_scholar
    name: "Google Scholar 'How cited' (scraper)"
    cost: free
  - id: casetext_free
    name: "Casetext free tier (CARA)"
    cost: free_with_account
    enabled: false
  - id: vlex_fastcase
    name: "vLex Fastcase (bar association access)"
    cost: bar_association_membership
    enabled: false
  - id: cap
    name: "Caselaw Access Project / Harvard CAP API"
    cost: free

quote_check_config:
  exact_substring_match: true
  fail_closed: true

ingestion:
  cadence: "weekly statute + admin-code refresh per state in scope"
  parser: { primary: docling, fallback: reducto }
  embedding: { provider: voyage, model: "voyage-law-2" }
  reranker: { provider: voyage, model: "rerank-2" }
```

**Action**: port `source-profiles/profile-a-lexis.yaml` and `source-profiles/profile-b-free.yaml` from the source branch.

---

## 9. Company Context Pack

Drop-in directory the operator authors. Loaded on every run. Schema:

```
company-context/
├── company.yaml                   # identity + business model
├── fact-pattern.md                # standing fact pattern
├── terminology.yaml               # always/never word lists
├── verb-principle.yaml            # preferred/avoided verbs
├── risk-taxonomy.yaml             # N-category classification risk
├── risk-vectors.yaml              # mandatory check vectors
├── high-risk-jurisdictions.yaml   # heightened-scrutiny states
├── factual-baseline.md            # what the company does NOT do
├── prior-positions/               # prior memos
└── deliverable-templates/         # output formats
    ├── slack-response.md
    ├── memo.md
    ├── chart.md
    └── research-trail.md
```

### Default `company.yaml` (generic gig-economy marketplace)

```yaml
company:
  name: "<Company>"
  short_name: "<Co>"
  vertical: "gig-economy-marketplace"
  business_model:
    type: "two-sided online marketplace"
    role: "technology infrastructure / intermediary"
    demand_side:
      label: "<Customer Type>"
    supply_side:
      label: "<Worker Type>"
      classification_intended: "independent contractor"
    not_role:
      - "staffing agency"
      - "temporary services agency"
      - "<industry> services company"
      - "employer of supply-side workers"
      - "joint employer with demand-side counterparties"
  worker_classification:
    primary_tests_we_must_pass:
      - "ABC Test (CA, MA, NJ, others)"
      - "Common-law agency / right-to-control"
      - "Joint-employer (FLSA + state variants)"
      - "Statutory staffing-agency definitions"
      - "Marketplace contractor / platform-worker statutes"
  context_stores:
    primary: "notion"
    secondary: "google_drive"
```

### High-risk jurisdictions (default)

CA (AB5/ABC), IL (Day & Temporary Labor Services Act), MA (M.G.L. c. 149 § 148B), MN (ABC), NJ (N.J.S.A. 43:21-19), DC (broad classification standards). Operators add others.

**Action**: port the entire `company-context/` directory verbatim from the source branch (9 files + the prior-positions README + 4 deliverable templates).

---

## 10. Skills (procedural recipes)

Skills live at `skills/<name>/SKILL.md` (matching OpenClaw's convention) with YAML frontmatter + markdown body. The orchestrator's planner instructs sub-agents to load the appropriate skill before acting.

### Skills to create

| Skill | Purpose |
|---|---|
| `docs-escalation-response` | Top-level entry point; orchestrates the rest |
| `statute-research` | The 7-step research sequence (Methodology II.2) |
| `regulation-research` | Implementing-regulation research |
| `definitions-first` | Enforces R9 procedurally |
| `cross-reference-trace` | Enforces R8 procedurally |
| `canon-application` | Applies canons of construction (Methodology IV.3); declares conflicts (W4) |
| `applicability-analysis` | Thresholds, conjunction, exemptions (Part V) |
| `requirement-type-categorization` | Typed requirements (Part VI) |
| `verification-gate` | Screenshot-and-compare gate (Part VII) |
| `citator-profile-b` | Free citator chain (Profile B default) |
| `citator-profile-a` | Lexis Brief Analysis (Profile A; opt-in) |
| `classification-overlay` | Company-context risk overlay (R12, Part X) |

### Skill file format

```markdown
---
name: <skill-name>
description: <one-paragraph; the model reads this when deciding whether to load>
argument-hint: "[<args>]"
when_to_use:
  - "<bulleted list>"
---

# /<skill-name> -- <Title>

## Pre-conditions

## Workflow

### Step 1: ...
### Step 2: ...

## Output Format

## Anti-patterns specific to this skill
```

**Action**: port the entire `skills/` directory verbatim from the source branch (12 SKILL.md files + README).

---

## 11. JSON schemas (data contracts)

JSON Schema 2020-12 contracts for the data structures the orchestrator and sub-agents exchange. Implementations validate against these at every service boundary.

### Schema files

| Schema | Purpose |
|---|---|
| `schemas/task-spec.schema.json` | TaskSpec emitted by Tier 1; frozen for the run |
| `schemas/claim.schema.json` | Atomic legal claim with anchors, cites, interpretation basis |
| `schemas/claim-ledger.schema.json` | Append-only ledger; hash-chained audit |
| `schemas/verifier-output.schema.json` | Per-citation Verifier status |
| `schemas/classification-output.schema.json` | R12-compliant classification record |
| `schemas/confidence-output.schema.json` | Rule-based confidence determination |
| `schemas/deliverable.schema.json` | Renderer input — complete artifact pre-render |

### Source-category enum (R14)

```
citation_eligible:
  - primary_statute
  - primary_regulation
  - case_law
  - secondary_treatise

orientation_only:                       # R14 rejects in cites[]
  - law_firm_blog
  - news_article
  - vendor_blog
  - wikipedia
  - ncsl_summary
  - agency_guidance                     # operator-configurable per profile
  - index_only
```

### Conventions

- All `id` fields are ULIDs.
- All timestamps are ISO-8601 with timezone.
- All `doc_id` values are typed: `<source_category>:<jurisdiction>:<identifier>`.
- All hashes are SHA-256 hex strings.
- Schemas reject unknown properties at the top level.

**Action**: port the entire `schemas/` directory verbatim from the source branch (7 JSON Schema files + README).

---

## 12. Database schema

Postgres with pgvector + tsvector. Tables (full DDL in `migrations/0001_init.sql`):

| Table | Purpose |
|---|---|
| `statute_chunks` | Ingested statute corpus; pgvector + tsvector + HNSW |
| `regulation_chunks` | Ingested regulation corpus |
| `case_index` | CourtListener / CAP mirror; treatment flags |
| `claim_ledgers` | One row per orchestration session |
| `claims` | Atomic legal claims |
| `retrieval_log` | Every span retrieved this session; R3 / R4 validate against this |
| `audit_chain` | Append-only hash-chained audit |
| `verifier_results` | Per-citation Verifier output |
| `corpus_freshness` | Per-jurisdiction ingestion metadata |

Embeddings are 1024-dim (`voyage-law-2`). Idempotent upsert by `(jurisdiction, doc_id, hash)` — re-ingestion is safe.

**Action**: port `migrations/0001_init.sql` and `migrations/README.md` verbatim. Add `scripts/migrate.ts` (lexicographic SQL runner with `_migrations` tracking).

---

## 13. Ingestion pipeline (Python + Docling + Voyage)

Python service (separate from OpenClaw runtime) that ingests statute and admin-code text from official state sources.

### Stack

- Python 3.12, `uv` for dep management
- `docling` (free, open-source; preserves § hierarchy and footnotes)
- `voyageai` (`voyage-law-2` embeddings + `rerank-2` reranker)
- `asyncpg` for Postgres
- `playwright` for state-legislative-site scraping
- `typer` for CLI
- `pydantic` + `pydantic-settings` for config
- `structlog` for logs

### Pipeline

```
state-source URL / PDF
        ↓
   Docling parser           (preserves § hierarchy, footnotes, amendments)
        ↓
   structure-aware chunker  (per-section spans, with cross-ref detection)
        ↓
   Voyage embedder          (voyage-law-2; batch)
        ↓
   Postgres writer          (statute_chunks; pgvector + tsvector; idempotent)
        ↓
   freshness metadata       (current_through, retrieved_at, source_url)
```

### CLI

```bash
agentic-law-os-ingestion worker                          # long-lived
agentic-law-os-ingestion ingest-statutes --jurisdiction CA
agentic-law-os-ingestion parse-pdf path/to/file.pdf
agentic-law-os-ingestion freshness --jurisdiction CA
```

### Per-state sources

`Source` ABC in `sources/base.py`. Each state implements `iter_documents()` and `confirm_currency()`. v1 ships:

- `CaliforniaSource` against `leginfo.legislature.ca.gov`
- `IllinoisSource` against `ilga.gov`

Add states as needed. Each source is ~150–300 lines of Python + Playwright when official sites lack reliable PDFs.

**Action**: port `apps/ingestion-worker/` verbatim from the source branch (pyproject.toml, Dockerfile, full `src/` tree). The worker doesn't depend on OpenClaw and runs as a separate process.

---

## 14. KB MCP server

TypeScript MCP server exposing `kb.*` tools. The orchestrator (and any other MCP-aware client, e.g. Claude Code or VS Code) connects to it.

### Tools

| Tool | Status | Profile |
|---|---|---|
| `kb_statutes_search` | Implemented (keyword); vector path TODO | B |
| `kb_statutes_get` | TODO | B |
| `kb_statutes_effective_date_for` | TODO | B |
| `kb_span_get_by_hash` | Implemented | B |
| `kb_regs_search` | TODO | B |
| `kb_cases_search` | TODO | B |
| `kb_lexis_*` | Future | A |

### Source-profile dispatch

The server reads `DEFAULT_SOURCE_PROFILE` env var and selects the backend. Profile B reads from local corpus (Postgres pgvector + tsvector). Profile A talks to Lexis via Chrome MCP / Playwright.

**Action**: port `apps/mcp-kb/` verbatim from the source branch (package.json, Dockerfile, src/index.ts).

---

## 15. ChatGPT-subscription auth via OpenClaw OAuth

This is the central reason for forking OpenClaw.

### Mechanism

OpenClaw is an OAuth client OpenAI has approved for the Codex endpoint with subscription auth. The flow:

```bash
openclaw onboard --auth-choice openai-codex
```

This:

1. Generates an OAuth URL pointing to `auth.openai.com/oauth/authorize`
2. Displays the URL in the terminal
3. User opens the URL in a browser, logs in with their ChatGPT account, clicks "Continue" to authorize OpenClaw
4. The callback writes the OAuth token to `~/.openclaw/auth.json` (or similar; verify exact path during Phase 0)
5. Subsequent agent runs use the persisted token; refresh tokens auto-rotate during active use

### What it grants

- Access to GPT-5.4 with 1M-token context via the Codex endpoint
- Subscription quota (flat-rate, no per-token billing)
- Tool calling (verify exact capabilities during Phase 0 — Codex endpoint may differ from Chat Completions in subtle ways)

### What it requires

- ChatGPT Plus ($20/mo) or Pro ($200/mo) subscription
- **Interactive TTY for first login.** Running over SSH fails with `Error: models auth login requires an interactive TTY.` Two workarounds:
  - Auth on a laptop, copy `~/.openclaw/auth.json` to the production host
  - SSH with X11 forwarding from a graphical workstation
- Refresh token expires if dormant; periodic re-auth (typically weeks to months) needed for unattended deployments

### Architecture implication

The agent's "drafter" sub-agent calls `openai/gpt-5.4` (or whichever Codex-endpoint model) via OpenClaw's auth-routed model client. The Anthropic SDK is replaced by OpenAI SDK calls routed through OpenClaw's auth layer.

### Fallback

`openclaw onboard --auth-choice openai-api-key` for direct API billing if subscription auth isn't desired or rate-limited.

### v1 verification checklist

Before committing to subscription auth as primary, verify in Phase 0:

- [ ] Tool calling works on Codex endpoint with the expected JSON shape
- [ ] Prompt caching is available (or document the cost implication if not)
- [ ] MCP tools register cleanly through OpenClaw
- [ ] Rate limits are tolerable for unattended agent use (typical: 50–200 requests/hour for Plus; higher for Pro)
- [ ] Refresh-token lifetime is documented and an alerting hook exists
- [ ] Token-file format is documented and portable for Railway secret-mounting

**Action**: read OpenClaw's [providers/openai docs](https://github.com/openclaw/openclaw/blob/main/docs/providers/openai.md) and [concepts/oauth docs](https://github.com/openclaw/openclaw/blob/main/docs/concepts/oauth.md) before starting Phase 1.

---

## 16. Infrastructure & deployment (Railway)

Default deployment target: Railway. Hostinger VPS supported as an alternative.

### Service topology on Railway

```
Project: agentic-law-os
├── Service: openclaw-runtime         (web; OpenClaw's runtime + our plugin pack)
├── Service: mcp-kb                   (web; KB MCP server)
├── Service: ingestion-worker         (worker; long-lived; consumes refresh events)
└── Plugin:  Postgres                 (pgvector enabled; DATABASE_URL service-linked)
```

External:

- Cloudflare R2 (evidence cards, screenshots, audit-chain anchor)
- Voyage AI (embeddings + rerank)
- Anthropic API (fallback when not using ChatGPT-subscription auth, or for non-Codex tasks)
- OpenAI Codex endpoint (via OpenClaw OAuth)
- CourtListener (free case index)
- CAP (older cases)
- Notion (Company-Context primary)
- Google Drive (Company-Context secondary)
- Langfuse (LLM tracing)
- Sentry (error tracking)

### Cost estimate (monthly, Railway Hobby)

| Component | Range |
|---|---|
| openclaw-runtime | $5–15 |
| mcp-kb | $3–10 |
| ingestion-worker | $5–25 |
| Postgres plugin | $5–20 |
| **Subtotal Railway** | **$20–70** |
| ChatGPT Plus subscription | $20 (or Pro $200) |
| Voyage API | $5–30 |
| R2 | $1–5 |
| **Total** | **~$50–100** (Plus tier) |

The ChatGPT-subscription path saves roughly $50–500/mo vs API-key path at typical solo / small-firm usage. Pro tier ($200/mo) is worth it once you exceed 50 escalations/week.

### Caveat: interactive-TTY OAuth on Railway

Railway services run headless. The OAuth flow needs a TTY for the initial login. Two patterns:

1. **Laptop-bootstrap**: auth on your laptop, copy `~/.openclaw/auth.json` into Railway as a secret-mounted file (or env var holding the token JSON), let the service refresh it from there.
2. **VPS-friendly alternative**: Hostinger VPS lets you SSH-in with X11 forwarding, run the OAuth flow against a local browser, persist the token. Same model after that.

In either case, set up an alert when the refresh token gets close to expiry.

### Hardening checklist (before going live with real client data)

- [ ] Postgres encryption at rest
- [ ] R2 server-side encryption + Object Lock for evidence + audit-anchor buckets
- [ ] Per-matter row-level security in Postgres (claims, claim_ledgers, retrieval_log)
- [ ] Hash-chained audit log anchored to a separate R2 account, weekly head-hash snapshot
- [ ] Conflict-of-interest gate wired to Notion lookup
- [ ] Backup restore drill documented and tested quarterly
- [ ] Doppler / Infisical for secrets
- [ ] Rate limiting on `/escalation` endpoint
- [ ] Per-user authentication (WorkOS SSO; basic auth for solo)

**Action**: port `docs/INFRASTRUCTURE.md` and `docs/DEPLOYMENT.md` from the source branch; update for OpenClaw runtime substitution.

---

## 17. Phased build plan (weeks 1–6)

### Phase 0 — Spike & verify (days 1–3)

Before committing to the architecture, verify the things that could blow up the plan:

- [ ] Fork OpenClaw locally; run `openclaw onboard` with `--auth-choice openai-codex`; confirm OAuth flow works end-to-end against a ChatGPT subscription
- [ ] Confirm Codex endpoint supports tool calling with the expected JSON shape
- [ ] Confirm OpenClaw's plugin SDK lets you register custom skills, custom MCP servers, and a custom intake plugin
- [ ] Confirm the Slack and Discord adapters work out of the box with subscription auth
- [ ] Identify exact path of persisted OAuth tokens; document portability for Railway

**Done when**: a forked OpenClaw runs locally, authenticates via ChatGPT subscription, and successfully runs a tool-calling agent loop with one trivial custom tool you registered.

### Phase 1 — Foundation (week 1)

Drop in the contracts and configuration that don't depend on the runtime.

- [ ] Port `docs/` (ARCHITECTURE.md, METHODOLOGY.md, ANTI-PATTERNS.md, INFRASTRUCTURE.md, DEPLOYMENT.md)
- [ ] Port `company-context/` (gig-economy default; operator edits values)
- [ ] Port `source-profiles/` (Profile A + Profile B YAML)
- [ ] Port `rules/` (15 rule specs + 4 warnings + README)
- [ ] Port `schemas/` (7 JSON Schema files + README)
- [ ] Port `skills/` (12 SKILL.md files + README)
- [ ] Add `.env.example`, `.gitignore`, `.nvmrc`, `.python-version`, `docker-compose.yml`, `tsconfig.base.json`

**Done when**: forked OpenClaw repo contains all the legal-layer markdown / YAML / JSON files, organized cleanly. No code yet.

### Phase 2 — Database + ingestion (week 2)

- [ ] Port `migrations/0001_init.sql` and `scripts/migrate.ts`
- [ ] Provision Railway Postgres plugin with pgvector
- [ ] Run migrations
- [ ] Port `apps/ingestion-worker/` (Python; Docling + Voyage)
- [ ] Implement `CaliforniaSource` against `leginfo.legislature.ca.gov`
- [ ] Run end-to-end ingestion: `agentic-law-os-ingestion ingest-statutes --jurisdiction CA`
- [ ] Verify chunks land in `statute_chunks` with embeddings

**Done when**: California statute corpus is searchable in Postgres via SQL and pgvector queries.

### Phase 3 — KB MCP server (week 3)

- [ ] Port `apps/mcp-kb/` (TS MCP server)
- [ ] Implement `kb_statutes_search` (keyword path is already in the source; add Voyage embedding path for hybrid)
- [ ] Implement `kb_span_get_by_hash` (already in source)
- [ ] Implement `kb_statutes_get`, `kb_statutes_effective_date_for`, `kb_regs_search`
- [ ] Connect from a local OpenClaw instance via MCP stdio
- [ ] Register the MCP server in OpenClaw's MCP config

**Done when**: from inside a forked OpenClaw session, the agent can call `kb_statutes_search(jurisdiction="CA", query="independent contractor")` and get back ranked results from the ingested California corpus.

### Phase 4 — Legal plugin pack (weeks 3–4)

This is the core of the fork. Implement the legal-research plugin on top of OpenClaw's plugin SDK.

- [ ] Implement Tier-1 intake plugin: TaskSpec construction, jurisdiction lock, source-profile selection, company-context loading
- [ ] Implement orchestrator plugin: 11-layer plan builder + claim ledger + audit chain
- [ ] Implement rule engine: R1, R2, R4, R5, R6, R10, R11, R12, R13, R14, R15 (start with these 11; defer R3/R7/R8/R9 to later)
- [ ] Implement Statute sub-agent (loads `skills/statute-research/SKILL.md`, calls KB tools, produces structured artifact)
- [ ] Implement Verifier sub-agent (calls `kb_span_get_by_hash`; runs R5)
- [ ] Implement Confidence sub-agent (rule-based, ~50 lines)
- [ ] Implement Renderer (loads template from `company-context/deliverable-templates/slack-response.md`; emits final Slack-format response)

**Done when**: a Slack message to OpenClaw with a California IC-classification escalation produces a Slack-format response with verified citations, classification overlay, and confidence rating.

### Phase 5 — Critic + classification + remaining rules (week 5)

- [ ] Implement Critic sub-agent (re-reads draft + claim ledger; runs R3/R4 re-check; runs the four-step self-audit)
- [ ] Implement Classification sub-agent (runs `skills/classification-overlay/SKILL.md`)
- [ ] Implement remaining rules: R3, R7, R8, R9
- [ ] Implement W1, W2, W3, W4 warnings
- [ ] Implement `skills/citator-profile-b/SKILL.md` (free citator chain — CourtListener + Google Scholar)

**Done when**: a Slack escalation produces a response that has been independently verified, critiqued, and classified, with all 15 R-rules and 4 W-rules running on every output.

### Phase 6 — Notion + Google Drive + multi-state + polish (week 6)

- [ ] Add Notion MCP server registration in OpenClaw config
- [ ] Add Google Drive MCP server registration
- [ ] Implement Company-Context sub-agent (uses Notion + GDrive MCPs)
- [ ] Implement multi-state survey workflow (per-state R15 completeness; per-state confidence; W1 partial-survey warning)
- [ ] Implement memo + chart deliverable templates (in addition to Slack)
- [ ] Implement second state: `IllinoisSource` and ingest 220 ILCS 175 (Day & Temporary Labor Services Act)
- [ ] VS Code extension (thin HTTP client over the orchestrator's API)
- [ ] Hardening checklist items (RLS, audit-chain external anchor, conflict-of-interest gate)
- [ ] Quarterly backup-restore drill

**Done when**: a multi-state survey escalation across CA + IL produces a chart deliverable with per-state verification, classification overlay, and audit-chain integrity confirmed.

### Phase 7+ — Future

- Profile A (Lexis-enabled) configuration layer
- Hermes-style Curator (idle-triggered umbrella consolidation of per-matter notes)
- Additional state sources (NJ, MA, MN, NY, DC)
- Discord adapter polish
- Per-firm SSO (WorkOS)
- Multi-tenant deployment

---

## 18. File inventory — what to create in the new project

After forking OpenClaw, your new repo should have these directories layered on top of OpenClaw's existing structure:

```
<your-fork-of-openclaw>/
├── docs/
│   ├── ARCHITECTURE.md            ← port from source branch
│   ├── METHODOLOGY.md             ← port (the full Parts I-XIV)
│   ├── ANTI-PATTERNS.md           ← port
│   ├── INFRASTRUCTURE.md          ← port + edit for OpenClaw runtime
│   ├── DEPLOYMENT.md              ← port + edit
│   └── PRD-OPENCLAW-FORK.md       ← this file
├── company-context/               ← port directory (9 files + 4 templates)
├── source-profiles/               ← port (3 files: README + 2 YAMLs)
├── rules/                         ← port (15 rule files + 4 warnings + README)
├── schemas/                       ← port (7 JSON Schema files + README)
├── skills/
│   ├── docs-escalation-response/SKILL.md       ← port
│   ├── statute-research/SKILL.md               ← port
│   ├── regulation-research/SKILL.md            ← port
│   ├── definitions-first/SKILL.md              ← port
│   ├── cross-reference-trace/SKILL.md          ← port
│   ├── canon-application/SKILL.md              ← port
│   ├── applicability-analysis/SKILL.md         ← port
│   ├── requirement-type-categorization/SKILL.md ← port
│   ├── verification-gate/SKILL.md              ← port
│   ├── citator-profile-b/SKILL.md              ← port
│   └── classification-overlay/SKILL.md         ← port
├── plugins/                       ← OpenClaw plugin convention (verify exact path during Phase 0)
│   └── agentic-law-os/
│       ├── plugin.json
│       ├── intake/                ← Tier 1 plugin (TS or whichever OpenClaw uses)
│       ├── orchestrator/          ← orchestrator plugin
│       ├── sub-agents/            ← Statute, Regulation, Verifier, Critic, Classification, Confidence, Renderer
│       └── rule-engine/           ← R1-R15 + W1-W4 implementations
├── apps/
│   ├── mcp-kb/                    ← port (TS MCP server)
│   └── ingestion-worker/          ← port (Python; doesn't depend on OpenClaw)
├── migrations/
│   ├── 0001_init.sql              ← port
│   └── README.md                  ← port
├── scripts/
│   └── migrate.ts                 ← port
├── docker-compose.yml             ← port (local Postgres + MinIO)
├── .env.example                   ← port
├── .gitignore                     ← merge with OpenClaw's
├── .nvmrc                         ← port
├── .python-version                ← port
└── README.md                      ← edit (note: forked from OpenClaw + legal layer)
```

The `plugins/agentic-law-os/` shape may differ from OpenClaw's actual plugin convention — verify in Phase 0 and adjust accordingly. The `skills/` directory aligns with OpenClaw's existing skill convention; legal-research skills live alongside (not replacing) OpenClaw's personal-productivity skills.

---

## 19. Acceptance criteria & done definitions

### v1 acceptance criteria (end of Phase 6)

A reviewer should be able to:

1. **Send a Slack message** to the agent: "Does the Illinois Day & Temporary Labor Services Act apply to <Company>?"
2. **Receive a Slack-format response** in <2 minutes that contains:
   - Bottom line (one sentence)
   - Verbatim question
   - Governing statute citation (pinpoint, e.g., `220 ILCS 175/35`)
   - Implementing regulation citation (if any)
   - 2–4 paragraph analysis applying the law to the company's fact pattern
   - Classification risk overlay (every category in `risk-taxonomy.yaml` either flagged or explicitly cleared)
   - Confidence rating (HIGH/MEDIUM/LOW with one-line basis)
   - Verify flags (≤3, each specific)
3. **Click through to per-citation verification** showing the hash-anchored evidence card from the local KB
4. **Audit the run** by querying the audit chain in Postgres; the hash chain verifies intact
5. **Confirm the run cost zero API tokens** (it ran on the ChatGPT subscription via OpenClaw OAuth)

### Per-rule acceptance

For each of R1–R15 and W1–W4:

- A blocking-rule violation produces an explicit rejection with the rule ID and a fix recommendation (no silent failures)
- A warning is surfaced to the user but doesn't block delivery
- Documented test cases (compliant + non-compliant) are part of the test suite

### Per-skill acceptance

For each skill:

- The agent loads it when relevant (per OpenClaw's skill-loading mandate)
- The skill's documented workflow steps are followed in order
- The skill's documented output schema is produced
- The skill's documented anti-patterns do not appear in real outputs

### Operational acceptance

- Restart the agent service; OAuth token persists; resumes without re-auth
- Run for 7 days unattended; no token refresh failures (or alerts fire if so)
- Daily Postgres backup completes; quarterly restore drill passes
- Audit-chain head hash anchored to external R2 weekly; tamper detected if intentionally corrupted

---

## 20. Open decisions & blockers

These need human input before / during the build.

### Decisions

1. **Default ChatGPT subscription tier**: Plus ($20/mo) or Pro ($200/mo)? Plus is fine for solo / early team; Pro becomes worth it past ~50 escalations/week.
2. **Initial state in scope**: California (recommended, given the AB5 / Prong B prevalence in the gig-economy domain).
3. **Second state in scope**: Illinois (recommended, given the Day & Temporary Labor Services Act sweeps platforms by definition).
4. **Notion workspace**: pre-existing? new? schema for prior positions and matter context?
5. **Voyage AI account**: signed up? funded? key in Doppler?
6. **Cloudflare R2**: account ready? bucket created? Object Lock enabled?
7. **Railway project**: created and linked?
8. **Slack workspace + bot app**: created and bot token in Doppler?
9. **OpenClaw fork visibility**: public or private? (Recommend private until v1.)
10. **Citation style**: Bluebook (default) or ALWD or state-specific?

### Blockers (must resolve before Phase 1)

- [ ] Phase 0 spike confirms Codex endpoint supports tool calling cleanly
- [ ] Phase 0 spike confirms OpenClaw's plugin SDK supports the architectural seams we need (intake, orchestrator, sub-agents, rule engine, MCP wiring, custom auth)
- [ ] Plan for OAuth token persistence on Railway (laptop-bootstrap or VPS path)

### Risks

- **OpenClaw's plugin SDK may not expose all the seams we need**, especially for the rule engine that runs at multiple stages of the agent loop. Mitigation: Phase 0 spike. If blocked, fallback option is to keep the orchestrator as a separate service that delegates inference to OpenClaw via the OpenClaw-as-MCP-server pattern (worse, but viable).
- **Refresh-token expiry kills unattended deployments.** Mitigation: alert at 80% of expected token lifetime; fallback to API-key auth automatically.
- **Codex endpoint feature parity with Chat Completions.** Some features (prompt caching, JSON mode, structured outputs) may differ. Mitigation: Phase 0 verification; document which features work and adapt the agent loop.
- **Rate limits on subscription auth.** Plus tier rate limits are designed for interactive use, not unattended agents. Mitigation: monitor; throttle ingestion-time queries; upgrade to Pro when hitting limits.
- **State-site scrapers break.** State legislative websites change layout. Mitigation: per-state Source classes are isolated; failure of one state doesn't break the others; monitor freshness and alert on stale corpora.

---

## 21. Source material to port from existing branch

The existing branch [marco-clip/Agentic-Law-OS:claude/statutory-research-tool-0kORq](https://github.com/marco-clip/Agentic-Law-OS/tree/claude/statutory-research-tool-0kORq) contains the complete content to port. 115 files; ~8,400 lines. Three commits:

1. `df8c565` — Foundation: docs, company-context, source-profiles
2. `58e3edb` — Contracts: rules, schemas, skills
3. `51aa7ba` — Scaffold: TS+Python services with Dockerfiles + migrations

Recommended approach:

```bash
# Clone the source branch into a working directory
git clone https://github.com/marco-clip/Agentic-Law-OS.git source-material
cd source-material
git checkout claude/statutory-research-tool-0kORq

# Fork OpenClaw into your new project directory
gh repo fork openclaw/openclaw --clone --remote
cd openclaw

# Copy the legal layer in
cp -r ../source-material/docs ./docs/legal/      # avoid collision with OpenClaw's docs
cp -r ../source-material/company-context ./
cp -r ../source-material/source-profiles ./
cp -r ../source-material/rules ./
cp -r ../source-material/schemas ./
cp -r ../source-material/skills/* ./skills/      # legal skills join existing skills
cp -r ../source-material/migrations ./
cp -r ../source-material/apps/mcp-kb ./apps/
cp -r ../source-material/apps/ingestion-worker ./apps/
cp ../source-material/scripts/migrate.ts ./scripts/
cp ../source-material/docker-compose.yml ./
cp ../source-material/.env.example ./
cp ../source-material/.nvmrc ./
cp ../source-material/.python-version ./

# Then: throw away ../source-material/apps/orchestrator/ — that's what OpenClaw's runtime replaces
```

The orchestrator code in `apps/orchestrator/` is the only piece that does NOT port — OpenClaw's runtime replaces it. The agent loop, claim ledger, rule engine, and sub-agent dispatch are reimplemented as OpenClaw plugins. The existing TypeScript code in `apps/orchestrator/src/` is reference material — read it for the patterns, but the actual code lives in OpenClaw plugin shape.

---

## 22. Starter prompt for a coding agent

If you want a coding agent to execute this plan in a fresh session, paste the following at the start:

> ```
> You are working on Agentic-Law-OS, a multi-channel statutory research agent forked from OpenClaw. The full PRD and build plan is in docs/PRD-OPENCLAW-FORK.md (this file). Read it end-to-end before starting any work.
>
> Your immediate task: execute Phase 0 (spike & verify). Specifically:
>
> 1. Fork openclaw/openclaw locally
> 2. Run `openclaw onboard --auth-choice openai-codex` and confirm OAuth flow
> 3. Verify Codex endpoint supports tool calling
> 4. Document OpenClaw's plugin SDK shape — exact paths, manifest format, how skills register, how custom MCP servers are added
> 5. Identify the persisted-token path for OAuth
> 6. Confirm Slack adapter works with subscription auth
> 7. Report findings back with: GO / NO-GO recommendation for Phase 1, list of blockers if NO-GO, list of architectural adjustments needed if GO-WITH-CHANGES
>
> Do NOT begin Phase 1 (porting the legal layer) until you have my explicit approval after reading your Phase 0 report.
>
> Source material to port lives at https://github.com/marco-clip/Agentic-Law-OS branch claude/statutory-research-tool-0kORq. Do NOT modify the source repo. Treat it as read-only reference.
>
> The PRD specifies:
> - Profile B (Lexis-free) as the default source profile
> - Generic gig-economy marketplace as the default Company Context Pack
> - Notion (primary) + Google Drive (secondary) for company-context storage
> - ChatGPT subscription via OpenClaw OAuth as the default inference path
> - Railway as the default deployment target
> - 15 blocking rules + 4 warning rules enforced at architectural seams
> - 14-part research methodology with refuse-rather-than-fabricate as the design principle
>
> Constraints you must follow:
> - Never write code that lets the agent fabricate citations. If a feature would weaken R3 (no-memory statutes) or R4 (quoting rule), refuse and explain.
> - Verify against primary sources, not training memory.
> - Stamp every output "DRAFT FOR COUNSEL REVIEW".
> - Maintain the audit chain integrity at all times.
> - When in doubt, escalate via R11 (LOW confidence) rather than producing an under-grounded answer.
> - Do not delete files in the source repo or in OpenClaw without explicit approval.
> - Commit frequently with conventional-commit messages.
>
> Begin with Phase 0. Report back when complete.
> ```

This prompt assumes a Claude Code or equivalent coding-agent session with file-edit and shell tools. Adjust for your specific tooling if needed.

---

## End of PRD

If anything in this document is ambiguous or contradicts itself, raise it as an open decision before proceeding. The methodology and rule engine are intentionally strict; weakening them defeats the purpose of the system. Add to them; don't subtract.

When v1 ships, reread Section 19 (acceptance criteria) and confirm every item is green before declaring done.
