import type { OpenClawPluginApi } from "../../api.js";

/**
 * R6 PinpointCite (rules/R6.PinpointCite.md).
 *
 * Hook: message_sending (last-mile). Every substantive claim in the draft
 * must cite a code title + section + subdivision (e.g., "Cal. Lab. Code
 * § 2775(b)(2)(A)"). Bare "Section 2775" or "the Labor Code" is rejected.
 *
 * Validator: regex over the rendered output for citation patterns; reject
 * if any sentence ending in a factual claim is missing a pinpoint.
 */
export function registerR6PinpointCite(_api: OpenClawPluginApi): void {
  // TODO(phase-4): regex /\b\w+\.\s+(?:Code|Stat\.?|Lab\.?|Civ\.?|Bus\.?\s+&\s+Prof\.?)\s+§\s*\d+(?:\.\d+)?(?:\([a-z]\))?(?:\(\d+\))?(?:\([A-Z]\))?/i;
  // for each fact-bearing sentence, require at least one match.
}
