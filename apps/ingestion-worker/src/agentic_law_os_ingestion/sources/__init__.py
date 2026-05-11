"""Per-jurisdiction source implementations.

Each source implements the Source ABC in `base.py`. v1 ships:
- CaliforniaSource (leginfo.legislature.ca.gov)

Add new sources by creating `<jurisdiction>.py` exporting a Source subclass
and registering it in `_REGISTRY` below.
"""

from __future__ import annotations

from agentic_law_os_ingestion.sources.base import Source
from agentic_law_os_ingestion.sources.california import CaliforniaSource

_REGISTRY: dict[str, type[Source]] = {
    "US-CA": CaliforniaSource,
    # Add new jurisdictions here as they're implemented.
}


def get_source_for_jurisdiction(jurisdiction: str) -> type[Source]:
    """Return the Source class for a jurisdiction.

    Raises KeyError with a helpful message when no source is registered.
    """
    try:
        return _REGISTRY[jurisdiction]
    except KeyError as exc:
        registered = ", ".join(sorted(_REGISTRY)) or "(none)"
        raise KeyError(
            f"No Source registered for jurisdiction {jurisdiction!r}. "
            f"Registered: {registered}. "
            f"Add an implementation at agentic_law_os_ingestion/sources/<state>.py."
        ) from exc


__all__ = ["Source", "get_source_for_jurisdiction"]
