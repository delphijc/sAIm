/**
 * Episodic Memory Integration Tests
 * Tests recordTurn, getRecentTurns, buildConversationContext,
 * searchConversation, getConversationStats, and pruneOldTurns
 * against a real in-memory SQLite database.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { _setDbForTesting } from "../memory/db.ts";
import {
  recordTurn,
  getRecentTurns,
  buildConversationContext,
  searchConversation,
  getConversationStats,
  pruneOldTurns,
} from "../memory/episodic.ts";
import type { EpisodicMemory } from "../memory/episodic.ts";
import { createTestDb } from "./test-helpers.ts";

let testDb: Database;

function initTestDb() {
  testDb = createTestDb();
  _setDbForTesting(testDb);
}

function makeTurn(overrides: Partial<EpisodicMemory> = {}): EpisodicMemory {
  return {
    sessionId: "test-session",
    discordUserId: "user-123",
    discordChannelId: "channel-456",
    role: "user",
    content: "Hello there",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("Episodic Memory - recordTurn", () => {
  beforeEach(() => initTestDb());
  afterEach(() => {
    _setDbForTesting(null);
    testDb.close();
  });

  it("should record a turn and return an ID", async () => {
    const id = await recordTurn(makeTurn());
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBe(36);
  });

  it("should persist turn content in database", async () => {
    await recordTurn(makeTurn({ content: "Persisted message" }));
    const rows = testDb.query("SELECT content FROM conversations").all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].content).toBe("Persisted message");
  });

  it("should store metadata as JSON", async () => {
    await recordTurn(
      makeTurn({
        metadata: { messageType: "voice", attachmentCount: 2 },
      })
    );
    const rows = testDb.query("SELECT metadata FROM conversations").all() as any[];
    const meta = JSON.parse(rows[0].metadata);
    expect(meta.messageType).toBe("voice");
    expect(meta.attachmentCount).toBe(2);
  });

  it("should record both user and assistant turns", async () => {
    const now = Date.now();
    await recordTurn(makeTurn({ role: "user", content: "Question", timestamp: now }));
    await recordTurn(makeTurn({ role: "assistant", content: "Answer", timestamp: now + 1000 }));

    const rows = testDb.query("SELECT role FROM conversations ORDER BY timestamp").all() as any[];
    expect(rows.length).toBe(2);
    expect(rows[0].role).toBe("user");
    expect(rows[1].role).toBe("assistant");
  });
});

describe("Episodic Memory - getRecentTurns", () => {
  beforeEach(() => initTestDb());
  afterEach(() => {
    _setDbForTesting(null);
    testDb.close();
  });

  it("should return turns in chronological order (oldest first)", async () => {
    const now = Date.now();
    await recordTurn(makeTurn({ content: "First", timestamp: now }));
    await recordTurn(makeTurn({ content: "Second", timestamp: now + 1000 }));
    await recordTurn(makeTurn({ content: "Third", timestamp: now + 2000 }));

    const turns = await getRecentTurns("test-session", 10);
    expect(turns.length).toBe(3);
    expect(turns[0].content).toBe("First");
    expect(turns[2].content).toBe("Third");
  });

  it("should respect count limit", async () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      await recordTurn(makeTurn({ content: `Msg ${i}`, timestamp: now + i * 1000 }));
    }

    const turns = await getRecentTurns("test-session", 3);
    expect(turns.length).toBe(3);
  });

  it("should only return turns for the specified session", async () => {
    const now = Date.now();
    await recordTurn(makeTurn({ sessionId: "session-a", content: "A", timestamp: now }));
    await recordTurn(makeTurn({ sessionId: "session-b", content: "B", timestamp: now }));

    const turns = await getRecentTurns("session-a", 10);
    expect(turns.length).toBe(1);
    expect(turns[0].content).toBe("A");
  });

  it("should return empty array when no turns exist", async () => {
    const turns = await getRecentTurns("nonexistent-session", 10);
    expect(turns.length).toBe(0);
  });

  it("should return most recent turns when count < total", async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await recordTurn(makeTurn({ content: `Msg ${i}`, timestamp: now + i * 1000 }));
    }

    // Limit 2 fetches the 2 most recent (DESC), then reversed to chronological
    const turns = await getRecentTurns("test-session", 2);
    expect(turns.length).toBe(2);
    expect(turns[0].content).toBe("Msg 3");
    expect(turns[1].content).toBe("Msg 4");
  });
});

describe("Episodic Memory - buildConversationContext", () => {
  beforeEach(() => initTestDb());
  afterEach(() => {
    _setDbForTesting(null);
    testDb.close();
  });

  it("should return empty string for no history", async () => {
    const ctx = await buildConversationContext("empty-session");
    expect(ctx).toBe("");
  });

  it("should format user turns as 'You' and assistant turns as 'Sam'", async () => {
    const now = Date.now();
    await recordTurn(makeTurn({ role: "user", content: "Hello", timestamp: now }));
    await recordTurn(makeTurn({ role: "assistant", content: "Hi there!", timestamp: now + 1000 }));

    const ctx = await buildConversationContext("test-session");
    expect(ctx).toContain("**You**: Hello");
    expect(ctx).toContain("**Sam**: Hi there!");
  });

  it("should include header text", async () => {
    await recordTurn(makeTurn({ content: "Test" }));
    const ctx = await buildConversationContext("test-session");
    expect(ctx).toContain("**Recent Conversation Context:**");
  });

  it("should truncate when token budget exceeded", async () => {
    const now = Date.now();
    // Each turn ~250 chars * 0.25 = ~62.5 tokens; with maxTokens=100, only ~1-2 turns fit
    for (let i = 0; i < 10; i++) {
      await recordTurn(
        makeTurn({
          content: "A".repeat(250),
          timestamp: now + i * 1000,
        })
      );
    }

    const ctx = await buildConversationContext("test-session", 10, 100);
    expect(ctx).toContain("_...earlier context omitted..._");
  });

  it("should gracefully handle errors", async () => {
    // Close the DB to force an error
    _setDbForTesting(null);
    const ctx = await buildConversationContext("test-session");
    expect(ctx).toBe("");
    // Restore for cleanup
    _setDbForTesting(testDb);
  });
});

describe("Episodic Memory - searchConversation", () => {
  beforeEach(() => initTestDb());
  afterEach(() => {
    _setDbForTesting(null);
    testDb.close();
  });

  it("should find turns matching query string", async () => {
    const now = Date.now();
    await recordTurn(makeTurn({ content: "I love Python programming", timestamp: now }));
    await recordTurn(makeTurn({ content: "JavaScript is cool too", timestamp: now + 1000 }));

    const results = await searchConversation("test-session", "Python");
    expect(results.length).toBe(1);
    expect(results[0].content).toContain("Python");
  });

  it("should return empty array for no matches", async () => {
    await recordTurn(makeTurn({ content: "Hello world" }));
    const results = await searchConversation("test-session", "nonexistent-xyz");
    expect(results.length).toBe(0);
  });

  it("should only search within the specified session", async () => {
    const now = Date.now();
    await recordTurn(makeTurn({ sessionId: "session-a", content: "Python in A", timestamp: now }));
    await recordTurn(makeTurn({ sessionId: "session-b", content: "Python in B", timestamp: now }));

    const results = await searchConversation("session-a", "Python");
    expect(results.length).toBe(1);
    expect(results[0].sessionId).toBe("session-a");
  });

  it("should find partial content matches", async () => {
    await recordTurn(makeTurn({ content: "The architecture of microservices" }));
    const results = await searchConversation("test-session", "micro");
    expect(results.length).toBe(1);
  });
});

describe("Episodic Memory - getConversationStats", () => {
  beforeEach(() => initTestDb());
  afterEach(() => {
    _setDbForTesting(null);
    testDb.close();
  });

  it("should return zero counts for empty session", async () => {
    const stats = await getConversationStats("empty-session");
    expect(stats.totalTurns).toBe(0);
    expect(stats.userTurns).toBe(0);
    expect(stats.assistantTurns).toBe(0);
    expect(stats.timeSpan).toBe(0);
  });

  it("should count user and assistant turns correctly", async () => {
    const now = Date.now();
    await recordTurn(makeTurn({ role: "user", content: "Q1", timestamp: now }));
    await recordTurn(makeTurn({ role: "assistant", content: "A1", timestamp: now + 1000 }));
    await recordTurn(makeTurn({ role: "user", content: "Q2", timestamp: now + 2000 }));

    const stats = await getConversationStats("test-session");
    expect(stats.totalTurns).toBe(3);
    expect(stats.userTurns).toBe(2);
    expect(stats.assistantTurns).toBe(1);
  });

  it("should calculate average message lengths", async () => {
    const now = Date.now();
    await recordTurn(makeTurn({ role: "user", content: "Hi", timestamp: now }));
    await recordTurn(makeTurn({ role: "user", content: "Hello world", timestamp: now + 1000 }));
    await recordTurn(makeTurn({ role: "assistant", content: "Response here!", timestamp: now + 2000 }));

    const stats = await getConversationStats("test-session");
    // "Hi" = 2, "Hello world" = 11, avg = 6.5 -> rounded = 7
    expect(stats.avgUserMessageLength).toBe(7);
    expect(stats.avgAssistantMessageLength).toBe(14);
  });

  it("should calculate time span between first and last turn", async () => {
    const now = Date.now();
    await recordTurn(makeTurn({ content: "First", timestamp: now }));
    await recordTurn(makeTurn({ content: "Last", timestamp: now + 60000 }));

    const stats = await getConversationStats("test-session");
    expect(stats.timeSpan).toBe(60000);
  });

  it("should return zero timeSpan for single turn", async () => {
    await recordTurn(makeTurn({ content: "Only one" }));
    const stats = await getConversationStats("test-session");
    expect(stats.timeSpan).toBe(0);
  });
});

describe("Episodic Memory - pruneOldTurns", () => {
  beforeEach(() => initTestDb());
  afterEach(() => {
    _setDbForTesting(null);
    testDb.close();
  });

  it("should return 0 when no turns are old enough", async () => {
    await recordTurn(makeTurn({ content: "Recent", timestamp: Date.now() }));
    const pruned = await pruneOldTurns("test-session", 30);
    expect(pruned).toBe(0);
  });

  it("should delete turns older than retention period", async () => {
    const now = Date.now();
    const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;

    await recordTurn(makeTurn({ content: "Old", timestamp: thirtyOneDaysAgo }));
    await recordTurn(makeTurn({ content: "Recent", timestamp: now }));

    const pruned = await pruneOldTurns("test-session", 30);
    expect(pruned).toBe(1);

    // Verify old turn was actually deleted
    const remaining = await getRecentTurns("test-session", 100);
    expect(remaining.length).toBe(1);
    expect(remaining[0].content).toBe("Recent");
  });

  it("should only prune turns from the specified session", async () => {
    const now = Date.now();
    const oldTime = now - 60 * 24 * 60 * 60 * 1000; // 60 days ago

    await recordTurn(makeTurn({ sessionId: "session-a", content: "Old A", timestamp: oldTime }));
    await recordTurn(makeTurn({ sessionId: "session-b", content: "Old B", timestamp: oldTime }));

    await pruneOldTurns("session-a", 30);

    // Session A's old turn should be gone
    const turnsA = await getRecentTurns("session-a", 100);
    expect(turnsA.length).toBe(0);

    // Session B's old turn should still exist
    const turnsB = await getRecentTurns("session-b", 100);
    expect(turnsB.length).toBe(1);
  });

  it("should handle custom retention periods", async () => {
    const now = Date.now();
    const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;

    await recordTurn(makeTurn({ content: "Five days old", timestamp: fiveDaysAgo }));
    await recordTurn(makeTurn({ content: "Recent", timestamp: now }));

    // With 7-day retention, 5-day-old turn should survive
    const pruned7 = await pruneOldTurns("test-session", 7);
    expect(pruned7).toBe(0);

    // With 3-day retention, 5-day-old turn should be pruned
    const pruned3 = await pruneOldTurns("test-session", 3);
    expect(pruned3).toBe(1);
  });
});
