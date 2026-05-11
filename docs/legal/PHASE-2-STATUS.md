# Phase 2 — Database + Ingestion Status

**Phase scope** (PRD §17): port the migration SQL, provision Railway Postgres with pgvector, port the Python ingestion worker, implement `CaliforniaSource`, run end-to-end CA statute ingestion.

**Phase 2 done-criterion** (PRD §17): *California statute corpus is searchable in Postgres via SQL and pgvector queries.*

---

## What landed in code

| Deliverable | Status | Where |
|---|---|---|
| Postgres schema (11 tables, indexes, triggers) | ✓ shipped | [`migrations/0001_init.sql`](../../migrations/0001_init.sql) |
| Migration runner (TS, lexicographic) | ✓ shipped | [`scripts/migrate.ts`](../../scripts/migrate.ts) |
| `pnpm run migrate` script + `pg` dependency | ✓ shipped | `package.json` |
| Docker Compose Postgres service (`pgvector/pgvector:pg16`) | ✓ shipped | [`docker-compose.yml`](../../docker-compose.yml) |
| Ingestion worker scaffold (Python 3.12 + uv) | ✓ shipped | [`apps/ingestion-worker/`](../../apps/ingestion-worker/) |
| `CaliforniaSource` v1 (Lab. Code Chapter 2, §§ 2750–2787) | ✓ shipped | [`apps/ingestion-worker/.../sources/california.py`](../../apps/ingestion-worker/src/agentic_law_os_ingestion/sources/california.py) |
| Voyage AI embedder (voyage-law-2, 1024-dim) | ✓ shipped | [`.../embedders/voyage_embedder.py`](../../apps/ingestion-worker/src/agentic_law_os_ingestion/embedders/voyage_embedder.py) |
| Docling parser + BeautifulSoup HTML fallback | ✓ shipped | [`.../parsers/docling_parser.py`](../../apps/ingestion-worker/src/agentic_law_os_ingestion/parsers/docling_parser.py) |
| Structure-aware chunker (subdivision-boundary aware) | ✓ shipped | [`.../chunker.py`](../../apps/ingestion-worker/src/agentic_law_os_ingestion/chunker.py) |
| asyncpg connection pool + idempotent upserts | ✓ shipped | [`.../db.py`](../../apps/ingestion-worker/src/agentic_law_os_ingestion/db.py) |
| Typer CLI (`ingest-statutes`, `ingest-regulations`, `freshness`, `parse-pdf`) | ✓ shipped | [`.../cli.py`](../../apps/ingestion-worker/src/agentic_law_os_ingestion/cli.py) |
| Phase 2 status doc | ✓ shipped | this file |

## Phase 2 — DONE (2026-05-11)

**Done-criterion (PRD §17): California statute corpus is searchable in Postgres via SQL and pgvector queries. ✓ MET.**

End-to-end run summary (against the local Homebrew Postgres 17 + pgvector 0.8.2 + live `leginfo.legislature.ca.gov`):

- **38 sections enumerated**; **59 chunks inserted**; **0 errors**.
- **15.5 seconds** wall-clock end-to-end (parallelism=4).
- **All 59 chunks have valid 1024-dim `voyage-law-2` embeddings**.
- **67,050 chars** of statutory text in `statute_chunks.text` (clean — no leginfo page chrome).
- `corpus_freshness` row UPSERTed: current_through=2026-05-11, chunk_count=59, error_message=NULL.

Search proof (all queries executed against the live corpus):

- **Vector similarity (HNSW)** — closest neighbors to § 2775 (the operative ABC test) chunk 0 are § 2785 (joint liability) @ 0.16, § 2776 (B2B exemption) @ 0.23, § 2781, § 2778, § 2783 (occupation exemptions). Semantically correct cluster.
- **Full-text search (GIN tsvector)** — keyword queries return ranked results.
- **B-tree address lookup** — `(jurisdiction='US-CA', code='Lab.', section='2775')` is <1ms.
- **R9 fast-filter** — 24 sections tagged `is_definitions_section=true` via partial index.
- **R15 exemption tracking** — 10 sections (§§ 2776–2785) tagged `is_exemption_section=true`.

