/**
 * MCP-KB runtime configuration.
 *
 * Loaded from environment variables at process start. Validated lazily so
 * the binary can `--help` without all envs being set.
 */

export interface KBConfig {
  databaseUrl: string;
  voyageApiKey: string;
  voyageEmbeddingModel: string;
  voyageRerankModel: string;
  defaultSourceProfile: "A" | "B";

  // Search behavior
  vectorTopK: number;
  ftsTopK: number;
  hybridWeightVector: number;
  hybridWeightFts: number;
  defaultLimit: number;
  maxLimit: number;
  rerankEnabled: boolean;
  rerankTopK: number;

  // Transport
  transport: "stdio" | "http";
  httpPort: number;
}

let _cached: KBConfig | null = null;

export function getConfig(): KBConfig {
  if (_cached) return _cached;

  const env = process.env;
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is required (Postgres connection string with pgvector enabled)");
  }
  const voyageKey = env.VOYAGE_API_KEY;
  if (!voyageKey) {
    throw new Error("VOYAGE_API_KEY is required");
  }

  _cached = {
    databaseUrl: dbUrl,
    voyageApiKey: voyageKey,
    voyageEmbeddingModel: env.VOYAGE_EMBEDDING_MODEL ?? "voyage-law-2",
    voyageRerankModel: env.VOYAGE_RERANK_MODEL ?? "rerank-2",
    defaultSourceProfile: (env.DEFAULT_SOURCE_PROFILE as "A" | "B" | undefined) ?? "B",

    vectorTopK: Number(env.MCP_KB_VECTOR_TOP_K ?? 30),
    ftsTopK: Number(env.MCP_KB_FTS_TOP_K ?? 30),
    hybridWeightVector: Number(env.MCP_KB_HYBRID_WEIGHT_VECTOR ?? 0.6),
    hybridWeightFts: Number(env.MCP_KB_HYBRID_WEIGHT_FTS ?? 0.4),
    defaultLimit: Number(env.MCP_KB_DEFAULT_LIMIT ?? 10),
    maxLimit: Number(env.MCP_KB_MAX_LIMIT ?? 50),
    rerankEnabled: env.MCP_KB_RERANK_ENABLED === "true",
    rerankTopK: Number(env.MCP_KB_RERANK_TOP_K ?? 10),

    transport: (env.MCP_KB_TRANSPORT as "stdio" | "http" | undefined) ?? "stdio",
    httpPort: Number(env.MCP_KB_HTTP_PORT ?? 3334),
  };

  return _cached;
}
