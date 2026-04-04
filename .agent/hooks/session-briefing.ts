#!/usr/bin/env bun

/**
 * Session Briefing Hook
 *
 * Queries memory.db at SessionStart and PreCompact to build a dynamic
 * session briefing. The briefing evolves as the conversation progresses:
 *
 * - SessionStart: Full briefing with top memories, recent topics, and stats
 * - PreCompact: Refreshed briefing incorporating newly extracted facts
 *
 * Outputs a <system-reminder> block that Claude Code injects into context.
 * Reads memory.db directly (no dependency on memory server being up).
 */

import { Database } from "bun:sqlite";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { PAI_DIR } from "./lib/pai-paths";

const DB_PATH = join(PAI_DIR, "discord-remote-control", "memory.db");
const BRIEFING_STATE_FILE = join(PAI_DIR, ".session-briefing-state.json");

interface BriefingState {
  sessionId: string;
  generatedAt: number;
  turnCount: number;
  topicsSeen: string[];
}

/**
 * Load or initialize briefing state for migration tracking
 */
function loadBriefingState(): BriefingState {
  try {
    if (existsSync(BRIEFING_STATE_FILE)) {
      return JSON.parse(readFileSync(BRIEFING_STATE_FILE, "utf-8"));
    }
  } catch {}
  return {
    sessionId: "",
    generatedAt: 0,
    turnCount: 0,
    topicsSeen: [],
  };
}

