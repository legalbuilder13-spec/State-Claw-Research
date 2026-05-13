import type { OpenClawPluginApi } from "../../api.js";

/**
 * R11 LowConfidenceGate (rules/R11.LowConfidenceGate.md).
 *
 * Hook: before_agent_finalize. Reads confidence_results from the
 * Confidence sub-agent. Below the threshold (default 0.6 — operator-tunable
 * via plugin config), the gate forces output_type → "incomplete_notice"
 * instead of "slack_response", and the Renderer emits a structured
 * "Insufficient confidence" deliverable rather than the normal answer.
 */
export function registerR11LowConfidenceGate(_api: OpenClawPluginApi): void {
  // TODO(phase-4): read confidence from run context, mutate output_type.
}
