/**
 * Daily Journal Generator
 * Queries the last 24 hours of memory data and generates a narrative
 * daily journal entry. Saves to .agent/History/journals/YYYY-MM/YYYY-MM-DD-journal.md
 * and inserts a summary back into the semantic memory table.
 *
 * Usage:
 *   bun daily-journal.ts         (standalone — writes file and prints path)
 *   import { generateDailyJournal, generateAndSaveDailyJournal } from "./daily-journal.ts"
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { initializeMemory, getMemoryInstance } from "./db.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SemanticRow {
  id: string;
  session_id: string;
  topic: string;
  summary: string;
  relevance_score: number;
  created_at: number;
  source_message_ids: string;
  access_count: number;
  last_access: number;
  confidence: number;
  source: string;
  tags: string;
}

interface ConversationRow {
  id: string;
  session_id: string;
  discord_user_id: string;
  discord_channel_id: string;
  role: string;
  content: string;
  timestamp: number;
  metadata: string;
  source?: string;
}

interface AssociationRow {
  source_id: string;
  target_id: string;
  weight: number;
  co_activation_count: number;
  last_activated: number;
  source_topic: string;
  target_topic: string;
}

interface RetrospectiveRow {
  mode: string;
  timestamp: number;
  summary: string;
  recommendations: string;
  memory_count: number;
  patterns_found: number;
}

interface JournalData {
  date: string;
  generatedAt: string;
  semanticMemories: SemanticRow[];
  conversations: ConversationRow[];
  associations: AssociationRow[];
  retrospectives: RetrospectiveRow[];
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

/**
 * Collect all data needed for the journal from the last 24 hours.
 */
