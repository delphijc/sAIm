/**
 * Memory Consolidation Engine
 *
 * Periodic maintenance for memory.db to keep it healthy and useful:
 *   1. Merge near-duplicate semantic memories (Jaccard similarity > 0.7)
 *   2. Strengthen corroborated facts (same topic from multiple sources)
 *   3. Surface forgotten insights (high-confidence, unaccessed 14+ days)
 *   4. Prune low-value noise (confidence < 0.3, never accessed, older than 30 days)
 *   5. Clean up orphaned associations
 *   6. Emit a structured consolidation report
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { initializeMemory, getMemoryInstance } from "./db.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsolidationReport {
  timestamp: number;
  duplicatesMerged: number;
  factsStrengthened: number;
  forgottenInsights: { topic: string; summary: string; daysSinceAccess: number }[];
  noisePruned: number;
  orphanedAssociationsRemoved: number;
  /** 0–100: ratio of high-confidence memories (≥ 0.7) to total */
  memoryHealthScore: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Jaccard similarity over word sets, ignoring tokens shorter than 3 characters.
 */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

function msTodays(ms: number): number {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Step 1: Merge near-duplicates
// ---------------------------------------------------------------------------

/**
 * Within each topic group, compare all pairs by Jaccard similarity.
 * When similarity > 0.7: keep the higher-confidence record, absorb the
 * other's access_count, then delete the duplicate.
 *
 * Returns the number of duplicates removed.
 */
function mergeNearDuplicates(
  mem: ReturnType<typeof getMemoryInstance>
): { merged: number; log: string[] } {
  const rows: any[] = mem.rawQuery(
    "SELECT id, topic, summary, confidence, access_count FROM semantic ORDER BY topic, confidence DESC"
  );

  // Group by topic
  const byTopic = new Map<string, any[]>();
  for (const row of rows) {
    const list = byTopic.get(row.topic) ?? [];
    list.push(row);
    byTopic.set(row.topic, list);
  }

  let merged = 0;
  const log: string[] = [];
  const deleted = new Set<string>();

  for (const [topic, group] of byTopic) {
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      if (deleted.has(a.id)) continue;

      for (let j = i + 1; j < group.length; j++) {
        const b = group[j];
        if (deleted.has(b.id)) continue;

        const sim = jaccardSimilarity(a.summary, b.summary);
        if (sim <= 0.7) continue;

        // Keep the record with higher confidence (a is already sorted DESC)
        const keeper = a.confidence >= b.confidence ? a : b;
        const duplicate = a.confidence >= b.confidence ? b : a;

        // Absorb access_count from duplicate into keeper
        const newAccessCount = (keeper.access_count ?? 0) + (duplicate.access_count ?? 0);
        mem.rawRun(
          "UPDATE semantic SET access_count = ? WHERE id = ?",
          newAccessCount,
          keeper.id
        );

        mem.rawRun("DELETE FROM semantic WHERE id = ?", duplicate.id);
        deleted.add(duplicate.id);
        merged++;

        log.push(
          `Merged duplicate in topic "${topic}" (sim=${sim.toFixed(2)}): kept ${keeper.id}, removed ${duplicate.id}`
        );
      }
    }
  }

  return { merged, log };
}

// ---------------------------------------------------------------------------
// Step 2: Strengthen corroborated facts
// ---------------------------------------------------------------------------

/**
 * Find topics that appear from both "discord" and "claude-code-hook" sources.
 * Boost confidence by 10% (capped at 1.0) for those memories.
 *
 * Returns the count of memories updated.
 */
function strengthenCorroboratedFacts(
  mem: ReturnType<typeof getMemoryInstance>
): { strengthened: number; log: string[] } {
  // Find topics with entries from more than one distinct source
  const corroborated: any[] = mem.rawQuery(`
    SELECT topic
    FROM semantic
    GROUP BY topic
    HAVING COUNT(DISTINCT source) > 1
  `);

  if (corroborated.length === 0) return { strengthened: 0, log: [] };

  const topics = corroborated.map((r: any) => r.topic);
  const placeholders = topics.map(() => "?").join(", ");

  const result = mem.rawRun(
    `UPDATE semantic
     SET confidence = MIN(1.0, confidence + 0.1)
     WHERE topic IN (${placeholders})`,
    ...topics
  );

  const count = (result as any).changes ?? 0;
  const log = count > 0
    ? [`Strengthened ${count} memories across ${topics.length} corroborated topics`]
    : [];

  return { strengthened: count, log };
}

// ---------------------------------------------------------------------------
// Step 3: Surface forgotten insights
// ---------------------------------------------------------------------------

/**
 * Find high-confidence memories (>= 0.7) with at least one prior access
 * that have not been accessed in 14+ days.
 *
 * Returns up to 10 entries, ordered by confidence then access_count.
 */
function surfaceForgottenInsights(
  mem: ReturnType<typeof getMemoryInstance>
): { topic: string; summary: string; daysSinceAccess: number }[] {
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

  const rows: any[] = mem.rawQuery(
    `SELECT topic, summary, last_access
     FROM semantic
     WHERE confidence >= 0.7
       AND access_count >= 1
       AND last_access < ?
     ORDER BY confidence DESC, access_count DESC
     LIMIT 10`,
    fourteenDaysAgo
  );

  return rows.map((r: any) => ({
    topic: r.topic,
    summary: r.summary,
    daysSinceAccess: msTodays(Date.now() - r.last_access),
  }));
}

// ---------------------------------------------------------------------------
// Step 4: Prune low-value noise
// ---------------------------------------------------------------------------

