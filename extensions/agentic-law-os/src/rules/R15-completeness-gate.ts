import type { OpenClawPluginApi } from "../../api.js";

/**
 * R15 CompletenessGate (rules/R15.CompletenessGate.md).
 *
 * Hook: before_agent_finalize. Seven-criterion gate before allowing the
 * Renderer to emit:
 *   1. At least one operative-provision citation per jurisdiction.
 *   2. Definitions section (R9) covered for each jurisdiction.
 *   3. Exemption sections enumerated per jurisdiction (uses statute_chunks.is_exemption_section).
 *   4. Cross-references resolved (R8 trace ledger non-empty).
 *   5. Currency tag present on every citation (R10).
 *   6. Verifier (R5) ran and passed for every anchored quote.
 *   7. Classification overlay (R12) attached.
 *
 * Failure on any criterion → action: "revise" with the missing-criterion list.
 */
export function registerR15CompletenessGate(_api: OpenClawPluginApi): void {
  // TODO(phase-4): aggregate ledger state, run the 7 checks.
}
