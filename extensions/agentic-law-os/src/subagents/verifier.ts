import type { OpenClawPluginApi } from "../../api.js";

/**
 * Verifier sub-agent. Runs R5 HashEcho: for every anchor in the Statute
 * sub-agent's output, calls kb_span_get_by_hash and exact-substring-matches
 * the returned text_normalized against the asserted quote.
 *
 * Failures are returned as a strip-or-revise list. Independent session from
 * Statute sub-agent so the audit trail is clean.
 *
 * Session id: "agent:main:subagent:verifier".
 */
export function registerVerifierSubagent(_api: OpenClawPluginApi): void {
  // TODO(phase-4): api.subagents.register("verifier", { tools:
  //   ["kb_span_get_by_hash"], output_schema: verifierOutputSchema }).
}
