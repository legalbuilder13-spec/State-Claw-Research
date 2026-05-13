import type { OpenClawPluginApi } from "../../api.js";

/**
 * R5 HashEcho (rules/R5.HashEcho.md).
 *
 * Sub-agent driven, not a hook. The Verifier sub-agent (src/subagents/verifier.ts)
 * iterates every anchor in the draft, calls kb_span_get_by_hash, and runs
 * exact-substring-match against the asserted quote (text_normalized vs.
 * normalized quote text).
 *
 * Failed anchors are stripped or returned to the orchestrator as "revise"
 * with the anchor → expected vs. got diff. This module exposes the
 * verification routine for the Verifier sub-agent to call; the hook
 * registration is a no-op (kept for symmetry with the rest of the engine).
 */
export function registerR5HashEcho(_api: OpenClawPluginApi): void {
  // R5 enforcement happens inside the Verifier sub-agent loop, not via hook.
}
