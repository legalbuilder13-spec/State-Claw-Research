/**
 * kb_statutes_effective_date_for — R10 CurrencyTag input.
 */

import { statuteEffectiveDate } from "../db.js";

export const statutesEffectiveDateSchema = {
  type: "object" as const,
  required: ["jurisdiction", "doc_id"],
  additionalProperties: false,
  properties: {
    jurisdiction: {
      type: "string",
      pattern: "^US(-[A-Z]{2})?(:[a-z0-9-]+)?$",
    },
    doc_id: {
      type: "string",
      pattern: "^[a-z_]+:[a-z0-9-]+:[a-zA-Z0-9._-]+$",
    },
  },
};

export async function handleStatutesEffectiveDate(
  input: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent?: unknown }> {
  const jurisdiction = String(input.jurisdiction);
  const doc_id = String(input.doc_id);
  const result = await statuteEffectiveDate(jurisdiction, doc_id);
  const payload = {
    jurisdiction,
    doc_id,
    found: result !== null,
    current_through: result?.current_through ?? null,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}
