/**
 * Retrospective Analysis Engine
 * Queries accumulated semantic memories, detects patterns, and produces
 * structured recommendations for continuous improvement.
 *
 * Three modes:
 *   - daily: lightweight topic clustering + pain point detection
 *   - weekly: deeper pattern analysis with cross-topic correlations
 *   - full: comprehensive retrospective with all analysis passes
 */

import { getMemoryInstance } from "./db.ts";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

export type RetrospectiveMode = "daily" | "weekly" | "full";

export interface PatternCluster {
  topic: string;
  count: number;
  tags: string[];
  entries: { summary: string; confidence: number; createdAt: number }[];
  isRecurring: boolean; // 3+ mentions = structural issue
}

export interface PainPoint {
  topic: string;
  occurrences: number;
  summaries: string[];
  firstSeen: number;
  lastSeen: number;
  severity: "low" | "medium" | "high"; // based on frequency + recency
}

export interface PreferenceDrift {
  topic: string;
  earlier: { summary: string; timestamp: number };
  later: { summary: string; timestamp: number };
  conflictScore: number; // 0-1, higher = more contradictory
}

export interface SkillUsageReport {
  skillName: string;
  invocations: number;
  successRate: number;
  avgDuration: number;
  manualOverrides: number;
}

export interface RetrospectiveReport {
  mode: RetrospectiveMode;
  timestamp: number;
  memoryCount: number;
  clusters: PatternCluster[];
  painPoints: PainPoint[];
  preferenceDrifts: PreferenceDrift[];
  skillUsage: SkillUsageReport[];
  recommendations: string[];
  summary: string;
}

/**
 * Get all semantic memories, optionally filtered by time window
 */
function getAllMemories(sinceTimestamp?: number): any[] {
  const mem = getMemoryInstance();
  let sql = "SELECT * FROM semantic WHERE 1=1";
  const params: any[] = [];

  if (sinceTimestamp) {
    sql += " AND created_at > ?";
    params.push(sinceTimestamp);
  }

  sql += " ORDER BY created_at DESC";
  return mem.rawQuery(sql, ...params);
}

/**
 * Cluster memories by topic, counting occurrences and detecting recurring patterns
 */
export function clusterByTopic(memories: any[]): PatternCluster[] {
  const clusters = new Map<string, PatternCluster>();

  for (const mem of memories) {
    const topic = mem.topic;
    const tags: string[] = mem.tags ? JSON.parse(mem.tags) : [];

    if (!clusters.has(topic)) {
      clusters.set(topic, {
        topic,
        count: 0,
        tags: [],
        entries: [],
        isRecurring: false,
      });
    }

    const cluster = clusters.get(topic)!;
    cluster.count++;
    cluster.entries.push({
      summary: mem.summary,
      confidence: mem.confidence,
      createdAt: mem.created_at,
    });

    // Merge tags (unique)
    for (const tag of tags) {
      if (!cluster.tags.includes(tag)) {
        cluster.tags.push(tag);
      }
    }

    cluster.isRecurring = cluster.count >= 3;
  }

  return Array.from(clusters.values()).sort((a, b) => b.count - a.count);
}

/**
 * Detect pain points: topics tagged as debugging/pain-point appearing 2+ times
 */
