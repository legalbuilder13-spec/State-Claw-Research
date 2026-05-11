# Migrations

Postgres schema migrations for Agentic-Law-OS. Numbered lexicographically; each file is run-once; the runner tracks applied migrations in the `_migrations` table.

## Files

| File | Adds |
|---|---|
| [`0001_init.sql`](0001_init.sql) | Initial schema. 11 tables, pgvector + tsvector indexes, hash-chain audit, idempotent upsert constraints. |

## Required Postgres extensions

- **`vector`** (pgvector v0.7+) — provides the `vector(N)` column type and HNSW index for embedding similarity search.
- **`pgcrypto`** — for `gen_random_uuid()` and `digest()` helpers used in ULID and hash columns.
- **`pg_trgm`** — for trigram similarity search (used as a fallback for fuzzy keyword matching when full-text search misses).

`0001_init.sql` issues `CREATE EXTENSION IF NOT EXISTS` for each of these at the top.

## Running migrations

### Local development

Spin up the local Postgres + pgvector stack via Docker:

```sh
docker compose up -d postgres
```

The compose service uses `pgvector/pgvector:pg16` as the base image. Then run the migration:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agentic_law_os \
  pnpm run migrate
```

The runner ([`../scripts/migrate.ts`](../scripts/migrate.ts)) is a lexicographic-order SQL runner: it lists every `*.sql` file in `migrations/`, sorts them, applies each one not present in `_migrations`, and records the application in `_migrations`.

### Railway / production

The Railway Postgres plugin must have the `vector` extension enabled (Railway → service → variables → enable `vector` from the extensions panel). After provisioning, set `DATABASE_URL` from Railway's service-linked variable and run the same `pnpm run migrate` from a one-off deployment.

The ingestion worker's Dockerfile runs `pnpm run migrate` as a pre-start step when `MIGRATE_ON_START=1` is set; otherwise migrations are run as a separate Railway deploy hook.

## Schema conventions

- **Every table has an `id` column** that's either a ULID (`text`, 26 chars, Crockford Base32) for application-level IDs or a `bigserial` for internal-only join tables.
- **Every table has `created_at timestamptz NOT NULL DEFAULT now()`**. Mutable tables also have `updated_at timestamptz NOT NULL DEFAULT now()` with a trigger.
- **Hashes are stored as `bytea(32)`** (raw SHA-256). The application layer renders them as `sha256:<hex>` at API boundaries (per the schemas).
- **Jurisdiction codes use the schema's pattern** (`US`, `US-CA`, `US-CA:los-angeles-county`).
- **Source identifiers use `<source_category>:<jurisdiction>:<identifier>`** form. The `doc_id` text columns are unconstrained but conventionally follow this shape.
- **Embeddings are `vector(1024)`** to match Voyage's `voyage-law-2` output dimension. Profile A (Lexis) may add a separate column for a different embedder; v1 sticks to one.

## Idempotency

Re-ingestion of the same (jurisdiction, doc_id, hash) tuple is a no-op via `ON CONFLICT (jurisdiction, doc_id, hash) DO NOTHING` on the corpus tables. This means the ingestion worker can be re-run safely without producing duplicates. A new hash (different text) does produce a new row — the application layer relies on this for R10 CurrencyTag's corpus-drift detection.

## Row-level security (Phase 6+ hardening)

The PRD §16 hardening checklist calls for per-matter RLS on `claims`, `claim_ledgers`, and `retrieval_log`. The initial migration includes the RLS column scaffolding (`matter_id` column on each, with `NULL` permitted in v1) but does NOT enable RLS yet. Phase 6 hardening adds an `ENABLE ROW LEVEL SECURITY` + policies migration.

## Audit chain integrity

The audit hash chain (per-`claim_ledger` entries with `prev_hash` → `this_hash` linkage) is enforced via a `BEFORE INSERT` trigger on `ledger_entries`: the trigger refuses inserts whose `prev_hash` doesn't match the previous entry's `this_hash`. Tampering with a historical row would break the chain at the next insert.

A separate weekly job (Phase 6) anchors the head hash to an external R2 bucket; that's tracked in the `audit_anchors` table.

## Adding a new migration

1. Pick the next number: look at the highest `NNNN_*.sql` in the directory and increment.
2. Author `NNNN_short_description.sql` with `BEGIN;` … `COMMIT;` wrapping the changes.
3. Test locally against a fresh Postgres + the prior migrations applied.
4. The runner applies it on next `pnpm run migrate`.

Never edit a migration that has already been applied to any environment. If you need to change a column or constraint, write a new migration that alters the prior one. (`_migrations` tracks by filename; editing an applied file doesn't re-run it.)
