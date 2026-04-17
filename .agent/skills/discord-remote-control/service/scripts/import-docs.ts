#!/usr/bin/env bun
/**
 * Import .md documentation into SQLite semantic memory
 * Reads from docs/, wiki/, .claude/, .agent/ and discord-remote-control skill docs
 * Inserts as semantic memories with topic extraction and BM25 FTS indexing
 */

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import path from "path";
import { execSync } from "child_process";
import { homedir } from "os";

// Dynamically detect SAM_ROOT from git repo or working directory
function getSAMRoot(): string {
  try {
    // Try to find git root
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      cwd: process.cwd()
    }).trim();
    return gitRoot;
  } catch {
    // Fallback to current working directory
    return process.cwd();
  }
}

// Get PAI_DIR (single source of truth for all PAI paths)
function getPAIDir(): string {
  if (process.env.PAI_DIR) {
    return process.env.PAI_DIR;
  }
  return path.join(homedir(), '.claude');
}

const SAM_ROOT = getSAMRoot();
const PAI_DIR = getPAIDir();

// After memory-system externalization, prefer project root location
let DB_PATH: string;
if (process.env.MEMORY_DB_PATH) {
  DB_PATH = process.env.MEMORY_DB_PATH;
} else {
  // Check memory-system project first (after externalization)
  const memorySystemProject = path.join(path.dirname(SAM_ROOT), "memory-system", "memory.db");
  DB_PATH = memorySystemProject;
}
const SESSION_ID = "docs-import"; // Special session for imported docs
const NOW = Date.now();

// Directories to scan (relative to SAM_ROOT)
const SCAN_DIRS = [
  "docs",
  "wiki",
  ".agent/skills/CORE",
  ".agent/skills/discord-remote-control",
  ".agent/agents",
  ".agent/rules",
  ".agent/guides",
  ".agent/hooks",
  ".agent/history/History/2026-02",
  ".agent/history/History/sessions/2026-03",
  ".agent/plans",
  "docs/migration",
  "docs/completed",
  "docs/archived",
];

// Additional individual files (current user only)
const INDIVIDUAL_FILES = [
  ".agent/CLAUDE-REFERENCE.md",
  ".agent/CLAUDE.md",
  ".agent/ANTIGRAVITY_SKILLS.md",
  ".agent/state.md",
  ".agent/troubleshooting.md",
  // Project memory files (current user: obsidium)
  ".agent/projects/-home-obsidium-Projects-sam/memory/MEMORY.md",
  ".agent/projects/-home-obsidium-Projects-voice-server/memory/MEMORY.md",
  // .claude memory files (current user: obsidium)
  ".claude/projects/-home-obsidium-Projects-sam/memory/MEMORY.md",
  ".claude/projects/-home-obsidium-Projects-voice-server/memory/MEMORY.md",
];

// Skip patterns
const SKIP_PATTERNS = [
  "node_modules",
  ".git",
  "bun-types",
  "CHANGELOG.md", // npm package changelogs
];

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some((p) => filePath.includes(p));
}

function extractTopic(filePath: string, content: string): string {
  // Try to get title from first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // Try frontmatter name
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    return nameMatch[1].trim();
  }

  // Fall back to filename
  const basename = path.basename(filePath, ".md");
  return basename
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractSummary(content: string, maxLen: number = 2000): string {
  // Remove frontmatter
  let cleaned = content.replace(/^---[\s\S]*?---\n*/m, "");

  // Remove code blocks (keep just a note)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "[code block]");

  // Collapse multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Truncate
  if (cleaned.length > maxLen) {
    cleaned = cleaned.substring(0, maxLen) + "...";
  }

  return cleaned.trim();
}

function collectMdFiles(dir: string): string[] {
  const fullDir = path.join(SAM_ROOT, dir);
  if (!existsSync(fullDir)) {
    console.log(`  Skipping (not found): ${dir}`);
    return [];
  }

  const files: string[] = [];

  function walk(d: string) {
    try {
      const entries = readdirSync(d);
      for (const entry of entries) {
        const full = path.join(d, entry);
        if (shouldSkip(full)) continue;

        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (entry.endsWith(".md")) {
          files.push(full);
        }
      }
    } catch {
      // Skip permission errors
    }
  }

  walk(fullDir);
  return files;
}

