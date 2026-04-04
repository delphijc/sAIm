/**
 * Conversation Analysis Engine
 *
 * Keyword-based topic detection, sentiment analysis, helpful response ranking,
 * and token efficiency metrics for Discord conversation history.
 *
 * Design: pure functions that accept conversation/semantic data arrays so they
 * can be tested without a live database and called from any handler.
 */

// ============================================================================
// Public Types
// ============================================================================

export interface AnalysisResult {
  dateRange: { start: Date; end: Date };
  totalTurns: number;
  totalSessions: number;
  topics: TopicSummary[];
  sentiment: SentimentTimeline;
  helpfulResponses: RankedResponse[];
  tokenEfficiency: TokenMetrics;
}

export interface TopicSummary {
  topic: string;
  count: number;
  percentage: number;
  examples: string[]; // First 3 message snippets
}

export interface SentimentTimeline {
  overall: "positive" | "neutral" | "negative";
  segments: SentimentSegment[];
}

export interface SentimentSegment {
  timestamp: number;
  sessionId: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number; // -1 to 1
  sample: string; // Representative message
}

export interface RankedResponse {
  content: string; // Truncated to 200 chars
  sessionId: string;
  timestamp: number;
  score: number; // Helpfulness score
  reason: string; // Why it scored high
}

export interface TokenMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  avgInputPerTurn: number;
  avgOutputPerTurn: number;
  efficiency: number; // output/input ratio
  mostEfficientSession: { sessionId: string; ratio: number };
  leastEfficientSession: { sessionId: string; ratio: number };
}

// ============================================================================
// Conversation row shape (matches MemoryDB query output)
// ============================================================================

export interface ConversationRow {
  id?: string;
  sessionId: string;
  discordUserId?: string;
  discordChannelId?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata?: Record<string, any> | string | null;
  source?: string;
}

// ============================================================================
// Topic Keywords
// ============================================================================

export const TOPIC_KEYWORDS: Record<string, string[]> = {
  "Code & Development": [
    "code", "function", "bug", "fix", "implement", "refactor", "test",
    "deploy", "build", "compile", "error", "debug", "variable", "class",
    "method", "module", "import", "export", "type", "interface",
  ],
  "Architecture & Design": [
    "architecture", "design", "pattern", "system", "infrastructure", "schema",
    "database", "api", "endpoint", "service", "layer", "component", "structure",
    "model", "abstraction",
  ],
  "Security": [
    "security", "vulnerability", "authentication", "authorization", "encryption",
    "ssl", "tls", "firewall", "pentest", "exploit", "injection", "xss", "csrf",
    "token", "session", "password", "hash",
  ],
  "DevOps & Infrastructure": [
    "docker", "kubernetes", "ci/cd", "pipeline", "deploy", "server", "cloud",
    "aws", "monitoring", "container", "helm", "nginx", "systemd", "service",
    "daemon", "process", "port",
  ],
  "AI & Machine Learning": [
    "model", "prompt", "llm", "claude", "training", "inference", "embedding",
    "token", "context", "completion", "gpt", "anthropic", "neural", "agent",
    "memory", "retrieval",
  ],
  "Project Management": [
    "epic", "story", "task", "sprint", "milestone", "deadline", "plan",
    "roadmap", "backlog", "priority", "estimate", "standup", "retrospective",
  ],
  "Creative & Content": [
    "image", "art", "design", "video", "audio", "content", "writing",
    "narrative", "generate", "create", "style", "aesthetic", "visual",
  ],
  "Research": [
    "research", "investigate", "analyze", "compare", "evaluate", "review",
    "study", "look up", "find", "search", "explore", "understand",
  ],
  "Configuration": [
    "config", "setting", "environment", "variable", "parameter", "option",
    "setup", "install", "configure", "env", "dotenv", "yml", "yaml", "toml",
    "json",
  ],
  "General Discussion": [],
};

// ============================================================================
// Sentiment Word Lists
// ============================================================================

export const POSITIVE_WORDS = [
  "great", "awesome", "perfect", "excellent", "thanks", "love", "amazing",
  "fantastic", "nice", "good", "wonderful", "crushing", "sweet", "brilliant",
  "impressive", "helpful", "useful", "appreciate", "glad", "happy",
  "fantastic", "superb", "outstanding", "cool", "neat",
];

export const NEGATIVE_WORDS = [
  "bad", "wrong", "error", "fail", "broken", "terrible", "awful", "hate",
  "frustrated", "annoying", "slow", "ugly", "confused", "stuck", "issue",
  "problem", "crash", "bug", "missing", "lost", "failed", "sad", "worst",
  "terrible", "useless", "garbage",
];

