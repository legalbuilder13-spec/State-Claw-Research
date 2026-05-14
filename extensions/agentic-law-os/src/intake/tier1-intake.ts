import type { OpenClawPluginApi } from "../../api.js";

/**
 * Tier-1 intake: subscribes to the inbound message stream, builds a TaskSpec,
 * freezes it, and attaches it to the run context for the orchestrator and
 * sub-agents to read.
 *
 * Hook plan (per docs/legal/PLUGIN-SDK-NOTES.md §3 + PRD §17 Phase 4):
 *   - on `message_received` / `inbound_claim`:
 *       1. Parse requester message + channel envelope.
 *       2. Infer jurisdictions (or fall back to plugin config default).
 *       3. Choose source_profile (or fall back to plugin config default).
 *       4. Hash the company-context pack at company_context_ref.path → version_hash.
 *       5. Construct TaskSpec, validate against taskSpecSchema, freeze.
 *       6. Attach as run-context value under key "agentic-law-os.task-spec".
 *
 * Every downstream rule reads the TaskSpec from run context. R2 JurisdictionLock
 * binds tool-call jurisdiction args against TaskSpec.jurisdictions; R10 reads
 * requires_fresh; R12 reads topic to choose the classification overlay; etc.
 */
export function registerTier1Intake(_api: OpenClawPluginApi): void {
  // TODO(phase-4): wire api.hooks.register("message_received", ...) once the
  // intake builder is implemented. Building the TaskSpec is non-trivial:
  // jurisdiction inference may need a sub-agent call against the requester
  // message, and the company-context content hash needs a streaming SHA-256
  // over every file under company_context_path.
}
