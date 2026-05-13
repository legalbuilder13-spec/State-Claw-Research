import type { OpenClawPluginApi } from "../../api.js";
import { registerR1SourceAllowlist } from "./R1-source-allowlist.js";
import { registerR2JurisdictionLock } from "./R2-jurisdiction-lock.js";
import { registerR4QuotingRule } from "./R4-quoting.js";
import { registerR5HashEcho } from "./R5-hash-echo.js";
import { registerR6PinpointCite } from "./R6-pinpoint-cite.js";
import { registerR10CurrencyTag } from "./R10-currency-tag.js";
import { registerR11LowConfidenceGate } from "./R11-low-confidence-gate.js";
import { registerR12ClassificationOverlay } from "./R12-classification-overlay.js";
import { registerR13VerifyFlagCap } from "./R13-verify-flag-cap.js";
import { registerR14NoLawFirmCitation } from "./R14-no-law-firm-citation.js";
import { registerR15CompletenessGate } from "./R15-completeness-gate.js";

/**
 * Phase 4 rule engine. Eleven blocking rules ship in this phase; R3, R7, R8,
 * R9 plus W1-W4 land in Phase 5 per PRD §17.
 *
 * Hook ordering matters: on `before_tool_call`, R1 (source allowlist) must
 * fire before R2 (jurisdiction lock) so a blocked-source call is rejected
 * before we waste cycles validating its jurisdiction arg.
 */
export function registerRuleEngine(api: OpenClawPluginApi): void {
  registerR1SourceAllowlist(api);
  registerR2JurisdictionLock(api);
  registerR4QuotingRule(api);
  registerR5HashEcho(api);
  registerR6PinpointCite(api);
  registerR10CurrencyTag(api);
  registerR11LowConfidenceGate(api);
  registerR12ClassificationOverlay(api);
  registerR13VerifyFlagCap(api);
  registerR14NoLawFirmCitation(api);
  registerR15CompletenessGate(api);
}