/**
 * Delete memories that meet all three criteria:
 *   - confidence < 0.3
 *   - access_count = 0
 *   - created_at older than 30 days
 *
 * Returns the number of records removed.
 */
function pruneNoise(
  mem: ReturnType<typeof getMemoryInstance>
): { pruned: number; log: string[] } {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const result = mem.rawRun(
    `DELETE FROM semantic
     WHERE confidence < 0.3
       AND access_count = 0
       AND created_at < ?`,
    thirtyDaysAgo
  );

  const pruned = (result as any).changes ?? 0;
  const log = pruned > 0 ? [`Pruned ${pruned} low-value noise memories`] : [];

  return { pruned, log };
}

// ---------------------------------------------------------------------------
// Step 5: Orphaned association cleanup
// ---------------------------------------------------------------------------

/**
 * Remove associations where either source_id or target_id no longer exists
 * in the semantic table.
 *
 * Returns the number of orphaned rows removed.
 */
function cleanOrphanedAssociations(
  mem: ReturnType<typeof getMemoryInstance>
): { removed: number; log: string[] } {
  const result = mem.rawRun(`
    DELETE FROM associations
    WHERE source_id NOT IN (SELECT id FROM semantic)
       OR target_id NOT IN (SELECT id FROM semantic)
  `);

  const removed = (result as any).changes ?? 0;
  const log = removed > 0
    ? [`Removed ${removed} orphaned associations`]
    : [];

  return { removed, log };
}

// ---------------------------------------------------------------------------
// Step 6: Health score
// ---------------------------------------------------------------------------

function computeHealthScore(mem: ReturnType<typeof getMemoryInstance>): number {
  const totals = mem.rawQuery("SELECT COUNT(*) AS total FROM semantic");
  const total = totals[0]?.total ?? 0;
  if (total === 0) return 100;

  const highs = mem.rawQuery(
    "SELECT COUNT(*) AS cnt FROM semantic WHERE confidence >= 0.7"
  );
  const high = highs[0]?.cnt ?? 0;

  return Math.round((high / total) * 100);
}

// ---------------------------------------------------------------------------
// Report persistence
// ---------------------------------------------------------------------------

function reportPath(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dir = path.join(
    process.env.HOME || "",
    "$HOME/Projects/sam/.agent/History/consolidation"
  );
  return path.join(dir, `${yyyy}-${mm}-${dd}-consolidation.md`);
}

export function formatConsolidationReport(report: ConsolidationReport): string {
  const date = new Date(report.timestamp).toISOString();

  const forgottenSection =
    report.forgottenInsights.length > 0
      ? report.forgottenInsights
          .map(
            (f) =>
              `- **${f.topic}** (${f.daysSinceAccess}d ago): ${f.summary}`
          )
          .join("\n")
      : "_None found_";

  return `# Memory Consolidation Report

**Date:** ${date}
**Health Score:** ${report.memoryHealthScore}/100

## Summary

| Metric | Count |
|--------|-------|
| Duplicates merged | ${report.duplicatesMerged} |
| Facts strengthened | ${report.factsStrengthened} |
| Forgotten insights surfaced | ${report.forgottenInsights.length} |
| Noise records pruned | ${report.noisePruned} |
| Orphaned associations removed | ${report.orphanedAssociationsRemoved} |

## Forgotten Insights (High-Confidence, Unaccessed 14+ Days)

${forgottenSection}
`;
}

function saveReport(report: ConsolidationReport): void {
  const filePath = reportPath();
  const dir = path.dirname(filePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, formatConsolidationReport(report), "utf-8");
  console.log(`Consolidation report saved to ${filePath}`);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runConsolidation(): Promise<ConsolidationReport> {
  const mem = getMemoryInstance();

  console.log("Starting memory consolidation...");

  // Step 1: Merge near-duplicates
  const { merged, log: mergeLog } = mergeNearDuplicates(mem);
  for (const line of mergeLog) console.log(`  [merge] ${line}`);

  // Step 2: Strengthen corroborated facts
  const { strengthened, log: strengthLog } = strengthenCorroboratedFacts(mem);
  for (const line of strengthLog) console.log(`  [strengthen] ${line}`);

  // Step 3: Surface forgotten insights
  const forgottenInsights = surfaceForgottenInsights(mem);
  if (forgottenInsights.length > 0) {
    console.log(`  [surface] Found ${forgottenInsights.length} forgotten insights`);
  }

  // Step 4: Prune noise
  const { pruned, log: pruneLog } = pruneNoise(mem);
  for (const line of pruneLog) console.log(`  [prune] ${line}`);

  // Step 5: Clean orphaned associations
  const { removed, log: orphanLog } = cleanOrphanedAssociations(mem);
  for (const line of orphanLog) console.log(`  [orphan] ${line}`);

  // Step 6: Health score
  const memoryHealthScore = computeHealthScore(mem);

  const report: ConsolidationReport = {
    timestamp: Date.now(),
    duplicatesMerged: merged,
    factsStrengthened: strengthened,
    forgottenInsights,
    noisePruned: pruned,
    orphanedAssociationsRemoved: removed,
    memoryHealthScore,
  };

  saveReport(report);

  console.log(
    `Consolidation complete. Health: ${memoryHealthScore}/100 | Merged: ${merged} | Pruned: ${pruned} | Orphans removed: ${removed}`
  );

  return report;
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const paiDir =
    process.env.PAI_DIR || path.join(process.env.HOME || "", ".claude");

  await initializeMemory({ paiDir });

  const report = await runConsolidation();
  console.log("\n" + formatConsolidationReport(report));
}