function saveBriefingState(state: BriefingState): void {
  try {
    writeFileSync(BRIEFING_STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

/**
 * Query memory.db directly for briefing data
 */
function buildBriefing(): string | null {
  if (!existsSync(DB_PATH)) {
    console.error(`Session briefing: memory.db not found at ${DB_PATH}`);
    return null;
  }

  let db: Database;
  try {
    db = new Database(DB_PATH, { readonly: true });
  } catch (e) {
    console.error(`Session briefing: failed to open memory.db: ${e}`);
    return null;
  }

  try {
    // 1. Memory stats
    const semanticCount =
      (db.prepare("SELECT COUNT(*) as count FROM semantic").get() as any)
        ?.count ?? 0;
    const conversationCount =
      (
        db.prepare("SELECT COUNT(*) as count FROM conversations").get() as any
      )?.count ?? 0;
    const associationCount =
      (
        db.prepare("SELECT COUNT(*) as count FROM associations").get() as any
      )?.count ?? 0;

    if (semanticCount === 0 && conversationCount === 0) {
      db.close();
      return null; // No memories yet
    }

    // 2. Top topics by frequency
    const topTopics = db
      .prepare(
        `SELECT topic, COUNT(*) as count
         FROM semantic
         GROUP BY topic
         ORDER BY count DESC
         LIMIT 8`
      )
      .all() as { topic: string; count: number }[];

    // 3. Highest confidence memories (most reliable facts)
    const highConfidence = db
      .prepare(
        `SELECT topic, summary, confidence, access_count
         FROM semantic
         WHERE confidence >= 0.7
         ORDER BY confidence DESC, access_count DESC
         LIMIT 10`
      )
      .all() as {
      topic: string;
      summary: string;
      confidence: number;
      access_count: number;
    }[];

    // 4. Most accessed memories (most useful)
    const mostAccessed = db
      .prepare(
        `SELECT topic, summary, access_count, confidence
         FROM semantic
         WHERE access_count > 0
         ORDER BY access_count DESC
         LIMIT 5`
      )
      .all() as {
      topic: string;
      summary: string;
      access_count: number;
      confidence: number;
    }[];

    // 5. Recent memories (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentMemories = db
      .prepare(
        `SELECT topic, summary, confidence, created_at
         FROM semantic
         WHERE created_at > ?
         ORDER BY created_at DESC
         LIMIT 8`
      )
      .all(oneDayAgo) as {
      topic: string;
      summary: string;
      confidence: number;
      created_at: number;
    }[];

    // 6. Recent conversation snippets (last session context)
    const recentConversations = db
      .prepare(
        `SELECT role, content, timestamp
         FROM conversations
         ORDER BY timestamp DESC
         LIMIT 6`
      )
      .all() as { role: string; content: string; timestamp: number }[];

    // 7. Check for skill invocation patterns (if table exists)
    let skillPatterns: { skill_name: string; count: number }[] = [];
    try {
      skillPatterns = db
        .prepare(
          `SELECT skill_name, COUNT(*) as count
           FROM skill_invocations
           GROUP BY skill_name
           ORDER BY count DESC
           LIMIT 5`
        )
        .all() as { skill_name: string; count: number }[];
    } catch {
      // Table may not exist yet
    }

    // 8. Temporal awareness - time since last interaction
    const lastInteraction = db.prepare(
      `SELECT MAX(timestamp) as last_ts FROM conversations WHERE role = 'user'`
    ).get() as { last_ts: number } | null;

    // 8b. Topics cooling off - things discussed 3+ days ago but not recently
    let coolingTopics: { topic: string; last_mentioned: number; mentions: number }[] = [];
    try {
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const sevenDaysBeforeThreeDaysAgo = threeDaysAgo - 7 * 24 * 60 * 60 * 1000;
      coolingTopics = db.prepare(`
        SELECT topic, MAX(created_at) as last_mentioned, COUNT(*) as mentions
        FROM semantic
        WHERE created_at < ? AND created_at > ?
        GROUP BY topic
        HAVING mentions >= 2
        AND topic NOT IN (
          SELECT topic FROM semantic WHERE created_at > ?
        )
        ORDER BY mentions DESC
        LIMIT 5
      `).all(oneDayAgo, sevenDaysBeforeThreeDaysAgo, oneDayAgo) as { topic: string; last_mentioned: number; mentions: number }[];
    } catch {
      // cooling topics query failed, skip
    }

    // 9. Proactive recommendations from latest retrospective
    let latestRetro: { recommendations: string; mode: string; timestamp: number } | null = null;
    try {
      latestRetro = db.prepare(`
        SELECT recommendations, mode, timestamp
        FROM retrospectives
        ORDER BY timestamp DESC
        LIMIT 1
      `).get() as { recommendations: string; mode: string; timestamp: number } | null;
    } catch {
      // retrospectives table may not exist yet
    }

    // 10. Open threads - topics that seem unfinished
    let openThreadMessages: { content: string; timestamp: number }[] = [];
    try {
      openThreadMessages = db.prepare(`
        SELECT content, timestamp FROM conversations
        WHERE role = 'user'
        AND timestamp > ?
        ORDER BY timestamp DESC
        LIMIT 20
      `).all(Date.now() - 3 * 24 * 60 * 60 * 1000) as { content: string; timestamp: number }[];
    } catch {
      // conversations query for open threads failed, skip
    }

    db.close();

    // Build the briefing markdown
    const sections: string[] = [];

    sections.push(`# Session Briefing (from memory.db)`);
    sections.push(
      `*Generated: ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} | ${semanticCount} facts | ${conversationCount} conversation turns | ${associationCount} associations*\n`
    );

    // Top topics
    if (topTopics.length > 0) {
      sections.push(`## Knowledge Domains`);
      sections.push(
        topTopics.map((t) => `- **${t.topic}** (${t.count})`).join("\n")
      );
      sections.push("");
    }

    // High confidence facts
    if (highConfidence.length > 0) {
      sections.push(`## Key Facts (High Confidence)`);
      for (const mem of highConfidence) {
        const pct = (mem.confidence * 100).toFixed(0);
        sections.push(
          `- **${mem.topic}** (${pct}%, accessed ${mem.access_count}x): ${mem.summary.substring(0, 150)}`
        );
      }
      sections.push("");
    }

    // Most accessed (most useful to user)
    if (mostAccessed.length > 0) {
      sections.push(`## Frequently Referenced`);
      for (const mem of mostAccessed) {
        sections.push(
          `- **${mem.topic}** (${mem.access_count}x): ${mem.summary.substring(0, 120)}`
        );
      }
      sections.push("");
    }

    // Recent learnings
    if (recentMemories.length > 0) {
      sections.push(`## Recent Learnings (Last 24h)`);
      for (const mem of recentMemories) {
        const timeAgo = formatTimeAgo(mem.created_at);
        sections.push(
          `- [${timeAgo}] **${mem.topic}**: ${mem.summary.substring(0, 120)}`
        );
      }
      sections.push("");
    }

    // Recent conversation context
    if (recentConversations.length > 0) {
      sections.push(`## Last Conversation Context`);
      // Reverse to chronological order
      const ordered = [...recentConversations].reverse();
      for (const conv of ordered) {
        const role = conv.role === "user" ? "You" : "Sam";
        const snippet = conv.content.substring(0, 200);
        sections.push(`**${role}**: ${snippet}${conv.content.length > 200 ? "..." : ""}`);
      }
      sections.push("");
    }

    // Temporal awareness
    if (lastInteraction?.last_ts) {
      const hoursSince = Math.floor((Date.now() - lastInteraction.last_ts) / (60 * 60 * 1000));
      if (hoursSince > 2) {
        sections.push(`## Time Context`);
        if (hoursSince < 24) {
          sections.push(`It's been **${hoursSince} hours** since your last interaction.`);
        } else {
          const daysSince = Math.floor(hoursSince / 24);
          sections.push(`It's been **${daysSince} day${daysSince > 1 ? 's' : ''}** since your last interaction.`);
        }

        if (coolingTopics.length > 0) {
          sections.push(`\n**Topics cooling off** (active recently, quiet now):`);
          for (const t of coolingTopics) {
            const daysAgo = Math.floor((Date.now() - t.last_mentioned) / (24 * 60 * 60 * 1000));
            sections.push(`- ${t.topic} (${t.mentions} mentions, last ${daysAgo}d ago)`);
          }
        }
        sections.push("");
      }
    }

    // Proactive recommendations
    if (latestRetro) {
      try {
        const retroAge = Math.floor((Date.now() - latestRetro.timestamp) / (24 * 60 * 60 * 1000));
        if (retroAge < 7) {
          const recs = JSON.parse(latestRetro.recommendations);
          const highRecs = (recs as string[]).filter((r) => r.startsWith('[HIGH]')).slice(0, 3);
          if (highRecs.length > 0) {
            sections.push(`## Active Recommendations`);
            sections.push(`*From ${latestRetro.mode} retrospective, ${retroAge === 0 ? 'today' : retroAge + 'd ago'}:*`);
            for (const rec of highRecs) {
              sections.push(`- ${rec}`);
            }
            sections.push("");
          }
        }
      } catch {
        // malformed recommendations JSON, skip
      }
    }

    // Open threads
    if (openThreadMessages.length > 0) {
      try {
        const openThreadPatterns = /\b(tomorrow|next time|later|follow up|TODO|will do|need to|should we|let's try|going to)\b/i;
        const threads: string[] = [];

        for (const msg of openThreadMessages) {
          if (openThreadPatterns.test(msg.content)) {
            const snippet = msg.content.substring(0, 100);
            const timeAgo = formatTimeAgo(msg.timestamp);
            threads.push(`- [${timeAgo}] "${snippet}${msg.content.length > 100 ? '...' : ''}"`);
          }
        }

        if (threads.length > 0) {
          sections.push(`## Open Threads`);
          sections.push(threads.slice(0, 5).join("\n"));
          sections.push("");
        }
      } catch {
        // open threads processing failed, skip
      }
    }

    // Latest journal reference
    try {
      const journalDir = join(PAI_DIR, '..', 'History', 'journals');
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const yearMonth = today.substring(0, 7);
      const yesterdayYearMonth = yesterday.substring(0, 7);

      const todayJournal = join(journalDir, yearMonth, `${today}-journal.md`);
      const yesterdayJournal = join(journalDir, yesterdayYearMonth, `${yesterday}-journal.md`);

      if (existsSync(todayJournal)) {
        sections.push(`## Today's Journal`);
        sections.push(`Journal available at: ${todayJournal}`);
        sections.push("");
      } else if (existsSync(yesterdayJournal)) {
        sections.push(`## Yesterday's Journal`);
        sections.push(`Journal available at: ${yesterdayJournal}`);
        sections.push("");
      }
    } catch {
      // journal lookup failed, skip
    }

    // Skill patterns
    if (skillPatterns.length > 0) {
      sections.push(`## Skill Usage Patterns`);
      sections.push(
        skillPatterns.map((s) => `- ${s.skill_name}: ${s.count}x`).join("\n")
      );
      sections.push("");
    }

    return sections.join("\n");
  } catch (e) {
    console.error(`Session briefing: query error: ${e}`);
    try {
      db.close();
    } catch {}
    return null;
  }
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

async function main() {
  // Read stdin for hook context
  let input = "";
  try {
    input = await Bun.stdin.text();
  } catch {}

  let sessionId = "unknown";
  let isPreCompact = false;
  try {
    const parsed = JSON.parse(input);
    sessionId = parsed.conversation_id || parsed.session_id || "unknown";
    // Detect if this is a PreCompact invocation
    isPreCompact = parsed.hook_event === "PreCompact" || process.argv.includes("--precompact");
  } catch {}

  // Skip for subagent sessions
  const isSubagent =
    (process.env.CLAUDE_PROJECT_DIR || "").includes("/.claude/agents/") ||
    process.env.CLAUDE_AGENT_TYPE !== undefined;
  if (isSubagent) {
    process.exit(0);
  }

  // Build the briefing
  const briefing = buildBriefing();

  if (!briefing) {
    console.error("Session briefing: no memories to brief on (empty DB)");
    process.exit(0);
  }

  // Update state for migration tracking
  const state = loadBriefingState();
  state.sessionId = sessionId;
  state.generatedAt = Date.now();
  state.turnCount = isPreCompact ? state.turnCount + 1 : 0;
  saveBriefingState(state);

  // Output as system-reminder (Claude Code hooks output format)
  const label = isPreCompact ? "Refreshed Session Briefing" : "Session Briefing";
  console.log(`<system-reminder>\n${label}:\n\n${briefing}\n\n      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.\n</system-reminder>`);

  console.error(
    `Session briefing ${isPreCompact ? "refreshed" : "generated"} for session ${sessionId}`
  );
}

main().catch(() => process.exit(0));