Sample of clean § 2775 chunk 0 (the operative ABC test):

```
Labor Code - LAB
DIVISION 3. EMPLOYMENT RELATIONS [2700 - 3122.4]
( Division 3 enacted by Stats. 1937, Ch. 90. )
CHAPTER 2. Employer and Employee [2750 - 2930]
( Chapter 2 enacted by Stats. 1937, Ch. 90. )
ARTICLE 1.5. Worker Status: Employees [2775 - 2787]
( Article 1.5 added by Stats. 2020, Ch. 38, Sec. 2. )
2775.
(a) As used in this article:
(1) "Dynamex" means Dynamex Operations W. Inc. v. Superior Court (2018) 4 Cal.5th 903.
(2) "Borello" means the California Supreme Court's decision in S. ...
```

Voyage AI economics for this run: ~18,000 tokens consumed across 14 batch calls, all 2xx. Cost: $0.00 (well within the 200M-token free-tier allotment).

Two bugs surfaced and fixed during the live run (commit `57cc1b10`):

1. asyncpg didn't auto-register the pgvector codec — INSERTs failed with `expected str, got list`. Fix: register `pgvector.asyncpg.register_vector` in the pool's per-connection init hook.
2. HTML extraction kept ~2000 chars of leginfo page chrome per section. Fix: priority-ordered selector list targeting known content containers (`#codeLawSectionNoHead` and friends) with graceful fallback.

The Voyage AI rate-limit caveat from the previous ingestion attempt was resolved by adding a payment method to the Voyage account — standard rate limits unlocked even on the free tier.

---

## Local schema validation (2026-05-11)

The migration was applied locally against a Homebrew-installed PostgreSQL 17 + pgvector 0.8.2 and validated end-to-end. Six smoke tests, all passed:

| # | Test | Result |
|---|---|---|
| 1 | `pgvector` round-trip — INSERT into `statute_chunks.embedding` (vector(1024)), SELECT with cosine-distance operator + HNSW index | ✓ passed |
| 2 | `tsvector` full-text search via `search_tsv` GIN index, `plainto_tsquery` lookup | ✓ passed |
| 3 | Hash-chain trigger accepts a valid genesis + chained INSERT into `ledger_entries` | ✓ passed |
| 4 | `claim_ledgers.head_hash` automatically propagates from the latest `ledger_entries.this_hash` | ✓ passed |
| 5 | Hash-chain trigger **rejects** an INSERT whose `prev_hash` doesn't match the previous entry's `this_hash` | ✓ passed — raised P0001 with the expected vs. got hex |
| 6 | `refuse_mutation` trigger blocks UPDATE on `ledger_entries` (append-only enforcement) | ✓ passed |

Schema artifacts confirmed:
- **3 extensions:** vector 0.8.2, pgcrypto 1.3, pg_trgm 1.6.
- **15 schema tables + `_migrations`:** statute_chunks, regulation_chunks, case_index, corpus_freshness, task_specs, claim_ledgers, ledger_entries, claims, retrieval_log, verifier_results, confidence_results, classification_results, completeness_results, deliverables, audit_anchors.
- **9 indexes on `statute_chunks` alone:** primary key, idempotent-upsert unique (jurisdiction, doc_id, hash, chunk_index), HNSW on embedding (vector_cosine_ops), GIN on search_tsv, GIN on text (trigram), B-tree on (jurisdiction, code, section, subdivision), B-tree partial on chapter_id, B-tree partial on definitions_section, B-tree on doc_id.
- **2 triggers on `ledger_entries`:** `enforce_ledger_chain` (BEFORE INSERT — hash-chain validation + head_hash propagation), `refuse_mutation` (BEFORE UPDATE/DELETE — audit immutability).
- **Migration runtime:** 647ms wall-clock for the full schema apply.

This validates the schema half of the Phase 2 done-criterion. The corpus-data half (CA Lab. Code chunks searchable via SQL + pgvector) still requires the Voyage AI signup + the bootstrap ingestion run; those steps are unchanged below.

## What still needs you (Phase 2 finish line)

The code is authored and pushed. To hit the PRD's Phase 2 done-criterion (CA corpus searchable in Postgres), you need to make four external-system decisions and run two commands.

