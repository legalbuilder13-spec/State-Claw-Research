import type { OpenClawPluginApi } from "../../api.js";

/**
 * R1 SourceAllowlist (rules/R1.SourceAllowlist.md).
 *
 * Hook: before_tool_call (priority: highest). For every kb_* tool call, look
 * up the active source profile (TaskSpec.source_profile) and reject if the
 * tool's target source is not in that profile's allowlist.
 *
 * Profile B (Lexis-free, default) allows:
 *   - leginfo.legislature.ca.gov, oal.ca.gov, justia.com, law.cornell.edu,
 *     courtlistener.com, scholar.google.com, casetext.com (read-only).
 *
 * Profile A (Lexis) additionally allows lexis.com / Lexis API endpoints.
 *
 * Law-firm blogs and vendor sites are NEVER citable — see R14.
 */
export function registerR1SourceAllowlist(_api: OpenClawPluginApi): void {
  // TODO(phase-4): api.hooks.register("before_tool_call", { priority: 100,
  //   handler: (ctx) => {
  //     if (!ctx.toolName.startsWith("kb_")) return { action: "continue" };
  //     const taskSpec = ctx.runContext.get("agentic-law-os.task-spec");
  //     const profile = loadSourceProfile(taskSpec.source_profile);
  //     const target = inferSourceTargetFromToolCall(ctx.toolName, ctx.params);
  //     if (!profile.allowlist.includes(target)) {
  //       return { action: "block", reason: `R1: source ${target} not in profile ${profile.id}` };
  //     }
  //     return { action: "continue" };
  //   } });
}
