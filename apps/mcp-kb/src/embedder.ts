/**
 * Voyage AI query embedder.
 *
 * Wraps Voyage's REST API for the embed endpoint. Used at query time to
 * embed the incoming search query into the same 1024-dim space as the
 * statute_chunks.embedding column.
 *
 * Distinct from the Python ingestion-worker embedder which uses input_type=
 * "document" for stored content. Query-side uses input_type="query" so
 * Voyage applies the correct asymmetric retrieval optimization.
 */

import { getConfig } from "./config.js";

const VOYAGE_EMBED_URL = "https://api.voyageai.com/v1/embeddings";

interface VoyageEmbedResponse {
  object: string;
  data: Array<{ object: string; embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
}

export async function embedQuery(text: string): Promise<number[]> {
  const cfg = getConfig();
  const res = await fetch(VOYAGE_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.voyageApiKey}`,
    },
    body: JSON.stringify({
      input: [text],
      model: cfg.voyageEmbeddingModel,
      input_type: "query",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Voyage embed failed (${res.status}): ${detail}`);
  }

  const body = (await res.json()) as VoyageEmbedResponse;
  const first = body.data[0];
  if (!first?.embedding) {
    throw new Error("Voyage returned no embedding");
  }
  return first.embedding;
}