### 1. Pick the Postgres host

Options, in order of recommendation for Phase 2:

| Option | Pros | Cons | What to do |
|---|---|---|---|
| **Railway Postgres plugin** (Recommended for production parity) | Production target per PRD §16; pgvector is a one-click extension toggle; `DATABASE_URL` is a service-linked variable | Costs ~$5–20/mo; first provisioning is a few clicks | Create Railway project → add Postgres → enable `vector` extension → copy `DATABASE_URL` |
| **Local Docker Compose** | Free; matches the included `docker-compose.yml`; fully offline | Requires Docker Desktop (a sizable Mac install) | `brew install --cask docker`, start Docker Desktop, then `docker compose up -d postgres` |
| **Local Homebrew Postgres + pgvector** | Lightest install; no Docker daemon | More setup; no `docker-compose` parity with prod | `brew install postgresql@16 pgvector` then manually `CREATE EXTENSION vector;` |

Whichever you pick, the rest of the steps are the same.

### 2. Sign up for Voyage AI

The ingestion worker needs `VOYAGE_API_KEY` to compute the 1024-dim `voyage-law-2` embeddings stored in `statute_chunks.embedding`.

- Sign up: https://voyageai.com/ (Anthropic-affiliated)
- Free tier: 50M tokens/month — easily enough for CA Labor Code Chapter 2 (~50k tokens total)
- Copy the API key

### 3. Set environment variables

Create `apps/ingestion-worker/.env` (gitignored) with:

```
DATABASE_URL=postgres://...your_chosen_postgres...
VOYAGE_API_KEY=...your_voyage_key...
INGESTION_LOG_LEVEL=INFO
```

Or set them in your shell. For Railway, set them as Railway service variables (the ingestion worker reads from the env at start).

### 4. Run the migration + the ingestion

From the repo root:

```sh
# 1. Apply the schema
DATABASE_URL=$DATABASE_URL pnpm run migrate

# 2. Install + activate the worker
cd apps/ingestion-worker
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
playwright install chromium    # for Phase 2+ Playwright-driven sources

# 3. Run the bootstrap ingestion
agentic-law-os-ingestion ingest-statutes --jurisdiction US-CA --dev

# 4. Confirm the corpus is searchable
psql "$DATABASE_URL" -c "
  SELECT jurisdiction, code, section, char_end
  FROM statute_chunks
  WHERE jurisdiction='US-CA' AND code='Lab.'
  ORDER BY section::int LIMIT 10;
"

psql "$DATABASE_URL" -c "
  SELECT jurisdiction, source_kind, current_through, chunk_count
  FROM corpus_freshness
  WHERE jurisdiction='US-CA';
"
```

Expected output:
- ~30+ rows in `statute_chunks` (Labor Code §§ 2750–2787; some sections produce multiple chunks).
- A `corpus_freshness` row for `(US-CA, primary_statute)` with `chunk_count > 0` and today's `last_ingested_at`.

### 5. (Optional) Smoke-test pgvector search

```sh
# Compute a query embedding via Voyage (one-shot — the runtime will do this automatically in Phase 4)
# then issue a similarity search:
psql "$DATABASE_URL" -c "
  -- Replace <query_vector> with a 1024-dim voyage-law-2 embedding of, e.g., 'ABC test prong B'
  SELECT doc_id, section, embedding <=> '[<query_vector>]'::vector AS distance
  FROM statute_chunks
  WHERE jurisdiction='US-CA'
  ORDER BY distance
  LIMIT 5;
"
```

A simpler check that just exercises the index without needing a query embedding:

```sh
psql "$DATABASE_URL" -c "
  SELECT doc_id, section, ts_rank(search_tsv, plainto_tsquery('english','independent contractor')) AS rank
  FROM statute_chunks
  WHERE jurisdiction='US-CA' AND search_tsv @@ plainto_tsquery('english','independent contractor')
  ORDER BY rank DESC LIMIT 5;
"
```

Expected: § 2775 (the operative ABC test section) and adjacent definitions sections rank highly.

---

## Phase 2 design decisions captured

