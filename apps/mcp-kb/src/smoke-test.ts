/**
 * Smoke test: end-to-end query against the live corpus.
 *
 * Bypasses the MCP protocol — directly invokes the tool handlers to validate
 * that embed + search + DB round-trip works.
 *
 * Run with:
 *   PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" \
 *   DATABASE_URL=postgres://localhost:5432/agentic_law_os \
 *   VOYAGE_API_KEY=... \
 *   pnpm --filter @agentic-law-os/mcp-kb exec node --import tsx src/smoke-test.ts
 */

import { closePool } from "./db.js";
import { handleStatutesSearch } from "./tools/kb_statutes_search.js";
import { handleStatutesGet } from "./tools/kb_statutes_get.js";
import { handleSpanGetByHash } from "./tools/kb_span_get_by_hash.js";
import { handleStatutesEffectiveDate } from "./tools/kb_statutes_effective_date_for.js";

async function runTest(name: string, fn: () => Promise<unknown>): Promise<void> {
  process.stdout.write(`\n=== ${name} ===\n`);
  const start = Date.now();
  try {
    const result = await fn();
    process.stdout.write(`✓ ${name} OK (${Date.now() - start}ms)\n`);
    if (result !== undefined) {
      process.stdout.write(`${JSON.stringify(result, null, 2).slice(0, 2000)}\n`);
    }
  } catch (err) {
    process.stdout.write(`✗ ${name} FAILED (${Date.now() - start}ms): ${String(err)}\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  try {
    await runTest("kb_statutes_search('independent contractor')", async () => {
      const result = await handleStatutesSearch({
        jurisdiction: "US-CA",
        query: "independent contractor presumption ABC test",
        limit: 5,
      });
      return result.structuredContent;
    });

    await runTest("kb_statutes_search('wage statement requirements')", async () => {
      const result = await handleStatutesSearch({
        jurisdiction: "US-CA",
        query: "wage statement itemized requirements pay stub",
        limit: 3,
      });
      return result.structuredContent;
    });

    await runTest("kb_statutes_search delegation test ('Labor Commissioner regulations')", async () => {
      const result = await handleStatutesSearch({
        jurisdiction: "US-CA",
        query: "Labor Commissioner shall develop regulations notice",
        limit: 3,
      });
      // We expect § 2810.5 (Wage Theft Prevention Notice — has the R7 delegation) high in results.
      return result.structuredContent;
    });

    await runTest("kb_statutes_get(ca-lab-2775)", async () => {
      const result = await handleStatutesGet({
        jurisdiction: "US-CA",
        doc_id: "primary_statute:us-ca:ca-lab-2775",
      });
      const sc = result.structuredContent as { chunks: Array<{ chunk_index: number }> };
      return { chunk_count: sc.chunks.length, first_index: sc.chunks[0]?.chunk_index };
    });

    await runTest("kb_statutes_effective_date_for(ca-lab-2775)", async () => {
      const result = await handleStatutesEffectiveDate({
        jurisdiction: "US-CA",
        doc_id: "primary_statute:us-ca:ca-lab-2775",
      });
      return result.structuredContent;
    });

    // For kb_span_get_by_hash, look up one chunk's hash via search first.
    await runTest("kb_span_get_by_hash (round-trip)", async () => {
      const searchResult = await handleStatutesSearch({
        jurisdiction: "US-CA",
        query: "ABC test",
        limit: 1,
      });
      const sc = searchResult.structuredContent as {
        results: Array<{ hash: string; text_excerpt: string; doc_id: string }>;
      };
      const first = sc.results[0];
      if (!first) throw new Error("no search result to verify");
      const verifyResult = await handleSpanGetByHash({ hash: first.hash });
      const verifySC = verifyResult.structuredContent as { found: boolean; doc_id: string };
      if (!verifySC.found) throw new Error("hash lookup found=false");
      if (verifySC.doc_id !== first.doc_id) {
        throw new Error(`doc_id mismatch: search=${first.doc_id}, verify=${verifySC.doc_id}`);
      }
      return { round_trip_ok: true, doc_id: verifySC.doc_id, hash: first.hash };
    });

    process.stdout.write("\n=== ALL TESTS PASSED ===\n");
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  process.stderr.write(`fatal: ${String(err?.stack ?? err)}\n`);
  process.exit(1);
});
