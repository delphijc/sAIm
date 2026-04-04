/**
 * Analyze Command Handler
 *
 * Handles the `!analyze` Discord command. Parses arguments, fetches conversation
 * data from the MemoryDB adapter, runs analysis, and formats results.
 *
 * Can be imported by the export plugin or used standalone.
 *
 * Command syntax:
 *   !analyze                           → Discord summary, last 7 days
 *   !analyze range:last-30-days        → Last 30 days
 *   !analyze format:markdown           → Full markdown report as file attachment
 *   !analyze format:html range:all     → HTML report of all time
 *   !analyze topics                    → Topics only
 *   !analyze sentiment                 → Sentiment only
 *   !analyze tokens                    → Token efficiency only
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { runAnalysis, type ConversationRow } from "./analysis.ts";
import {
  formatAnalysisForDiscord,
  formatAnalysisAsMarkdown,
  formatAnalysisAsHTML,
} from "./analysis-formatter.ts";

// ============================================================================
// MemoryDB minimal interface (avoids hard dependency on singleton)
// ============================================================================

export interface AnalysisMemoryDB {
  query(
    collection: string,
    opts?: {
      filter?: Record<string, any>;
      limit?: number;
      orderBy?: Record<string, string>;
    }
  ): any[];
}

// ============================================================================
// Argument Parsing
// ============================================================================

export type AnalysisFormat = "discord" | "markdown" | "html";
export type AnalysisMode = "full" | "topics" | "sentiment" | "tokens";

export interface AnalysisArgs {
  format: AnalysisFormat;
  rangeMs: number | null; // null = all time
  mode: AnalysisMode;
}

const RANGE_MAP: Record<string, number> = {
  "last-7-days": 7 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "last-30-days": 30 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "last-90-days": 90 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "last-year": 365 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
  "all": null,
  "all-time": null,
};

/**
 * Parse the arguments string from the `!analyze` command.
 * Examples:
 *   ""                          → defaults
 *   "range:last-30-days"        → 30-day range
 *   "format:html range:all"     → HTML, all time
 *   "topics"                    → topics only mode
 *   "sentiment"                 → sentiment only mode
 *   "tokens"                    → tokens only mode
 */
export function parseAnalysisArgs(args: string): AnalysisArgs {
  const tokens = args.trim().toLowerCase().split(/\s+/).filter(Boolean);

  let format: AnalysisFormat = "discord";
  let rangeMs: number | null = 7 * 24 * 60 * 60 * 1000; // Default: last 7 days
  let mode: AnalysisMode = "full";

  for (const token of tokens) {
    // format:X
    if (token.startsWith("format:")) {
      const fmt = token.slice("format:".length);
      if (fmt === "markdown" || fmt === "md") format = "markdown";
      else if (fmt === "html") format = "html";
      else format = "discord";
      continue;
    }

    // range:X
    if (token.startsWith("range:")) {
      const rangeKey = token.slice("range:".length);
      if (rangeKey in RANGE_MAP) {
        rangeMs = RANGE_MAP[rangeKey];
      }
      continue;
    }

    // Mode shortcuts
    if (token === "topics") { mode = "topics"; continue; }
    if (token === "sentiment") { mode = "sentiment"; continue; }
    if (token === "tokens" || token === "token") { mode = "tokens"; continue; }

    // Plain range keywords without prefix
    if (token in RANGE_MAP) {
      rangeMs = RANGE_MAP[token];
      continue;
    }
  }

  // If a non-discord format was requested but mode is full, keep full
  // File formats always imply full report unless overridden
  return { format, rangeMs, mode };
}

// ============================================================================
// Data Fetching
// ============================================================================

function fetchConversations(
  db: AnalysisMemoryDB,
  rangeMs: number | null,
  userId?: string
): ConversationRow[] {
  const opts: Record<string, any> = {
    orderBy: { timestamp: "asc" },
  };

  if (rangeMs !== null) {
    const cutoff = Date.now() - rangeMs;
    // Use a filter that the MemoryDB supports
    opts.filter = { timestamp: { $lt: Date.now() + 1 } };
    // Fetch all then filter in memory (simpler than relying on $gte which may not be defined)
    const all: ConversationRow[] = db.query("conversations", { orderBy: { timestamp: "asc" } });
    const filtered = all.filter((c) => c.timestamp >= cutoff);
    if (userId) {
      return filtered.filter((c) => c.discordUserId === userId);
    }
    return filtered;
  }

  const all: ConversationRow[] = db.query("conversations", opts);
  if (userId) {
    return all.filter((c) => c.discordUserId === userId);
  }
  return all;
}

// ============================================================================
// Output File Helpers
// ============================================================================

function resolveOutputDir(): string {
  const paiDir = process.env.PAI_DIR ?? join(process.env.HOME ?? "", "Projects", "sam");
  return join(paiDir, ".agent", "skills", "discord-remote-control", "service", "data", "analysis");
}

