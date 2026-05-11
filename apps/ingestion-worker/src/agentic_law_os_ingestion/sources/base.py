"""Source ABC — the contract every per-jurisdiction implementation conforms to.

A Source knows how to:
1. Enumerate the official documents in scope (`iter_documents`).
2. Report what the corpus is current through (`confirm_currency`).

The Source does NOT chunk, embed, or write to the DB — those are the
ingestion-worker's responsibility, applied uniformly across sources.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from typing import AsyncIterator, Literal


@dataclass(slots=True)
class IngestionScope:
    """What to ingest in a single run.

    `chapter_filter` and `section_filter` are optional narrowing hints — when
    set, the source enumerates only documents matching them. When None, the
    source enumerates everything it knows how to retrieve.
    """

    kind: Literal["primary_statute", "primary_regulation"]
    chapter_filter: str | None = None    # e.g. "Lab. Code Division 3 Part 1 Chapter 2"
    section_filter: str | None = None    # e.g. "2775"
    agency_filter: str | None = None     # only meaningful for primary_regulation
    force_refresh: bool = False          # ignore corpus_freshness; re-fetch everything


@dataclass(slots=True)
class RawDocument:
    """A document yielded by Source.iter_documents.

    Worker downstream pipeline (parser → chunker → embedder → DB) consumes
    these. The Source has already identified the structural address of each
    document; the parser fills in the content.
    """

    # Source identity
    source_id: str                       # e.g. "local_corpus_state_official"
    source_category: Literal["primary_statute", "primary_regulation", "case_law"]
    source_url: str | None

    # Document identity
    doc_id: str                          # typed: '<src_cat>:<juris>:<identifier>'
    jurisdiction: str                    # 'US-CA'

    # Statutory or regulatory address
    code: str | None = None              # 'Lab.' (for statutes)
    chapter_id: str | None = None
    section: str | None = None
    subdivision: str | None = None
    title: str | None = None             # for regulations
    part: str | None = None              # for regulations
    agency: str | None = None            # for regulations
    implements_statute_doc_id: str | None = None

    # Structural flags
    is_definitions_section: bool = False
    is_exemption_section: bool = False
    is_operative_section: bool = True

    # Content (filled in by parser; Source may pre-populate if HTML is cheap)
    raw_text: str | None = None          # parser overwrites with cleaned text
    raw_html: str | None = None
    raw_pdf_bytes: bytes | None = None

    # Currency
    current_through: date | None = None
    amendment_history: list[dict] = field(default_factory=list)


@dataclass(slots=True)
class CurrencyInfo:
    """What the source reports about its own currency."""

    jurisdiction: str
    source_kind: str                     # 'primary_statute' | 'primary_regulation'
    current_through: date
    canonical_source_url: str
    notes: str = ""


class Source(ABC):
    """Per-jurisdiction document enumerator.

    Subclasses override iter_documents and confirm_currency.
    """

    jurisdiction: str
    source_id: str
    source_category: Literal["primary_statute", "primary_regulation", "case_law"]

    @abstractmethod
    async def iter_documents(self, scope: IngestionScope) -> AsyncIterator[RawDocument]:
        """Yield RawDocuments one at a time (memory-bounded).

        Implementations should yield as soon as a document is fully identified —
        do not buffer the entire corpus into memory before yielding.
        """
        ...  # pragma: no cover - abstract

    @abstractmethod
    async def confirm_currency(self) -> CurrencyInfo:
        """Report what the source's corpus is current through.

        Called before ingestion starts (to populate corpus_freshness ahead of
        the actual ingestion run) and after (to confirm currency was correctly
        captured).
        """
        ...  # pragma: no cover - abstract
