"""Structure-aware chunker.

Takes a fully-parsed statute / regulation section and splits it into
embedding-sized chunks while preserving:
- section + subdivision boundaries (never split across a subdivision)
- definitions vs. operative classification (set by the source parser)
- char_start / char_end offsets into the section's text
- chunk_index / chunk_total for downstream R4 anchor resolution

This file is the ingestion-worker counterpart of R4's anchor model. Every
chunk's (doc_id, char_start, char_end, hash) tuple is what later becomes the
R4 anchor.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from agentic_law_os_ingestion.config import get_config
from agentic_law_os_ingestion.hashing import sha256_bytes
from agentic_law_os_ingestion.normalization import normalize


@dataclass(slots=True)
class TextChunk:
    """A single chunk ready for DB insertion."""

    text: str
    text_normalized: str
    hash: bytes
    chunk_index: int
    chunk_total: int
    char_start: int
    char_end: int


# Section/subdivision boundaries we try not to split across.
_SUBDIVISION_RE = re.compile(r"\n(?=\s*\([a-zA-Z0-9]+\))")
_PARAGRAPH_RE = re.compile(r"\n\s*\n")


def chunk_section(section_text: str) -> list[TextChunk]:
    """Split a section's text into embedding-sized chunks with overlap.

    Strategy:
    1. Try to split on subdivision boundaries (`\n(a)`, `\n(1)`, etc.).
    2. If any resulting chunk exceeds target_chars, fall back to paragraph splits.
    3. If any chunk still exceeds target_chars, fall back to char-window splits with overlap.

    Each chunk's char_start / char_end are offsets into the ORIGINAL
    section_text — these are what R4 anchors resolve against.
    """
    cfg = get_config()
    target = cfg.chunk_target_chars
    overlap = cfg.chunk_overlap_chars

    if not section_text:
        return []

    # Single-chunk fast path: section is small enough to embed whole.
    if len(section_text) <= target:
        return [
            TextChunk(
                text=section_text,
                text_normalized=normalize(section_text),
                hash=sha256_bytes(section_text),
                chunk_index=0,
                chunk_total=1,
                char_start=0,
                char_end=len(section_text),
            )
        ]

    # Compute candidate boundaries.
    boundaries = _candidate_boundaries(section_text, target)

    # Build chunks with overlap.
    chunks: list[tuple[int, int]] = []  # (start, end) offsets
    prev_end = 0
    for boundary in boundaries:
        start = max(0, prev_end - overlap) if prev_end > 0 else 0
        end = boundary
        if end - start <= 0:
            continue
        chunks.append((start, end))
        prev_end = end

    # Trailing chunk
    if prev_end < len(section_text):
        start = max(0, prev_end - overlap)
        chunks.append((start, len(section_text)))

    total = len(chunks)
    result: list[TextChunk] = []
    for i, (start, end) in enumerate(chunks):
        text = section_text[start:end]
        result.append(
            TextChunk(
                text=text,
                text_normalized=normalize(text),
                hash=sha256_bytes(text),
                chunk_index=i,
                chunk_total=total,
                char_start=start,
                char_end=end,
            )
        )
    return result


def _candidate_boundaries(text: str, target: int) -> list[int]:
    """Find char offsets where we'd prefer to split, respecting structure."""
    boundaries: list[int] = []
    cursor = 0

    while cursor < len(text):
        # Look for a subdivision boundary within target chars.
        window_end = min(cursor + target, len(text))
        window = text[cursor:window_end]

        # Prefer subdivision boundary.
        sub_matches = list(_SUBDIVISION_RE.finditer(window))
        if sub_matches:
            last = sub_matches[-1]
            boundary = cursor + last.start()
            if boundary > cursor:
                boundaries.append(boundary)
                cursor = boundary
                continue

        # Fall back to paragraph boundary.
        para_matches = list(_PARAGRAPH_RE.finditer(window))
        if para_matches:
            last = para_matches[-1]
            boundary = cursor + last.end()
            boundaries.append(boundary)
            cursor = boundary
            continue

        # Hard char-window cut if neither structure boundary worked.
        cursor = window_end
        boundaries.append(cursor)

    return boundaries