async function main() {
  console.log(`\n📚 Importing documentation into SQLite memory`);
  console.log(`   DB: ${DB_PATH}\n`);

  const db = new Database(DB_PATH, { create: true });
  db.run("PRAGMA journal_mode = WAL");

  // Collect all files
  const allFiles: string[] = [];

  for (const dir of SCAN_DIRS) {
    const files = collectMdFiles(dir);
    console.log(`  📂 ${dir}: ${files.length} files`);
    allFiles.push(...files);
  }

  // Add individual files
  for (const f of INDIVIDUAL_FILES) {
    const full = path.join(SAM_ROOT, f);
    if (existsSync(full) && !shouldSkip(full)) {
      allFiles.push(full);
    }
  }

  // Deduplicate
  const uniqueFiles = [...new Set(allFiles)];
  console.log(`\n  Total unique files: ${uniqueFiles.length}\n`);

  // Clear previous docs-import data to allow re-runs
  const deleted = db.run("DELETE FROM semantic WHERE session_id = ?", SESSION_ID);
  if (deleted.changes > 0) {
    console.log(`  🗑️  Cleared ${deleted.changes} previous doc imports\n`);
  }

  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT INTO semantic (id, session_id, topic, summary, relevance_score, created_at, source_message_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const insertMany = db.transaction(() => {
    for (const filePath of uniqueFiles) {
      try {
        const content = readFileSync(filePath, "utf-8");

        // Skip empty or very small files
        if (content.trim().length < 50) {
          skipped++;
          continue;
        }

        const relPath = path.relative(SAM_ROOT, filePath);
        const topic = extractTopic(filePath, content);
        const summary = extractSummary(content);

        const id = crypto.randomUUID();
        const sourceRef = JSON.stringify([relPath]);

        insertStmt.run(
          id,
          SESSION_ID,
          `[${relPath}] ${topic}`,
          summary,
          1.0, // Fresh import = max relevance
          NOW - imported, // Slight time offset for ordering
          sourceRef
        );

        imported++;
      } catch (err: any) {
        errors.push(`${filePath}: ${err.message}`);
      }
    }
  });

  insertMany();

  console.log(`  ✅ Imported: ${imported} documents`);
  console.log(`  ⏭️  Skipped: ${skipped} (too small)`);
  if (errors.length > 0) {
    console.log(`  ❌ Errors: ${errors.length}`);
    for (const e of errors) {
      console.log(`     ${e}`);
    }
  }

  // Verify
  const count = db.query("SELECT COUNT(*) as c FROM semantic WHERE session_id = ?").get(SESSION_ID) as any;
  console.log(`\n  📊 Total semantic memories (docs-import): ${count.c}`);

  // Sample search test
  const testQuery = db.query(`
    SELECT topic, substr(summary, 1, 100) as preview
    FROM semantic
    WHERE session_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `).all(SESSION_ID);

  console.log(`\n  🔍 Sample entries:`);
  for (const row of testQuery as any[]) {
    console.log(`     • ${row.topic}`);
    console.log(`       ${row.preview}...`);
  }

  // Test FTS search
  try {
    const ftsTest = db.query(`
      SELECT s.topic, bm25(semantic_fts) as rank
      FROM semantic s
      JOIN semantic_fts ON semantic_fts.rowid = s.rowid
      WHERE semantic_fts MATCH '"architecture" OR "system"'
        AND s.session_id = ?
      ORDER BY rank
      LIMIT 3
    `).all(SESSION_ID);

    console.log(`\n  🔎 FTS test (architecture OR system):`);
    for (const row of ftsTest as any[]) {
      console.log(`     • ${row.topic} (rank: ${(row as any).rank.toFixed(3)})`);
    }
  } catch (e: any) {
    console.log(`\n  ⚠️  FTS test failed: ${e.message}`);
  }

  db.close();
  console.log(`\n✅ Import complete!\n`);
}

main().catch(console.error);
