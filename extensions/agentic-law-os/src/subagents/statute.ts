import type { OpenClawPluginApi } from "../../api.js";

/**
 * Statute sub-agent. Loads skills/statute-research/SKILL.md as its system
 * prompt. Calls kb_statutes_search → kb_statutes_get against the locked
 * jurisdiction. Emits structured StatuteFinding claims (one per cited
 * subdivision) into the orchestrator's collector.
 *
 * Session id: "agent:main:subagent:statute".
 */
export function registerStatuteSubagent(_api: OpenClawPluginApi): void {
  // TODO(phase-4): api.subagents.register("statute", { systemPromptPath:
  //   "skills/statute-research/SKILL.md", tools: ["kb_statutes_search",
  //   "kb_statutes_get", "kb_statutes_effective_date_for"] }).
}
