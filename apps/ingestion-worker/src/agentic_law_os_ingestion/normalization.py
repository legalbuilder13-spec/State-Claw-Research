"""Text normalization.

Used both at ingest time (the `text_normalized` column in statute_chunks /
regulation_chunks) and at verification time (R5 HashEcho's substring match
runs against normalized text on both sides).

The normalization is intentionally conservative: whitespace and Unicode form
only. Case and punctuation are preserved — legal text is read for every
character.
"""

from __future__ import annotations

import re
import unicodedata

# Smart quotes / dashes / non-breaking spaces — common in scraped HTML and
# OCR output. Normalize to ASCII equivalents so anchored quotes compare cleanly.
_SMART_TO_ASCII: dict[str, str] = {
    "‘": "'",   # left single quotation mark
    "’": "'",   # right single quotation mark
    "‚": "'",   # single low-9 quotation mark
    "‛": "'",   # single high-reversed-9 quotation mark
    "“": '"',   # left double quotation mark
    "”": '"',   # right double quotation mark
    "„": '"',   # double low-9 quotation mark
    "‟": '"',   # double high-reversed-9 quotation mark
    "–": "-",   # en dash
    "—": "-",   # em dash
    "−": "-",   # minus sign
    " ": " ",   # no-break space
    " ": " ",   # line separator
    " ": " ",   # paragraph separator
    "​": "",    # zero-width space
    "‌": "",    # zero-width non-joiner
    "‍": "",    # zero-width joiner
    "﻿": "",    # BOM / zero-width no-break space
}

_SMART_TRANS = str.maketrans(_SMART_TO_ASCII)
_WS_RUN = re.compile(r"\s+")
_LEAD_TRAIL = re.compile(r"^[\s ]+|[\s ]+$")


def normalize(text: str) -> str:
    """Normalize legal text for R5 comparison and DB storage.

    - Apply Unicode NFC.
    - Replace smart quotes / dashes / non-breaking spaces with ASCII equivalents.
    - Collapse runs of whitespace to a single space.
    - Trim leading and trailing whitespace.

    Case and punctuation are preserved.
    """
    if not text:
        return ""
    # 1. Unicode NFC normalization.
    text = unicodedata.normalize("NFC", text)
    # 2. Smart-character → ASCII replacements.
    text = text.translate(_SMART_TRANS)
    # 3. Collapse whitespace runs.
    text = _WS_RUN.sub(" ", text)
    # 4. Trim.
    text = _LEAD_TRAIL.sub("", text)
    return text


def is_substring_after_normalization(needle: str, haystack: str) -> bool:
    """Return True iff normalize(needle) is a substring of normalize(haystack).

    Used by R5 HashEcho's asserted-text-vs-fetched-span check.
    """
    return normalize(needle) in normalize(haystack)
