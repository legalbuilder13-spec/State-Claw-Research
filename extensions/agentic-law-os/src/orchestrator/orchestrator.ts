import type { OpenClawPluginApi } from "../../api.js";

/**
 * Orchestrator: 11-layer plan builder + claim-ledger writer + sub-agent
 * dispatcher. Reads the frozen TaskSpec from run context and produces the
 * structured plan the sub-agents execute against.
 *
 * Plan layers (PRD §6, "Research methodology Parts I-XIV"):
 *   1. Definitions sweep   — R9 DefinitionsFirst
 *   2. Operative provision — Statute sub-agent
 *   3. Cross-references    — R8 CrossRefTrace
 *   4. Exemptions          — R15 CompletenessGate (exemption coverage)
 *   5. Delegated authority — R7 RegSearchOnDelegation
 *   6. Currency tag        — R10 CurrencyTag
 *   7. Pinpoint citations  — R6 PinpointCite
 *   8. Verifier pass       — R5 HashEcho via Verifier sub-agent
 *   9. Critic pass         — R3/R4 re-check via Critic sub-agent (Phase 5)
 *  10. Confidence rating   — R11 LowConfidenceGate
 *  11. Render              — R12 ClassificationOverlay + R14 NoLawFirmCitation
 *
 * Each sub-agent dispatch goes through api.runtime.subagent.run(...) with a
 * dedicated session id ("agent:main:subagent:<role>"). Every claim emitted by
 * a sub-agent gets a row in claim_ledger.ledger_entries (hash-chained, append-
 * only — see migrations/0001_init.sql). The orchestrator owns the ledger
 * write; sub-agents emit claim payloads.
 */
export function registerOrchestrator(_api: OpenClawPluginApi): void {
  // TODO(phase-4): hook on `before_agent_run` to attach the plan to run
  // context. Plan execution is iterative: the orchestrator receives sub-agent
  // results, writes claims to the ledger, and decides the next dispatch based
  // on R7/R8/R15 gates.
}