// Flip sentiment when any of these precede a positive/negative word
export const NEUTRAL_MODIFIERS = [
  "not", "don't", "doesn't", "isn't", "can't", "won't", "never", "no",
  "hardly", "barely",
];

// ============================================================================
// Helpers
// ============================================================================

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s'/]/g, " ").split(/\s+/).filter(Boolean);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseMeta(
  meta: Record<string, any> | string | null | undefined
): Record<string, any> {
  if (!meta) return {};
  if (typeof meta === "string") {
    try {
      return JSON.parse(meta);
    } catch {
      return {};
    }
  }
  return meta;
}

// ============================================================================
// Topic Detection
// ============================================================================

/**
 * Score a single message text against all topic keyword sets.
 * Returns a map of topic -> match count (only topics with at least 1 match).
 * "General Discussion" catches messages with no keyword matches.
 */
export function scoreMessageTopics(text: string): Map<string, number> {
  const words = tokenize(text);
  const scores = new Map<string, number>();

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.length === 0) continue; // Skip catch-all here; we handle below

    let count = 0;
    for (const kw of keywords) {
      // Multi-word keywords: check the full text string
      if (kw.includes(" ")) {
        if (text.toLowerCase().includes(kw)) count++;
      } else {
        if (words.includes(kw)) count++;
      }
    }

    if (count > 0) {
      scores.set(topic, count);
    }
  }

  // Catch-all: if nothing matched, mark as General Discussion
  if (scores.size === 0) {
    scores.set("General Discussion", 1);
  }

  return scores;
}

/**
 * Analyze user messages and return topics sorted by frequency.
 */
export function analyzeTopics(conversations: ConversationRow[]): TopicSummary[] {
  const userMessages = conversations.filter((c) => c.role === "user");
  const topicCounts = new Map<string, number>();
  const topicExamples = new Map<string, string[]>();

  for (const msg of userMessages) {
    const scores = scoreMessageTopics(msg.content);
    for (const [topic] of scores) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
      const examples = topicExamples.get(topic) ?? [];
      if (examples.length < 3) {
        examples.push(msg.content.slice(0, 80) + (msg.content.length > 80 ? "..." : ""));
        topicExamples.set(topic, examples);
      }
    }
  }

  const total = userMessages.length;

  const summaries: TopicSummary[] = [];
  for (const [topic, count] of topicCounts) {
    summaries.push({
      topic,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
      examples: topicExamples.get(topic) ?? [],
    });
  }

  // Sort by count descending, then alphabetically for stability
  summaries.sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

  return summaries;
}

// ============================================================================
// Sentiment Analysis
// ============================================================================

/**
 * Score a single message from -1 (negative) to 1 (positive).
 * Handles simple negation (e.g., "not great" → negative).
 */
export function scoreMessageSentiment(text: string): number {
  const words = tokenize(text);
  let score = 0;
  let wordCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prev = i > 0 ? words[i - 1] : "";
    const prevPrev = i > 1 ? words[i - 2] : "";
    const negated =
      NEUTRAL_MODIFIERS.includes(prev) || NEUTRAL_MODIFIERS.includes(prevPrev);

    if (POSITIVE_WORDS.includes(word)) {
      score += negated ? -0.5 : 0.5;
      wordCount++;
    } else if (NEGATIVE_WORDS.includes(word)) {
      score += negated ? 0.5 : -0.5;
      wordCount++;
    }
  }

  if (wordCount === 0) return 0;

  // Normalize by number of sentiment words found, clamp to [-1, 1]
  const normalized = score / wordCount;
  return clamp(normalized, -1, 1);
}

function sentimentLabel(score: number): "positive" | "neutral" | "negative" {
  if (score > 0.1) return "positive";
  if (score < -0.1) return "negative";
  return "neutral";
}

/**
 * Analyze sentiment across conversations, grouped by session.
 * Returns per-session segments and overall weighted sentiment.
 */
