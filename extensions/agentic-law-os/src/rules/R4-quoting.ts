import type { OpenClawPluginApi } from "../../api.js";

/**
 * R4 QuotingRule (rules/R4.QuotingRule.md).
 *
 * Hook: before_agent_finalize. Every quoted span in the draft must be
 * anchored to a hash returned by kb_statutes_search/kb_statutes_get this
 * session. Verifier sub-agent (R5) re-fetches and exact-substring-matches.
 *
 * On quote without anchor → action: "revise" with a precise instruction
 * naming the offending quote.
 */
export function registerR4QuotingRule(_api: OpenClawPluginApi): void {
  // TODO(phase-4): walk draft for `"..."` spans, look up each in
  // retrieval_log filtered by current claim_ledger_id; reject any span
  // whose hash isn't present.
}
