import type { Pool } from "pg";

/**
 * Append-only writer for claim_ledgers / ledger_entries (migrations/0001_init.sql).
 *
 * Hash-chain enforcement is at the Postgres trigger layer; this writer just
 * supplies prev_hash + this_hash + claim payload. The trigger rejects writes
 * that don't continue the chain (P0001). claim_ledgers.head_hash auto-
 * propagates from the latest ledger_entries.this_hash.
 *
 * Read path: every R-rule that needs to validate against canonical claims
 * reads from this ledger, not from in-memory sub-agent results — the ledger
 * is the source of truth.
 */
export interface LedgerWriter {
  appendClaim(input: {
    claimLedgerId: string;
    claimPayload: Record<string, unknown>;
    actorSessionId: string;
  }): Promise<{ thisHash: string }>;
}

export function createLedgerWriter(_pool: Pool): LedgerWriter {
  return {
    async appendClaim(_input) {
      // TODO(phase-4): SELECT prev_hash FROM ledger_entries WHERE
      // claim_ledger_id = $1 ORDER BY seq DESC LIMIT 1, then INSERT a new row
      // with prev_hash + computed this_hash = sha256(prev_hash || canonicalize(payload)).
      // The Postgres trigger validates the chain before commit.
      throw new Error("not yet implemented");
    },
  };
}
