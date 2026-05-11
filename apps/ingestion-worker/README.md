# Ingestion Worker

Python service that ingests statute and admin-code text from official state sources into the Agentic-Law-OS Postgres corpus tables (`statute_chunks`, `regulation_chunks`, `case_index`).

Separate from the OpenClaw runtime (Node/TypeScript) — runs as its own Railway service with its own Dockerfile, lifecycle, and scaling.

## Quickstart

```sh
# Local development
cd apps/ingestion-worker
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
playwright install chromium

# Set DATABASE_URL + VOYAGE_API_KEY in ../../.env or export them.
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/agentic_law_os
export VOYAGE_API_KEY=...

# Run an ingestion
agentic-law-os-ingestion ingest-statutes --jurisdiction US-CA
```

## Architecture

```
state-source URL / PDF
        │
        ▼
   Source ABC          (per-state implementation: iter_documents() + confirm_currency())
        │
        ▼
   Docling parser      (preserves § hierarchy, footnotes, amendment markers)
        │
        ▼
   Structure-aware     (per-section spans; detects definitions block, exemptions,
   chunker              delegations; preserves section boundaries)
        │
        ▼
   Voyage embedder     (voyage-law-2; batched; 1024-dim vectors)
        │
        ▼
   Postgres writer     (statute_chunks INSERT ... ON CONFLICT DO NOTHING per
                        UNIQUE(jurisdiction, doc_id, hash, chunk_index))
        │
        ▼
   Freshness metadata  (UPSERT corpus_freshness rows)
```

## CLI

```sh
agentic-law-os-ingestion worker                          # long-lived; consumes refresh events
agentic-law-os-ingestion ingest-statutes --jurisdiction US-CA
agentic-law-os-ingestion ingest-regulations --jurisdiction US-CA --agency labor-commissioner
agentic-law-os-ingestion freshness --jurisdiction US-CA  # show corpus_freshness rows
agentic-law-os-ingestion parse-pdf path/to/file.pdf      # one-shot PDF inspection
agentic-law-os-ingestion --help
```

## Per-state sources

Each state has its own `Source` class in `src/agentic_law_os_ingestion/sources/<state>.py` implementing the `Source` ABC in `sources/base.py`:

```python
class Source(ABC):
    jurisdiction: str
    source_id: str          # e.g. "local_corpus_state_official"
    source_category: str    # "primary_statute" | "primary_regulation"

    @abstractmethod
    async def iter_documents(self, scope: IngestionScope) -> AsyncIterator[RawDocument]:
        """Yield raw documents one at a time (memory-bounded)."""

    @abstractmethod
    async def confirm_currency(self) -> CurrencyInfo:
        """Return current_through date + canonical source URL."""
```

v1 ships:
- `CaliforniaSource` against `leginfo.legislature.ca.gov`
- `IllinoisSource` against `ilga.gov` (Phase 6 deliverable per PRD §17)

Each source is ~150–300 lines depending on whether the official site provides reliable PDFs (less code) or requires Playwright-driven HTML scraping (more code).

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Must include `?sslmode=require` for Railway. |
| `VOYAGE_API_KEY` | Voyage AI key for `voyage-law-2` embeddings and `rerank-2` reranker. |
| `INGESTION_PARALLELISM` | Max concurrent in-flight documents. Default 4. |
| `INGESTION_LOG_LEVEL` | structlog level. Default `INFO`. |
| `INGESTION_EMBEDDING_BATCH_SIZE` | Batch size for Voyage embedding calls. Default 64. |
| `INGESTION_USE_REDUCTO_FALLBACK` | When Docling fails on a doc, fall back to Reducto. Default false. |
| `REDUCTO_API_KEY` | Required only if INGESTION_USE_REDUCTO_FALLBACK=true. |

## Idempotency

Re-ingestion of the same `(jurisdiction, doc_id, hash, chunk_index)` is a no-op (UNIQUE constraint + ON CONFLICT DO NOTHING). A new hash for the same `(jurisdiction, doc_id)` produces a new row alongside the old — the application layer relies on this for R10 CurrencyTag's corpus-drift detection.

The `corpus_freshness` row is UPSERTed with the new `last_ingested_at` and `chunk_count`.

## Deployment

Railway service config:

- Build: from this directory's Dockerfile.
- Service type: worker (no public ports).
- Plugins: link to the project Postgres for `DATABASE_URL`.
- Secrets: `VOYAGE_API_KEY`, optionally `REDUCTO_API_KEY`.
- Schedule: cron `0 2 * * 0` to run `ingest-statutes` weekly per jurisdiction in scope. (Or trigger from the OpenClaw orchestrator on R10 stale-blocking events — Phase 4 wiring.)

## Why a separate worker

- **Independent scaling.** Ingestion is bursty; the runtime serves continuous escalations. Separate services let Railway scale them differently.
- **Python ecosystem.** Docling + Voyage + Playwright are best in Python; the runtime is TypeScript. Crossing the language boundary at the corpus layer keeps both runtimes idiomatic.
- **Independent failure domain.** A scraper that breaks on a state-site layout change doesn't take down the agent runtime.

## See also

- [`../../migrations/0001_init.sql`](../../migrations/0001_init.sql) — the schema this worker writes to.
- [`../../source-profiles/profile-b-free.yaml`](../../source-profiles/profile-b-free.yaml) — source allowlist and ingestion config the worker consults.
- [`../../rules/R10.CurrencyTag.md`](../../rules/R10.CurrencyTag.md) — how the agent uses `corpus_freshness` at runtime.
