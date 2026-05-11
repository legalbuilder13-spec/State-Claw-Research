"""Docling-based parser.

Docling preserves the § hierarchy, footnote markers, and amendment annotations
that scraped HTML often loses. We use it as the primary parser; the optional
Reducto fallback handles documents where Docling fails (rare; mostly bad PDFs).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from agentic_law_os_ingestion.logging import get_logger

if TYPE_CHECKING:
    from agentic_law_os_ingestion.sources.base import RawDocument

_logger = get_logger(__name__)


@dataclass(slots=True)
class ParsedDocument:
    """Output of the parser. Plain text, preserving structural cues as plain prose."""

    text: str
    parser_used: str            # 'docling' | 'reducto' | 'html_fallback'
    parser_notes: list[str]


class DoclingParser:
    """Parses RawDocuments via Docling (and an HTML fallback)."""

    def __init__(self) -> None:
        # Lazy import — Docling pulls in heavy deps; only import when actually used.
        self._docling = None

    def _ensure_docling(self) -> None:
        if self._docling is None:
            try:
                from docling.document_converter import DocumentConverter  # type: ignore[import]

                self._docling = DocumentConverter()
            except ImportError as exc:
                raise RuntimeError(
                    "docling is not installed. Run `uv pip install docling`."
                ) from exc

    async def parse(self, raw: "RawDocument") -> ParsedDocument:
        """Parse a RawDocument into plain text.

        Routes by available raw content:
        - raw_text present → no parsing needed; return as-is with notes.
        - raw_html present → fall back to a simple HTML-to-text path (BeautifulSoup).
        - raw_pdf_bytes present → Docling.
        """
        if raw.raw_text:
            return ParsedDocument(
                text=raw.raw_text,
                parser_used="passthrough",
                parser_notes=["raw_text was pre-populated by source"],
            )

        if raw.raw_pdf_bytes:
            return await self._parse_pdf(raw.raw_pdf_bytes)

        if raw.raw_html:
            return self._parse_html(raw.raw_html)

        raise ValueError(
            f"RawDocument {raw.doc_id!r} has no parseable content "
            f"(raw_text, raw_html, raw_pdf_bytes all empty)."
        )

    async def _parse_pdf(self, pdf_bytes: bytes) -> ParsedDocument:
        self._ensure_docling()
        assert self._docling is not None
        # Docling's converter takes file paths or streams; write to a temp.
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmp:
            tmp.write(pdf_bytes)
            tmp.flush()
            try:
                result = self._docling.convert(tmp.name)
                text = result.document.export_to_markdown()
                return ParsedDocument(
                    text=text,
                    parser_used="docling",
                    parser_notes=[],
                )
            except Exception as exc:
                _logger.warning("docling.failed", error=str(exc), recoverable=True)
                # TODO: Reducto fallback when INGESTION_USE_REDUCTO_FALLBACK=true.
                raise

    def _parse_html(self, html: str) -> ParsedDocument:
        try:
            from bs4 import BeautifulSoup
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("beautifulsoup4 is required for HTML parsing") from exc

        soup = BeautifulSoup(html, "lxml")
        notes: list[str] = ["BeautifulSoup + lxml; Docling not used for HTML input"]

        # Try known content containers in priority order. leginfo (CA), ilga (IL),
        # and most state legislative sites wrap the operative text in one of these.
        content: object | None = None
        for selector in [
            ("id", "codeLawSectionNoHead"),    # leginfo.legislature.ca.gov
            ("id", "codes_displaysecblock"),    # leginfo fallback
            ("id", "single_law_section"),       # leginfo fallback
            ("id", "manylawsections"),          # leginfo expanded view
            ("id", "ContentPlaceHolder1_TextContent"),  # ilga.gov pattern
            ("class_", "contentBox"),
            ("role", "main"),
        ]:
            kwargs = {selector[0]: selector[1]}
            container = soup.find(**kwargs)
            if container is not None:
                content = container
                notes.append(f"content extracted from {selector[0]}={selector[1]!r}")
                break

        if content is None:
            # Fallback: strip obvious noise tags, then extract from body.
            for noise in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
                noise.decompose()
            content = soup.find("body") or soup
            notes.append("no known content container matched; fell back to body extraction")

        text = content.get_text(separator="\n")  # type: ignore[union-attr]
        # Collapse runs of blank lines and trim each line.
        lines = [line.strip() for line in text.split("\n")]
        compact = "\n".join(line for line in lines if line)
        return ParsedDocument(
            text=compact,
            parser_used="html_fallback",
            parser_notes=notes,
        )
