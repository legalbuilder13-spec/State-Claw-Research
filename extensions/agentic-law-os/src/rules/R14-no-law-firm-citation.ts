import type { OpenClawPluginApi } from "../../api.js";

/**
 * R14 NoLawFirmCitation (rules/R14.NoLawFirmCitation.md).
 *
 * Hook: message_sending. Filters citations by source category. Only
 * primary-source categories (statute, regulation, case_opinion, agency_guidance,
 * official_form) survive into the rendered output. Law-firm blogs, treatises,
 * vendor sites, and secondary-source URLs are stripped — they may have
 * informed retrieval, but they may not appear in the citation list.
 *
 * The source-category enum lives in schemas/source-categories.schema.json.
 */
export function registerR14NoLawFirmCitation(_api: OpenClawPluginApi): void {
  // TODO(phase-4): walk citations array, filter by source_category enum.
}
