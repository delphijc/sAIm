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

// Support both new location (memory-system) and env var override
const DB_PATH = process.env.MEMORY_DB_PATH || join(PAI_DIR, "memory-system", "memory.db");
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
function buildBriefing(sessionId: string = ""): string | null {
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

    // 2. Top topics by weighted score (recency, frequency, confidence)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const topTopics = db
      .prepare(
        `SELECT
           topic,
           COUNT(*) as count,
           SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as recent_count,
           COALESCE(AVG(confidence), 0) as avg_confidence,
           COALESCE(SUM(access_count), 0) as total_access_count
         FROM semantic
         WHERE created_at > ?
         GROUP BY topic
         ORDER BY count DESC
         LIMIT 20`
      )
      .all(oneDayAgo, sevenDaysAgo) as {
        topic: string;
        count: number;
        recent_count: number;
        avg_confidence: number;
        total_access_count: number;
      }[];

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

    // 5. Recent memories (extended to 72 hours for better coverage)
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    let recentMemories = db
      .prepare(
        `SELECT topic, summary, confidence, created_at
         FROM semantic
         WHERE created_at > ?
         ORDER BY created_at DESC
         LIMIT 20`
      )
      .all(threeDaysAgo) as {
      topic: string;
      summary: string;
      confidence: number;
      created_at: number;
    }[];

    // 6. Recent conversation snippets (last session context) - with session isolation
    let recentConversations = db
      .prepare(
        `SELECT role, content, timestamp
         FROM conversations
         WHERE session_id = ? OR ? = ''
         ORDER BY timestamp DESC
         LIMIT 20`
      )
      .all(sessionId, sessionId) as { role: string; content: string; timestamp: number }[];

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

    // Top topics - sorted by weighted score
    if (topTopics.length > 0) {
      // Calculate max access count for normalization
      const maxAccess = Math.max(...topTopics.map(t => t.total_access_count), 1);

      // Score and sort by composite weight
      const scoredTopics = topTopics.map((t) => ({
        ...t,
        weight: scoreDomain(t.topic, t.count, t.recent_count, t.avg_confidence, t.total_access_count, maxAccess)
      }));
      scoredTopics.sort((a, b) => b.weight - a.weight);

      sections.push(`## Knowledge Domains`);
      sections.push(
        scoredTopics.slice(0, 8).map((t) => `- **${t.topic}** (${t.count})`).join("\n")
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

    // Recent learnings - with composite scoring
    if (recentMemories.length > 0) {
      // Score each learning with composite metric
      const scoredLearnings = recentMemories.map(mem => {
        // Actionability: 40%
        const actionability = scoreActionability(mem.topic, mem.summary);

        // Confidence: 30%
        const confidenceScore = mem.confidence;

        // Recency: 20% (exponential decay, 24h half-life)
        const recencyScore = getRecencyScore(mem.created_at, 24 * 60 * 60 * 1000);

        // Relevance: 10% (bonus if mentioned in recent conversations)
        const conversationContent = recentConversations.map(c => c.content).join(" ").toLowerCase();
        const topicKeywords = `${mem.topic} ${mem.summary}`.toLowerCase().split(/\s+/);
        const mentionCount = topicKeywords.filter(k => conversationContent.includes(k)).length;
        const relevanceScore = Math.min(mentionCount * 0.2, 1.0);

        // Composite score
        const compositeScore =
          actionability * 0.4 +
          confidenceScore * 0.3 +
          recencyScore * 0.2 +
          relevanceScore * 0.1;

        return {
          ...mem,
          score: compositeScore
        };
      });

      // Sort by score and take top 8
      scoredLearnings.sort((a, b) => b.score - a.score);
      const topLearnings = scoredLearnings.slice(0, 8);

      sections.push(`## Recent Learnings (Last 72h)`);
      for (const mem of topLearnings) {
        const timeAgo = formatTimeAgo(mem.created_at);
        sections.push(
          `- [${timeAgo}] **${mem.topic}**: ${mem.summary.substring(0, 120)}`
        );
      }
      sections.push("");
    }

    // Recent conversation context - scored for relevance
    if (recentConversations.length > 0) {
      // Score conversations for relevance/importance
      const scoredConversations = recentConversations.map(conv => ({
        ...conv,
        score: scoreConversationTurn(conv.role, conv.content, conv.timestamp, recentMemories.slice(0, 5))
      }));

      // Sort by score (relevance) but keep chronological for display
      scoredConversations.sort((a, b) => b.score - a.score);

      // Take top 8 by relevance
      const topConversations = scoredConversations.slice(0, 8);

      // Re-sort chronologically for display
      topConversations.sort((a, b) => a.timestamp - b.timestamp);

      sections.push(`## Last Conversation Context`);
      for (const conv of topConversations) {
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

    // Open threads - with enhanced scoring
    if (openThreadMessages.length > 0) {
      try {
        const scoredThreads: { content: string; timestamp: number; score: number }[] = [];

        for (const msg of openThreadMessages) {
          const score = scoreOpenThread(msg.content);
          if (score > 0) {
            scoredThreads.push({
              content: msg.content,
              timestamp: msg.timestamp,
              score
            });
          }
        }

        // Sort by score descending
        scoredThreads.sort((a, b) => b.score - a.score);

        if (scoredThreads.length > 0) {
          sections.push(`## Open Threads`);
          const displayThreads = scoredThreads.slice(0, 5); // Top 5 threads
          for (const thread of displayThreads) {
            const snippet = thread.content.substring(0, 100);
            const timeAgo = formatTimeAgo(thread.timestamp);
            const scoreLabel = thread.score > 0.6 ? "🔴" : thread.score > 0.3 ? "🟡" : "🟢";
            sections.push(`- [${timeAgo}] ${scoreLabel} "${snippet}${thread.content.length > 100 ? '...' : ''}"`);
          }
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

/**
 * Enhanced Open Threads Detection
 * Scores threads based on patterns indicating unfinished work
 */
function scoreOpenThread(content: string): number {
  let score = 0;

  // Question detection (high confidence indicator)
  if (content.match(/\?$/m)) score += 0.3;

  // Temporal anchors (things deferred to future)
  if (content.match(/\b(tomorrow|next week|next time|eventually|someday|later|soon|next month|upcoming)\b/i)) {
    score += 0.2;
  }

  // Action verbs (things that need doing)
  if (content.match(/\b(debug|investigate|check|fix|build|implement|test|refactor|review|verify|validate|confirm|test)\b/i)) {
    score += 0.15;
  }

  // Blocking patterns (clearly stuck or waiting)
  if (content.match(/\b(blocked by|waiting for|stuck on|pending|hung|unable to|can't|cannot)\b/i)) {
    score += 0.2;
  }

  // Negations (things still undone)
  if (content.match(/\b(still need to|haven't|yet|not done|incomplete|unfinished)\b/i)) {
    score += 0.15;
  }

  // TODO/FIXME markers
  if (content.match(/\b(TODO|FIXME|BUG|ISSUE)\b/i)) {
    score += 0.25;
  }

  // Follow-up indicators
  if (content.match(/\b(follow up|come back to|revisit|circle back)\b/i)) {
    score += 0.2;
  }

  return Math.min(score, 1.0); // Cap at 1.0
}

/**
 * Calculate domain weight with composite scoring
 * - Recency (30%): Recent activity weighted higher
 * - Access Frequency (30%): Frequently referenced topics
 * - Confidence (20%): High-confidence memories matter more
 * - Project relevance (20%): Current context boost
 */
function scoreDomain(
  topic: string,
  count: number,
  recentCount: number,
  avgConfidence: number,
  accessCount: number,
  maxAccessInAnyDomain: number
): number {
  // Recency: topics with recent memories get boost
  const recencyScore = recentCount / Math.max(count, 1); // 0-1

  // Access frequency: normalized against max in any domain
  const frequencyScore = accessCount / Math.max(maxAccessInAnyDomain, 1); // 0-1

  // Confidence: average confidence of memories in this domain
  const confidenceScore = avgConfidence; // already 0-1

  // Composite
  return (
    recencyScore * 0.3 +
    frequencyScore * 0.3 +
    confidenceScore * 0.2
  );
}

/**
 * Calculate recency score with exponential decay over 7 days
 */
function getRecencyScore(timestamp: number, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
  const ageMs = Date.now() - timestamp;
  if (ageMs < 0) return 1.0;
  if (ageMs > maxAgeMs) return 0.0;
  // Exponential decay: e^(-ageMs/halflife)
  const halfLife = 3 * 24 * 60 * 60 * 1000; // 3 days
  return Math.exp(-ageMs / halfLife);
}

/**
 * Score actionability of a memory
 * Keywords: blocking, bug, critical, urgent, high-priority, etc.
 */
function scoreActionability(topic: string, summary: string): number {
  const combined = `${topic} ${summary}`.toLowerCase();

  if (combined.match(/\b(blocking|blocked|critical|urgent|high.?priority|asap|immediate)\b/)) {
    return 0.9;
  }
  if (combined.match(/\b(bug|error|crash|broken|fail|issue|fix)\b/)) {
    return 0.75;
  }
  if (combined.match(/\b(todo|fixme|implement|build|feature)\b/)) {
    return 0.6;
  }
  if (combined.match(/\b(question|unclear|unclear|need|want|should)\b/)) {
    return 0.4;
  }
  return 0.1; // Low actionability by default
}

/**
 * Score conversation turn for relevance and importance
 * Factors:
 * - Importance markers (TODO, code blocks, attachments, length)
 * - Actionability keywords
 * - Topic match with recent learnings
 */
function scoreConversationTurn(
  role: string,
  content: string,
  timestamp: number,
  recentLearnings: { topic: string; summary: string }[] = []
): number {
  let score = 0;

  // User messages are more important than assistant responses
  const roleMultiplier = role === 'user' ? 1.0 : 0.7;

  // Importance markers
  if (content.match(/```[\s\S]*?```/)) score += 0.2; // Code blocks
  if (content.match(/TODO|FIXME|BUG|ISSUE/i)) score += 0.25; // Explicit markers
  if (content.length > 500) score += 0.15; // Longer messages are more substantive
  if (content.match(/\[.*?\]\(.*?\)/)) score += 0.1; // Links/attachments

  // Actionability
  const actionability = scoreActionability("", content);
  score += actionability * 0.2;

  // Topic match with recent learnings
  if (recentLearnings.length > 0) {
    const contentWords = content.toLowerCase().split(/\s+/);
    for (const learning of recentLearnings) {
      const learningWords = `${learning.topic} ${learning.summary}`.toLowerCase().split(/\s+/);
      const matches = contentWords.filter(w => learningWords.includes(w)).length;
      if (matches > 0) {
        score += Math.min(matches * 0.05, 0.15); // Boost for keyword overlap
      }
    }
  }

  // Recency bonus (exponential decay, but within last 24h)
  const ageMs = Date.now() - timestamp;
  if (ageMs < 24 * 60 * 60 * 1000) {
    const recencyBonus = Math.exp(-ageMs / (12 * 60 * 60 * 1000)); // Half-life 12h
    score += recencyBonus * 0.1;
  }

  return Math.min(score * roleMultiplier, 1.0);
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
  const briefing = buildBriefing(sessionId);

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
