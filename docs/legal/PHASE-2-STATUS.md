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