(Inline with the code; surfaced here for the Phase 2 record.)

- **One initial migration, not many small migrations.** PRD §17 Phase 2 specifies `0001_init.sql`; we kept it as one file rather than splitting into multiple migrations. Easier to reason about for the v1 bootstrap; subsequent changes get their own numbered migrations.
- **Embedding column is `vector(1024)`** to match `voyage-law-2`. If the team later switches embedders (e.g., to `voyage-3-large` at 2048 dim), that's a new migration — not a backwards-compatible change.
- **`text_normalized` column stored alongside `text`.** Pre-computed at ingest time so R5 HashEcho's substring-match check at runtime is a single column read, not an on-the-fly normalize per anchor. Trades disk space for runtime speed.
- **`chunk_index` + `chunk_total` + `char_start`/`char_end`** on every chunk row. These are what R4 anchors resolve against. Even single-chunk sections carry `chunk_index=0, chunk_total=1`.
- **`is_definitions_section` / `is_exemption_section` flags** at the chunk row level (not just the doc level). R9 / R15 use these to identify the relevant sections during analysis without re-parsing.
- **Hash chain enforced by trigger, not application code.** The application could enforce `prev_hash` continuity, but a Postgres trigger makes the contract tamper-resistant even against direct SQL writes.
- **CaliforniaSource v1 scope is Lab. Code Chapter 2.** That's the ~38-section block where AB5 / ABC test live (PRD §20 decision 2 — California is the recommended first state). Expanding to the full Labor Code is a Phase 6 task; the registry-driven structure scales without architecture changes.
- **`_CHAPTER_REGISTRY` pattern** for adding new chapters. Each entry pre-declares section ranges + definitions/exemption section sets. The alternative (dynamic TOC discovery via Playwright) is harder and was deferred to Phase 2+ when the registry becomes the bottleneck.

---

## What does NOT land in Phase 2 (deferred)

These were in scope per PRD §17 Phase 2 but pushed to later phases:

- **`IllinoisSource`** (PRD calls this out for Phase 6 Day & Temporary Labor Services Act). Authored later when IL becomes the second-state target.
- **Regulation ingestion for CA** (Cal. Code Regs. tit. 8). `regulation_chunks` table exists; CaliforniaSource v1 raises `NotImplementedError` on `primary_regulation`. Phase 2+ deliverable.
- **Case-law ingestion** (`case_index` table). Will be populated by the CourtListener-mirror skill in Phase 3 (KB MCP server work).
- **Reducto fallback** for Docling failures. Plumbing is in place (`INGESTION_USE_REDUCTO_FALLBACK` env var); actual fallback implementation TODO.
- **Long-lived `worker` mode** (`agentic-law-os-ingestion worker`). Placeholder in cli.py; will listen for R10 refresh events via Postgres LISTEN/NOTIFY in Phase 4.
- **Voyage reranker** (rerank-2). Embedder is wired; reranker is invoked by the KB MCP server's hybrid search path in Phase 3.

## Phase 2+ refinements observed during authoring

(For Phase 3 planning.)

- **`current_through` parsing from leginfo footer.** v1 reports today's date as a placeholder. Phase 2+ parses leginfo's "Code current as of <date>" footer for accurate currency.
- **Per-section amendment history.** `amendment_history` column exists but is empty in v1. Phase 2+ extracts the "Stats. <year>, ch. <chapter>" annotations leginfo includes after amended sections.
- **Cross-references during ingestion.** The orchestrator's R8 CrossRefTrace will detect cross-refs at runtime, but pre-computing them at ingest time would speed up retrieval. Worth benchmarking in Phase 3.

---

## Sign-off

Phase 2 code is complete and pushed (commits [`874205e7`](https://github.com/legalbuilder13-spec/State-Claw-Research/commit/874205e7), [`334af837`](https://github.com/legalbuilder13-spec/State-Claw-Research/commit/334af837)). The PRD §17 Phase 2 done-criterion is **not yet met** because it requires running the migration + ingestion against a provisioned Postgres, which is the operator's external-system step (see §1–§4 above).

When you've completed the external setup and run the four commands, the done-criterion is met and Phase 3 (KB MCP server) can begin.
