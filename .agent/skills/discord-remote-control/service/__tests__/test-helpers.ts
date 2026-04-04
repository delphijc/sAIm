/**
 * Shared test helper: creates a fully-migrated in-memory SQLite database.
 *
 * Reads the base schema.sql and all migration files in order so that the
 * in-memory schema always matches production, regardless of future migrations.
 */

import { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const SERVICE_ROOT = path.resolve(import.meta.dir, "..");

/**
 * Returns a new in-memory Database with the complete production schema applied:
 *   1. memory/schema.sql
 *   2. memory/migrations/001-*.sql … N-*.sql  (sorted lexically)
 *
 * SQLite ALTER TABLE statements that are already satisfied by the base schema
 * are safe because the base schema already includes those columns. To avoid
 * "duplicate column" errors we skip ALTER TABLE lines whose column already
 * exists in the base schema.sql CREATE TABLE statement.
 *
 * In practice the simplest approach is: apply the base schema first (which
 * includes all columns as of the latest state of the codebase), then skip
 * migration files that only ADD columns already present in the base schema.
 * We do this by wrapping each ALTER TABLE in a try/catch.
 */
export function createTestDb(): Database {
  const db = new Database(":memory:");
  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");

  // 1. Apply base schema
  const schemaPath = path.join(SERVICE_ROOT, "memory", "schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf-8");
  execStatements(db, schemaSql);

  // 2. Apply migrations in order, tolerating duplicate-column errors from
  //    ALTER TABLE statements that are already satisfied by the base schema.
  const migrationsDir = path.join(SERVICE_ROOT, "memory", "migrations");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
    execStatements(db, sql, { tolerateDuplicateColumn: true });
  }

  return db;
}

/**
 * Splits a SQL file into individual statements and executes them one by one.
 * Handles multi-statement constructs like CREATE TRIGGER … BEGIN … END by
 * only splitting on semicolons that appear outside of a BEGIN/END block.
 *
 * @param tolerateDuplicateColumn  When true, SQLiteError "duplicate column
 *   name" from ALTER TABLE is silently swallowed (idempotent migrations).
 */
function execStatements(
  db: Database,
  sql: string,
  opts: { tolerateDuplicateColumn?: boolean } = {}
): void {
  const statements = splitSql(sql);

  for (const stmt of statements) {
    try {
      db.run(stmt);
    } catch (err: any) {
      const isDuplicateColumn =
        typeof err?.message === "string" &&
        err.message.includes("duplicate column name");

      if (opts.tolerateDuplicateColumn && isDuplicateColumn) {
        // Column already exists from base schema — safe to ignore
        continue;
      }

      // Re-throw everything else
      throw err;
    }
  }
}

/**
 * Splits a SQL string into individual runnable statements.
 *
 * The key challenge is that CREATE TRIGGER bodies contain semicolons inside
 * BEGIN … END blocks.  We track nesting depth so we only split on a semicolon
 * when depth === 0.
 *
 * Rules:
 * - Strip line comments (-- …)
 * - Track BEGIN / END keywords to maintain depth
 * - Split on `;` at depth 0
 * - Drop empty / comment-only fragments
 */
function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let depth = 0;

  // Tokenise line-by-line so we can strip -- comments before scanning
  const lines = sql.split("\n");

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    // Strip inline line comment (but keep the newline for readability)
    const line = rawLine.replace(/--[^\n]*$/, "");

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      // Track BEGIN / END for trigger bodies
      // We look for word boundaries so we don't false-positive on "BEGINNING"
      const remaining = line.slice(i).toUpperCase();
      if (/^BEGIN\b/.test(remaining)) {
        depth++;
        current += "BEGIN";
        i += 4; // skip "BEGIN"
        continue;
      }
      if (/^END\b/.test(remaining)) {
        depth = Math.max(0, depth - 1);
        current += "END";
        i += 2; // skip "END"
        continue;
      }

      if (ch === ";" && depth === 0) {
        const stmt = current.trim();
        if (stmt.length > 0) {
          statements.push(stmt);
        }
        current = "";
      } else {
        current += ch;
      }
    }
    current += "\n";
  }

  // Flush any trailing statement without a final semicolon
  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }

  return statements.filter((s) => {
    // Remove statements that are only comments or whitespace after stripping comments
    const stripped = s.replace(/--[^\n]*/g, "").trim();
    return stripped.length > 0;
  });
}
