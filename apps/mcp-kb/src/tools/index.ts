/**
 * MCP tool registry — wires schemas + handlers + descriptions for the kb_* tools.
 *
 * Tool names use the kb_<noun>_<verb> convention so the orchestrator can
 * recognize them by prefix when enforcing R1 SourceAllowlist.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { handleStatutesSearch, statutesSearchSchema } from "./kb_statutes_search.js";
import { handleStatutesGet, statutesGetSchema } from "./kb_statutes_get.js";
import { handleStatutesEffectiveDate, statutesEffectiveDateSchema } from "./kb_statutes_effective_date_for.js";
import { handleSpanGetByHash, spanGetByHashSchema } from "./kb_span_get_by_hash.js";
import { handleRegsSearch, regsSearchSchema } from "./kb_regs_search.js";

export interface ToolHandler {
  (input: Record<string, unknown>): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent?: unknown }>;
}

export interface ToolRegistration {
  tool: Tool;
  handler: ToolHandler;
}

export const TOOLS: ToolRegistration[] = [
  {
    tool: {
      name: "kb_statutes_search",
      description: [
        "Search the local statute corpus for sections semantically and lexically related to a query.",
        "Returns ranked chunks with pinpoint addresses (jurisdiction, code, section, subdivision)",
        "plus the (doc_id, char_start, char_end, hash) anchor every result carries.",
        "R1 SourceAllowlist requires the active source profile to allow `local_corpus_state_official`;",
        "R2 JurisdictionLock requires `jurisdiction` to be in TaskSpec.jurisdictions.",
      ].join(" "),
      inputSchema: statutesSearchSchema,
    },
    handler: handleStatutesSearch,
  },
  {
    tool: {
      name: "kb_statutes_get",
      description: [
        "Fetch a specific statute by doc_id (and optionally a single chunk_index).",
        "Returns the full structured row(s) including text, anchor metadata, current_through, and structural flags.",
        "Source-agnostic at the R1 layer (relies on prior search to have validated the doc_id).",
      ].join(" "),
      inputSchema: statutesGetSchema,
    },
    handler: handleStatutesGet,
  },
  {
    tool: {
      name: "kb_statutes_effective_date_for",
      description: [
        "Return the current_through date for a given statute doc_id.",
        "R10 CurrencyTag consumes this to compute staleness against the active threshold.",
      ].join(" "),
      inputSchema: statutesEffectiveDateSchema,
    },
    handler: handleStatutesEffectiveDate,
  },
  {
    tool: {
      name: "kb_span_get_by_hash",
      description: [
        "Re-fetch a previously retrieved span by its SHA-256 hash.",
        "Returns the verbatim text plus metadata so the Verifier sub-agent (R5 HashEcho)",
        "can exact-substring-match an asserted quote against the source.",
        "Source-agnostic; permitted under R1 because the span must already exist in retrieval_log.",
      ].join(" "),
      inputSchema: spanGetByHashSchema,
    },
    handler: handleSpanGetByHash,
  },
  {
    tool: {
      name: "kb_regs_search",
      description: [
        "Search the local regulation corpus (parallel to kb_statutes_search but against regulation_chunks).",
        "Used by the Regulation sub-agent when R7 RegSearchOnDelegation flags a statutory delegation",
        "and the orchestrator dispatches an implementing-reg retrieval.",
      ].join(" "),
      inputSchema: regsSearchSchema,
    },
    handler: handleRegsSearch,
  },
];

export function findToolHandler(name: string): ToolHandler | undefined {
  return TOOLS.find((t) => t.tool.name === name)?.handler;
}
