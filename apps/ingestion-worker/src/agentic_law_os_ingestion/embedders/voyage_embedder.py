"""Voyage AI embedder.

Wraps voyageai's client to embed batches of text using voyage-law-2 (1024 dim).
Handles retry on rate limits and surfaces costs via structured logs.
"""

from __future__ import annotations

import asyncio
from typing import Sequence

from agentic_law_os_ingestion.config import get_config
from agentic_law_os_ingestion.logging import get_logger

_logger = get_logger(__name__)


class VoyageEmbedder:
    """Batched Voyage embedding client."""

    def __init__(self) -> None:
        self._client = None

    def _ensure_client(self):
        if self._client is None:
            try:
                import voyageai  # type: ignore[import]
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError("voyageai is not installed") from exc
            cfg = get_config()
            self._client = voyageai.AsyncClient(api_key=cfg.voyage_api_key.get_secret_value())
        return self._client

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        """Embed a batch of texts. Returns one 1024-dim vector per input."""
        if not texts:
            return []
        cfg = get_config()
        client = self._ensure_client()
        batch_size = cfg.ingestion_embedding_batch_size
        result: list[list[float]] = []
        for start in range(0, len(texts), batch_size):
            batch = list(texts[start : start + batch_size])
            attempt = 0
            while True:
                try:
                    resp = await client.embed(
                        texts=batch,
                        model=cfg.voyage_embedding_model,
                        input_type="document",
                    )
                    result.extend(resp.embeddings)
                    _logger.info(
                        "voyage.embed_batch_ok",
                        batch_size=len(batch),
                        model=cfg.voyage_embedding_model,
                        total_tokens=getattr(resp, "total_tokens", None),
                    )
                    break
                except Exception as exc:
                    attempt += 1
                    if attempt >= 5:
                        _logger.error(
                            "voyage.embed_batch_failed", error=str(exc), batch_size=len(batch)
                        )
                        raise
                    backoff = min(60.0, 2.0**attempt)
                    _logger.warning(
                        "voyage.embed_batch_retry",
                        attempt=attempt,
                        backoff_seconds=backoff,
                        error=str(exc),
                    )
                    await asyncio.sleep(backoff)
        return result