export function detectPainPoints(memories: any[]): PainPoint[] {
  const painMap = new Map<string, PainPoint>();

  for (const mem of memories) {
    const tags: string[] = mem.tags ? JSON.parse(mem.tags) : [];
    const topic = mem.topic;

    // Check if this memory relates to a pain point
    const isPain = tags.includes("pain-point") ||
      topic === "Debugging" ||
      /(?:bug|issue|error|broken|fail|crash|wrong|fix)/i.test(mem.summary);

    if (!isPain) continue;

    // Normalize key: use first 3 significant words of summary for grouping
    const words = mem.summary.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter((w: string) => w.length > 3);
    const groupKey = words.slice(0, 3).join(" ") || topic;

    if (!painMap.has(groupKey)) {
      painMap.set(groupKey, {
        topic: groupKey,
        occurrences: 0,
        summaries: [],
        firstSeen: mem.created_at,
        lastSeen: mem.created_at,
        severity: "low",
      });
    }

    const point = painMap.get(groupKey)!;
    point.occurrences++;
    point.summaries.push(mem.summary);
    point.firstSeen = Math.min(point.firstSeen, mem.created_at);
    point.lastSeen = Math.max(point.lastSeen, mem.created_at);

    // Severity based on frequency + recency
    const daysSinceLastSeen = (Date.now() - point.lastSeen) / (24 * 60 * 60 * 1000);
    if (point.occurrences >= 4 || (point.occurrences >= 2 && daysSinceLastSeen < 7)) {
      point.severity = "high";
    } else if (point.occurrences >= 2) {
      point.severity = "medium";
    }
  }

  return Array.from(painMap.values())
    .filter((p) => p.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Detect preference drift: decisions or preferences that contradict earlier ones
 */
export function detectPreferenceDrift(memories: any[]): PreferenceDrift[] {
  const drifts: PreferenceDrift[] = [];
  const decisionMemories = memories.filter((m) => {
    const tags: string[] = m.tags ? JSON.parse(m.tags) : [];
    return tags.includes("architectural-decision") ||
      tags.includes("preference") ||
      m.topic === "Decision" ||
      m.topic === "Preference";
  });

  // Compare pairs for contradiction signals
  for (let i = 0; i < decisionMemories.length; i++) {
    for (let j = i + 1; j < decisionMemories.length; j++) {
      const a = decisionMemories[i];
      const b = decisionMemories[j];

      // Only compare if they share topic similarity
      const aWords = new Set(a.summary.toLowerCase().split(/\s+/));
      const bWords = new Set(b.summary.toLowerCase().split(/\s+/));
      const intersection = [...aWords].filter((w) => bWords.has(w)).length;
      const union = new Set([...aWords, ...bWords]).size;
      const similarity = union === 0 ? 0 : intersection / union;

      if (similarity < 0.2) continue; // Not related enough

      // Check for contradiction signals
      const contradictionWords = ["instead", "rather than", "switched", "changed", "no longer", "replaced"];
      const hasContradiction = contradictionWords.some(
        (w) => b.summary.toLowerCase().includes(w) || a.summary.toLowerCase().includes(w)
      );

      if (hasContradiction && similarity > 0.15) {
        const [earlier, later] = a.created_at < b.created_at ? [a, b] : [b, a];
        drifts.push({
          topic: a.topic,
          earlier: { summary: earlier.summary, timestamp: earlier.created_at },
          later: { summary: later.summary, timestamp: later.created_at },
          conflictScore: Math.min(1.0, similarity + (hasContradiction ? 0.3 : 0)),
        });
      }
    }
  }

  return drifts.sort((a, b) => b.conflictScore - a.conflictScore);
}

/**
 * Get skill usage analytics from the skill_invocations table
 */
export function getSkillUsageAnalytics(): SkillUsageReport[] {
  try {
    const mem = getMemoryInstance();
    const rows = mem.rawQuery(`
      SELECT
        skill_name,
        COUNT(*) as invocations,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
        AVG(duration_ms) as avg_duration,
        SUM(CASE WHEN manual_override = 1 THEN 1 ELSE 0 END) as overrides
      FROM skill_invocations
      GROUP BY skill_name
      ORDER BY invocations DESC
    `);

    return rows.map((r: any) => ({
      skillName: r.skill_name,
      invocations: r.invocations,
      successRate: r.invocations > 0 ? r.successes / r.invocations : 0,
      avgDuration: Math.round(r.avg_duration || 0),
      manualOverrides: r.overrides,
    }));
  } catch {
    // Table might not exist yet
    return [];
  }
}

/**
 * Record a skill invocation for analytics
 */
export function recordSkillInvocation(
  skillName: string,
  success: boolean,
  durationMs?: number,
  mode?: string,
  manualOverride?: boolean,
  notes?: string,
  triggerContext?: string
): void {
  try {
    const mem = getMemoryInstance();
    mem.rawRun(
      `INSERT INTO skill_invocations (skill_name, timestamp, success, duration_ms, mode, manual_override, notes, trigger_context)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      skillName,
      Date.now(),
      success ? 1 : 0,
      durationMs || null,
      mode || null,
      manualOverride ? 1 : 0,
      notes || null,
      triggerContext || null
    );
  } catch (e) {
    console.warn("Failed to record skill invocation:", e);
  }
}

/**
 * Record an agent invocation for analytics
 */
export function recordAgentInvocation(
  agentName: string,
  success: boolean,
  durationMs?: number,
  triggerContext?: string,
  notes?: string
): void {
  try {
    const mem = getMemoryInstance();
    mem.rawRun(
      `INSERT INTO agent_invocations (agent_name, timestamp, success, duration_ms, trigger_context, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      agentName,
      Date.now(),
      success ? 1 : 0,
      durationMs || null,
      triggerContext || null,
      notes || null
    );
  } catch (e) {
    console.warn("Failed to record agent invocation:", e);
  }
}

/**
 * Get agent usage analytics from the agent_invocations table
 */
export function getAgentUsageAnalytics(): { agentName: string; invocations: number; successRate: number; avgDuration: number }[] {
  try {
    const mem = getMemoryInstance();
    const rows = mem.rawQuery(`
      SELECT
        agent_name,
        COUNT(*) as invocations,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
        AVG(duration_ms) as avg_duration
      FROM agent_invocations
      GROUP BY agent_name
      ORDER BY invocations DESC
    `);

    return rows.map((r: any) => ({
      agentName: r.agent_name,
      invocations: r.invocations,
      successRate: r.invocations > 0 ? r.successes / r.invocations : 0,
      avgDuration: Math.round(r.avg_duration || 0),
    }));
  } catch {
    return [];
  }
}

/**
 * Generate prioritized recommendations from analysis results
 */
function generateRecommendations(
  clusters: PatternCluster[],
  painPoints: PainPoint[],
  drifts: PreferenceDrift[],
  skillUsage: SkillUsageReport[]
): string[] {
  const recs: string[] = [];

  // High-severity pain points get top priority
  for (const pp of painPoints.filter((p) => p.severity === "high")) {
    recs.push(
      `[HIGH] Recurring issue "${pp.topic}" (${pp.occurrences}x). Consider a structural fix rather than repeated patches.`
    );
  }

  // Medium pain points
  for (const pp of painPoints.filter((p) => p.severity === "medium")) {
    recs.push(
      `[MEDIUM] Pattern "${pp.topic}" appeared ${pp.occurrences} times. Monitor for escalation.`
    );
  }

  // Preference drifts indicate evolving requirements
  for (const drift of drifts.slice(0, 3)) {
    recs.push(
      `[INFO] Decision drift detected in "${drift.topic}": earlier approach may be outdated. Review if current approach is intentional.`
    );
  }

  // Over-concentrated topics (too many facts in one area = complexity risk)
  const topClusters = clusters.filter((c) => c.count >= 5);
  for (const cluster of topClusters.slice(0, 3)) {
    recs.push(
      `[INFO] "${cluster.topic}" has ${cluster.count} entries — this area may benefit from consolidation or documentation.`
    );
  }

  // Skill usage gaps
  const failingSkills = skillUsage.filter((s) => s.successRate < 0.7 && s.invocations >= 3);
  for (const skill of failingSkills) {
    recs.push(
      `[MEDIUM] Skill "${skill.skillName}" has ${Math.round(skill.successRate * 100)}% success rate. Investigate failure patterns.`
    );
  }

  const overriddenSkills = skillUsage.filter((s) => s.manualOverrides > 2);
  for (const skill of overriddenSkills) {
    recs.push(
      `[LOW] Skill "${skill.skillName}" required ${skill.manualOverrides} manual overrides. Consider automating the common workaround.`
    );
  }

  return recs;
}

/**
 * Format the report as structured markdown
 */
function formatReport(report: RetrospectiveReport): string {
  const lines: string[] = [];
  const date = new Date(report.timestamp).toISOString().split("T")[0];

  lines.push(`# Retrospective Report — ${date} (${report.mode})`);
  lines.push("");
  lines.push(`**Memories analyzed:** ${report.memoryCount}`);
  lines.push(`**Patterns found:** ${report.clusters.length} topic clusters`);
  lines.push(`**Pain points:** ${report.painPoints.length}`);
  lines.push(`**Recommendations:** ${report.recommendations.length}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push(report.summary);
  lines.push("");

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push("## Recommendations");
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push("");
  }

  // Pain Points
  if (report.painPoints.length > 0) {
    lines.push("## Pain Points");
    for (const pp of report.painPoints) {
      lines.push(`### ${pp.topic} (${pp.severity})`);
      lines.push(`- Occurrences: ${pp.occurrences}`);
      lines.push(`- First seen: ${new Date(pp.firstSeen).toLocaleDateString()}`);
      lines.push(`- Last seen: ${new Date(pp.lastSeen).toLocaleDateString()}`);
      lines.push(`- Examples: ${pp.summaries.slice(0, 3).join("; ")}`);
      lines.push("");
    }
  }

  // Topic Clusters (top 10)
  if (report.mode !== "daily") {
    lines.push("## Top Topic Clusters");
    for (const cluster of report.clusters.slice(0, 10)) {
      const recurring = cluster.isRecurring ? " (recurring)" : "";
      lines.push(
        `- **${cluster.topic}** — ${cluster.count} entries${recurring} [${cluster.tags.join(", ")}]`
      );
    }
    lines.push("");
  }

  // Preference Drifts
  if (report.preferenceDrifts.length > 0) {
    lines.push("## Decision Drift");
    for (const drift of report.preferenceDrifts.slice(0, 5)) {
      lines.push(
        `- **${drift.topic}**: "${drift.earlier.summary.substring(0, 80)}" → "${drift.later.summary.substring(0, 80)}" (conflict: ${(drift.conflictScore * 100).toFixed(0)}%)`
      );
    }
    lines.push("");
  }

  // Skill Usage (if available)
  if (report.skillUsage.length > 0) {
    lines.push("## Skill Usage");
    for (const s of report.skillUsage) {
      lines.push(
        `- **${s.skillName}**: ${s.invocations} invocations, ${Math.round(s.successRate * 100)}% success, ${s.avgDuration}ms avg`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Run a retrospective analysis
 *
 * @param mode - "daily" (1-day window), "weekly" (7-day window), "full" (all time)
 * @returns The structured report
 */
export function runRetrospective(mode: RetrospectiveMode = "daily"): RetrospectiveReport {
  const now = Date.now();
  const windowMs: Record<RetrospectiveMode, number | undefined> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    full: undefined, // all time
  };

  const sinceTimestamp = windowMs[mode] ? now - windowMs[mode]! : undefined;
  const memories = getAllMemories(sinceTimestamp);

  // Run analysis passes
  const clusters = clusterByTopic(memories);
  const painPoints = detectPainPoints(memories);

  // Only run expensive analyses for weekly/full modes
  const drifts = mode === "daily" ? [] : detectPreferenceDrift(memories);
  const skillUsage = mode === "daily" ? [] : getSkillUsageAnalytics();

  // Generate recommendations
  const recommendations = generateRecommendations(clusters, painPoints, drifts, skillUsage);

  // Build summary
  const recurringCount = clusters.filter((c) => c.isRecurring).length;
  const highPainCount = painPoints.filter((p) => p.severity === "high").length;
  const summary = [
    `Analyzed ${memories.length} memories from ${mode === "full" ? "all time" : `the last ${mode === "daily" ? "24 hours" : "7 days"}`}.`,
    `Found ${clusters.length} topic clusters (${recurringCount} recurring).`,
    painPoints.length > 0
      ? `Detected ${painPoints.length} pain points (${highPainCount} high severity).`
      : "No significant pain points detected.",
    drifts.length > 0
      ? `Identified ${drifts.length} potential decision drifts.`
      : "",
    recommendations.length > 0
      ? `Generated ${recommendations.length} actionable recommendations.`
      : "No recommendations at this time — system appears healthy.",
  ]
    .filter(Boolean)
    .join(" ");

  const report: RetrospectiveReport = {
    mode,
    timestamp: now,
    memoryCount: memories.length,
    clusters,
    painPoints,
    preferenceDrifts: drifts,
    skillUsage,
    recommendations,
    summary,
  };

  return report;
}

/**
 * Run retrospective and save results to file + database
 */
export function runAndSaveRetrospective(
  mode: RetrospectiveMode = "daily",
  outputDir?: string
): { report: RetrospectiveReport; filePath: string } {
  const report = runRetrospective(mode);
  const markdown = formatReport(report);

  // Save to file
  // Derive the Claude projects memory directory dynamically from HOME
  const claudeProjectsDir = process.env.PAI_DIR
    ? path.join(process.env.PAI_DIR, "projects")
    : path.join(process.env.HOME || "", ".claude", "projects");
  const projectKey = `-home-${process.env.USER || "unknown"}-Projects-sam`;
  const dir = outputDir || path.join(claudeProjectsDir, projectKey, "memory");

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const date = new Date(report.timestamp).toISOString().split("T")[0];
  const filePath = path.join(dir, `retrospective-${date}-${mode}.md`);
  writeFileSync(filePath, markdown);

  // Save to retrospectives table
  try {
    const mem = getMemoryInstance();
    mem.rawRun(
      `INSERT INTO retrospectives (mode, timestamp, summary, recommendations, memory_count, patterns_found)
       VALUES (?, ?, ?, ?, ?, ?)`,
      mode,
      report.timestamp,
      report.summary,
      JSON.stringify(report.recommendations),
      report.memoryCount,
      report.clusters.length
    );
  } catch (e) {
    console.warn("Failed to save retrospective to DB:", e);
  }

  // Save recommendations as high-value semantic memories
  if (report.recommendations.length > 0) {
    try {
      const mem = getMemoryInstance();
      const topRecs = report.recommendations.slice(0, 5).join("\n");
      mem.rawRun(
        `INSERT INTO semantic (id, session_id, topic, summary, relevance_score, created_at, source_message_ids, access_count, last_access, confidence, source, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        crypto.randomUUID(),
        "retrospective",
        "Recommendation",
        topRecs.substring(0, 500),
        1.0,
        Date.now(),
        "[]",
        0,
        Date.now(),
        0.85,
        "retrospective",
        JSON.stringify(["recommendation", "insight"]),
      );
    } catch (e) {
      console.warn("Failed to save retrospective recommendations to memory:", e);
    }
  }

  // Record this as a skill invocation
  recordSkillInvocation("retrospective", true, undefined, mode);

  console.log(`📊 Retrospective (${mode}) complete: ${report.recommendations.length} recommendations`);
  return { report, filePath };
}

/**
 * Format report for concise Discord output
 */
export function formatForDiscord(report: RetrospectiveReport): string {
  const lines: string[] = [];
  const date = new Date(report.timestamp).toISOString().split("T")[0];

  lines.push(`**Retrospective Report — ${date} (${report.mode})**`);
  lines.push(`Analyzed ${report.memoryCount} memories.`);
  lines.push("");

  if (report.recommendations.length > 0) {
    lines.push("**Top Recommendations:**");
    for (const rec of report.recommendations.slice(0, 5)) {
      lines.push(`• ${rec}`);
    }
    lines.push("");
  }

  if (report.painPoints.length > 0) {
    lines.push(`**Pain Points:** ${report.painPoints.length} detected`);
    for (const pp of report.painPoints.slice(0, 3)) {
      lines.push(`• ${pp.topic} (${pp.severity}, ${pp.occurrences}x)`);
    }
    lines.push("");
  }

  const recurringCount = report.clusters.filter((c) => c.isRecurring).length;
  if (recurringCount > 0) {
    lines.push(`**Recurring Patterns:** ${recurringCount} topics with 3+ entries`);
  }

  if (report.summary) {
    lines.push("");
    lines.push(report.summary);
  }

  return lines.join("\n");
}
