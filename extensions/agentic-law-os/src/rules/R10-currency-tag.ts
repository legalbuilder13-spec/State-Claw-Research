import type { OpenClawPluginApi } from "../../api.js";

/**
 * R10 CurrencyTag (rules/R10.CurrencyTag.md).
 *
 * Hook: after_tool_call. Every kb_statutes_get / kb_statutes_search hit
 * gets a current_through tag from kb_statutes_effective_date_for. Stale
 * results (> threshold) raise the "stale-corpus" warning; if
 * TaskSpec.requires_fresh is true, stale results trigger a synchronous
 * corpus refresh via the ingestion worker's LISTEN/NOTIFY channel.
 */
export function registerR10CurrencyTag(_api: OpenClawPluginApi): void {
  // TODO(phase-4): subscribe to after_tool_call, attach freshness tag,
  // optionally NOTIFY corpus_refresh on stale + requires_fresh.
}
