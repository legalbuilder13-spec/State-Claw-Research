import type { OpenClawPluginApi } from "../../api.js";

/**
 * R12 ClassificationOverlay (rules/R12.ClassificationOverlay.md).
 *
 * Hook: message_sending. Adds the company-context risk overlay to every
 * outbound deliverable. Reads company-context/risk-vectors.yaml and
 * company-context/risk-taxonomy.yaml; for each citation in the draft,
 * cross-references against the risk taxonomy and stamps a classification
 * (low / medium / high / critical) plus the relevant risk-vector pointer.
 */
export function registerR12ClassificationOverlay(_api: OpenClawPluginApi): void {
  // TODO(phase-4): mutate draft to append the classification block before
  // the Renderer's final pass.
}
