import type { OpenClawPluginApi } from "../../api.js";

/**
 * Confidence sub-agent. Rule-based, ~50 lines. Inputs: claim ledger
 * snapshot for current run, Verifier results, Critic results (if Phase 5
 * is live), R15 gate state. Output: confidence_score in [0, 1] keyed by
 * deliverable section.
 *
 * Heuristic v1 (PRD §7 R11):
 *   - 1.0 baseline.
 *   - -0.2 per jurisdiction with < 1 cited operative provision.
 *   - -0.1 per W-warning fired (W1-W4).
 *   - -0.3 if any Verifier anchor failed.
 *   - -0.4 if any Critic flag fired (Phase 5).
 *   - clamp to [0, 1].
 *
 * Below the R11 threshold → R11 promotes the deliverable to incomplete_notice.
 *
 * Session id: "agent:main:subagent:confidence".
 */
export function registerConfidenceSubagent(_api: OpenClawPluginApi): void {
  // TODO(phase-4): rule-based scorer; no LLM call needed.
}
