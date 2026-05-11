"""Typer CLI entrypoint.

Exposes the `agentic-law-os-ingestion` command and its subcommands.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import typer

from agentic_law_os_ingestion import __version__
from agentic_law_os_ingestion.config import get_config
from agentic_law_os_ingestion.db import close_pool, transaction
from agentic_law_os_ingestion.logging import configure_logging, get_logger
from agentic_law_os_ingestion.worker import run_ingestion

app = typer.Typer(
    no_args_is_help=True,
    help="Statute and admin-code ingestion worker for Agentic-Law-OS.",
)


@app.callback()
def _root(
    log_level: str = typer.Option("INFO", "--log-level"),
    dev: bool = typer.Option(False, "--dev", help="Use pretty console output."),
) -> None:
    """Configure logging before any subcommand runs."""
    configure_logging(level=log_level, is_dev=dev)


@app.command("version")
def version() -> None:
    """Print the worker version."""
    typer.echo(__version__)


@app.command("ingest-statutes")
def ingest_statutes(
    jurisdiction: str = typer.Option(..., "--jurisdiction", "-j", help="Jurisdiction code, e.g., US-CA"),
    chapter: str | None = typer.Option(None, "--chapter", help="Optional chapter filter"),
    section: str | None = typer.Option(None, "--section", help="Optional section filter"),
    force_refresh: bool = typer.Option(False, "--force-refresh", help="Re-fetch even if corpus is fresh"),
) -> None:
    """Ingest statute corpus for a jurisdiction."""
    log = get_logger("cli")
    log.info("cli.ingest_statutes_start", jurisdiction=jurisdiction, force_refresh=force_refresh)
    summary = asyncio.run(
        _run_and_close(
            jurisdiction=jurisdiction,
            kind="primary_statute",
            chapter_filter=chapter,
            section_filter=section,
            force_refresh=force_refresh,
        )
    )
    typer.echo(f"Ingestion complete: {summary}")


@app.command("ingest-regulations")
def ingest_regulations(
    jurisdiction: str = typer.Option(..., "--jurisdiction", "-j"),
    agency: str | None = typer.Option(None, "--agency"),
    chapter: str | None = typer.Option(None, "--chapter"),
    section: str | None = typer.Option(None, "--section"),
    force_refresh: bool = typer.Option(False, "--force-refresh"),
) -> None:
    """Ingest regulation corpus for a jurisdiction (+ agency)."""
    summary = asyncio.run(
        _run_and_close(
            jurisdiction=jurisdiction,
            kind="primary_regulation",
            chapter_filter=chapter,
            section_filter=section,
            agency_filter=agency,
            force_refresh=force_refresh,
        )
    )
    typer.echo(f"Ingestion complete: {summary}")


@app.command("freshness")
def freshness(
    jurisdiction: str | None = typer.Option(None, "--jurisdiction", "-j"),
) -> None:
    """Show corpus_freshness rows."""
    asyncio.run(_show_freshness(jurisdiction))


@app.command("parse-pdf")
def parse_pdf(
    path: Path = typer.Argument(..., exists=True, readable=True),
) -> None:
    """One-shot PDF inspection: parse a PDF via Docling and print the first 1000 chars."""
    from agentic_law_os_ingestion.parsers import DoclingParser
    from agentic_law_os_ingestion.sources.base import RawDocument

    raw = RawDocument(
        source_id="manual",
        source_category="primary_statute",
        source_url=None,
        doc_id="manual:test:adhoc",
        jurisdiction="US",
        raw_pdf_bytes=path.read_bytes(),
    )
    parser = DoclingParser()
    parsed = asyncio.run(parser.parse(raw))
    typer.echo(f"--- parser: {parsed.parser_used} ---")
    typer.echo(f"length: {len(parsed.text)} chars")
    typer.echo("--- first 1000 chars ---")
    typer.echo(parsed.text[:1000])
    if parsed.parser_notes:
        typer.echo("--- parser notes ---")
        for note in parsed.parser_notes:
            typer.echo(f"  • {note}")


@app.command("worker")
def worker() -> None:
    """Long-lived worker mode: poll for ingestion requests and process them.

    v1 implementation is a placeholder; Phase 4+ wires this to listen for
    R10 refresh events from the orchestrator via Postgres LISTEN/NOTIFY.
    """
    typer.echo("worker mode not yet implemented; run ingest-statutes / ingest-regulations directly")
    raise typer.Exit(code=2)


# ----------------------------------------------------------------------------
# Internal helpers
# ----------------------------------------------------------------------------


async def _run_and_close(**kwargs) -> dict[str, int]:
    try:
        # Ensure config loads before any DB call so credentials errors surface early.
        get_config()
        return await run_ingestion(**kwargs)
    finally:
        await close_pool()


async def _show_freshness(jurisdiction: str | None) -> None:
    try:
        async with transaction() as conn:
            if jurisdiction:
                rows = await conn.fetch(
                    "SELECT * FROM corpus_freshness WHERE jurisdiction=$1 ORDER BY source_kind",
                    jurisdiction,
                )
            else:
                rows = await conn.fetch("SELECT * FROM corpus_freshness ORDER BY jurisdiction, source_kind")
            if not rows:
                typer.echo("(no corpus_freshness rows)")
                return
            for r in rows:
                typer.echo(
                    f"{r['jurisdiction']:>10}  {r['source_kind']:<20}  "
                    f"current_through={r['current_through']}  "
                    f"last_ingested={r['last_ingested_at']:%Y-%m-%d %H:%M}  "
                    f"chunks={r['chunk_count']}"
                )
    finally:
        await close_pool()


if __name__ == "__main__":
    app()
