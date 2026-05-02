#!/usr/bin/env bun

/**
 * Tests for session briefing enhancements
 *
 * Tests for:
 * 1. Enhanced Open Threads Detection
 * 2. Knowledge Domain Weighting
 * 3. Conversation History Integration
 * 4. Recent Learnings Optimization
 */

import { describe, it, expect } from "bun:test";

// Import the scoring functions
// Note: These would need to be exported from session-briefing.ts
// For now, we'll re-implement them here for testing

/**
 * Enhanced Open Threads Detection
 */
function scoreOpenThread(content: string): number {
  let score = 0;

  if (content.match(/\?$/m)) score += 0.3;
  if (content.match(/\b(tomorrow|next week|next time|eventually|someday|later|soon|next month|upcoming)\b/i)) {
    score += 0.2;
  }
  if (content.match(/\b(debug|investigate|check|fix|build|implement|test|refactor|review|verify|validate|confirm|test)\b/i)) {
    score += 0.15;
  }
  if (content.match(/\b(blocked by|waiting for|stuck on|pending|hung|unable to|can't|cannot)\b/i)) {
    score += 0.2;
  }
  if (content.match(/\b(still need to|haven't|yet|not done|incomplete|unfinished)\b/i)) {
    score += 0.15;
  }
  if (content.match(/\b(TODO|FIXME|BUG|ISSUE)\b/i)) {
    score += 0.25;
  }
  if (content.match(/\b(follow up|come back to|revisit|circle back)\b/i)) {
    score += 0.2;
  }

  return Math.min(score, 1.0);
}

/**
 * Domain Weighting
 */
function scoreDomain(
  topic: string,
  count: number,
  recentCount: number,
  avgConfidence: number,
  accessCount: number,
  maxAccessInAnyDomain: number
): number {
  const recencyScore = recentCount / Math.max(count, 1);
  const frequencyScore = accessCount / Math.max(maxAccessInAnyDomain, 1);
  const confidenceScore = avgConfidence;

  return (
    recencyScore * 0.3 +
    frequencyScore * 0.3 +
    confidenceScore * 0.2
  );
}

/**
 * Recency Score with Exponential Decay
 */
function getRecencyScore(timestamp: number, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
  const ageMs = Date.now() - timestamp;
  if (ageMs < 0) return 1.0;
  if (ageMs > maxAgeMs) return 0.0;
  const halfLife = 3 * 24 * 60 * 60 * 1000;
  return Math.exp(-ageMs / halfLife);
}

/**
 * Actionability Scoring
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
  return 0.1;
}

/**
 * Conversation Turn Scoring
 */
function scoreConversationTurn(
  role: string,
  content: string,
  timestamp: number,
  recentLearnings: { topic: string; summary: string }[] = []
): number {
  let score = 0;
  const roleMultiplier = role === 'user' ? 1.0 : 0.7;

  if (content.match(/```[\s\S]*?```/)) score += 0.2;
  if (content.match(/TODO|FIXME|BUG|ISSUE/i)) score += 0.25;
  if (content.length > 500) score += 0.15;
  if (content.match(/\[.*?\]\(.*?\)/)) score += 0.1;

  const actionability = scoreActionability("", content);
  score += actionability * 0.2;

  if (recentLearnings.length > 0) {
    const contentWords = content.toLowerCase().split(/\s+/);
    for (const learning of recentLearnings) {
      const learningWords = `${learning.topic} ${learning.summary}`.toLowerCase().split(/\s+/);
      const matches = contentWords.filter(w => learningWords.includes(w)).length;
      if (matches > 0) {
        score += Math.min(matches * 0.05, 0.15);
      }
    }
  }

  const ageMs = Date.now() - timestamp;
  if (ageMs < 24 * 60 * 60 * 1000) {
    const recencyBonus = Math.exp(-ageMs / (12 * 60 * 60 * 1000));
    score += recencyBonus * 0.1;
  }

  return Math.min(score * roleMultiplier, 1.0);
}

// ============================================================================
// TESTS
// ============================================================================

describe("Enhancement 1: Open Threads Detection", () => {
  it("should detect questions", () => {
    const score = scoreOpenThread("Why is this broken?");
    expect(score).toBeGreaterThan(0.25);
  });

  it("should detect temporal anchors", () => {
    const score = scoreOpenThread("We should fix this tomorrow");
    expect(score).toBeGreaterThan(0.15);
  });

  it("should detect action verbs", () => {
    const score = scoreOpenThread("I need to debug the API");
    expect(score).toBeGreaterThan(0.1);
  });

  it("should detect blocking patterns", () => {
    const score = scoreOpenThread("Stuck on the auth flow");
    expect(score).toBeGreaterThan(0.15);
  });

  it("should detect TODO markers", () => {
    const score = scoreOpenThread("TODO: Fix the broken endpoint");
    expect(score).toBeGreaterThan(0.2);
  });

  it("should cap score at 1.0", () => {
    const score = scoreOpenThread("TODO: Debug and fix this blocking issue that needs work next week");
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should score low for non-open content", () => {
    const score = scoreOpenThread("The system is working well");
    expect(score).toBeLessThan(0.1);
  });
});

describe("Enhancement 2: Domain Weighting", () => {
  it("should weight recent active domains higher", () => {
    const recentScore = scoreDomain("recent-topic", 10, 8, 0.8, 100, 100);
    const oldScore = scoreDomain("old-topic", 20, 1, 0.8, 50, 100);
    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it("should weight frequently accessed domains higher", () => {
    const frequentScore = scoreDomain("frequent", 10, 5, 0.8, 80, 100);
    const rareScore = scoreDomain("rare", 10, 5, 0.8, 10, 100);
    expect(frequentScore).toBeGreaterThan(rareScore);
  });

  it("should weight high-confidence domains higher", () => {
    const highConfScore = scoreDomain("high", 10, 5, 0.9, 50, 100);
    const lowConfScore = scoreDomain("low", 10, 5, 0.5, 50, 100);
    expect(highConfScore).toBeGreaterThan(lowConfScore);
  });

  it("should produce score between 0 and 1", () => {
    const score = scoreDomain("topic", 100, 50, 0.75, 500, 1000);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("Enhancement 3: Recency Scoring", () => {
  it("should give high score to very recent items", () => {
    const now = Date.now();
    const score = getRecencyScore(now);
    expect(score).toBeCloseTo(1.0, 0.1);
  });

  it("should apply exponential decay over time", () => {
    const now = Date.now();
    const score1h = getRecencyScore(now - 1 * 60 * 60 * 1000);
    const score3h = getRecencyScore(now - 3 * 60 * 60 * 1000);
    const score6h = getRecencyScore(now - 6 * 60 * 60 * 1000);

    expect(score1h).toBeGreaterThan(score3h);
    expect(score3h).toBeGreaterThan(score6h);
  });

  it("should give zero score to very old items", () => {
    const now = Date.now();
    const oldTimestamp = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago
    const score = getRecencyScore(oldTimestamp);
    expect(score).toBeLessThan(0.01);
  });

  it("should respect custom max age", () => {
    const now = Date.now();
    const timestamp = now - 2 * 24 * 60 * 60 * 1000;
    const scoreWith7d = getRecencyScore(timestamp, 7 * 24 * 60 * 60 * 1000);
    const scoreWith1d = getRecencyScore(timestamp, 1 * 24 * 60 * 60 * 1000);

    expect(scoreWith7d).toBeGreaterThan(scoreWith1d);
  });
});

describe("Enhancement 4: Actionability Scoring", () => {
  it("should score critical items high", () => {
    const score = scoreActionability("critical-bug", "This is blocking production");
    expect(score).toBeGreaterThan(0.8);
  });

  it("should score bugs medium-high", () => {
    const score = scoreActionability("error", "There's a crash in the auth");
    expect(score).toBeGreaterThan(0.7);
  });

  it("should score features medium", () => {
    const score = scoreActionability("feature-request", "TODO: Implement dark mode");
    expect(score).toBeGreaterThan(0.5);
  });

  it("should score questions lower", () => {
    const score = scoreActionability("clarification", "What does this function do?");
    expect(score).toBeLessThan(0.5);
  });

  it("should score info-only content low", () => {
    const score = scoreActionability("info", "The system is working well");
    expect(score).toBeLessThan(0.15);
  });
});

describe("Conversation Turn Scoring", () => {
  it("should score user messages higher than assistant", () => {
    const userScore = scoreConversationTurn('user', 'What needs fixing?', Date.now());
    const assistantScore = scoreConversationTurn('assistant', 'What needs fixing?', Date.now());
    expect(userScore).toBeGreaterThan(assistantScore);
  });

  it("should boost messages with code blocks", () => {
    const withCode = scoreConversationTurn('user', 'Here is the bug:\n```typescript\nconst x = 1\n```', Date.now());
    const withoutCode = scoreConversationTurn('user', 'Here is the bug', Date.now());
    expect(withCode).toBeGreaterThan(withoutCode);
  });

  it("should boost messages with TODO markers", () => {
    const withTodo = scoreConversationTurn('user', 'TODO: Fix this endpoint', Date.now());
    const withoutTodo = scoreConversationTurn('user', 'Fix this endpoint', Date.now());
    expect(withTodo).toBeGreaterThan(withoutTodo);
  });

  it("should boost long, substantive messages", () => {
    const longMsg = 'x'.repeat(600);
    const shortMsg = 'x'.repeat(100);
    const longScore = scoreConversationTurn('user', longMsg, Date.now());
    const shortScore = scoreConversationTurn('user', shortMsg, Date.now());
    expect(longScore).toBeGreaterThan(shortScore);
  });

  it("should consider keyword overlap with recent learnings", () => {
    const recentLearning = { topic: 'authentication', summary: 'JWT tokens' };
    const relatedMsg = scoreConversationTurn('user', 'How do JWT tokens work in auth?', Date.now(), [recentLearning]);
    const unrelatedMsg = scoreConversationTurn('user', 'How do users subscribe?', Date.now(), [recentLearning]);
    expect(relatedMsg).toBeGreaterThan(unrelatedMsg);
  });

  it("should cap score at 1.0", () => {
    const score = scoreConversationTurn('user', 'TODO: ' + 'x'.repeat(1000), Date.now());
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

describe("Integration: Enhanced Session Brief System", () => {
  it("should prioritize critical open threads", () => {
    const threads = [
      { content: "We should review this sometime", score: scoreOpenThread("We should review this sometime") },
      { content: "TODO: CRITICAL BUG - production is down!", score: scoreOpenThread("TODO: CRITICAL BUG - production is down!") },
      { content: "The weather is nice today", score: scoreOpenThread("The weather is nice today") }
    ];

    threads.sort((a, b) => b.score - a.score);
    expect(threads[0].content).toContain("CRITICAL BUG");
  });

  it("should rank domains by composite weight", () => {
    const domains = [
      { name: "security", recent: 15, count: 20, conf: 0.95, access: 100, maxAccess: 100 }, // High recency ratio, high conf, high access
      { name: "docs", recent: 1, count: 20, conf: 0.6, access: 20, maxAccess: 100 }, // Low recency, low access
      { name: "features", recent: 8, count: 15, conf: 0.7, access: 80, maxAccess: 100 } // Medium on all metrics
    ];

    const scored = domains.map(d =>
      ({
        ...d,
        weight: scoreDomain(d.name, d.count, d.recent, d.conf, d.access, d.maxAccess)
      })
    );

    scored.sort((a, b) => b.weight - a.weight);
    // Security should rank first due to high recency ratio (15/20) + high confidence + high access
    expect(scored[0].name).toBe("security");
    // Docs should rank last due to low metrics across the board
    expect(scored[2].name).toBe("docs");
  });
});
