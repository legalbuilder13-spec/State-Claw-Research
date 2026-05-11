"""SHA-256 hashing helpers.

Used to compute (and verify) the content hashes that flow through
retrieval_log, statute_chunks, regulation_chunks, ledger_entries, and
audit_anchors.
"""

from __future__ import annotations

import hashlib


def sha256_bytes(data: str | bytes) -> bytes:
    """Return the raw 32-byte SHA-256 digest of data.

    Strings are UTF-8 encoded before hashing.
    """
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).digest()


def sha256_hex(data: str | bytes) -> str:
    """Return the 64-char lowercase hex SHA-256 of data."""
    return sha256_bytes(data).hex()


def sha256_prefixed(data: str | bytes) -> str:
    """Return 'sha256:<hex>' (the form used at tool/API boundaries)."""
    return f"sha256:{sha256_hex(data)}"


def verify_hash(data: str | bytes, expected_hex_or_prefixed: str) -> bool:
    """Constant-time-compare data's hash against an expected hex/prefixed value."""
    expected = expected_hex_or_prefixed.removeprefix("sha256:")
    actual = sha256_hex(data)
    # Length check first to avoid surprising results when callers pass garbage.
    if len(expected) != 64:
        return False
    # Use compare_digest for constant-time equality.
    import hmac as _hmac

    return _hmac.compare_digest(actual, expected)
