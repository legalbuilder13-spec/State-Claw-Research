import type { OpenClawPluginApi } from "../../api.js";

/**
 * R2 JurisdictionLock (rules/R2.JurisdictionLock.md).
 *
 * Hook: before_tool_call (priority: high, after R1). For every kb_* tool
 * call, assert that the `jurisdiction` arg is in TaskSpec.jurisdictions.
 *
 * Tool params are TypeBox-validated at registration time (the kb_* tools
 * declare jurisdiction as a string), but TypeBox can't bind the enum to a
 * runtime-supplied list. This hook closes that gap.
 */
export function registerR2JurisdictionLock(_api: OpenClawPluginApi): void {
  // TODO(phase-4): api.hooks.register("before_tool_call", { priority: 90,
  //   handler: (ctx) => {
  //     if (!ctx.toolName.startsWith("kb_")) return { action: "continue" };
  //     const taskSpec = ctx.runContext.get("agentic-law-os.task-spec");
  //     const jurisdiction = ctx.params?.jurisdiction;
  //     if (typeof jurisdiction !== "string") return { action: "continue" };
  //     if (!taskSpec.jurisdictions.includes(jurisdiction)) {
  //       return { action: "block", reason: `R2: jurisdiction ${jurisdiction} not in locked set ${taskSpec.jurisdictions.join(",")}` };
  //     }
  //     return { action: "continue" };
  //   } });
}
