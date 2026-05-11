"""asyncpg connection pool + per-table upsert helpers.

The ingestion worker only writes to corpus tables (statute_chunks,
regulation_chunks, case_index, corpus_freshness). It does NOT touch the
run-state tables (task_specs, claim_ledgers, ...); those are the runtime's.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import asyncpg
from pgvector.asyncpg import register_vector

from agentic_law_os_ingestion.config import get_config
from agentic_law_os_ingestion.logging import get_logger

_logger = get_logger(__name__)
_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Per-connection init hook: register the pgvector codec.

    Without this, asyncpg encodes/decodes the `vector(N)` column type as text
    and INSERTs with a Python list fail with 'expected str, got list'.
    """
    await register_vector(conn)


async def get_pool() -> asyncpg.Pool:
    """Return the process-singleton asyncpg pool. Created on first call."""
    global _pool
    if _pool is None:
        cfg = get_config()
        dsn = cfg.database_url.get_secret_value()
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=2,
            max_size=cfg.ingestion_parallelism * 2,
            command_timeout=60,
            init=_init_connection,
        )
        _logger.info("db.pool_created", min_size=2, max_size=cfg.ingestion_parallelism * 2)
    return _pool


async def close_pool() -> None:
    """Close the pool. Called at worker shutdown."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        _logger.info("db.pool_closed")


@asynccontextmanager
async def transaction() -> AsyncIterator[asyncpg.Connection]:
    """Yield a connection inside a transaction; commits on exit, rolls back on exception."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            yield conn


# ----------------------------------------------------------------------------
# Statute chunk upsert
# ----------------------------------------------------------------------------

STATUTE_CHUNK_INSERT_SQL = """
INSERT INTO statute_chunks (
    id, doc_id, jurisdiction, source_category, source_id, source_url,
    code, chapter_id, section, subdivision,
    is_definitions_section, is_exemption_section, is_operative_section,
    chunk_index, chunk_total, char_start, char_end,
    text, text_normalized, hash,
    current_through, retrieved_at, amendment_history,
    embedding, search_tsv
)
VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10,
    $11, $12, $13,
    $14, $15, $16, $17,
    $18, $19, $20,
    $21, $22, $23,
    $24, to_tsvector('english', $18)
)
ON CONFLICT (jurisdiction, doc_id, hash, chunk_index) DO NOTHING
RETURNING id
"""


async def insert_statute_chunk(
    conn: asyncpg.Connection,
    row: dict[str, Any],
) -> str | None:
    """Insert a statute chunk row. Returns id on insert, None on conflict (already present)."""
    result = await conn.fetchval(
        STATUTE_CHUNK_INSERT_SQL,
        row["id"],
        row["doc_id"],
        row["jurisdiction"],
        row.get("source_category", "primary_statute"),
        row["source_id"],
        row.get("source_url"),
        row["code"],
        row.get("chapter_id"),
        row["section"],
        row.get("subdivision"),
        row.get("is_definitions_section", False),
        row.get("is_exemption_section", False),
        row.get("is_operative_section", True),
        row.get("chunk_index", 0),
        row.get("chunk_total", 1),
        row.get("char_start", 0),
        row["char_end"],
        row["text"],
        row["text_normalized"],
        row["hash"],
        row["current_through"],
        row.get("retrieved_at"),
        row.get("amendment_history", "[]"),
        row.get("embedding"),
    )
    return result


# ----------------------------------------------------------------------------
# Regulation chunk upsert
# ----------------------------------------------------------------------------

REGULATION_CHUNK_INSERT_SQL = """
INSERT INTO regulation_chunks (
    id, doc_id, jurisdiction, source_category, source_id, source_url,
    title, part, section, subdivision, agency, implements_statute_doc_id,
    is_definitions_section, is_operative_section,
    chunk_index, chunk_total, char_start, char_end,
    text, text_normalized, hash,
    current_through, retrieved_at,
    embedding, search_tsv
)
VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, $11, $12,
    $13, $14,
    $15, $16, $17, $18,
    $19, $20, $21,
    $22, $23,
    $24, to_tsvector('english', $19)
)
ON CONFLICT (jurisdiction, doc_id, hash, chunk_index) DO NOTHING
RETURNING id
"""


async def insert_regulation_chunk(
    conn: asyncpg.Connection,
    row: dict[str, Any],
) -> str | None:
    """Insert a regulation chunk row. Returns id on insert, None on conflict."""
    return await conn.fetchval(
        REGULATION_CHUNK_INSERT_SQL,
        row["id"],
        row["doc_id"],
        row["jurisdiction"],
        row.get("source_category", "primary_regulation"),
        row["source_id"],
        row.get("source_url"),
        row["title"],
        row["part"],
        row["section"],
        row.get("subdivision"),
        row["agency"],
        row.get("implements_statute_doc_id"),
        row.get("is_definitions_section", False),
        row.get("is_operative_section", True),
        row.get("chunk_index", 0),
        row.get("chunk_total", 1),
        row.get("char_start", 0),
        row["char_end"],
        row["text"],
        row["text_normalized"],
        row["hash"],
        row["current_through"],
        row.get("retrieved_at"),
        row.get("embedding"),
    )


# ----------------------------------------------------------------------------
# Corpus freshness upsert
# ----------------------------------------------------------------------------

CORPUS_FRESHNESS_UPSERT_SQL = """
INSERT INTO corpus_freshness (
    jurisdiction, source_kind, current_through, last_ingested_at,
    ingestion_run_id, chunk_count, error_message, notes
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (jurisdiction, source_kind) DO UPDATE
SET current_through    = EXCLUDED.current_through,
    last_ingested_at   = EXCLUDED.last_ingested_at,
    ingestion_run_id   = EXCLUDED.ingestion_run_id,
    chunk_count        = EXCLUDED.chunk_count,
    error_message      = EXCLUDED.error_message,
    notes              = EXCLUDED.notes
"""


async def upsert_corpus_freshness(
    conn: asyncpg.Connection,
    *,
    jurisdiction: str,
    source_kind: str,
    current_through: Any,
    last_ingested_at: Any,
    ingestion_run_id: str | None,
    chunk_count: int,
    error_message: str | None = None,
    notes: str = "{}",
) -> None:
    """UPSERT a corpus_freshness row."""
    await conn.execute(
        CORPUS_FRESHNESS_UPSERT_SQL,
        jurisdiction,
        source_kind,
        current_through,
        last_ingested_at,
        ingestion_run_id,
        chunk_count,
        error_message,
        notes,
    )
