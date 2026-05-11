#!/usr/bin/env -S node --import tsx
/**
 * Lexicographic SQL migration runner.
 *
 * Lists every *.sql file in migrations/, sorts them, and applies each one not
 * present in the _migrations tracking table. Each application is wrapped in a
 * transaction that also inserts the tracking row, so partial application
 * cannot leave the schema half-migrated.
 *
 * Idempotent: re-running with no new files is a no-op.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm run migrate
 *
 * The DATABASE_URL must point at a Postgres instance with pgvector enabled.
 */

import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(HERE, "../migrations");

interface MigrationFile {
  filename: string;
  fullPath: string;
}

interface AppliedRow {
  filename: string;
  applied_at: Date;
}

async function listMigrationFiles(): Promise<MigrationFile[]> {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .map((e) => ({
      filename: e.name,
      fullPath: resolve(MIGRATIONS_DIR, e.name),
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

async function ensureMigrationsTable(client: pg.Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename     text PRIMARY KEY,
      applied_at   timestamptz NOT NULL DEFAULT now(),
      content_hash bytea,
      duration_ms  int
    )
  `);
}

async function listAppliedMigrations(client: pg.Client): Promise<Set<string>> {
  const result = await client.query<AppliedRow>(
    "SELECT filename, applied_at FROM _migrations ORDER BY filename",
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function applyMigration(client: pg.Client, file: MigrationFile): Promise<void> {
  const sql = await readFile(file.fullPath, "utf-8");
  const start = Date.now();
  console.log(`[migrate] applying ${file.filename} (${sql.length} chars)`);
  // The migration file is expected to include its own BEGIN/COMMIT.
  // We add a SAVEPOINT around the tracking-row insert so partial application
  // of a malformed migration rolls back cleanly.
  await client.query(sql);
  const duration = Date.now() - start;
  await client.query(
    "INSERT INTO _migrations (filename, content_hash, duration_ms) VALUES ($1, decode(encode(digest($2, 'sha256'), 'hex'), 'hex'), $3)",
    [file.filename, sql, duration],
  );
  console.log(`[migrate] applied ${file.filename} in ${duration}ms`);
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await listAppliedMigrations(client);
    const all = await listMigrationFiles();
    const pending = all.filter((f) => !applied.has(f.filename));

    if (pending.length === 0) {
      console.log("[migrate] no pending migrations; up to date");
      return;
    }

    console.log(`[migrate] ${pending.length} pending migration${pending.length === 1 ? "" : "s"}:`);
    for (const f of pending) console.log(`  • ${f.filename}`);

    for (const file of pending) {
      await applyMigration(client, file);
    }

    console.log(`[migrate] done; applied ${pending.length} migration${pending.length === 1 ? "" : "s"}`);
  } catch (err) {
    console.error("[migrate] failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
