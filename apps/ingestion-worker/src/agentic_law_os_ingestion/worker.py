"""Ingestion pipeline orchestrator.

Wires Source → Parser → Chunker → Embedder → DB into a coherent async pipeline.
Driven by the CLI's ingest-statutes / ingest-regulations commands.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import ulid

from agentic_law_os_ingestion.chunker import chunk_section
from agentic_law_os_ingestion.config import get_config
from agentic_law_os_ingestion.db import (
    insert_regulation_chunk,
    insert_statute_chunk,
    transaction,
    upsert_corpus_freshness,
)
from agentic_law_os_ingestion.embedders import VoyageEmbedder
from agentic_law_os_ingestion.logging import get_logger
from agentic_law_os_ingestion.parsers import DoclingParser
from agentic_law_os_ingestion.sources import get_source_for_jurisdiction
from agentic_law_os_ingestion.sources.base import IngestionScope, RawDocument

_logger = get_logger(__name__)


async def run_ingestion(
    *,
    jurisdiction: str,
    kind: str,                                   # 'primary_statute' | 'primary_regulation'
    chapter_filter: str | None = None,
    section_filter: str | None = None,
    agency_filter: str | None = None,
    force_refresh: bool = False,
) -> dict[str, int]:
    """Run a full ingestion pass. Returns a summary with chunk counts."""
    cfg = get_config()
    run_id = str(ulid.ULID())
    started_at = datetime.now(UTC)

    SourceCls = get_source_for_jurisdiction(jurisdiction)
    source = SourceCls()

    scope = IngestionScope(
        kind=kind,                                # type: ignore[arg-type]
        chapter_filter=chapter_filter,
        section_filter=section_filter,
        agency_filter=agency_filter,
        force_refresh=force_refresh,
    )

    parser = DoclingParser()
    embedder = VoyageEmbedder()

    docs_processed = 0
    chunks_inserted = 0
    chunks_skipped = 0   # already-present (ON CONFLICT path)
    errors = 0

    semaphore = asyncio.Semaphore(cfg.ingestion_parallelism)

    async def process_doc(doc: RawDocument) -> tuple[int, int]:
        async with semaphore:
            try:
                parsed = await parser.parse(doc)
            except Exception as exc:
                _logger.error("worker.parse_failed", doc_id=doc.doc_id, error=str(exc))
                return (0, 1)   # 0 chunks, 1 error

            chunks = chunk_section(parsed.text)
            if not chunks:
                return (0, 0)

            # Embed all chunks in one batch per document.
            try:
                vectors = await embedder.embed([c.text for c in chunks])
            except Exception as exc:
                _logger.error("worker.embed_failed", doc_id=doc.doc_id, error=str(exc))
                return (0, 1)

            inserted_this_doc = 0
            skipped_this_doc = 0
            async with transaction() as conn:
                for chunk, vector in zip(chunks, vectors, strict=True):
                    row = _build_row(doc, chunk, vector)
                    if kind == "primary_statute":
                        result = await insert_statute_chunk(conn, row)
                    elif kind == "primary_regulation":
                        result = await insert_regulation_chunk(conn, row)
                    else:
                        raise ValueError(f"Unsupported kind {kind!r}")

                    if result is not None:
                        inserted_this_doc += 1
                    else:
                        skipped_this_doc += 1

            _logger.info(
                "worker.doc_processed",
                doc_id=doc.doc_id,
                chunks_inserted=inserted_this_doc,
                chunks_skipped=skipped_this_doc,
            )
            return (inserted_this_doc, 0)

    tasks: list[asyncio.Task[tuple[int, int]]] = []
    async for raw_doc in source.iter_documents(scope):
        docs_processed += 1
        tasks.append(asyncio.create_task(process_doc(raw_doc)))

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=False)
        for inserted, err in results:
            chunks_inserted += inserted
            errors += err

    # UPSERT corpus_freshness
    currency = await source.confirm_currency()
    async with transaction() as conn:
        await upsert_corpus_freshness(
            conn,
            jurisdiction=jurisdiction,
            source_kind=kind,
            current_through=currency.current_through,
            last_ingested_at=started_at,
            ingestion_run_id=run_id,
            chunk_count=chunks_inserted,
            error_message=None if errors == 0 else f"{errors} doc-level errors",
        )

    summary = {
        "docs_processed": docs_processed,
        "chunks_inserted": chunks_inserted,
        "chunks_skipped": chunks_skipped,
        "errors": errors,
    }
    _logger.info(
        "worker.run_complete",
        run_id=run_id,
        jurisdiction=jurisdiction,
        kind=kind,
        duration_s=(datetime.now(UTC) - started_at).total_seconds(),
        **summary,
    )
    return summary


def _build_row(doc: RawDocument, chunk, vector: list[float]) -> dict:
    """Compose the DB row from a RawDocument + a chunk + its embedding."""
    return {
        "id": str(ulid.ULID()),
        "doc_id": doc.doc_id,
        "jurisdiction": doc.jurisdiction,
        "source_category": doc.source_category,
        "source_id": doc.source_id,
        "source_url": doc.source_url,
        # statute fields
        "code": doc.code,
        "chapter_id": doc.chapter_id,
        "section": doc.section,
        "subdivision": doc.subdivision,
        # regulation fields
        "title": doc.title,
        "part": doc.part,
        "agency": doc.agency,
        "implements_statute_doc_id": doc.implements_statute_doc_id,
        # flags
        "is_definitions_section": doc.is_definitions_section,
        "is_exemption_section": doc.is_exemption_section,
        "is_operative_section": doc.is_operative_section,
        # chunking
        "chunk_index": chunk.chunk_index,
        "chunk_total": chunk.chunk_total,
        "char_start": chunk.char_start,
        "char_end": chunk.char_end,
        # content
        "text": chunk.text,
        "text_normalized": chunk.text_normalized,
        "hash": chunk.hash,
        # currency
        "current_through": doc.current_through,
        "retrieved_at": datetime.now(UTC),
        "amendment_history": "[]",
        # embedding
        "embedding": vector,
    }
