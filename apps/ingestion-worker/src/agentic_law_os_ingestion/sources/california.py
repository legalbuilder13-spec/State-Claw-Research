"""California statute + admin-code source.

Pulls from leginfo.legislature.ca.gov (the official source per PRD §13).

The site uses JSF-rendered HTML with javascript-driven TOC navigation, so
this Source uses Playwright to enumerate sections within a chapter and
direct httpx fetches for individual section content (the section pages
themselves are static once rendered).

URL pattern (post-render):
  https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=LAB&sectionNum=2775

This v1 scaffold:
- Enumerates Labor Code Chapter 2 (§§ 2750–2787 — IC classification + ABC test)
  as the bootstrap chapter. PRD §17 Phase 2 done-criterion calls for
  California statute corpus searchable in Postgres.
- Provides extension hooks for additional chapters via _CHAPTER_REGISTRY.

Expanding to the full CA Labor Code is a Phase 2+/Phase 6 task; the
infrastructure here scales without further architecture changes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import AsyncIterator

import httpx

from agentic_law_os_ingestion.config import get_config
from agentic_law_os_ingestion.logging import get_logger
from agentic_law_os_ingestion.sources.base import (
    CurrencyInfo,
    IngestionScope,
    RawDocument,
    Source,
)

_logger = get_logger(__name__)

_LEGINFO_BASE = "https://leginfo.legislature.ca.gov"
_SECTION_URL = (
    _LEGINFO_BASE + "/faces/codes_displaySection.xhtml?lawCode={code}&sectionNum={section}"
)


@dataclass(slots=True)
class _ChapterScope:
    """A chapter we know how to enumerate.

    `section_range` is the inclusive integer range fetched from leginfo.
    `extra_sections` carries decimal-numbered sections (e.g., "226.8",
    "2810.3") that fall outside the integer iteration but belong to the
    same chapter; leginfo addresses them by their full string section
    number.
    """

    code: str                            # 'LAB' (Labor Code; URL parameter)
    code_bluebook: str                   # 'Lab.' (Bluebook abbreviation; for the corpus row)
    chapter_label: str                   # 'Division 3 Part 1 Chapter 2'
    section_range: tuple[int, int]       # inclusive section number range, e.g. (2750, 2787)
    extra_sections: tuple[str, ...] = ()                                  # decimal-numbered sections
    definitions_sections: set[int] = field(default_factory=set)
    exemption_sections: set[int] = field(default_factory=set)


# Registry of chapters this source knows how to enumerate.
# Operators / contributors expand by adding entries here.
_CHAPTER_REGISTRY: dict[str, _ChapterScope] = {
    # CA Labor Code Division 3, Part 1, Chapter 2 — IC classification (AB5).
    # Definitions are typically at the top of the chapter; the exemption
    # block (§ 2776 onward + § 2783) carves out specific occupations.
    "Lab. Code Division 3 Part 1 Chapter 2": _ChapterScope(
        code="LAB",
        code_bluebook="Lab.",
        chapter_label="Division 3 Part 1 Chapter 2",
        section_range=(2750, 2787),
        definitions_sections=set(range(2750, 2774)),    # §§ 2750–2773
        exemption_sections={2776, 2777, 2778, 2779, 2780, 2781, 2782, 2783, 2784, 2785},
    ),

    # CA Labor Code Division 2, Part 1, Chapter 1 — Payment of Wages.
    # Wage definition (§§ 200-204), wage statement requirements (§ 226),
    # itemized statements, frequency of payment, deductions. Adjacent to
    # IC analysis via joint-employer doctrines and wage-and-hour exposure.
    "Lab. Code Division 2 Part 1 Chapter 1 (Payment of Wages)": _ChapterScope(
        code="LAB",
        code_bluebook="Lab.",
        chapter_label="Division 2 Part 1 Chapter 1",
        section_range=(200, 245),
        extra_sections=("226.2", "226.3", "226.7", "226.8"),  # decimal-numbered sections in this chapter
        # §§ 200-204 are the wage / labor / wages / payment definitions.
        definitions_sections=set(range(200, 205)),
        exemption_sections=set(),
    ),

    # CA Labor Code Division 3, Part 1, Chapter 1 (Employer / Employee
    # general provisions, §§ 2700-2749) — the broader chapter that
    # contains the common-law-agency-adjacent provisions immediately
    # preceding our Chapter 2 ABC test work. Worth ingesting for R8
    # cross-reference resolution into Chapter 2.
    "Lab. Code Division 3 Part 1 Chapter 1 (General Provisions)": _ChapterScope(
        code="LAB",
        code_bluebook="Lab.",
        chapter_label="Division 3 Part 1 Chapter 1",
        section_range=(2700, 2749),
        definitions_sections={2700, 2701, 2702, 2703, 2704, 2705, 2706, 2707, 2708, 2709, 2710},
        exemption_sections=set(),
    ),

    # Discrete operative sections outside the chapter blocks above but
    # frequently referenced in IC classification / joint-employer analysis.
    # Modeled as a synthetic single-section "chapter" each so they can be
    # filtered / referenced cleanly.

    # § 226.8 — Willful misclassification penalty (operative for R12 risk-taxonomy
    # .control_indicators.behavioral_control + .relationship_indicators).
    # Already included via Division 2 Part 1 Chapter 1's extra_sections, but
    # also exposed as its own synthetic chapter for chapter_filter targeting.

    # § 2810.3 — Client-employer joint liability for wage-and-hour violations
    # (the R7 / joint_employer canonical test case in CA).
    "Lab. Code Joint Liability (§ 2810.3)": _ChapterScope(
        code="LAB",
        code_bluebook="Lab.",
        chapter_label="Division 2 Part 3.7 Chapter 1",
        section_range=(2810, 2810),
        extra_sections=("2810.3", "2810.5", "2810.6", "2810.7"),
        # § 2810.5 contains a delegation clause ('the Labor Commissioner shall
        # adopt regulations...') — the canonical R7 RegSearchOnDelegation
        # detection case for our test corpus.
        definitions_sections=set(),
        exemption_sections=set(),
    ),
}


class CaliforniaSource(Source):
    """California (`US-CA`) primary statute + regulation source."""

    jurisdiction = "US-CA"
    source_id = "local_corpus_state_official"
    source_category = "primary_statute"

    def __init__(self) -> None:
        cfg = get_config()
        self._http = httpx.AsyncClient(
            base_url=_LEGINFO_BASE,
            timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0),
            headers={"User-Agent": cfg.scraper_user_agent, "Accept": "text/html,application/xhtml+xml"},
            follow_redirects=True,
            http2=True,
        )

    async def __aenter__(self) -> "CaliforniaSource":
        return self

    async def __aexit__(self, *exc) -> None:
        await self._http.aclose()

    async def iter_documents(
        self, scope: IngestionScope
    ) -> AsyncIterator[RawDocument]:
        """Yield documents for each section in scope.

        v1: enumerates chapters from _CHAPTER_REGISTRY. If scope.chapter_filter
        is set, only that chapter is enumerated; otherwise every registered
        chapter is enumerated.

        Phase 2+: extend to dynamic TOC discovery via Playwright when the
        registry doesn't cover the requested chapter.
        """
        if scope.kind != "primary_statute":
            raise NotImplementedError(
                "CaliforniaSource v1 supports primary_statute only; "
                "primary_regulation is a Phase 2+ deliverable."
            )

        chapters_to_enumerate: list[_ChapterScope] = []
        if scope.chapter_filter:
            if scope.chapter_filter in _CHAPTER_REGISTRY:
                chapters_to_enumerate = [_CHAPTER_REGISTRY[scope.chapter_filter]]
            else:
                raise KeyError(
                    f"Chapter {scope.chapter_filter!r} not in CaliforniaSource registry. "
                    f"Registered: {list(_CHAPTER_REGISTRY)}"
                )
        else:
            chapters_to_enumerate = list(_CHAPTER_REGISTRY.values())

        for chapter in chapters_to_enumerate:
            async for doc in self._enumerate_chapter(chapter, scope):
                yield doc

    async def _enumerate_chapter(
        self, chapter: _ChapterScope, scope: IngestionScope
    ) -> AsyncIterator[RawDocument]:
        """Enumerate sections within a known chapter.

        Yields every integer section in the chapter's section_range plus every
        decimal-numbered section in chapter.extra_sections. Section-filter is
        applied if scope.section_filter is set.
        """
        section_filter = scope.section_filter

        # Build the full ordered list of section IDs to fetch.
        integer_sections = [str(n) for n in range(chapter.section_range[0], chapter.section_range[1] + 1)]
        section_ids: list[str] = integer_sections + list(chapter.extra_sections)

        for sec_str in section_ids:
            if section_filter and sec_str != section_filter:
                continue

            url = _SECTION_URL.format(code=chapter.code, section=sec_str)
            try:
                resp = await self._http.get(url)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                _logger.warning(
                    "california.fetch_failed", section=sec_str, url=url, error=str(exc)
                )
                continue

            html = resp.text
            if not html or "section does not exist" in html.lower():
                # Some section numbers in the registered range are reserved /
                # repealed; skip silently.
                continue

            # Structural flags. Integer sections check against the
            # definitions/exemption sets; decimal sections (extra_sections)
            # default to operative unless overridden in the registry.
            is_def = False
            is_exempt = False
            try:
                sec_int = int(sec_str)
                is_def = sec_int in chapter.definitions_sections
                is_exempt = sec_int in chapter.exemption_sections
            except ValueError:
                # Decimal-numbered section (e.g., "226.8"). Default to operative.
                pass

            yield RawDocument(
                source_id=self.source_id,
                source_category="primary_statute",
                source_url=url,
                doc_id=f"primary_statute:us-ca:ca-lab-{sec_str}",
                jurisdiction=self.jurisdiction,
                code=chapter.code_bluebook,
                chapter_id=chapter.chapter_label,
                section=sec_str,
                is_definitions_section=is_def,
                is_exemption_section=is_exempt,
                is_operative_section=(not is_def and not is_exempt),
                raw_html=html,
                current_through=date.today(),   # TODO: parse leginfo's "current as of" footer
            )

    async def confirm_currency(self) -> CurrencyInfo:
        """Report what CA's leginfo says about its corpus currency.

        Today's implementation reports today's date; a Phase 2+ refinement
        scrapes leginfo's "Code current as of <date>" footer and uses that.
        """
        return CurrencyInfo(
            jurisdiction=self.jurisdiction,
            source_kind=self.source_category,
            current_through=date.today(),
            canonical_source_url=_LEGINFO_BASE,
            notes=(
                "CaliforniaSource v1 reports today's date as current_through; "
                "leginfo's actual 'current as of' footer parsing is a Phase 2+ refinement."
            ),
        )
