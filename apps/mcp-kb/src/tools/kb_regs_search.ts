/**
 * kb_regs_search — hybrid search over regulation_chunks (parallel to kb_statutes_search).
 */

import { getConfig } from "../config.js";
import { regulationHybridSearch } from "../db.js";
import { embedQuery } from "../embedder.js";

export const regsSearchSchema = {
  type: "object" as const,
  required: ["jurisdiction", "query"],
  additionalProperties: false,
  properties: {
    jurisdiction: {
      type: "string",
      pattern: "^US(-[A-Z]{2})?(:[a-z0-9-]+)?$",
    },
    query: { type: "string", minLength: 1, maxLength: 4000 },
    agency: {
      type: "string",
      description: "Optional agency filter (e.g., 'Labor Commissioner', 'DOL').",
    },
    implements_statute_doc_id: {
      type: "string",
      pattern: "^[a-z_]+:[a-z0-9-]+:[a-zA-Z0-9._-]+$",
      description: "Optional — narrow results to regs implementing a specific statute (R7 chase).",
    },
    limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
  },
};

export async function handleRegsSearch(
  input: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent?: unknown }> {
  const cfg = getConfig();
  const jurisdiction = String(input.jurisdiction);
  const queryText = String(input.query);
  const limit = Math.min(Number(input.limit ?? cfg.defaultLimit), cfg.maxLimit);

  const queryEmbedding = await embedQuery(queryText);
  const hits = await regulationHybridSearch({
    jurisdiction,
    queryText,
    queryEmbedding,
    chapter: undefined,
    limit,
    vectorTopK: cfg.vectorTopK,
    ftsTopK: cfg.ftsTopK,
    weightVector: cfg.hybridWeightVector,
    weightFts: cfg.hybridWeightFts,
    agency: input.agency ? String(input.agency) : undefined,
  });

  const payload = {
    jurisdiction,
    query: queryText,
    agency_filter: input.agency ?? null,
    total_hits: hits.length,
    results: hits.map((h) => ({
      doc_id: h.doc_id,
      jurisdiction: h.jurisdiction,
      title: h.title,
      part: h.part,
      section: h.section,
      subdivision: h.subdivision,
      agency: h.agency,
      implements_statute_doc_id: h.implements_statute_doc_id,
      chunk_index: h.chunk_index,
      char_start: h.char_start,
      char_end: h.char_end,
      hash: `sha256:${h.hash_hex}`,
      current_through: h.current_through,
      combined_score: h.combined_score,
      text_excerpt: h.text.slice(0, 400),
    })),
  };

  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}
