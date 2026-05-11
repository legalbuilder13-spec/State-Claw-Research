/**
 * kb_statutes_search — hybrid (vector + FTS) search over statute_chunks.
 */

import { getConfig } from "../config.js";
import { statuteHybridSearch, type StatuteHit } from "../db.js";
import { embedQuery } from "../embedder.js";

export const statutesSearchSchema = {
  type: "object" as const,
  required: ["jurisdiction", "query"],
  additionalProperties: false,
  properties: {
    jurisdiction: {
      type: "string",
      description: "Jurisdiction code (US-CA, US-IL, etc.). Must be in TaskSpec.jurisdictions per R2.",
      pattern: "^US(-[A-Z]{2})?(:[a-z0-9-]+)?$",
    },
    query: {
      type: "string",
      description: "Natural-language search query. Voyage embeds it as `input_type=query` for asymmetric retrieval.",
      minLength: 1,
      maxLength: 4000,
    },
    chapter: {
      type: "string",
      description: "Optional chapter filter (e.g., 'Division 3 Part 1 Chapter 2').",
    },
    limit: {
      type: "integer",
      description: "Max results to return. Default 10; max 50.",
      minimum: 1,
      maximum: 50,
      default: 10,
    },
  },
};

export async function handleStatutesSearch(
  input: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent?: unknown }> {
  const cfg = getConfig();
  const jurisdiction = String(input.jurisdiction);
  const queryText = String(input.query);
  const chapter = input.chapter ? String(input.chapter) : undefined;
  const limit = Math.min(Number(input.limit ?? cfg.defaultLimit), cfg.maxLimit);

  const queryEmbedding = await embedQuery(queryText);
  const hits = await statuteHybridSearch({
    jurisdiction,
    queryText,
    queryEmbedding,
    chapter,
    limit,
    vectorTopK: cfg.vectorTopK,
    ftsTopK: cfg.ftsTopK,
    weightVector: cfg.hybridWeightVector,
    weightFts: cfg.hybridWeightFts,
  });

  const summary = {
    jurisdiction,
    query: queryText,
    chapter: chapter ?? null,
    total_hits: hits.length,
    weights: { vector: cfg.hybridWeightVector, fts: cfg.hybridWeightFts },
    results: hits.map((h) => ({
      doc_id: h.doc_id,
      jurisdiction: h.jurisdiction,
      code: h.code,
      chapter_id: h.chapter_id,
      section: h.section,
      subdivision: h.subdivision,
      chunk_index: h.chunk_index,
      chunk_total: h.chunk_total,
      char_start: h.char_start,
      char_end: h.char_end,
      hash: `sha256:${h.hash_hex}`,
      current_through: h.current_through,
      is_definitions_section: h.is_definitions_section,
      is_exemption_section: h.is_exemption_section,
      vector_distance: h.vector_distance,
      fts_rank: h.fts_rank,
      combined_score: h.combined_score,
      text_excerpt: truncate(h.text, 400),
    })),
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(summary, null, 2),
      },
    ],
    structuredContent: summary,
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n).trimEnd()}…`;
}

export type { StatuteHit };
