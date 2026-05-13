import type { OpenClawPluginApi } from "../../api.js";

/**
 * R13 VerifyFlagCap (rules/R13.VerifyFlagCap.md).
 *
 * Hook: before_agent_finalize. The Drafter may emit at most 3 "verify"
 * flags per deliverable. Beyond 3, the answer is too uncertain to ship —
 * promote to incomplete_notice and surface the verify queue separately.
 */
export function registerR13VerifyFlagCap(_api: OpenClawPluginApi): void {
  // TODO(phase-4): count "verify" flags in claim ledger for current run;
  // if > 3, mutate output_type → incomplete_notice.
}
