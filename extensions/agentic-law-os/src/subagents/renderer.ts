import type { OpenClawPluginApi } from "../../api.js";

/**
 * Renderer sub-agent. Loads the appropriate template from
 * company-context/deliverable-templates/ based on TaskSpec.output_type:
 *   - slack_response       → slack-response.md
 *   - memo                 → memo.md (Phase 6)
 *   - chart                → chart.md (Phase 6)
 *   - research_trail       → research-trail.md
 *   - incomplete_notice    → incomplete-notice.md (R11/R13/R15-driven)
 *
 * Renders the final deliverable from claim ledger contents + classification
 * overlay (R12) + freshness tags (R10). Output is what message_sending hooks
 * (R6, R14) see for last-mile validation.
 *
 * Session id: "agent:main:subagent:renderer".
 */
export function registerRendererSubagent(_api: OpenClawPluginApi): void {
  // TODO(phase-4): api.subagents.register("renderer", { tools: [],
  //   output_schema: deliverableSchema }).
}
