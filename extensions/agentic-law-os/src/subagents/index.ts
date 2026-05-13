import type { OpenClawPluginApi } from "../../api.js";
import { registerConfidenceSubagent } from "./confidence.js";
import { registerRendererSubagent } from "./renderer.js";
import { registerStatuteSubagent } from "./statute.js";
import { registerVerifierSubagent } from "./verifier.js";

/**
 * Phase 4 sub-agents. Critic + Classification land in Phase 5 per PRD §17.
 *
 * Each sub-agent is a separately-prompted run via api.runtime.subagent.run()
 * with its own session id under "agent:main:subagent:<role>". The orchestrator
 * dispatches; sub-agents emit claim payloads back to the orchestrator, which
 * writes them into the ledger.
 */
export function registerSubagents(api: OpenClawPluginApi): void {
  registerStatuteSubagent(api);
  registerVerifierSubagent(api);
  registerConfidenceSubagent(api);
  registerRendererSubagent(api);
}