function writeReportFile(content: string, filename: string): string {
  const dir = resolveOutputDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const filePath = join(dir, filename);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function timestampSuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// ============================================================================
// Partial-mode Formatters
// ============================================================================

function formatTopicsOnly(result: ReturnType<typeof runAnalysis>): string {
  const lines: string[] = ["## Topics Analysis"];
  if (result.topics.length === 0) {
    lines.push("No topics detected.");
    return lines.join("\n");
  }
  result.topics.forEach((t, i) => {
    lines.push(`${i + 1}. **${t.topic}** — ${t.percentage.toFixed(1)}% (${t.count} turn${t.count !== 1 ? "s" : ""})`);
    if (t.examples.length > 0) {
      lines.push(`   > ${t.examples[0]}`);
    }
  });
  return lines.join("\n");
}

function formatSentimentOnly(result: ReturnType<typeof runAnalysis>): string {
  const { sentiment } = result;
  const emoji = sentiment.overall === "positive" ? "😊" : sentiment.overall === "negative" ? "😕" : "😐";
  const lines: string[] = [`## Sentiment: ${sentiment.overall.charAt(0).toUpperCase() + sentiment.overall.slice(1)} ${emoji}`];
  if (sentiment.segments.length === 0) {
    lines.push("No sentiment data available.");
    return lines.join("\n");
  }
  lines.push(`**${sentiment.segments.length} session${sentiment.segments.length !== 1 ? "s" : ""} analyzed**`);
  sentiment.segments.slice(0, 5).forEach((seg) => {
    const d = new Date(seg.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    lines.push(`- \`${seg.sessionId.slice(0, 8)}\` (${d}): **${seg.sentiment}** (${seg.score.toFixed(2)})`);
  });
  return lines.join("\n");
}

function formatTokensOnly(result: ReturnType<typeof runAnalysis>): string {
  const te = result.tokenEfficiency;
  const lines: string[] = ["## Token Efficiency"];
  const fmt = (n: number) => n.toLocaleString("en-US");
  lines.push(`- **Total:** ${fmt(te.totalInputTokens)} input / ${fmt(te.totalOutputTokens)} output`);
  lines.push(`- **Avg per turn:** ${fmt(te.avgInputPerTurn)} in / ${fmt(te.avgOutputPerTurn)} out`);
  lines.push(`- **Efficiency ratio:** ${te.efficiency.toFixed(3)}`);
  if (te.mostEfficientSession.sessionId !== "none") {
    lines.push(`- **Most efficient:** \`${te.mostEfficientSession.sessionId.slice(0, 12)}\` (${te.mostEfficientSession.ratio.toFixed(2)})`);
    lines.push(`- **Least efficient:** \`${te.leastEfficientSession.sessionId.slice(0, 12)}\` (${te.leastEfficientSession.ratio.toFixed(2)})`);
  }
  return lines.join("\n");
}

// ============================================================================
// Main Handler
// ============================================================================

export interface AnalyzeResult {
  text: string;
  fileAttachment?: { path: string; name: string };
}

/**
 * Handle the `!analyze` command.
 *
 * @param args   - The argument string after `!analyze`
 * @param db     - MemoryDB adapter (injected for testability)
 * @param userId - Optional Discord user ID to scope the query
 */
export async function handleAnalyzeCommand(
  args: string,
  db: AnalysisMemoryDB,
  userId?: string
): Promise<AnalyzeResult> {
  const parsed = parseAnalysisArgs(args);
  const conversations = fetchConversations(db, parsed.rangeMs, userId);

  if (conversations.length === 0) {
    const rangeDesc = parsed.rangeMs
      ? `the last ${Math.round(parsed.rangeMs / 86400000)} days`
      : "all time";
    return {
      text: `No conversation data found for ${rangeDesc}.`,
    };
  }

  const result = runAnalysis(conversations);

  // Mode-only responses (no file attachment)
  if (parsed.mode === "topics") {
    return { text: formatTopicsOnly(result) };
  }
  if (parsed.mode === "sentiment") {
    return { text: formatSentimentOnly(result) };
  }
  if (parsed.mode === "tokens") {
    return { text: formatTokensOnly(result) };
  }

  // Full analysis
  const discordSummary = formatAnalysisForDiscord(result);

  if (parsed.format === "markdown") {
    const content = formatAnalysisAsMarkdown(result);
    const filename = `analysis-${timestampSuffix()}.md`;
    const filePath = writeReportFile(content, filename);
    return {
      text: discordSummary,
      fileAttachment: { path: filePath, name: filename },
    };
  }

  if (parsed.format === "html") {
    const content = formatAnalysisAsHTML(result);
    const filename = `analysis-${timestampSuffix()}.html`;
    const filePath = writeReportFile(content, filename);
    return {
      text: discordSummary,
      fileAttachment: { path: filePath, name: filename },
    };
  }

  // Default: discord text only
  return { text: discordSummary };
}
