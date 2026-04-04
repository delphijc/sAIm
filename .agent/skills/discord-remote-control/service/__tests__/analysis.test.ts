/**
 * Conversation Analysis — Comprehensive Test Suite
 *
 * Tests topic detection, sentiment analysis, response ranking,
 * token efficiency, formatters, and the analyze command handler.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

import {
  scoreMessageTopics,
  analyzeTopics,
  scoreMessageSentiment,
  analyzeSentiment,
  scoreResponse,
  rankResponses,
  analyzeTokenEfficiency,
  runAnalysis,
  TOPIC_KEYWORDS,
  type ConversationRow,
} from "../plugins/export/analysis.ts";

import {
  formatAnalysisForDiscord,
  formatAnalysisAsMarkdown,
  formatAnalysisAsHTML,
} from "../plugins/export/analysis-formatter.ts";

import {
  parseAnalysisArgs,
  handleAnalyzeCommand,
  type AnalysisMemoryDB,
} from "../plugins/export/analyze-handler.ts";

// ============================================================================
// Test helpers
// ============================================================================

afterEach(() => {
  mock.restore();
});

let _sessionCounter = 0;
function uniqueSession(): string {
  return `sess-${Date.now()}-${++_sessionCounter}`;
}

function makeConv(
  overrides: Partial<ConversationRow> & Pick<ConversationRow, "role" | "content">
): ConversationRow {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    sessionId: uniqueSession(),
    discordUserId: "user-123",
    discordChannelId: "chan-456",
    timestamp: Date.now(),
    metadata: {},
    source: "discord",
    ...overrides,
  };
}

function makeUserMsg(content: string, sessionId?: string, ts?: number): ConversationRow {
  return makeConv({ role: "user", content, sessionId: sessionId ?? uniqueSession(), timestamp: ts ?? Date.now() });
}

function makeAssistantMsg(content: string, sessionId?: string, ts?: number, metadata?: any): ConversationRow {
  return makeConv({ role: "assistant", content, sessionId: sessionId ?? uniqueSession(), timestamp: ts ?? Date.now(), metadata });
}

// ============================================================================
// 1. Topic Detection
// ============================================================================

describe("scoreMessageTopics", () => {
  test("identifies a code-related message", () => {
    const scores = scoreMessageTopics("Can you help me fix this bug in my function?");
    expect(scores.has("Code & Development")).toBe(true);
    expect(scores.get("Code & Development")).toBeGreaterThan(0);
  });

  test("identifies a security-related message", () => {
    const scores = scoreMessageTopics("I need help with authentication and encryption");
    expect(scores.has("Security")).toBe(true);
  });

  test("identifies a DevOps message", () => {
    const scores = scoreMessageTopics("How do I configure docker and kubernetes for the pipeline?");
    expect(scores.has("DevOps & Infrastructure")).toBe(true);
  });

  test("identifies an AI/ML message", () => {
    const scores = scoreMessageTopics("How do I write better prompts for claude llm inference?");
    expect(scores.has("AI & Machine Learning")).toBe(true);
  });

  test("a message can match multiple topics", () => {
    const scores = scoreMessageTopics("Deploy the authentication api endpoint with docker");
    // Should match multiple topics
    expect(scores.size).toBeGreaterThan(1);
  });

  test("empty message falls back to General Discussion", () => {
    const scores = scoreMessageTopics("");
    expect(scores.has("General Discussion")).toBe(true);
    expect(scores.size).toBe(1);
  });

  test("message with no keyword matches → General Discussion", () => {
    const scores = scoreMessageTopics("hello there how are you doing today nice weather");
    expect(scores.has("General Discussion")).toBe(true);
  });

  test("topic matching is case-insensitive", () => {
    const lower = scoreMessageTopics("fix the bug");
    const upper = scoreMessageTopics("FIX THE BUG");
    expect(lower.has("Code & Development")).toBe(true);
    expect(upper.has("Code & Development")).toBe(true);
  });

  test("identifies architecture topic", () => {
    const scores = scoreMessageTopics("What database schema should I use for this api design?");
    expect(scores.has("Architecture & Design")).toBe(true);
  });

  test("identifies project management topic", () => {
    const scores = scoreMessageTopics("Can you help me plan this epic and create the sprint roadmap?");
    expect(scores.has("Project Management")).toBe(true);
  });
});

describe("analyzeTopics", () => {
  test("returns topics sorted by count descending", () => {
    const msgs = [
      makeUserMsg("fix this bug code function"),
      makeUserMsg("another bug to fix"),
      makeUserMsg("code review for function"),
      makeUserMsg("authentication security issue"),
    ];
    const topics = analyzeTopics(msgs);
    // Topics should be sorted descending
    for (let i = 1; i < topics.length; i++) {
      expect(topics[i - 1].count).toBeGreaterThanOrEqual(topics[i].count);
    }
  });

  test("only counts user messages (not assistant)", () => {
    const msgs = [
      makeUserMsg("fix this bug"),
      makeAssistantMsg("Here is how to fix the bug with code"),
    ];
    // analyzeTopics only looks at user messages
    const topics = analyzeTopics(msgs);
    const total = topics.reduce((sum, t) => sum + t.count, 0);
    // Each user message can appear in multiple topics, but base count from 1 user msg
    expect(total).toBeGreaterThanOrEqual(1);
  });

  test("percentages are computed correctly", () => {
    const msgs = [
      makeUserMsg("fix the bug in the code"),
      makeUserMsg("another bug fix needed"),
    ];
    const topics = analyzeTopics(msgs);
    // Every percentage should be between 0 and 100
    for (const t of topics) {
      expect(t.percentage).toBeGreaterThanOrEqual(0);
      expect(t.percentage).toBeLessThanOrEqual(100);
    }
  });

  test("examples array populated with up to 3 snippets", () => {
    const session = uniqueSession();
    const msgs = [
      makeUserMsg("fix the bug in function", session),
      makeUserMsg("debug the compile error", session),
      makeUserMsg("implement the feature code", session),
      makeUserMsg("refactor this function please", session),
    ];
    const topics = analyzeTopics(msgs);
    const codeTopic = topics.find((t) => t.topic === "Code & Development");
    expect(codeTopic).toBeDefined();
    expect(codeTopic!.examples.length).toBeLessThanOrEqual(3);
    expect(codeTopic!.examples.length).toBeGreaterThan(0);
  });

  test("empty corpus returns empty topics", () => {
    expect(analyzeTopics([])).toEqual([]);
  });

  test("all-assistant corpus returns empty (no user messages)", () => {
    const msgs = [makeAssistantMsg("I can help you"), makeAssistantMsg("Here is the code")];
    expect(analyzeTopics(msgs)).toEqual([]);
  });

  test("topic count field reflects actual message matches", () => {
    const msgs = [
      makeUserMsg("bug fix in code"),  // Code & Development
      makeUserMsg("more code refactor"),  // Code & Development
      makeUserMsg("design api schema"),   // Architecture & Design
    ];
    const topics = analyzeTopics(msgs);
    const code = topics.find((t) => t.topic === "Code & Development");
    expect(code).toBeDefined();
    expect(code!.count).toBeGreaterThanOrEqual(2);
  });

  test("large corpus produces reasonable distribution", () => {
    const msgs: ConversationRow[] = [];
    for (let i = 0; i < 50; i++) {
      msgs.push(makeUserMsg(i % 3 === 0 ? "fix this bug" : i % 3 === 1 ? "design the api" : "docker deploy"));
    }
    const topics = analyzeTopics(msgs);
    expect(topics.length).toBeGreaterThan(0);
    expect(topics[0].count).toBeGreaterThan(0);
  });

  test("'General Discussion' appears when messages have no keywords", () => {
    const msgs = [makeUserMsg("yes", uniqueSession()), makeUserMsg("ok sure", uniqueSession())];
    const topics = analyzeTopics(msgs);
    const gen = topics.find((t) => t.topic === "General Discussion");
    expect(gen).toBeDefined();
  });
});

// ============================================================================
// 2. Sentiment Analysis
// ============================================================================

describe("scoreMessageSentiment", () => {
  test("positive message scores > 0", () => {
    expect(scoreMessageSentiment("This is great, thanks so much!")).toBeGreaterThan(0);
  });

  test("negative message scores < 0", () => {
    expect(scoreMessageSentiment("This is terrible, it's broken and wrong")).toBeLessThan(0);
  });

  test("neutral message scores ~0", () => {
    const s = scoreMessageSentiment("What is the current status of the task?");
    expect(Math.abs(s)).toBeLessThanOrEqual(0.1);
  });

  test("negation flips positive sentiment", () => {
    const normal = scoreMessageSentiment("this is great");
    const negated = scoreMessageSentiment("this is not great");
    expect(normal).toBeGreaterThan(0);
    expect(negated).toBeLessThan(0);
  });

  test("negation flips negative sentiment", () => {
    const normal = scoreMessageSentiment("this is wrong");
    const negated = scoreMessageSentiment("this is not wrong");
    expect(normal).toBeLessThan(0);
    expect(negated).toBeGreaterThan(0);
  });

  test("score is clamped to [-1, 1]", () => {
    const veryPositive = scoreMessageSentiment(
      "great awesome perfect excellent amazing wonderful fantastic brilliant impressive"
    );
    const veryNegative = scoreMessageSentiment(
      "bad wrong broken terrible awful hate frustrated annoying slow ugly confused"
    );
    expect(veryPositive).toBeLessThanOrEqual(1);
    expect(veryNegative).toBeGreaterThanOrEqual(-1);
  });

  test("mixed sentiment message returns intermediate score", () => {
    const s = scoreMessageSentiment("It's great but also broken and bad");
    // Should be between -1 and 1 (mixed)
    expect(s).toBeGreaterThan(-1);
    expect(s).toBeLessThan(1);
  });

  test("empty string returns 0", () => {
    expect(scoreMessageSentiment("")).toBe(0);
  });

  test("all-caps positive still positive", () => {
    expect(scoreMessageSentiment("THIS IS GREAT")).toBeGreaterThan(0);
  });

  test("score is in [-1, 1] range always", () => {
    const inputs = [
      "hello world",
      "amazing perfect wonderful great",
      "broken terrible awful wrong",
      "not great at all",
      "",
      "the quick brown fox jumps over the lazy dog",
    ];
    for (const input of inputs) {
      const s = scoreMessageSentiment(input);
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe("analyzeSentiment", () => {
  test("overall positive when most messages are positive", () => {
    const sess = uniqueSession();
    const msgs = [
      makeUserMsg("This is great and amazing!", sess),
      makeUserMsg("Awesome work, thanks!", sess),
      makeUserMsg("Perfect solution!", sess),
    ];
    const result = analyzeSentiment(msgs);
    expect(result.overall).toBe("positive");
  });

  test("overall negative when most messages are negative", () => {
    const sess = uniqueSession();
    const msgs = [
      makeUserMsg("This is broken and terrible", sess),
      makeUserMsg("Awful, it's all wrong", sess),
      makeUserMsg("Bad, error everywhere", sess),
    ];
    const result = analyzeSentiment(msgs);
    expect(result.overall).toBe("negative");
  });

  test("overall neutral for neutral messages", () => {
    const sess = uniqueSession();
    const msgs = [
      makeUserMsg("Can you help me with this task?", sess),
      makeUserMsg("What is the current status?", sess),
    ];
    const result = analyzeSentiment(msgs);
    expect(result.overall).toBe("neutral");
  });

  test("timeline segments created per session", () => {
    const sess1 = uniqueSession();
    const sess2 = uniqueSession();
    const msgs = [
      makeUserMsg("great!", sess1),
      makeUserMsg("terrible", sess2),
    ];
    const result = analyzeSentiment(msgs);
    expect(result.segments.length).toBe(2);
  });

  test("empty input returns neutral with empty segments", () => {
    const result = analyzeSentiment([]);
    expect(result.overall).toBe("neutral");
    expect(result.segments).toEqual([]);
  });

  test("only assistant messages → neutral (no user messages scored)", () => {
    const msgs = [makeAssistantMsg("Here is a fix"), makeAssistantMsg("Done!")];
    const result = analyzeSentiment(msgs);
    expect(result.overall).toBe("neutral");
    expect(result.segments).toEqual([]);
  });

  test("segments sorted by timestamp ascending", () => {
    const now = Date.now();
    const sess1 = uniqueSession();
    const sess2 = uniqueSession();
    const msgs = [
      makeUserMsg("great!", sess2, now + 1000),
      makeUserMsg("bad!", sess1, now),
    ];
    const result = analyzeSentiment(msgs);
    if (result.segments.length > 1) {
      expect(result.segments[0].timestamp).toBeLessThanOrEqual(result.segments[1].timestamp);
    }
  });

  test("segment sample field is populated", () => {
    const sess = uniqueSession();
    const msgs = [makeUserMsg("Thanks this is really great!", sess)];
    const result = analyzeSentiment(msgs);
    expect(result.segments[0].sample.length).toBeGreaterThan(0);
  });

  test("all positive sessions → positive overall", () => {
    const msgs: ConversationRow[] = [];
    for (let i = 0; i < 5; i++) {
      msgs.push(makeUserMsg("great awesome perfect", uniqueSession()));
    }
    const result = analyzeSentiment(msgs);
    expect(result.overall).toBe("positive");
  });

  test("all negative sessions → negative overall", () => {
    const msgs: ConversationRow[] = [];
    for (let i = 0; i < 5; i++) {
      msgs.push(makeUserMsg("broken terrible wrong awful", uniqueSession()));
    }
    const result = analyzeSentiment(msgs);
    expect(result.overall).toBe("negative");
  });
});

// ============================================================================
// 3. Helpful Response Ranking
// ============================================================================

describe("scoreResponse", () => {
  test("response with code block scores higher than plain text", () => {
    const withCode = makeAssistantMsg("Here is the fix:\n```javascript\nconst x = 1;\n```");
    const withoutCode = makeAssistantMsg("Here is the fix: set x to 1");
    const codeScore = scoreResponse(withCode, null).score;
    const plainScore = scoreResponse(withoutCode, null).score;
    expect(codeScore).toBeGreaterThan(plainScore);
  });

  test("response with table scores higher", () => {
    const withTable = makeAssistantMsg("Results:\n| Name | Value |\n|------|-------|\n| foo | bar |");
    const plain = makeAssistantMsg("Results: foo is bar");
    expect(scoreResponse(withTable, null).score).toBeGreaterThan(scoreResponse(plain, null).score);
  });

  test("response with list scores higher than no list", () => {
    const withList = makeAssistantMsg("Steps:\n- Install\n- Configure\n- Run");
    const plain = makeAssistantMsg("Install, configure, then run");
    expect(scoreResponse(withList, null).score).toBeGreaterThan(scoreResponse(plain, null).score);
  });

  test("positive follow-up user message boosts score", () => {
    const sess = uniqueSession();
    const response = makeAssistantMsg("Here is how to fix the issue.", sess);
    const positiveUser = makeUserMsg("Thanks, that's perfect!", sess);
    const neutralUser = makeUserMsg("ok", sess);
    const positiveScore = scoreResponse(response, positiveUser).score;
    const neutralScore = scoreResponse(response, neutralUser).score;
    expect(positiveScore).toBeGreaterThan(neutralScore);
  });

  test("very short response scores lower", () => {
    const veryShort = makeAssistantMsg("ok");
    const adequate = makeAssistantMsg("Here is a detailed answer that explains the solution in some depth and provides context.");
    expect(scoreResponse(veryShort, null).score).toBeLessThan(scoreResponse(adequate, null).score);
  });

  test("reason field is populated with non-empty string", () => {
    const msg = makeAssistantMsg("Here is a detailed explanation with a list:\n- item 1\n- item 2");
    const { reason } = scoreResponse(msg, null);
    expect(reason.length).toBeGreaterThan(0);
  });

  test("response with good token ratio gets bonus", () => {
    const withTokens = makeAssistantMsg(
      "A " + "x".repeat(200) + " detailed response.",
      undefined,
      undefined,
      { tokens: { input: 500, output: 400 } }
    );
    const noTokens = makeAssistantMsg("A " + "x".repeat(200) + " detailed response.");
    const withScore = scoreResponse(withTokens, null).score;
    const withoutScore = scoreResponse(noTokens, null).score;
    expect(withScore).toBeGreaterThanOrEqual(withoutScore);
  });

  test("response with headers scores higher", () => {
    const withHeaders = makeAssistantMsg("## Solution\nHere is the answer with enough content to be useful for the reader.");
    const plain = makeAssistantMsg("Here is the answer with enough content to be useful for the reader.");
    expect(scoreResponse(withHeaders, null).score).toBeGreaterThan(scoreResponse(plain, null).score);
  });
});

describe("rankResponses", () => {
  test("returns at most 10 responses", () => {
    const msgs: ConversationRow[] = [];
    for (let i = 0; i < 30; i++) {
      msgs.push(makeAssistantMsg(`Response ${i} with some content that is at least 100 characters long to qualify as a good response length for this test case`));
    }
    const ranked = rankResponses(msgs);
    expect(ranked.length).toBeLessThanOrEqual(10);
  });

  test("results sorted by score descending", () => {
    const msgs = [
      makeAssistantMsg("ok"),
      makeAssistantMsg("Here is the code:\n```js\nconst x = 1;\n```\nWith list:\n- item1\n- item2\n## Summary\nAll done."),
      makeAssistantMsg("Some explanation with a list:\n- do this\n- then that"),
    ];
    const ranked = rankResponses(msgs);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  test("content is truncated to 200 chars", () => {
    const long = makeAssistantMsg("A".repeat(500));
    const ranked = rankResponses([long]);
    if (ranked.length > 0) {
      expect(ranked[0].content.length).toBeLessThanOrEqual(203); // 200 + "..."
    }
  });

  test("empty conversations returns empty array", () => {
    expect(rankResponses([])).toEqual([]);
  });

  test("only assistant messages are ranked", () => {
    const msgs = [
      makeUserMsg("help me please"),
      makeAssistantMsg("Here is the answer to your question"),
    ];
    const ranked = rankResponses(msgs);
    expect(ranked.length).toBe(1);
  });

  test("sessionId field is populated", () => {
    const sess = uniqueSession();
    const msg = makeAssistantMsg("A decent response with some content here", sess);
    const ranked = rankResponses([msg]);
    expect(ranked[0]?.sessionId).toBe(sess);
  });

  test("responses followed by positive feedback rank higher", () => {
    const sess1 = uniqueSession();
    const sess2 = uniqueSession();
    const ts = Date.now();

    // Session 1: response followed by positive feedback
    const resp1 = makeAssistantMsg("Here is the solution to your problem.", sess1, ts);
    const userFeedback = makeUserMsg("That's perfect, thanks!", sess1, ts + 100);

    // Session 2: same response, no feedback
    const resp2 = makeAssistantMsg("Here is the solution to your problem.", sess2, ts + 200);

    const msgs = [resp1, userFeedback, resp2];
    const ranked = rankResponses(msgs);
    const r1 = ranked.find((r) => r.sessionId === sess1);
    const r2 = ranked.find((r) => r.sessionId === sess2);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    expect(r1!.score).toBeGreaterThan(r2!.score);
  });

  test("all-user conversation returns empty", () => {
    const msgs = [makeUserMsg("hello"), makeUserMsg("help"), makeUserMsg("thanks")];
    expect(rankResponses(msgs)).toEqual([]);
  });
});

// ============================================================================
// 4. Token Efficiency
// ============================================================================

describe("analyzeTokenEfficiency", () => {
  test("totals input and output tokens correctly", () => {
    const msgs = [
      makeAssistantMsg("response", undefined, undefined, { tokens: { input: 100, output: 80 } }),
      makeAssistantMsg("response", undefined, undefined, { tokens: { input: 200, output: 150 } }),
    ];
    const result = analyzeTokenEfficiency(msgs);
    expect(result.totalInputTokens).toBe(300);
    expect(result.totalOutputTokens).toBe(230);
  });

  test("computes averages correctly", () => {
    const msgs = [
      makeAssistantMsg("r", undefined, undefined, { tokens: { input: 100, output: 50 } }),
      makeAssistantMsg("r", undefined, undefined, { tokens: { input: 200, output: 100 } }),
    ];
    const result = analyzeTokenEfficiency(msgs);
    expect(result.avgInputPerTurn).toBe(150); // (100 + 200) / 2
    expect(result.avgOutputPerTurn).toBe(75);  // (50 + 100) / 2
  });

  test("efficiency ratio is output/input", () => {
    const msgs = [makeAssistantMsg("r", undefined, undefined, { tokens: { input: 400, output: 200 } })];
    const result = analyzeTokenEfficiency(msgs);
    expect(result.efficiency).toBeCloseTo(0.5, 2);
  });

  test("missing metadata handled gracefully — no division by zero", () => {
    const msgs = [makeAssistantMsg("no metadata"), makeUserMsg("also no metadata")];
    const result = analyzeTokenEfficiency(msgs);
    expect(result.efficiency).toBe(0);
    expect(result.totalInputTokens).toBe(0);
  });

  test("null metadata handled gracefully", () => {
    const msg = makeConv({ role: "assistant", content: "hi", metadata: null });
    expect(() => analyzeTokenEfficiency([msg])).not.toThrow();
  });

  test("malformed metadata JSON string handled", () => {
    const msg = makeConv({ role: "assistant", content: "hi", metadata: "not-valid-json" as any });
    expect(() => analyzeTokenEfficiency([msg])).not.toThrow();
  });

  test("most and least efficient sessions identified", () => {
    const sess1 = uniqueSession();
    const sess2 = uniqueSession();
    const msgs = [
      makeAssistantMsg("r", sess1, undefined, { tokens: { input: 100, output: 200 } }), // ratio 2.0
      makeAssistantMsg("r", sess2, undefined, { tokens: { input: 100, output: 50 } }),  // ratio 0.5
    ];
    const result = analyzeTokenEfficiency(msgs);
    // Most efficient = highest ratio (more output per input)
    expect(result.mostEfficientSession.sessionId).toBe(sess1);
    expect(result.leastEfficientSession.sessionId).toBe(sess2);
  });

  test("single session edge case", () => {
    const sess = uniqueSession();
    const msgs = [makeAssistantMsg("r", sess, undefined, { tokens: { input: 100, output: 75 } })];
    const result = analyzeTokenEfficiency(msgs);
    expect(result.mostEfficientSession.sessionId).toBe(sess);
    expect(result.leastEfficientSession.sessionId).toBe(sess);
  });

  test("zero total tokens returns efficiency 0 without crashing", () => {
    const msgs = [makeAssistantMsg("no tokens")];
    const result = analyzeTokenEfficiency(msgs);
    expect(result.efficiency).toBe(0);
    expect(result.avgInputPerTurn).toBe(0);
  });

  test("metadata as JSON string is parsed correctly", () => {
    const msg = makeConv({
      role: "assistant",
      content: "hello",
      metadata: JSON.stringify({ tokens: { input: 300, output: 150 } }),
    });
    const result = analyzeTokenEfficiency([msg]);
    expect(result.totalInputTokens).toBe(300);
    expect(result.totalOutputTokens).toBe(150);
  });
});

// ============================================================================
// 5. Formatters
// ============================================================================

function makeSampleResult() {
  const sess = uniqueSession();
  const now = Date.now();
  const msgs: ConversationRow[] = [
    makeUserMsg("Can you fix this bug in my code function?", sess, now - 3000),
    makeAssistantMsg(
      "## Solution\nHere is the fix:\n```javascript\nconst x = 1;\n```\n- item1\n- item2",
      sess,
      now - 2000,
      { tokens: { input: 500, output: 400 } }
    ),
    makeUserMsg("Thanks, that's perfect!", sess, now - 1000),
    makeAssistantMsg("You're welcome!", sess, now, { tokens: { input: 100, output: 50 } }),
  ];
  return runAnalysis(msgs);
}

describe("formatAnalysisForDiscord", () => {
  test("output is under 2000 characters", () => {
    const result = makeSampleResult();
    const output = formatAnalysisForDiscord(result);
    expect(output.length).toBeLessThan(2000);
  });

  test("includes turn count", () => {
    const result = makeSampleResult();
    const output = formatAnalysisForDiscord(result);
    expect(output).toContain("turns");
  });

  test("includes 'sessions' label", () => {
    const result = makeSampleResult();
    const output = formatAnalysisForDiscord(result);
    expect(output).toContain("session");
  });

  test("includes Topics section", () => {
    const result = makeSampleResult();
    const output = formatAnalysisForDiscord(result);
    expect(output).toContain("Topics");
  });

  test("includes Sentiment section", () => {
    const result = makeSampleResult();
    const output = formatAnalysisForDiscord(result);
    expect(output).toContain("Sentiment");
  });

  test("includes Token Efficiency section", () => {
    const result = makeSampleResult();
    const output = formatAnalysisForDiscord(result);
    expect(output).toContain("Token");
  });

  test("includes date range", () => {
    const result = makeSampleResult();
    const output = formatAnalysisForDiscord(result);
    // Should have year or month abbreviation
    expect(output).toMatch(/\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
  });

  test("empty result still formats without crashing", () => {
    const result = runAnalysis([]);
    expect(() => formatAnalysisForDiscord(result)).not.toThrow();
    expect(formatAnalysisForDiscord(result).length).toBeGreaterThan(0);
  });

  test("shows at most 5 topics", () => {
    const msgs: ConversationRow[] = [];
    const topics = ["fix bug code", "design api schema", "docker kubernetes deploy", "research analyze evaluate", "prompt llm claude", "config setup environment", "image art creative"];
    for (const content of topics) {
      msgs.push(makeUserMsg(content));
    }
    const result = runAnalysis(msgs);
    const output = formatAnalysisForDiscord(result);
    // Count numbered list items in topics section - max 5
    const topicLines = (output.match(/^\d+\. /gm) ?? []).length;
    expect(topicLines).toBeLessThanOrEqual(5);
  });
});

describe("formatAnalysisAsMarkdown", () => {
  test("output contains all major sections", () => {
    const result = makeSampleResult();
    const output = formatAnalysisAsMarkdown(result);
    expect(output).toContain("# Conversation Analysis Report");
    expect(output).toContain("## Topics");
    expect(output).toContain("## Sentiment Analysis");
    expect(output).toContain("## Most Helpful Responses");
    expect(output).toContain("## Token Efficiency");
  });

  test("output is longer than Discord format (full report)", () => {
    const result = makeSampleResult();
    const discord = formatAnalysisForDiscord(result);
    const markdown = formatAnalysisAsMarkdown(result);
    expect(markdown.length).toBeGreaterThan(discord.length);
  });

  test("includes date range", () => {
    const result = makeSampleResult();
    const output = formatAnalysisAsMarkdown(result);
    expect(output).toContain("Date Range");
  });

  test("includes Total Turns", () => {
    const result = makeSampleResult();
    const output = formatAnalysisAsMarkdown(result);
    expect(output).toContain("Total Turns");
  });

  test("empty result formats gracefully", () => {
    const result = runAnalysis([]);
    expect(() => formatAnalysisAsMarkdown(result)).not.toThrow();
  });

  test("number formatting uses commas for large numbers", () => {
    const sess = uniqueSession();
    const msgs = [
      makeAssistantMsg("big response", sess, undefined, { tokens: { input: 1500000, output: 900000 } }),
    ];
    const result = runAnalysis(msgs);
    const output = formatAnalysisAsMarkdown(result);
    expect(output).toMatch(/1,500,000|900,000/);
  });

  test("percentage formatting includes % symbol", () => {
    const msgs = [makeUserMsg("fix this bug"), makeUserMsg("another bug")];
    const result = runAnalysis(msgs);
    const output = formatAnalysisAsMarkdown(result);
    expect(output).toContain("%");
  });
});

describe("formatAnalysisAsHTML", () => {
  test("contains a style tag", () => {
    const result = makeSampleResult();
    const html = formatAnalysisAsHTML(result);
    expect(html).toContain("<style>");
  });

  test("uses dark theme background color", () => {
    const result = makeSampleResult();
    const html = formatAnalysisAsHTML(result);
    expect(html).toContain("#0a0a1a");
  });

  test("uses accent neon green color", () => {
    const result = makeSampleResult();
    const html = formatAnalysisAsHTML(result);
    expect(html).toContain("#00ff88");
  });

  test("uses magenta secondary color", () => {
    const result = makeSampleResult();
    const html = formatAnalysisAsHTML(result);
    expect(html).toContain("#ff00ff");
  });

  test("contains topic bar chart elements", () => {
    const msgs = [makeUserMsg("fix this bug code function"), makeUserMsg("design the api schema")];
    const result = runAnalysis(msgs);
    const html = formatAnalysisAsHTML(result);
    // Bar charts use width in inline style
    expect(html).toContain("width:");
  });

  test("includes sentiment section", () => {
    const result = makeSampleResult();
    const html = formatAnalysisAsHTML(result);
    expect(html).toContain("Sentiment");
  });

  test("is valid HTML with doctype", () => {
    const result = makeSampleResult();
    const html = formatAnalysisAsHTML(result);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  test("empty result formats gracefully", () => {
    const result = runAnalysis([]);
    expect(() => formatAnalysisAsHTML(result)).not.toThrow();
    const html = formatAnalysisAsHTML(result);
    expect(html).toContain("<!DOCTYPE html>");
  });

  test("token numbers appear in the HTML", () => {
    const sess = uniqueSession();
    const msgs = [makeAssistantMsg("response", sess, undefined, { tokens: { input: 12345, output: 6789 } })];
    const result = runAnalysis(msgs);
    const html = formatAnalysisAsHTML(result);
    expect(html).toContain("12,345");
  });

  test("XSS-sensitive content is escaped", () => {
    const msgs = [makeUserMsg('<script>alert("xss")</script>')];
    const result = runAnalysis(msgs);
    const html = formatAnalysisAsHTML(result);
    expect(html).not.toContain("<script>alert");
  });
});

// ============================================================================
// 6. Command Parsing
// ============================================================================

describe("parseAnalysisArgs", () => {
  test("empty string returns defaults (discord, 7-day, full)", () => {
    const args = parseAnalysisArgs("");
    expect(args.format).toBe("discord");
    expect(args.rangeMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(args.mode).toBe("full");
  });

  test("range:last-30-days sets 30-day range", () => {
    const args = parseAnalysisArgs("range:last-30-days");
    expect(args.rangeMs).toBe(30 * 24 * 60 * 60 * 1000);
  });

  test("format:html sets html format", () => {
    const args = parseAnalysisArgs("format:html");
    expect(args.format).toBe("html");
  });

  test("format:markdown sets markdown format", () => {
    const args = parseAnalysisArgs("format:markdown");
    expect(args.format).toBe("markdown");
  });

  test("topics sets topics mode", () => {
    const args = parseAnalysisArgs("topics");
    expect(args.mode).toBe("topics");
  });

  test("sentiment sets sentiment mode", () => {
    const args = parseAnalysisArgs("sentiment");
    expect(args.mode).toBe("sentiment");
  });

  test("tokens sets tokens mode", () => {
    const args = parseAnalysisArgs("tokens");
    expect(args.mode).toBe("tokens");
  });

  test("format:html range:all sets both", () => {
    const args = parseAnalysisArgs("format:html range:all");
    expect(args.format).toBe("html");
    expect(args.rangeMs).toBeNull();
  });

  test("range:all sets null (all time)", () => {
    const args = parseAnalysisArgs("range:all");
    expect(args.rangeMs).toBeNull();
  });

  test("case insensitive", () => {
    const args = parseAnalysisArgs("FORMAT:HTML RANGE:ALL");
    expect(args.format).toBe("html");
    expect(args.rangeMs).toBeNull();
  });

  test("range:last-90-days sets 90-day range", () => {
    const args = parseAnalysisArgs("range:last-90-days");
    expect(args.rangeMs).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

// ============================================================================
// 7. handleAnalyzeCommand integration tests
// ============================================================================

function makeMockDB(rows: ConversationRow[]): AnalysisMemoryDB {
  return {
    query(_collection: string, _opts?: any) {
      return rows;
    },
  };
}

describe("handleAnalyzeCommand", () => {
  test("no data returns informative message", async () => {
    const db = makeMockDB([]);
    const result = await handleAnalyzeCommand("", db);
    expect(result.text).toContain("No conversation data");
  });

  test("default command returns Discord summary", async () => {
    const sess = uniqueSession();
    const rows = [
      makeUserMsg("fix this bug in code", sess),
      makeAssistantMsg("Here is the fix with code:\n```js\nconst x = 1\n```", sess),
    ];
    const db = makeMockDB(rows);
    const result = await handleAnalyzeCommand("", db);
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.fileAttachment).toBeUndefined();
  });

  test("format:markdown returns file attachment", async () => {
    const sess = uniqueSession();
    const rows = [
      makeUserMsg("fix the code bug", sess),
      makeAssistantMsg("Here is the solution explanation with enough text to be useful.", sess),
    ];
    const db = makeMockDB(rows);
    const result = await handleAnalyzeCommand("format:markdown", db);
    expect(result.fileAttachment).toBeDefined();
    expect(result.fileAttachment!.name).toMatch(/\.md$/);
    // Cleanup
    try { require("fs").unlinkSync(result.fileAttachment!.path); } catch {}
  });

  test("format:html returns html file attachment", async () => {
    const sess = uniqueSession();
    const rows = [
      makeUserMsg("design the api architecture", sess),
      makeAssistantMsg("Here is the architecture design with tables:\n| Col1 | Col2 |\n|------|------|\n| a | b |", sess),
    ];
    const db = makeMockDB(rows);
    const result = await handleAnalyzeCommand("format:html", db);
    expect(result.fileAttachment).toBeDefined();
    expect(result.fileAttachment!.name).toMatch(/\.html$/);
    // Cleanup
    try { require("fs").unlinkSync(result.fileAttachment!.path); } catch {}
  });

  test("topics mode returns topics-only text", async () => {
    const rows = [makeUserMsg("debug the code function"), makeAssistantMsg("Here is the fix")];
    const db = makeMockDB(rows);
    const result = await handleAnalyzeCommand("topics", db);
    expect(result.text).toContain("Topics");
    expect(result.fileAttachment).toBeUndefined();
  });

  test("sentiment mode returns sentiment-only text", async () => {
    const rows = [makeUserMsg("this is great and awesome"), makeAssistantMsg("Glad it helps!")];
    const db = makeMockDB(rows);
    const result = await handleAnalyzeCommand("sentiment", db);
    expect(result.text).toContain("Sentiment");
    expect(result.fileAttachment).toBeUndefined();
  });

  test("tokens mode returns token-only text", async () => {
    const rows = [makeAssistantMsg("r", undefined, undefined, { tokens: { input: 100, output: 50 } })];
    const db = makeMockDB(rows);
    const result = await handleAnalyzeCommand("tokens", db);
    expect(result.text).toContain("Token");
    expect(result.fileAttachment).toBeUndefined();
  });
});

// ============================================================================
// 8. runAnalysis integration
// ============================================================================

describe("runAnalysis", () => {
  test("returns correct totalTurns count", () => {
    const msgs = [makeUserMsg("hello"), makeAssistantMsg("hi"), makeUserMsg("bye")];
    const result = runAnalysis(msgs);
    expect(result.totalTurns).toBe(3);
  });

  test("returns correct totalSessions count", () => {
    const sess1 = uniqueSession();
    const sess2 = uniqueSession();
    const msgs = [
      makeUserMsg("msg 1", sess1),
      makeUserMsg("msg 2", sess2),
      makeAssistantMsg("reply", sess1),
    ];
    const result = runAnalysis(msgs);
    expect(result.totalSessions).toBe(2);
  });

  test("dateRange reflects actual timestamps", () => {
    const now = Date.now();
    const msgs = [
      makeUserMsg("early", undefined, now - 10000),
      makeAssistantMsg("late", undefined, now),
    ];
    const result = runAnalysis(msgs);
    expect(result.dateRange.start.getTime()).toBe(now - 10000);
    expect(result.dateRange.end.getTime()).toBe(now);
  });

  test("empty corpus returns zero totals", () => {
    const result = runAnalysis([]);
    expect(result.totalTurns).toBe(0);
    expect(result.totalSessions).toBe(0);
    expect(result.topics).toEqual([]);
    expect(result.helpfulResponses).toEqual([]);
  });

  test("all fields present in result", () => {
    const result = runAnalysis([makeUserMsg("hello")]);
    expect(result.dateRange).toBeDefined();
    expect(result.totalTurns).toBeDefined();
    expect(result.totalSessions).toBeDefined();
    expect(result.topics).toBeDefined();
    expect(result.sentiment).toBeDefined();
    expect(result.helpfulResponses).toBeDefined();
    expect(result.tokenEfficiency).toBeDefined();
  });
});
