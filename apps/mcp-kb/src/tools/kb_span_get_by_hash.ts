/**
 * kb_span_get_by_hash — R4/R5 anchor verification.
 *
 * Verifier sub-agent calls this with the hash from a Drafter-emitted anchor;
 * returns the exact span the hash resolves to so the Verifier can
 * exact-substring-match the Drafter's asserted quote.
 */

import { spanGetByHash } from "../db.js";

export const spanGetByHashSchema = {
  type: "object" as const,
  required: ["hash"],
  additionalProperties: false,
  properties: {
    hash: {
      type: "string",
      description: "Either 'sha256:<hex>' or just '<hex>' — the lowercase-hex SHA-256 of the span.",
      pattern: "^(sha256:)?[a-f0-9]{64}$",
    },
  },
};

export async function handleSpanGetByHash(
  input: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent?: unknown }> {
  const rawHash = String(input.hash);
  const hashHex = rawHash.startsWith("sha256:") ? rawHash.slice("sha256:".length) : rawHash;

  const result = await spanGetByHash(hashHex);
  const payload = result.found
    ? {
        found: true,
        hash: `sha256:${result.hash_hex}`,
        doc_id: result.doc_id,
        jurisdiction: result.jurisdiction,
        char_start: result.char_start,
        char_end: result.char_end,
        text: result.text,
        current_through: result.current_through,
        source_table: result.table,
      }
    : {
        found: false,
        hash: `sha256:${hashHex}`,
        reason: "hash not present in statute_chunks or regulation_chunks",
      };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}