export function analyzeSentiment(conversations: ConversationRow[]): SentimentTimeline {
  const userMessages = conversations.filter((c) => c.role === "user");

  if (userMessages.length === 0) {
    return {
      overall: "neutral",
      segments: [],
    };
  }

  // Group by sessionId
  const bySession = new Map<string, ConversationRow[]>();
  for (const msg of userMessages) {
    const list = bySession.get(msg.sessionId) ?? [];
    list.push(msg);
    bySession.set(msg.sessionId, list);
  }

  const segments: SentimentSegment[] = [];
  let totalScore = 0;
  let totalWeight = 0;

  for (const [sessionId, msgs] of bySession) {
    // Score all messages in the session and take the weighted mean
    let sessionScore = 0;
    let representativeMsg = msgs[0];
    let bestAbsScore = 0;

    for (const msg of msgs) {
      const s = scoreMessageSentiment(msg.content);
      sessionScore += s;
      if (Math.abs(s) > bestAbsScore) {
        bestAbsScore = Math.abs(s);
        representativeMsg = msg;
      }
    }

    const avgScore = clamp(sessionScore / msgs.length, -1, 1);
    const weight = msgs.length;

    totalScore += avgScore * weight;
    totalWeight += weight;

    segments.push({
      timestamp: representativeMsg.timestamp,
      sessionId,
      sentiment: sentimentLabel(avgScore),
      score: Math.round(avgScore * 100) / 100,
      sample: representativeMsg.content.slice(0, 100),
    });
  }

  // Sort segments by time ascending
  segments.sort((a, b) => a.timestamp - b.timestamp);

  const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;

  return {
    overall: sentimentLabel(overallScore),
    segments,
  };
}

// ============================================================================
// Helpful Response Ranking
// ============================================================================