function collectJournalData(now: number): JournalData {
  const mem = getMemoryInstance();
  const cutoff = now - 24 * 60 * 60 * 1000;

  const date = new Date(now).toISOString().split("T")[0];
  const generatedAt = new Date(now).toISOString();

  // Semantic memories created in the last 24 hours
  const semanticMemories = mem.rawQuery(
    `SELECT * FROM semantic WHERE created_at > ? ORDER BY created_at DESC`,
    cutoff
  ) as SemanticRow[];

  // Conversations from the last 24 hours
  const conversations = mem.rawQuery(
    `SELECT * FROM conversations WHERE timestamp > ? ORDER BY timestamp ASC`,
    cutoff
  ) as ConversationRow[];

  // New associations formed today
  let associations: AssociationRow[] = [];
  try {
    associations = mem.rawQuery(
      `SELECT a.*, s1.topic as source_topic, s2.topic as target_topic
       FROM associations a
       JOIN semantic s1 ON s1.id = a.source_id
       JOIN semantic s2 ON s2.id = a.target_id
       WHERE a.last_activated > ?
       ORDER BY a.weight DESC
       LIMIT 10`,
      cutoff
    ) as AssociationRow[];
  } catch {
    // associations table or join may be empty — not a fatal error
    associations = [];
  }

  // Retrospectives run today
  let retrospectives: RetrospectiveRow[] = [];
  try {
    retrospectives = mem.rawQuery(
      `SELECT * FROM retrospectives WHERE timestamp > ? ORDER BY timestamp DESC`,
      cutoff
    ) as RetrospectiveRow[];
  } catch {
    retrospectives = [];
  }

  return { date, generatedAt, semanticMemories, conversations, associations, retrospectives };
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/**
 * Format a Unix timestamp (ms) to a human-readable time string (HH:MM).
 */
function fmtTime(tsMs: number): string {
  return new Date(tsMs).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Format a Unix timestamp (ms) to ISO date string.
 */
function fmtDate(tsMs: number): string {
  return new Date(tsMs).toISOString().split("T")[0];
}

/**
 * Parse a JSON tags field safely.
 */
function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Build the "Today's Narrative" section — a 2-3 sentence summary written as Sam.
 * Synthesised from memory counts, dominant topics, and retrospective summaries.
 */
function buildNarrative(data: JournalData): string {
  const { semanticMemories, conversations, retrospectives } = data;

  const memCount = semanticMemories.length;
  const convCount = conversations.length;

  if (memCount === 0 && convCount === 0) {
    return "Today was quiet — no new memories or conversations were recorded in the last 24 hours. " +
      "The system remained available, though no notable interactions took place. " +
      "Tomorrow may bring more to reflect on.";
  }

  // Find the most frequent topic
  const topicFreq = new Map<string, number>();
  for (const mem of semanticMemories) {
    topicFreq.set(mem.topic, (topicFreq.get(mem.topic) ?? 0) + 1);
  }
  const topTopics = [...topicFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);

  const topicLine = topTopics.length > 0
    ? `The dominant topics today were ${topTopics.join(", ")}.`
    : "";

  const retro = retrospectives.find((r) => r.mode === "daily");
  const retroLine = retro
    ? retro.summary.split(".")[0] + "."
    : "";

  const activity = convCount > 0
    ? `I engaged in ${convCount} conversation turn${convCount === 1 ? "" : "s"} and extracted ${memCount} new semantic memor${memCount === 1 ? "y" : "ies"}.`
    : `I extracted ${memCount} new semantic memor${memCount === 1 ? "y" : "ies"} during today's sessions.`;

  return [activity, topicLine, retroLine].filter(Boolean).join(" ");
}

/**
 * Build the "Key Moments" section — timestamped highlights from conversations.
 * Focuses on assistant turns that contain structured output markers.
 */
function buildKeyMoments(data: JournalData): string[] {
  const { conversations } = data;

  if (conversations.length === 0) {
    return ["No conversations recorded today."];
  }

  const moments: string[] = [];

  // Look for assistant messages with completion markers or structured content
  const NOTABLE_PATTERNS = [
    /(?:fixed|resolved|completed|implemented|added|created|built|deployed)\s+(.{5,100})/i,
    /(?:decided|chose|switched to|going with)\s+(.{5,100})/i,
    /(?:root cause|the issue was|problem was|caused by)\s+(.{5,100})/i,
    /(?:summary|findings|analysis|assessment)\s*:\s*(.{5,100})/i,
    /(?:##\s+.{5,50})/,
  ];

  for (const turn of conversations) {
    if (turn.role !== "assistant") continue;

    for (const pat of NOTABLE_PATTERNS) {
      const match = turn.content.match(pat);
      if (match) {
        const excerpt = (match[1] || match[0]).trim().replace(/\n/g, " ").substring(0, 120);
        moments.push(`- **${fmtTime(turn.timestamp)}** — ${excerpt}`);
        break; // one moment per turn
      }
    }

    if (moments.length >= 8) break;
  }

  if (moments.length === 0) {
    // Fall back to first few user messages
    const userMessages = conversations.filter((c) => c.role === "user").slice(0, 3);
    for (const msg of userMessages) {
      const excerpt = msg.content.trim().replace(/\n/g, " ").substring(0, 100);
      moments.push(`- **${fmtTime(msg.timestamp)}** (user) — ${excerpt}`);
    }
  }

  if (moments.length === 0) {
    return ["No notable moments captured."];
  }

  return moments;
}

/**
 * Build the "What I Learned" section — new semantic memories grouped by topic.
 */
function buildLearned(data: JournalData): string[] {
  const { semanticMemories } = data;

  if (semanticMemories.length === 0) {
    return ["No new memories extracted today."];
  }

  // Group by topic
  const byTopic = new Map<string, string[]>();
  for (const mem of semanticMemories) {
    if (!byTopic.has(mem.topic)) byTopic.set(mem.topic, []);
    byTopic.get(mem.topic)!.push(mem.summary.substring(0, 120));
  }

  const lines: string[] = [];
  for (const [topic, summaries] of byTopic.entries()) {
    lines.push(`**${topic}** (${summaries.length})`);
    for (const s of summaries.slice(0, 3)) {
      lines.push(`  - ${s}`);
    }
    if (summaries.length > 3) {
      lines.push(`  - …and ${summaries.length - 3} more`);
    }
  }

  return lines;
}

/**
 * Build the "Open Threads" section — unresolved topics, follow-ups, and questions.
 */
function buildOpenThreads(data: JournalData): string[] {
  const { conversations } = data;

  const threads: string[] = [];
  const OPEN_PATTERNS = [
    /\btomorrow\b/i,
    /\bnext time\b/i,
    /\bfollow[- ]up\b/i,
    /\blater\b/i,
    /\bwe should\b/i,
    /\bwe need to\b/i,
    /\blet me know\b/i,
    /\bpending\b/i,
    /\bstill need\b/i,
    /\bto[- ]do\b/i,
  ];

  // Questions in user messages that weren't immediately followed by a detailed answer
  const sessionTurns = [...conversations];
  for (let i = 0; i < sessionTurns.length; i++) {
    const turn = sessionTurns[i];

    // User question that was the last message in its session (no assistant follow-up)
    if (turn.role === "user" && turn.content.trim().endsWith("?")) {
      const next = sessionTurns[i + 1];
      if (!next || next.role !== "assistant" || next.content.length < 50) {
        const excerpt = turn.content.trim().replace(/\n/g, " ").substring(0, 100);
        threads.push(`- Unanswered question: "${excerpt}"`);
      }
    }

    // Open-ended signals in any message
    for (const pat of OPEN_PATTERNS) {
      if (pat.test(turn.content)) {
        const excerpt = turn.content
          .split(/\n/)
          .find((line) => pat.test(line))
          ?.trim()
          .substring(0, 100);
        if (excerpt) {
          threads.push(`- Open signal (${turn.role}): "${excerpt}"`);
          break;
        }
      }
    }

    if (threads.length >= 6) break;
  }

  // Topics from semantic memory that appear only once (potentially incomplete)
  const topicCounts = new Map<string, number>();
  for (const mem of data.semanticMemories) {
    topicCounts.set(mem.topic, (topicCounts.get(mem.topic) ?? 0) + 1);
  }
  const singletons = [...topicCounts.entries()]
    .filter(([, count]) => count === 1)
    .slice(0, 3);

  for (const [topic] of singletons) {
    const mem = data.semanticMemories.find((m) => m.topic === topic);
    if (mem) {
      threads.push(`- Single mention: **${topic}** — "${mem.summary.substring(0, 80)}"`);
    }
  }

  return threads.length > 0 ? threads : ["No obvious open threads detected."];
}

/**
 * Build the "Connections Made" section — new Hebbian associations.
 */
function buildConnections(data: JournalData): string[] {
  const { associations } = data;

  if (associations.length === 0) {
    return ["No new associations formed today."];
  }

  const lines: string[] = [];
  for (const assoc of associations.slice(0, 8)) {
    const weight = (assoc.weight * 100).toFixed(0);
    lines.push(
      `- **${assoc.source_topic}** ↔ **${assoc.target_topic}** (strength: ${weight}%, co-activations: ${assoc.co_activation_count})`
    );
  }

  return lines;
}

/**
 * Build the "Reflection" section — self-assessment based on retrospective data and pain signals.
 */
function buildReflection(data: JournalData): string {
  const { retrospectives, semanticMemories, conversations } = data;

  const retro = retrospectives.find((r) => r.mode === "daily");

  // Parse pain-point tagged memories
  const painMemories = semanticMemories.filter((mem) => {
    const tags = parseTags(mem.tags);
    return tags.includes("pain-point") ||
      /(?:bug|error|fail|broken|crash)/i.test(mem.summary);
  });

  const parts: string[] = [];

  if (retro) {
    let recs: string[] = [];
    try {
      recs = JSON.parse(retro.recommendations);
    } catch {
      recs = [];
    }

    if (recs.length === 0) {
      parts.push("The daily retrospective found no significant issues — the system appears healthy.");
    } else {
      parts.push(
        `The retrospective surfaced ${recs.length} recommendation${recs.length === 1 ? "" : "s"}. ` +
        `Top item: ${recs[0].replace(/^\[.*?\]\s*/, "")}`
      );
    }
  }

  if (painMemories.length > 0) {
    parts.push(
      `${painMemories.length} pain-related memor${painMemories.length === 1 ? "y was" : "ies were"} recorded — ` +
      `these warrant review to prevent recurrence.`
    );
  }

  const totalTurns = conversations.length;
  if (totalTurns > 20) {
    parts.push("It was a high-volume day — consider reviewing session summaries to avoid information overload.");
  } else if (totalTurns > 0) {
    parts.push("Interaction volume was moderate and manageable.");
  }

  if (parts.length === 0) {
    return "Quiet day with no friction detected. Ready for tomorrow.";
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Journal assembly
// ---------------------------------------------------------------------------

/**
 * Format the date as "Month D, YYYY" (e.g. "April 2, 2026").
 */
function formatLongDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[month - 1]} ${day}, ${year}`;
}

/**
 * Generate the daily journal as a markdown string.
 * Queries the last 24 hours of data from the already-initialized memory DB.
 */
export function generateDailyJournal(now: number = Date.now()): string {
  const data = collectJournalData(now);

  const {
    date,
    generatedAt,
    semanticMemories,
    conversations,
  } = data;

  const memoryCount = semanticMemories.length;
  const conversationCount = conversations.length;

  const narrative = buildNarrative(data);
  const keyMoments = buildKeyMoments(data);
  const learned = buildLearned(data);
  const openThreads = buildOpenThreads(data);
  const connections = buildConnections(data);
  const reflection = buildReflection(data);

  // Cross-project review (best-effort; failures must not break the journal)
  let crossProjectReview = "";
  try {
    crossProjectReview = generateCrossProjectReview(undefined, now, resolveJournalsDir());
  } catch (e) {
    crossProjectReview = "## Cross-Project Review\n\n_Could not generate cross-project review: " +
      String(e).substring(0, 200) + "_\n";
  }

  const lines: string[] = [];

  // --- Frontmatter ---
  lines.push("---");
  lines.push(`date: ${date}`);
  lines.push(`generated: ${generatedAt}`);
  lines.push(`memory_count: ${memoryCount}`);
  lines.push(`conversation_count: ${conversationCount}`);
  lines.push("---");
  lines.push("");

  // --- Title ---
  lines.push(`# Daily Journal — ${formatLongDate(date)}`);
  lines.push("");

  // --- Today's Narrative ---
  lines.push("## Today's Narrative");
  lines.push(narrative);
  lines.push("");

  // --- Key Moments ---
  lines.push("## Key Moments");
  for (const moment of keyMoments) {
    lines.push(moment);
  }
  lines.push("");

  // --- What I Learned ---
  lines.push("## What I Learned");
  for (const item of learned) {
    lines.push(item);
  }
  lines.push("");

  // --- Open Threads ---
  lines.push("## Open Threads");
  for (const thread of openThreads) {
    lines.push(thread);
  }
  lines.push("");

  // --- Connections Made ---
  lines.push("## Connections Made");
  for (const connection of connections) {
    lines.push(connection);
  }
  lines.push("");

  // --- Reflection ---
  lines.push("## Reflection");
  lines.push(reflection);
  lines.push("");

  // --- Cross-Project Review ---
  lines.push(crossProjectReview);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Cross-Project Review
// ---------------------------------------------------------------------------

/**
 * A git-backed project discovered under ~/Projects/.
 */
export interface ProjectInfo {
  /** Absolute path to the project root */
  path: string;
  /** Directory name (last segment of path) */
  name: string;
  /** Active branch name, or null if not determinable */
  branch: string | null;
  /** Number of commits in the last 24 hours */
  recentCommitCount: number;
  /** One-line summaries of the most recent commits (up to 5) */
  recentCommitMessages: string[];
  /** True if there are unstaged or staged changes */
  hasUncommittedChanges: boolean;
  /** Files that appear modified/staged */
  changedFiles: string[];
  /** True if there are merge conflict markers present */
  hasMergeConflict: boolean;
  /** Unix ms of the last commit, or null if no commits */
  lastCommitTime: number | null;
  /** Files touched more than once in recent commits (potential hot-spots) */
  hotFiles: string[];
}

/**
 * Recommendations generated from cross-project analysis.
 */
export interface CrossProjectReview {
  projects: ProjectInfo[];
  /** Projects with uncommitted work */
  needsAttention: string[];
  /** Projects with zero activity in the last 24 h */
  staleProjects: string[];
  /** Pairs of project names whose recent commits share common file-name patterns */
  crossProjectConnections: Array<{ projectA: string; projectB: string; reason: string }>;
  /** Per-project plain-text next-action suggestions */
  recommendations: Array<{ project: string; action: string }>;
  /** Velocity notes comparing today to yesterday (if a prior journal exists) */
  velocityNote: string;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

/**
 * Run a git command inside a specific directory.
 * Returns trimmed stdout, or an empty string on error.
 * Uses Bun.spawnSync so it works in any execution context.
 */
function gitSync(args: string[], cwd: string): string {
  try {
    const proc = Bun.spawnSync(["git", ...args], {
      cwd,
      stderr: "pipe",
    });
    if (proc.exitCode !== 0) return "";
    return new TextDecoder().decode(proc.stdout).trim();
  } catch {
    return "";
  }
}

/**
 * Return all immediate sub-directories of ~/Projects/ that contain a .git
 * directory or file (submodule marker).
 */
function discoverGitRepos(projectsRoot: string): string[] {
  if (!existsSync(projectsRoot)) return [];

  let entries: string[];
  try {
    entries = readdirSync(projectsRoot);
  } catch {
    return [];
  }

  return entries
    .map((name) => path.join(projectsRoot, name))
    .filter((dir) => {
      try {
        return statSync(dir).isDirectory() && existsSync(path.join(dir, ".git"));
      } catch {
        return false;
      }
    });
}

/**
 * Gather rich metadata for a single git project.
 */
function inspectProject(projectPath: string, sinceMs: number): ProjectInfo {
  const name = path.basename(projectPath);
  const since = new Date(sinceMs).toISOString();

  // Current branch
  const branch = gitSync(["rev-parse", "--abbrev-ref", "HEAD"], projectPath) || null;

  // Commits in the last 24 hours
  const logRaw = gitSync(
    ["log", `--since=${since}`, "--oneline", "--no-merges"],
    projectPath
  );
  const logLines = logRaw ? logRaw.split("\n").filter(Boolean) : [];
  const recentCommitCount = logLines.length;
  const recentCommitMessages = logLines.slice(0, 5).map((l) => l.replace(/^[0-9a-f]+ /, ""));

  // Last commit timestamp
  const lastCommitRaw = gitSync(["log", "-1", "--format=%ct"], projectPath);
  const lastCommitTime = lastCommitRaw ? parseInt(lastCommitRaw, 10) * 1000 : null;

  // Uncommitted changes
  const statusRaw = gitSync(["status", "--porcelain"], projectPath);
  const statusLines = statusRaw ? statusRaw.split("\n").filter(Boolean) : [];
  const hasUncommittedChanges = statusLines.length > 0;
  const changedFiles = statusLines
    .slice(0, 20)
    .map((l) => l.slice(3).trim().split(" -> ").pop()!);

  // Merge conflict detection
  const conflictRaw = gitSync(["diff", "--check"], projectPath);
  const hasMergeConflict =
    /conflict/.test(gitSync(["status"], projectPath).toLowerCase()) ||
    conflictRaw.includes("<<<<<<");

  // Hot files — files that appear in multiple recent commits
  const detailedLog = gitSync(
    ["log", `--since=${since}`, "--name-only", "--format=", "--no-merges"],
    projectPath
  );
  const fileMentions = new Map<string, number>();
  for (const line of detailedLog.split("\n").filter(Boolean)) {
    fileMentions.set(line, (fileMentions.get(line) ?? 0) + 1);
  }
  const hotFiles = [...fileMentions.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([file]) => file);

  return {
    path: projectPath,
    name,
    branch,
    recentCommitCount,
    recentCommitMessages,
    hasUncommittedChanges,
    changedFiles,
    hasMergeConflict,
    lastCommitTime,
    hotFiles,
  };
}

// ---------------------------------------------------------------------------
// Cross-project analysis
// ---------------------------------------------------------------------------

/**
 * Return structured data about all git projects under ~/Projects/.
 * Suitable for reuse by heartbeat checks, weekly strategy, and other components.
 *
 * @param projectsRoot  Override for ~/Projects/ (useful in tests)
 * @param sinceMs       Look-back window in Unix ms (default: last 24 h)
 */
export function getProjectsOverview(
  projectsRoot?: string,
  sinceMs: number = Date.now() - 24 * 60 * 60 * 1000
): ProjectInfo[] {
  const root = projectsRoot ?? path.join(process.env.HOME || "", "Projects");
  const repoPaths = discoverGitRepos(root);
  return repoPaths.map((p) => inspectProject(p, sinceMs));
}

/**
 * Detect pairs of projects that likely share related work based on common
 * file-name stems appearing in both projects' recent commit file lists.
 */
function detectCrossProjectConnections(
  projects: ProjectInfo[]
): Array<{ projectA: string; projectB: string; reason: string }> {
  const connections: Array<{ projectA: string; projectB: string; reason: string }> = [];

  // Build a per-project set of "stem" tokens from changed/hot file names
  const stems = (files: string[]): Set<string> => {
    const s = new Set<string>();
    for (const f of files) {
      const base = path.basename(f, path.extname(f)).toLowerCase();
      // Ignore trivially common names
      if (base.length > 3 && !["index", "main", "types", "utils", "readme", "package"].includes(base)) {
        s.add(base);
      }
    }
    return s;
  };

  const active = projects.filter(
    (p) => p.recentCommitCount > 0 || p.hasUncommittedChanges
  );

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      const aFiles = [...a.changedFiles, ...a.hotFiles];
      const bFiles = [...b.changedFiles, ...b.hotFiles];

      const aStems = stems(aFiles);
      const bStems = stems(bFiles);
      const shared = [...aStems].filter((s) => bStems.has(s));

      if (shared.length >= 2) {
        connections.push({
          projectA: a.name,
          projectB: b.name,
          reason: `Shared file-name patterns: ${shared.slice(0, 3).join(", ")}`,
        });
      }
    }
  }

  return connections;
}

/**
 * Generate per-project next-action recommendations.
 */
function buildProjectRecommendations(
  projects: ProjectInfo[]
): Array<{ project: string; action: string }> {
  const recs: Array<{ project: string; action: string }> = [];

  for (const p of projects) {
    if (p.hasMergeConflict) {
      recs.push({ project: p.name, action: "Resolve merge conflicts before continuing work." });
      continue;
    }

    if (p.hasUncommittedChanges && p.recentCommitCount === 0) {
      recs.push({
        project: p.name,
        action: `${p.changedFiles.length} file(s) modified but no commits today — consider committing or stashing.`,
      });
      continue;
    }

    if (p.hotFiles.length > 0 && p.recentCommitCount >= 3) {
      recs.push({
        project: p.name,
        action: `Hot file(s) repeatedly edited: ${p.hotFiles.slice(0, 2).join(", ")}. Consider abstracting or extracting shared logic.`,
      });
      continue;
    }

    if (p.recentCommitCount > 0) {
      recs.push({
        project: p.name,
        action: `${p.recentCommitCount} commit(s) today — active and progressing.`,
      });
    }
  }

  return recs;
}

/**
 * Attempt to derive a velocity note by reading yesterday's journal file.
 * Returns an empty string if no prior journal is found.
 */
function buildVelocityNote(
  projects: ProjectInfo[],
  now: number,
  journalsDir: string
): string {
  const yesterday = new Date(now - 24 * 60 * 60 * 1000);
  const yDate = yesterday.toISOString().split("T")[0];
  const [yYear, yMonth] = yDate.split("-");
  const yJournalPath = path.join(journalsDir, `${yYear}-${yMonth}`, `${yDate}-journal.md`);

  let prevActiveCount = 0;

  if (existsSync(yJournalPath)) {
    try {
      const content = Bun.file(yJournalPath).toString();
      // Count project bullets in prior Cross-Project Review section
      const reviewMatch = content.match(/## Cross-Project Review([\s\S]+?)(?:\n## |$)/);
      if (reviewMatch) {
        prevActiveCount = (reviewMatch[1].match(/\*\*Active projects:\*\*/g) ?? []).length;
        // Alternative: count project heading lines
        const projectHeadings = reviewMatch[1].match(/^### /gm) ?? [];
        prevActiveCount = Math.max(prevActiveCount, projectHeadings.length);
      }
    } catch {
      // Ignore read errors
    }
  }

  const todayActive = projects.filter(
    (p) => p.recentCommitCount > 0 || p.hasUncommittedChanges
  ).length;

  if (prevActiveCount === 0) {
    return `${todayActive} project(s) active today. No prior journal found for velocity comparison.`;
  }

  const delta = todayActive - prevActiveCount;
  if (delta > 0) {
    return `${todayActive} project(s) active today vs ${prevActiveCount} yesterday — velocity up by ${delta}.`;
  } else if (delta < 0) {
    return `${todayActive} project(s) active today vs ${prevActiveCount} yesterday — velocity down by ${Math.abs(delta)}.`;
  }
  return `${todayActive} project(s) active today — same as yesterday.`;
}

/**
 * Generate the full Cross-Project Review as a markdown string.
 *
 * @param projectsRoot  Override ~/Projects/ root (useful in tests)
 * @param now           Current time in Unix ms
 * @param journalsDir   Path to journals directory for velocity comparison
 */
export function generateCrossProjectReview(
  projectsRoot?: string,
  now: number = Date.now(),
  journalsDir?: string
): string {
  const sinceMs = now - 24 * 60 * 60 * 1000;
  const projects = getProjectsOverview(projectsRoot, sinceMs);

  const activeProjects = projects.filter(
    (p) => p.recentCommitCount > 0 || p.hasUncommittedChanges
  );
  const staleProjects = projects
    .filter((p) => p.recentCommitCount === 0 && !p.hasUncommittedChanges)
    .map((p) => p.name);
  const needsAttention = projects
    .filter(
      (p) =>
        p.hasMergeConflict ||
        (p.hasUncommittedChanges && p.recentCommitCount === 0)
    )
    .map((p) => p.name);

  const connections = detectCrossProjectConnections(projects);
  const recommendations = buildProjectRecommendations(projects);

  const resolvedJournalsDir =
    journalsDir ?? path.join(process.env.HOME || "", "Projects", "sam", ".agent", "History", "journals");
  const velocityNote = buildVelocityNote(projects, now, resolvedJournalsDir);

  const lines: string[] = [];

  lines.push("## Cross-Project Review");
  lines.push("");
  lines.push(
    `**Scanned ${projects.length} project(s).** ` +
    `Active today: ${activeProjects.length}. ` +
    `Needs attention: ${needsAttention.length}.`
  );
  lines.push("");
  lines.push(`_Velocity: ${velocityNote}_`);
  lines.push("");

  if (needsAttention.length > 0) {
    lines.push("### Needs Attention");
    for (const name of needsAttention) {
      const p = projects.find((x) => x.name === name)!;
      if (p.hasMergeConflict) {
        lines.push(`- **${name}** — merge conflict detected on branch \`${p.branch ?? "unknown"}\``);
      } else {
        lines.push(
          `- **${name}** — ${p.changedFiles.length} uncommitted file(s) on \`${p.branch ?? "unknown"}\``
        );
      }
    }
    lines.push("");
  }

  // Per-project detail for active projects
  if (activeProjects.length > 0) {
    lines.push("### Active Projects");
    lines.push("");
    for (const p of activeProjects) {
      lines.push(`#### ${p.name}`);
      lines.push(`- **Branch:** \`${p.branch ?? "unknown"}\``);
      lines.push(`- **Commits today:** ${p.recentCommitCount}`);
      if (p.recentCommitMessages.length > 0) {
        for (const msg of p.recentCommitMessages) {
          lines.push(`  - ${msg}`);
        }
      }
      if (p.hasUncommittedChanges) {
        lines.push(`- **Uncommitted changes:** ${p.changedFiles.slice(0, 5).join(", ")}${p.changedFiles.length > 5 ? ` (+${p.changedFiles.length - 5} more)` : ""}`);
      }
      if (p.hotFiles.length > 0) {
        lines.push(`- **Hot files:** ${p.hotFiles.join(", ")}`);
      }
      lines.push("");
    }
  }

  if (staleProjects.length > 0) {
    lines.push("### Stale / Quiet Projects");
    lines.push(staleProjects.map((n) => `- ${n}`).join("\n"));
    lines.push("");
  }

  if (connections.length > 0) {
    lines.push("### Cross-Project Connections");
    for (const c of connections) {
      lines.push(`- **${c.projectA}** ↔ **${c.projectB}**: ${c.reason}`);
    }
    lines.push("");
  }

  if (recommendations.length > 0) {
    lines.push("### Recommendations");
    for (const r of recommendations) {
      lines.push(`- **${r.project}**: ${r.action}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// File output + DB summary storage
// ---------------------------------------------------------------------------

/**
 * Derive the journals output directory from environment variables.
 * Mirrors the convention used by retrospective.ts.
 */
function resolveJournalsDir(): string {
  const home = process.env.HOME || "";
  return path.join(home, "Projects", "sam", ".agent", "History", "journals");
}

/**
 * Write a focused recommendation file for each project that has
 * recommendations or needs attention today.
 *
 * Output path per project:
 *   $HOME/.claude/projects/-Users-<user>-Projects-<project>/memory/journals/<date>-daily-recommendations.md
 */
function savePerProjectRecommendations(
  projects: ProjectInfo[],
  recommendations: Array<{ project: string; action: string }>,
  needsAttention: string[],
  dateStr: string
): void {
  const home = process.env.HOME || "";
  const username = home.split("/").filter(Boolean).pop() || "unknown";

  // Only write files for projects that have something worth noting
  const relevantProjectNames = new Set<string>([
    ...needsAttention,
    ...recommendations.map((r) => r.project),
  ]);

  for (const projectName of relevantProjectNames) {
    const projectInfo = projects.find((p) => p.name === projectName);
    if (!projectInfo) continue;

    // Build the per-project memory directory path
    const claudeProjectKey = `-Users-${username}-Projects-${projectName}`;
    const memJournalsDir = path.join(
      home,
      ".claude",
      "projects",
      claudeProjectKey,
      "memory",
      "journals"
    );

    try {
      if (!existsSync(memJournalsDir)) {
        mkdirSync(memJournalsDir, { recursive: true });
      }
    } catch {
      // If the parent project memory dir doesn't exist, skip silently
      continue;
    }

    const filePath = path.join(memJournalsDir, `${dateStr}-daily-recommendations.md`);

    const lines: string[] = [];
    lines.push(`# Daily Recommendations — ${projectName}`);
    lines.push(`_Generated: ${dateStr}_`);
    lines.push("");

    // Status snapshot
    lines.push("## Status");
    lines.push(`- **Branch:** \`${projectInfo.branch ?? "unknown"}\``);
    lines.push(`- **Commits today:** ${projectInfo.recentCommitCount}`);
    if (projectInfo.hasUncommittedChanges) {
      lines.push(
        `- **Uncommitted changes:** ${projectInfo.changedFiles.slice(0, 5).join(", ")}` +
        (projectInfo.changedFiles.length > 5 ? ` (+${projectInfo.changedFiles.length - 5} more)` : "")
      );
    } else {
      lines.push("- **Uncommitted changes:** none");
    }
    if (projectInfo.hasMergeConflict) {
      lines.push("- **Merge conflict:** YES — resolve before continuing");
    }
    lines.push("");

    // Recommendations
    const projectRecs = recommendations.filter((r) => r.project === projectName);
    if (projectRecs.length > 0) {
      lines.push("## Recommendations");
      for (const rec of projectRecs) {
        lines.push(`- ${rec.action}`);
      }
      lines.push("");
    }

    // Hot files
    if (projectInfo.hotFiles.length > 0) {
      lines.push("## Hot Files");
      for (const f of projectInfo.hotFiles) {
        lines.push(`- \`${f}\``);
      }
      lines.push("");
    }

    try {
      writeFileSync(filePath, lines.join("\n"), "utf-8");
    } catch {
      // Non-fatal: skip if write fails
    }
  }
}

/**
 * Generate the daily journal, write it to disk, and persist a summary to the
 * semantic memory table tagged as "journal" + "daily-summary".
 *
 * @returns Absolute path of the written journal file.
 */
export async function generateAndSaveDailyJournal(now: number = Date.now()): Promise<string> {
  const markdown = generateDailyJournal(now);

  // Derive date components for directory/filename
  const dateStr = new Date(now).toISOString().split("T")[0]; // YYYY-MM-DD
  const [year, month] = dateStr.split("-");
  const monthDir = `${year}-${month}`;

  const journalsDir = resolveJournalsDir();
  const monthPath = path.join(journalsDir, monthDir);

  if (!existsSync(monthPath)) {
    mkdirSync(monthPath, { recursive: true });
  }

  const filePath = path.join(monthPath, `${dateStr}-journal.md`);
  writeFileSync(filePath, markdown, "utf-8");

  // Extract a brief summary from the narrative section for DB storage
  const narrativeMatch = markdown.match(/## Today's Narrative\n([\s\S]+?)\n\n##/);
  const narrativeSummary = narrativeMatch
    ? narrativeMatch[1].trim().substring(0, 500)
    : `Daily journal for ${dateStr}.`;

  // Persist summary back to semantic memory (tagged to the "sam" project)
  try {
    const mem = getMemoryInstance();
    mem.rawRun(
      `INSERT INTO semantic
         (id, session_id, topic, summary, relevance_score, created_at,
          source_message_ids, access_count, last_access, confidence, source, tags, project)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      "daily-journal",
      "Daily Journal",
      narrativeSummary,
      0.9,
      now,
      "[]",
      0,
      now,
      0.9,
      "daily-journal",
      JSON.stringify(["journal", "daily-summary"]),
      "sam"
    );
  } catch (e) {
    console.warn("Failed to save journal summary to semantic memory:", e);
  }

  // Write per-project recommendation files into each project's PAI memory space
  try {
    const sinceMs = now - 24 * 60 * 60 * 1000;
    const projects = getProjectsOverview(undefined, sinceMs);
    const needsAttention = projects
      .filter(
        (p) =>
          p.hasMergeConflict ||
          (p.hasUncommittedChanges && p.recentCommitCount === 0)
      )
      .map((p) => p.name);
    const recommendations = buildProjectRecommendations(projects);
    savePerProjectRecommendations(projects, recommendations, needsAttention, dateStr);
  } catch (e) {
    console.warn("Failed to write per-project recommendation files:", e);
  }

  return filePath;
}

// ---------------------------------------------------------------------------
// Standalone entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const paiDir = process.env.PAI_DIR || path.join(process.env.HOME || "", ".claude");

  await initializeMemory({ paiDir });

  const filePath = await generateAndSaveDailyJournal();
  console.log(filePath);
}
