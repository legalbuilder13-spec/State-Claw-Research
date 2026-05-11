"""Runtime configuration.

Loaded from environment variables (with .env fallback for local development).
Validated by Pydantic at start-up; the worker refuses to run with invalid config.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class IngestionConfig(BaseSettings):
    """All runtime configuration for the ingestion worker."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="",
        extra="ignore",
    )

    # ---- Database ----
    database_url: SecretStr = Field(
        ...,
        description="Postgres connection string. Include ?sslmode=require for Railway.",
    )

    # ---- Voyage AI ----
    voyage_api_key: SecretStr = Field(
        ..., description="Voyage AI key for voyage-law-2 embeddings."
    )
    voyage_embedding_model: str = Field(
        default="voyage-law-2", description="Embedding model identifier."
    )
    voyage_rerank_model: str = Field(
        default="rerank-2", description="Reranker model identifier."
    )

    # ---- Ingestion behavior ----
    ingestion_parallelism: int = Field(
        default=4, ge=1, le=32, description="Max concurrent documents."
    )
    ingestion_embedding_batch_size: int = Field(
        default=64, ge=1, le=256, description="Batch size for embedding API calls."
    )
    ingestion_use_reducto_fallback: bool = Field(
        default=False, description="Fall back to Reducto when Docling fails."
    )
    reducto_api_key: SecretStr | None = Field(
        default=None, description="Required only when reducto fallback is enabled."
    )

    # ---- Source profiles ----
    source_profiles_path: Path = Field(
        default=Path("../../source-profiles"),
        description="Path to source-profiles directory (relative to worker cwd or absolute).",
    )

    # ---- Observability ----
    ingestion_log_level: str = Field(default="INFO")
    sentry_dsn: SecretStr | None = Field(default=None)

    # ---- Scraping ----
    playwright_headless: bool = Field(default=True)
    playwright_timeout_ms: int = Field(default=60_000, ge=1_000, le=600_000)
    scraper_user_agent: str = Field(
        default="agentic-law-os/ingestion (legal research; contact: <set me>)"
    )

    # ---- Chunking ----
    chunk_target_chars: int = Field(default=2_500, ge=500, le=10_000)
    chunk_overlap_chars: int = Field(default=200, ge=0, le=1_000)


_singleton: IngestionConfig | None = None


def get_config() -> IngestionConfig:
    """Return the process-singleton config. Loaded lazily so import is cheap."""
    global _singleton
    if _singleton is None:
        _singleton = IngestionConfig()
    return _singleton
