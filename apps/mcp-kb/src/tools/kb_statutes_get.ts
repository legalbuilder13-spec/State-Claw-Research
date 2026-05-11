/**
 * kb_statutes_get — fetch a statute by doc_id.
 */

import { statuteGet } from "../db.js";

export const statutesGetSchema = {
  type: "object" as const,
  required: ["jurisdiction", "doc_id"],
  additionalProperties: false,
  properties: {
    jurisdiction: {
      type: "string",
      pattern: "^US(-[A-Z]{2})?(:[a-z0-9-]+)?$",
      description: "Jurisdiction code (R2-locked).",
    },
    doc_id: {
      type: "string",
      pattern: "^[a-z_]+:[a-z0-9-]+:[a-zA-Z0-9._-]+$",
      description: "Typed doc_id: <source_category>:<jurisdiction>:<identifier>.",
    },
    chunk_index: {
      type: "integer",
      minimum: 0,
      description: "Optional — return only one chunk. Omit to get all chunks of the section.",
    },
  },
};

export async function handleStatutesGet(
  input: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent?: unknown }> {
  const jurisdiction = String(input.jurisdiction);
  const doc_id = String(input.doc_id);
  const chunk_index = input.chunk_index !== undefined ? Number(input.chunk_index) : undefined;

  const chunks = await statuteGet({ jurisdiction, doc_id, chunk_index });
  const payload = {
    jurisdiction,
    doc_id,
    chunk_index_filter: chunk_index ?? null,
    chunk_count: chunks.length,
    chunks: chunks.map((c) => ({
      chunk_index: c.chunk_index,
      chunk_total: c.chunk_total,
      char_start: c.char_start,
      char_end: c.char_end,
      hash: `sha256:${c.hash_hex}`,
      text: c.text,
      current_through: c.current_through,
      code: c.code,
      chapter_id: c.chapter_id,
      section: c.section,
      subdivision: c.subdivision,
      is_definitions_section: c.is_definitions_section,
      is_exemption_section: c.is_exemption_section,
      is_operative_section: c.is_operative_section,
    })),
  };

  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}
