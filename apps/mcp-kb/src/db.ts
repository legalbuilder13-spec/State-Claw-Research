/**
 * Postgres connection pool + per-table query helpers.
 *
 * The KB server reads from corpus tables (statute_chunks, regulation_chunks,
 * case_index) and writes only to retrieval_log (when a tool call is invoked
 * inside an orchestrator run that supplies a claim_ledger_id).
 */

import pg from "pg";
import { toSql as vectorToSql } from "pgvector";

import { getConfig } from "./config.js";

const { Pool } = pg;
let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (_pool) return _pool;
  const cfg = getConfig();
  _pool = new Pool({
    connectionString: cfg.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  _pool.on("error", (err) => {
    // Log to stderr so MCP stdio transport (stdout) stays clean for protocol traffic.
    console.error("[mcp-kb] pg pool error:", err);
  });
  return _pool;
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

// ----------------------------------------------------------------------------
// Statute search — hybrid (vector + FTS) with weighted combination
// ----------------------------------------------------------------------------

export interface StatuteSearchParams {
  jurisdiction: string;
  queryText: string;
  queryEmbedding: number[];                  // 1024-dim from voyage-law-2
  chapter?: string;
  limit: number;
  vectorTopK: number;
  ftsTopK: number;
  weightVector: number;
  weightFts: number;
}

export interface StatuteHit {
  id: string;
  doc_id: string;
  jurisdiction: string;
  code: string | null;
  chapter_id: string | null;
  section: string;
  subdivision: string | null;
  chunk_index: number;
  chunk_total: number;
  char_start: number;
  char_end: number;
  text: string;
  hash_hex: string;
  current_through: string;                   // ISO date
  is_definitions_section: boolean;
  is_exemption_section: boolean;
  is_operative_section: boolean;
  vector_distance: number | null;
  fts_rank: number | null;
  combined_score: number;
}

const STATUTE_HYBRID_SEARCH_SQL = `
WITH vector_results AS (
  SELECT id, doc_id, jurisdiction, code, chapter_id, section, subdivision,
         chunk_index, chunk_total, char_start, char_end, text,
         encode(hash, 'hex') AS hash_hex,
         current_through, is_definitions_section, is_exemption_section,
         is_operative_section,
         (embedding <=> $1::vector) AS vector_distance
  FROM statute_chunks
  WHERE jurisdiction = $2
    AND ($3::text IS NULL OR chapter_id = $3)
    AND embedding IS NOT NULL
  ORDER BY embedding <=> $1::vector
  LIMIT $4
),
fts_results AS (
  SELECT id, doc_id, jurisdiction, code, chapter_id, section, subdivision,
         chunk_index, chunk_total, char_start, char_end, text,
         encode(hash, 'hex') AS hash_hex,
         current_through, is_definitions_section, is_exemption_section,
         is_operative_section,
         ts_rank(search_tsv, plainto_tsquery('english', $5)) AS fts_rank
  FROM statute_chunks
  WHERE jurisdiction = $2
    AND ($3::text IS NULL OR chapter_id = $3)
    AND search_tsv @@ plainto_tsquery('english', $5)
  ORDER BY fts_rank DESC
  LIMIT $6
),
combined AS (
  SELECT
    COALESCE(v.id, f.id) AS id,
    COALESCE(v.doc_id, f.doc_id) AS doc_id,
    COALESCE(v.jurisdiction, f.jurisdiction) AS jurisdiction,
    COALESCE(v.code, f.code) AS code,
    COALESCE(v.chapter_id, f.chapter_id) AS chapter_id,
    COALESCE(v.section, f.section) AS section,
    COALESCE(v.subdivision, f.subdivision) AS subdivision,
    COALESCE(v.chunk_index, f.chunk_index) AS chunk_index,
    COALESCE(v.chunk_total, f.chunk_total) AS chunk_total,
    COALESCE(v.char_start, f.char_start) AS char_start,
    COALESCE(v.char_end, f.char_end) AS char_end,
    COALESCE(v.text, f.text) AS text,
    COALESCE(v.hash_hex, f.hash_hex) AS hash_hex,
    COALESCE(v.current_through, f.current_through) AS current_through,
    COALESCE(v.is_definitions_section, f.is_definitions_section) AS is_definitions_section,
    COALESCE(v.is_exemption_section, f.is_exemption_section) AS is_exemption_section,
    COALESCE(v.is_operative_section, f.is_operative_section) AS is_operative_section,
    v.vector_distance,
    f.fts_rank
  FROM vector_results v
  FULL OUTER JOIN fts_results f ON v.id = f.id
)
SELECT *,
       (COALESCE(1 - vector_distance, 0) * $7 + COALESCE(fts_rank, 0) * $8) AS combined_score
FROM combined
ORDER BY combined_score DESC
LIMIT $9
`;

export async function statuteHybridSearch(params: StatuteSearchParams): Promise<StatuteHit[]> {
  const pool = getPool();
  const { rows } = await pool.query<StatuteHit>(STATUTE_HYBRID_SEARCH_SQL, [
    vectorToSql(params.queryEmbedding),
    params.jurisdiction,
    params.chapter ?? null,
    params.vectorTopK,
    params.queryText,
    params.ftsTopK,
    params.weightVector,
    params.weightFts,
    params.limit,
  ]);
  return rows;
}

// ----------------------------------------------------------------------------
// Statute fetch by doc_id (with optional chunk_index)
// ----------------------------------------------------------------------------

export interface StatuteGetParams {
  jurisdiction: string;
  doc_id: string;
  chunk_index?: number;
}

export async function statuteGet(params: StatuteGetParams): Promise<StatuteHit[]> {
  const pool = getPool();
  const sql = `
    SELECT id, doc_id, jurisdiction, code, chapter_id, section, subdivision,
           chunk_index, chunk_total, char_start, char_end, text,
           encode(hash, 'hex') AS hash_hex,
           current_through,
           is_definitions_section, is_exemption_section, is_operative_section,
           NULL::float AS vector_distance, NULL::float AS fts_rank, 1.0 AS combined_score
    FROM statute_chunks
    WHERE jurisdiction = $1 AND doc_id = $2
      AND ($3::int IS NULL OR chunk_index = $3)
    ORDER BY chunk_index
  `;
  const { rows } = await pool.query<StatuteHit>(sql, [
    params.jurisdiction,
    params.doc_id,
    params.chunk_index ?? null,
  ]);
  return rows;
}

// ----------------------------------------------------------------------------
// Span by hash (R4 / R5 anchor verification)
// ----------------------------------------------------------------------------

export interface SpanByHashResult {
  found: boolean;
  doc_id?: string;
  jurisdiction?: string;
  text?: string;
  char_start?: number;
  char_end?: number;
  current_through?: string;
  hash_hex?: string;
  table?: "statute_chunks" | "regulation_chunks";
}

export async function spanGetByHash(hashHex: string): Promise<SpanByHashResult> {
  const pool = getPool();
  // Try statute_chunks first; fall back to regulation_chunks.
  const sql = `
    SELECT 'statute_chunks' AS tbl, doc_id, jurisdiction, text, char_start, char_end,
           current_through, encode(hash, 'hex') AS hash_hex
    FROM statute_chunks WHERE encode(hash, 'hex') = $1
    UNION ALL
    SELECT 'regulation_chunks' AS tbl, doc_id, jurisdiction, text, char_start, char_end,
           current_through, encode(hash, 'hex') AS hash_hex
    FROM regulation_chunks WHERE encode(hash, 'hex') = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [hashHex]);
  if (rows.length === 0) return { found: false };
  const r = rows[0] as {
    tbl: "statute_chunks" | "regulation_chunks";
    doc_id: string;
    jurisdiction: string;
    text: string;
    char_start: number;
    char_end: number;
    current_through: string;
    hash_hex: string;
  };
  return {
    found: true,
    doc_id: r.doc_id,
    jurisdiction: r.jurisdiction,
    text: r.text,
    char_start: r.char_start,
    char_end: r.char_end,
    current_through: r.current_through,
    hash_hex: r.hash_hex,
    table: r.tbl,
  };
}

// ----------------------------------------------------------------------------
// Effective date for doc (R10 currency input)
// ----------------------------------------------------------------------------

export async function statuteEffectiveDate(
  jurisdiction: string,
  doc_id: string,
): Promise<{ current_through: string } | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT max(current_through) AS current_through
       FROM statute_chunks
      WHERE jurisdiction = $1 AND doc_id = $2`,
    [jurisdiction, doc_id],
  );
  const ct = rows[0]?.current_through;
  if (!ct) return null;
  return { current_through: typeof ct === "string" ? ct : (ct as Date).toISOString().slice(0, 10) };
}

// ----------------------------------------------------------------------------
// Regulation hybrid search (same shape as statute search)
// ----------------------------------------------------------------------------

export interface RegulationHit {
  id: string;
  doc_id: string;
  jurisdiction: string;
  title: string;
  part: string;
  section: string;
  subdivision: string | null;
  agency: string;
  implements_statute_doc_id: string | null;
  chunk_index: number;
  chunk_total: number;
  char_start: number;
  char_end: number;
  text: string;
  hash_hex: string;
  current_through: string;
  combined_score: number;
}

const REG_HYBRID_SEARCH_SQL = STATUTE_HYBRID_SEARCH_SQL.replace(
  /statute_chunks/g,
  "regulation_chunks",
);

export async function regulationHybridSearch(
  params: StatuteSearchParams & { agency?: string },
): Promise<RegulationHit[]> {
  const pool = getPool();
  // For now we reuse the statute hybrid SQL against regulation_chunks; the only
  // difference is the table name. Agency-filtering can be added in a follow-up.
  const { rows } = await pool.query<RegulationHit>(REG_HYBRID_SEARCH_SQL, [
    vectorToSql(params.queryEmbedding),
    params.jurisdiction,
    params.chapter ?? null,
    params.vectorTopK,
    params.queryText,
    params.ftsTopK,
    params.weightVector,
    params.weightFts,
    params.limit,
  ]);
  return rows;
}
