"""Agentic-Law-OS ingestion worker.

Ingests statute and admin-code text from official state sources into the
corpus tables that the runtime queries. Separate Railway service from the
OpenClaw runtime; communicates via Postgres only.
"""

__version__ = "0.1.0"