const CODE_BLOCK_RE = /```[\s\S]*?```/;
const INLINE_CODE_RE = /`[^`]+`/;
const LIST_RE = /^[-*+]\s|^\d+\.\s/m;
const TABLE_RE = /\|.+\|/;
const HEADER_RE = /^#+\s/m;

/**
 * Compute a helpfulness score for an assistant response.
 *
 * Scoring factors:
 *   - Content length in sweet-spot 100–1000 chars
 *   - Contains code block (+2)
 *   - Contains list/table/header (+1)
 *   - Followed by a positive user message (+3)
 *   - Token efficiency: good output/input ratio
 */
export function scoreResponse(
  response: ConversationRow,
  nextUserMessage: ConversationRow | null
): { score: number; reason: string } {
  const text = response.content;
  const len = text.length;
  let score = 0;
  const reasons: string[] = [];

  // Length appropriateness
  if (len >= 100 && len <= 1000) {
    score += 2;
    reasons.push("good length");
  } else if (len >= 50 && len < 100) {
    score += 1;
    reasons.push("adequate length");
  } else if (len > 1000 && len <= 3000) {
    score += 1;
    reasons.push("detailed response");
  } else if (len < 50) {
    score -= 1;
    reasons.push("very short");
  }
  // Responses > 3000 chars get no length bonus

  // Code blocks
  if (CODE_BLOCK_RE.test(text)) {
    score += 2;
    reasons.push("has code block");
  } else if (INLINE_CODE_RE.test(text)) {
    score += 1;
    reasons.push("has inline code");
  }

  // Structured content
  if (TABLE_RE.test(text)) {
    score += 2;
    reasons.push("has table");
  } else if (LIST_RE.test(text)) {
    score += 1;
    reasons.push("has list");
  }

  if (HEADER_RE.test(text)) {
    score += 1;
    reasons.push("has headers");
  }

  // Positive follow-up
  if (nextUserMessage) {
    const followUpScore = scoreMessageSentiment(nextUserMessage.content);
    if (followUpScore > 0.3) {
      score += 3;
      reasons.push("positive follow-up");
    } else if (followUpScore > 0.1) {
      score += 1;
      reasons.push("mildly positive follow-up");
    }
  }

  // Token efficiency from metadata
  const meta = parseMeta(response.metadata);
  const tokens = meta?.tokens;
  if (tokens && typeof tokens === "object") {
    const inputT = tokens.input ?? 0;
    const outputT = tokens.output ?? 0;
    if (inputT > 0 && outputT > 0) {
      const ratio = outputT / inputT;
      if (ratio >= 0.3 && ratio <= 2.0) {
        score += 1;
        reasons.push("good token ratio");
      }
    }
  }

  return {
    score,
    reason: reasons.length > 0 ? reasons.join(", ") : "no distinctive features",
  };
}

/**
 * Rank assistant responses by helpfulness and return the top 10.
 */
export function rankResponses(conversations: ConversationRow[]): RankedResponse[] {
  const ranked: RankedResponse[] = [];

  for (let i = 0; i < conversations.length; i++) {
    const turn = conversations[i];
    if (turn.role !== "assistant") continue;

    // Find the next user message (may not be adjacent)
    let nextUser: ConversationRow | null = null;
    for (let j = i + 1; j < conversations.length; j++) {
      if (conversations[j].role === "user") {
        nextUser = conversations[j];
        break;
      }
    }

    const { score, reason } = scoreResponse(turn, nextUser);

    ranked.push({
      content: turn.content.slice(0, 200) + (turn.content.length > 200 ? "..." : ""),
      sessionId: turn.sessionId,
      timestamp: turn.timestamp,
      score,
      reason,
    });
  }

  // Sort descending by score, then by timestamp (newer first) for tie-breaking
  ranked.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);

  return ranked.slice(0, 10);
}

// ============================================================================
// Token Efficiency
// ============================================================================

interface SessionTokens {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  turns: number;
}

/**
 * Parse token counts from a conversation row's metadata.
 * Metadata can be stored as a JSON string or already parsed.
 * The stored shape is: { tokens: { input: N, output: N } }
 * Legacy shape (just a number): { tokens: N }
 */
function extractTokens(row: ConversationRow): { input: number; output: number } {
  const meta = parseMeta(row.metadata);
  if (!meta) return { input: 0, output: 0 };

  const tokens = meta.tokens;
  if (!tokens) return { input: 0, output: 0 };

  if (typeof tokens === "number") {
    // Legacy: single count
    return row.role === "user"
      ? { input: tokens, output: 0 }
      : { input: 0, output: tokens };
  }

  if (typeof tokens === "object") {
    return {
      input: typeof tokens.input === "number" ? tokens.input : 0,
      output: typeof tokens.output === "number" ? tokens.output : 0,
    };
  }

  return { input: 0, output: 0 };
}

/**
 * Analyze token usage across all conversations.
 */
export function analyzeTokenEfficiency(conversations: ConversationRow[]): TokenMetrics {
  let totalInput = 0;
  let totalOutput = 0;
  let turnCount = 0;

  const sessionMap = new Map<string, SessionTokens>();

  for (const row of conversations) {
    const { input, output } = extractTokens(row);
    totalInput += input;
    totalOutput += output;
    turnCount++;

    const sess = sessionMap.get(row.sessionId) ?? {
      sessionId: row.sessionId,
      inputTokens: 0,
      outputTokens: 0,
      turns: 0,
    };
    sess.inputTokens += input;
    sess.outputTokens += output;
    sess.turns++;
    sessionMap.set(row.sessionId, sess);
  }

  const efficiency =
    totalInput > 0 ? Math.round((totalOutput / totalInput) * 1000) / 1000 : 0;

  const avgInput =
    turnCount > 0 ? Math.round(totalInput / turnCount) : 0;
  const avgOutput =
    turnCount > 0 ? Math.round(totalOutput / turnCount) : 0;

  // Compute per-session efficiency ratios (sessions with any tokens)
  const sessionRatios = [...sessionMap.values()]
    .filter((s) => s.inputTokens > 0)
    .map((s) => ({
      sessionId: s.sessionId,
      ratio: Math.round((s.outputTokens / s.inputTokens) * 1000) / 1000,
    }))
    .sort((a, b) => b.ratio - a.ratio); // higher ratio = more output per input

  const mostEfficient: { sessionId: string; ratio: number } =
    sessionRatios.length > 0
      ? sessionRatios[0]
      : { sessionId: "none", ratio: 0 };

  const leastEfficient: { sessionId: string; ratio: number } =
    sessionRatios.length > 0
      ? sessionRatios[sessionRatios.length - 1]
      : { sessionId: "none", ratio: 0 };

  return {
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    avgInputPerTurn: avgInput,
    avgOutputPerTurn: avgOutput,
    efficiency,
    mostEfficientSession: mostEfficient,
    leastEfficientSession: leastEfficient,
  };
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Run the full analysis pipeline over a set of conversation rows.
 * Accepts plain data arrays so it can be called from tests without a DB.
 */
export function runAnalysis(conversations: ConversationRow[]): AnalysisResult {
  const timestamps = conversations.map((c) => c.timestamp);
  const startTs = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
  const endTs = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

  const sessionIds = new Set(conversations.map((c) => c.sessionId));

  return {
    dateRange: { start: new Date(startTs), end: new Date(endTs) },
    totalTurns: conversations.length,
    totalSessions: sessionIds.size,
    topics: analyzeTopics(conversations),
    sentiment: analyzeSentiment(conversations),
    helpfulResponses: rankResponses(conversations),
    tokenEfficiency: analyzeTokenEfficiency(conversations),
  };
}
