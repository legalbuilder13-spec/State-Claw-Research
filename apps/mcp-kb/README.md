# KB MCP Server

Knowledge-base MCP server exposing the `kb_*` tools the runtime uses to query the local corpus. Standalone TypeScript service; communicates with the OpenClaw runtime over MCP (stdio in v1, HTTP later).

## Tools

| Tool | Purpose | Rule support |
|---|---|---|
| `kb_statutes_search` | Hybrid vector + FTS search over `statute_chunks` | R1 (source allowlist) + R2 (jurisdiction lock) |
| `kb_statutes_get` | Fetch a section by `doc_id` (optionally a single `chunk_index`) | Source-agnostic — relies on prior search to validate doc_id |
| `kb_statutes_effective_date_for` | Returns `current_through` for a statute | R10 CurrencyTag input |
| `kb_span_get_by_hash` | Re-fetch a span by SHA-256 hash for anchor verification | R4 + R5 HashEcho |
| `kb_regs_search` | Hybrid search over `regulation_chunks` | R7 RegSearchOnDelegation chase |

## Architecture

```
runtime (OpenClaw)
  │
  │  MCP stdio   (per .openclaw/mcp-config.json)
  ▼
agentic-law-os-mcp-kb  (this service)
  │
  ├─ embedder.ts  →  Voyage AI voyage-law-2  (query-side embedding, 1024-dim)
  └─ db.ts        →  Postgres + pgvector + tsvector
                     │
                     ▼
                  statute_chunks / regulation_chunks
                  (ingested by apps/ingestion-worker)
```

## Hybrid search

`kb_statutes_search` and `kb_regs_search` execute three stages in a single SQL query:

1. **Vector top-K** via the HNSW index on `embedding`, sorted by cosine distance.
2. **FTS top-K** via the GIN index on `search_tsv`, sorted by `ts_rank`.
3. **FULL OUTER JOIN** the two result sets and rank by a weighted combination:
   ```
   combined_score = (1 - vector_distance) * weight_vector + fts_rank * weight_fts
   ```
   Default weights: vector 0.6, FTS 0.4 (`MCP_KB_HYBRID_WEIGHT_*`).

Both legs are bounded (`MCP_KB_VECTOR_TOP_K`, `MCP_KB_FTS_TOP_K`; default 30 each) so the worst-case work is bounded regardless of corpus size.

## Environment

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string (pgvector enabled) |
| `VOYAGE_API_KEY` | yes | — | Voyage AI key for query embeddings |
| `VOYAGE_EMBEDDING_MODEL` | no | `voyage-law-2` | Embedding model |
| `DEFAULT_SOURCE_PROFILE` | no | `B` | Backend selection (Profile A adds Lexis routes — v2 work) |
| `MCP_KB_VECTOR_TOP_K` | no | `30` | Vector leg recall |
| `MCP_KB_FTS_TOP_K` | no | `30` | FTS leg recall |
| `MCP_KB_HYBRID_WEIGHT_VECTOR` | no | `0.6` | Combiner weight |
| `MCP_KB_HYBRID_WEIGHT_FTS` | no | `0.4` | Combiner weight |
| `MCP_KB_DEFAULT_LIMIT` | no | `10` | Default result count |
| `MCP_KB_MAX_LIMIT` | no | `50` | Max permitted result count |
| `MCP_KB_TRANSPORT` | no | `stdio` | `stdio` (default) or `http` (v2) |

## Local development

```sh
cd apps/mcp-kb
pnpm install                          # from repo root pulls workspace deps
pnpm --filter @agentic-law-os/mcp-kb build

# Run server on stdio
DATABASE_URL=postgres://localhost:5432/agentic_law_os \
VOYAGE_API_KEY=...                     \
pnpm --filter @agentic-law-os/mcp-kb dev
```

For a quick interactive test without a full MCP client, use the Anthropic MCP Inspector:

```sh
npx @modelcontextprotocol/inspector \
  node apps/mcp-kb/dist/index.js
```

## Wiring into OpenClaw

Per `docs/legal/PLUGIN-SDK-NOTES.md` §Q6, MCP servers are config-driven via `.openclaw/mcp-config.json`. Add a server entry:

```json
{
  "servers": {
    "kb": {
      "command": "node",
      "args": ["/path/to/apps/mcp-kb/dist/index.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}",
        "VOYAGE_API_KEY": "${VOYAGE_API_KEY}"
      }
    }
  }
}
```

OpenClaw discovers the server on startup and exposes its tools to the agent loop. Phase 4 (the legal plugin pack) wires the rule engine's `before_tool_call` hook against these specific tool names.

## Phase 3 done-criterion

Per PRD §17:

> From inside a forked OpenClaw session, the agent can call `kb_statutes_search(jurisdiction='US-CA', query='independent contractor')` and get back ranked results from the ingested California corpus.

Met when:
1. `pnpm build` succeeds.
2. `node dist/index.js` starts cleanly on stdio.
3. MCP Inspector or a real OpenClaw connection can list `kb_*` tools and invoke `kb_statutes_search`.
4. The returned hits include § 2775 (the operative ABC test) in the top 5 results for `query='independent contractor'`.

## Performance budget

- Vector top-K (HNSW): <10ms for 1k-row corpus, <50ms for 100k-row corpus.
- FTS top-K (GIN): <5ms for the same range.
- Voyage embed (single query, 1024-dim): ~150–400ms wall-clock.
- Hybrid join + combiner: <10ms.
- **End-to-end target: <500ms p50, <1000ms p95** for a typical search call.

Far under the deliverable latency budget (2 minutes per PRD §19), so the agent can issue 3–4 searches per research run without latency issues.
