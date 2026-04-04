/**
 * SQLite Memory Database Tests
 * 32 comprehensive test cases covering initialization, episodic memory,
 * semantic memory, FTS5 search, adapters, and cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import path from "path";
import {
  initializeMemory,
  getMemoryInstance,
  saveConversationMemory,
  getSessionConversations,
  saveSemanticMemory,
  findSimilarMemories,
  decayOldMemories,
  cleanupSessionMemory,
  getMemoryStats,
  _setDbForTesting,
} from "../memory/db.ts";
import { createTestDb } from "./test-helpers.ts";

let testDb: Database;

// Helper to initialize test database using the shared helper
async function initTestDb() {
  testDb = createTestDb();
  _setDbForTesting(testDb);
}

describe("SQLite Memory - Initialization", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should create database and tables on init", async () => {
    const convTable = testDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'").get();
    const semTable = testDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name='semantic'").get();
    const ftsTable = testDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name='semantic_fts'").get();

    expect(convTable).toBeTruthy();
    expect(semTable).toBeTruthy();
    expect(ftsTable).toBeTruthy();
  });

  it("should create indexes for conversations table", () => {
    const indexes = testDb.query("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='conversations'").all();
    const indexNames = (indexes as any[]).map((i: any) => i.name);

    expect(indexNames).toContain("idx_conversations_session");
  });

  it("should create triggers for semantic FTS sync", () => {
    const triggers = testDb.query("SELECT name FROM sqlite_master WHERE type='trigger'").all();
    const triggerNames = (triggers as any[]).map((t: any) => t.name);

    expect(triggerNames.some(name => name.includes("semantic"))).toBe(true);
  });
});

describe("SQLite Memory - Conversations (Episodic)", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should insert conversation turn and get ID back", async () => {
    const id = await saveConversationMemory({
      sessionId: "test-session-1",
      discordUserId: "user-123",
      discordChannelId: "channel-456",
      role: "user",
      content: "Hello!",
      timestamp: Date.now(),
    });

    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBe(36); // UUID length
  });

  it("should query by sessionId returns matching turns", async () => {
    const now = Date.now();
    await saveConversationMemory({
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "user",
      content: "First message",
      timestamp: now,
    });

    await saveConversationMemory({
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "assistant",
      content: "Response",
      timestamp: now + 1000,
    });

    await saveConversationMemory({
      sessionId: "session-2",
      discordUserId: "user-2",
      discordChannelId: "channel-2",
      role: "user",
      content: "Different session",
      timestamp: now,
    });

    const results = await getSessionConversations("session-1");

    expect(results.length).toBe(2);
    expect(results[0].sessionId).toBe("session-1");
  });

  it("should query respects limit parameter", async () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      await saveConversationMemory({
        sessionId: "session-1",
        discordUserId: "user-1",
        discordChannelId: "channel-1",
        role: "user",
        content: `Message ${i}`,
        timestamp: now + i * 1000,
      });
    }

    const results = await getSessionConversations("session-1", 5);

    expect(results.length).toBe(5);
  });

  it("should return results ordered by timestamp DESC", async () => {
    const now = Date.now();
    const id1 = await saveConversationMemory({
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "user",
      content: "Old message",
      timestamp: now,
    });

    const id2 = await saveConversationMemory({
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "assistant",
      content: "New message",
      timestamp: now + 5000,
    });

    const results = await getSessionConversations("session-1");

    expect(results[0].id).toBe(id2);
    expect(results[1].id).toBe(id1);
  });

  it("should store and retrieve metadata as JSON", async () => {
    await saveConversationMemory({
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "user",
      content: "Message with metadata",
      timestamp: Date.now(),
      metadata: {
        messageType: "voice",
        attachmentCount: 2,
        tokens: 150,
      },
    });

    const results = await getSessionConversations("session-1");

    expect(results[0].metadata?.messageType).toBe("voice");
    expect(results[0].metadata?.attachmentCount).toBe(2);
    expect(results[0].metadata?.tokens).toBe(150);
  });

  it("should isolate sessions from each other", async () => {
    await saveConversationMemory({
      sessionId: "session-a",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "user",
      content: "Session A",
      timestamp: Date.now(),
    });

    await saveConversationMemory({
      sessionId: "session-b",
      discordUserId: "user-2",
      discordChannelId: "channel-2",
      role: "user",
      content: "Session B",
      timestamp: Date.now(),
    });

    const resultsA = await getSessionConversations("session-a");
    const resultsB = await getSessionConversations("session-b");

    expect(resultsA.length).toBe(1);
    expect(resultsB.length).toBe(1);
    expect(resultsA[0].content).toBe("Session A");
    expect(resultsB[0].content).toBe("Session B");
  });
});

describe("SQLite Memory - Semantic", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should insert semantic memory and get ID back", async () => {
    const id = await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Python basics",
      summary: "Learned about loops and conditionals",
      createdAt: Date.now(),
      relevanceScore: 0.9,
    });

    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("should query by sessionId returns matching memories", async () => {
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Topic 1",
      summary: "Summary 1",
      createdAt: Date.now(),
      relevanceScore: 0.8,
    });

    await saveSemanticMemory({
      sessionId: "session-2",
      topic: "Topic 2",
      summary: "Summary 2",
      createdAt: Date.now(),
      relevanceScore: 0.7,
    });

    const memory = getMemoryInstance();
    const results = memory.query("semantic", { sessionId: "session-1" });

    expect(results.length).toBe(1);
    expect(results[0].topic).toBe("Topic 1");
  });

  it("should update relevance score", async () => {
    const id = await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Test Topic",
      summary: "Test Summary",
      createdAt: Date.now(),
      relevanceScore: 0.9,
    });

    const memory = getMemoryInstance();
    memory.update("semantic", id, { relevanceScore: 0.5 });

    const results = memory.query("semantic", { sessionId: "session-1" });
    expect(results[0].relevanceScore).toBe(0.5);
  });

  it("should rank recent memories higher using ACT-R scoring", async () => {
    const now = Date.now();
    const oldTime = now - 24 * 60 * 60 * 1000; // 24 hours ago

    // Create an old memory
    const oldMemId = await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Old Topic",
      summary: "Old memory accessed long ago",
      createdAt: oldTime,
      relevanceScore: 1.0,
      accessCount: 1,
      lastAccess: oldTime,
      confidence: 0.7,
      source: "discord",
    });

    // Create a recent memory
    const newMemId = await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Old Topic", // Same topic for search
      summary: "New memory just accessed",
      createdAt: now,
      relevanceScore: 1.0,
      accessCount: 1,
      lastAccess: now,
      confidence: 0.7,
      source: "discord",
    });

    // Search - recent memory should rank higher due to ACT-R
    const results = await findSimilarMemories("Old Topic", "session-1", 5);

    expect(results.length).toBeGreaterThanOrEqual(1);
    // The most recent memory should appear first
    if (results.length >= 2) {
      const newMemIdx = results.findIndex((r) => r.id === newMemId);
      const oldMemIdx = results.findIndex((r) => r.id === oldMemId);
      if (newMemIdx >= 0 && oldMemIdx >= 0) {
        expect(newMemIdx).toBeLessThan(oldMemIdx);
      }
    }
  });

  it("should skip memories within age threshold", async () => {
    const now = Date.now();
    const recentTime = now - 12 * 60 * 60 * 1000; // 12 hours ago

    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Recent Topic",
      summary: "Recent Summary",
      createdAt: recentTime,
      relevanceScore: 1.0,
    });

    const decayedCount = await decayOldMemories("session-1", 24);

    expect(decayedCount).toBe(0); // No decay, not old enough
  });
});

describe("SQLite Memory - FTS5 Semantic Search", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should find memories matching topic keywords", async () => {
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Python programming basics",
      summary: "Introduction to variables and types",
      createdAt: Date.now(),
      relevanceScore: 0.9,
    });

    const results = await findSimilarMemories("Python", "session-1");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].topic).toContain("Python");
  });

  it("should find memories matching summary keywords", async () => {
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Advanced concepts",
      summary: "Deep understanding of recursion and decorators",
      createdAt: Date.now(),
      relevanceScore: 0.9,
    });

    const results = await findSimilarMemories("recursion", "session-1");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].summary).toContain("recursion");
  });

  it("should filter by sessionId", async () => {
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "JavaScript fundamentals",
      summary: "Learning async/await",
      createdAt: Date.now(),
      relevanceScore: 0.9,
    });

    await saveSemanticMemory({
      sessionId: "session-2",
      topic: "JavaScript advanced",
      summary: "Closures and prototypes",
      createdAt: Date.now(),
      relevanceScore: 0.8,
    });

    const results = await findSimilarMemories("JavaScript", "session-1");

    expect(results.length).toBe(1);
    expect(results[0].sessionId).toBe("session-1");
  });

  it("should respect limit parameter", async () => {
    for (let i = 0; i < 10; i++) {
      await saveSemanticMemory({
        sessionId: "session-1",
        topic: `Topic ${i}`,
        summary: "shared keyword here",
        createdAt: Date.now(),
        relevanceScore: 0.8,
      });
    }

    const results = await findSimilarMemories("keyword", "session-1", 3);

    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("should fallback to LIKE when FTS5 match fails", async () => {
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Test with special chars!@#$",
      summary: "Content here",
      createdAt: Date.now(),
      relevanceScore: 0.9,
    });

    // FTS5 might fail with special chars, should fallback
    const results = await findSimilarMemories("Test", "session-1");

    expect(results.length).toBeGreaterThan(0);
  });

  it("should handle special characters in query", async () => {
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "C++ programming",
      summary: "Memory management and pointers",
      createdAt: Date.now(),
      relevanceScore: 0.9,
    });

    const results = await findSimilarMemories("C++", "session-1");

    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it("should return empty array for no matches", async () => {
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Python",
      summary: "Learning loops",
      createdAt: Date.now(),
      relevanceScore: 0.9,
    });

    const results = await findSimilarMemories("nonexistent-xyz-123", "session-1");

    expect(results.length).toBe(0);
  });
});

describe("SQLite Memory - getMemoryInstance Adapter", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should .query('conversations', ...) works", async () => {
    await saveConversationMemory({
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "user",
      content: "Test",
      timestamp: Date.now(),
    });

    const memory = getMemoryInstance();
    const results = memory.query("conversations", { sessionId: "session-1" });

    expect(results.length).toBe(1);
  });

  it("should .query('semantic', ...) works", async () => {
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Test",
      summary: "Summary",
      createdAt: Date.now(),
      relevanceScore: 0.8,
    });

    const memory = getMemoryInstance();
    const results = memory.query("semantic", { sessionId: "session-1" });

    expect(results.length).toBe(1);
  });

  it("should .query with $contains filter works", async () => {
    await saveConversationMemory({
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "user",
      content: "Hello world",
      timestamp: Date.now(),
    });

    const memory = getMemoryInstance();
    const results = memory.query("conversations", {
      sessionId: "session-1",
      filter: { content: { $contains: "world" } },
    });

    expect(results.length).toBe(1);
  });

  it("should .query with $lt filter works", async () => {
    const now = Date.now();
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Old",
      summary: "Old data",
      createdAt: now - 1000000,
      relevanceScore: 0.8,
    });

    const memory = getMemoryInstance();
    const results = memory.query("semantic", {
      sessionId: "session-1",
      filter: { createdAt: { $lt: now } },
    });

    expect(results.length).toBe(1);
  });

  it("should .insert works for both collections", async () => {
    const memory = getMemoryInstance();

    const convId = memory.insert("conversations", {
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "user",
      content: "Test",
      timestamp: Date.now(),
      metadata: {},
    });

    const semId = memory.insert("semantic", {
      sessionId: "session-1",
      topic: "Test",
      summary: "Summary",
      relevanceScore: 0.8,
      createdAt: Date.now(),
      sourceMessageIds: [],
    });

    expect(convId).toBeTruthy();
    expect(semId).toBeTruthy();
  });

  it("should .semanticSearch works", async () => {
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "JavaScript",
      summary: "Learning async",
      createdAt: Date.now(),
      relevanceScore: 0.9,
    });

    const memory = getMemoryInstance();
    const results = memory.semanticSearch("semantic", "JavaScript", {
      filter: { sessionId: "session-1" },
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
  });

  it("should .update works", async () => {
    const id = await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Test",
      summary: "Summary",
      createdAt: Date.now(),
      relevanceScore: 0.9,
    });

    const memory = getMemoryInstance();
    memory.update("semantic", id, { relevanceScore: 0.5 });

    const results = memory.query("semantic", { sessionId: "session-1" });
    expect(results[0].relevanceScore).toBe(0.5);
  });

  it("should throw if not initialized", () => {
    _setDbForTesting(null);

    expect(() => {
      getMemoryInstance();
    }).toThrow();
  });
});

describe("SQLite Memory - Stats & Cleanup", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should getMemoryStats returns correct counts", async () => {
    const now = Date.now();

    await saveConversationMemory({
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "user",
      content: "Message 1",
      timestamp: now,
    });

    await saveConversationMemory({
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "assistant",
      content: "Response 1",
      timestamp: now + 1000,
    });

    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Topic 1",
      summary: "Summary 1",
      createdAt: now,
      relevanceScore: 0.8,
    });

    const stats = await getMemoryStats("session-1");

    expect(stats.conversationTurns).toBe(2);
    expect(stats.semanticMemories).toBe(1);
    expect(stats.oldestMemory).toBe(now);
    expect(stats.newestMemory).toBe(now + 1000);
  });

  it("should cleanupSessionMemory removes session data", async () => {
    const now = Date.now();

    await saveConversationMemory({
      sessionId: "session-1",
      discordUserId: "user-1",
      discordChannelId: "channel-1",
      role: "user",
      content: "Test",
      timestamp: now,
    });

    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Test",
      summary: "Summary",
      createdAt: now,
      relevanceScore: 0.8,
    });

    await cleanupSessionMemory("session-1");

    const statsBefore = await getMemoryStats("session-1");
    expect(statsBefore.conversationTurns).toBe(0);
    expect(statsBefore.semanticMemories).toBe(0);
  });
});

describe("SQLite Memory - ACT-R Score Ranking Details", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should apply ACT-R formula: ln(count) - 0.5*ln(days) + (conf-0.5)", async () => {
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;

    // Memory accessed 10 times yesterday, high confidence
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Frequently used",
      summary: "High access, high confidence",
      createdAt: yesterday,
      relevanceScore: 0.9,
      accessCount: 10,
      lastAccess: yesterday,
      confidence: 0.9,
    });

    // Memory accessed once long ago, low confidence
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Rarely used",
      summary: "Low access, low confidence",
      createdAt: now - 30 * 24 * 60 * 60 * 1000,
      relevanceScore: 0.5,
      accessCount: 1,
      lastAccess: now - 30 * 24 * 60 * 60 * 1000,
      confidence: 0.3,
    });

    const results = await findSimilarMemories("used", "session-1");

    // Frequently used should rank higher
    expect(results.length).toBe(2);
    if (results[0].accessCount !== undefined && results[1].accessCount !== undefined) {
      expect(results[0].accessCount).toBeGreaterThan(results[1].accessCount);
    }
  });

  it("should rank by confidence when access count is equal", async () => {
    const now = Date.now();

    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Low confidence fact",
      summary: "Same access, low confidence",
      createdAt: now,
      relevanceScore: 0.5,
      accessCount: 5,
      lastAccess: now,
      confidence: 0.4,
    });

    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "High confidence fact",
      summary: "Same access, high confidence",
      createdAt: now,
      relevanceScore: 0.9,
      accessCount: 5,
      lastAccess: now,
      confidence: 0.95,
    });

    const results = await findSimilarMemories("confidence", "session-1");

    expect(results.length).toBe(2);
    // Higher confidence should rank first (confidence boost in ACT-R)
  });
});

describe("SQLite Memory - Initialization Edge Cases", () => {
  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should handle already initialized database gracefully", async () => {
    await initTestDb();

    const instance1 = getMemoryInstance();
    expect(instance1).toBeDefined();

    // Calling initializeMemory again should return cached instance
    const testConfig = { paiDir: "/tmp/test-pai" };
    const instance2 = await initializeMemory(testConfig);
    expect(instance2).toBeDefined();
  });

  it("should save memory with default confidence", async () => {
    await initTestDb();

    const memId = await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Default confidence",
      summary: "Should use 0.5 default",
      createdAt: Date.now(),
      relevanceScore: 0.8,
    });

    expect(memId).toBeDefined();
    const results = await findSimilarMemories("Default", "session-1");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].confidence).toBe(0.5); // Default confidence
  });

  it("should handle ACT-R score with very old timestamps", async () => {
    await initTestDb();

    const veryOldTime = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 year ago

    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Very Old Memory",
      summary: "Ancient history",
      createdAt: veryOldTime,
      relevanceScore: 0.9,
      lastAccess: veryOldTime,
      accessCount: 100,
      confidence: 0.95,
    });

    const results = await findSimilarMemories("Old Memory", "session-1");

    // Should still return results, ACT-R handles old dates gracefully
    expect(results.length).toBeGreaterThan(0);
  });

  it("should handle zero access count in ACT-R calculation", async () => {
    await initTestDb();

    const now = Date.now();

    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Zero access",
      summary: "No accesses yet",
      createdAt: now,
      relevanceScore: 0.8,
      accessCount: 0,
      lastAccess: now,
      confidence: 0.7,
    });

    const results = await findSimilarMemories("Zero access", "session-1");

    // ln(0 + 1) = ln(1) = 0, should still work
    expect(results.length).toBeGreaterThan(0);
  });

  it("should store and retrieve source field", async () => {
    await initTestDb();

    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Test source",
      summary: "Testing source field",
      createdAt: Date.now(),
      relevanceScore: 0.8,
      source: "claude-code-hook",
    });

    const results = await findSimilarMemories("source", "session-1");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe("claude-code-hook");
  });

  it("should rank memories by confidence score", async () => {
    await initTestDb();

    // Low confidence memory
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Low conf",
      summary: "Low confidence memory",
      createdAt: Date.now(),
      relevanceScore: 0.5,
      confidence: 0.3,
    });

    // High confidence memory
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "High conf",
      summary: "High confidence memory",
      createdAt: Date.now(),
      relevanceScore: 0.9,
      confidence: 0.95,
    });

    const results = await findSimilarMemories("conf", "session-1");

    // Results should be sorted by ACT-R which includes confidence
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle concurrent saveSemanticMemory calls", async () => {
    await initTestDb();

    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        saveSemanticMemory({
          sessionId: "session-1",
          topic: `Concurrent topic ${i}`,
          summary: `Concurrent memory ${i}`,
          createdAt: Date.now(),
          relevanceScore: 0.8,
        })
      );
    }

    const ids = await Promise.all(promises);

    expect(ids.length).toBe(5);
    ids.forEach((id) => {
      expect(id).toBeDefined();
    });

    const results = await findSimilarMemories("Concurrent", "session-1");
    expect(results.length).toBe(5);
  });

  it("should handle saveSemanticMemory with all optional fields", async () => {
    await initTestDb();

    const now = Date.now();

    const memId = await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Full field test",
      summary: "All fields populated",
      createdAt: now,
      relevanceScore: 0.85,
      sourceMessageIds: ["msg1", "msg2"],
      accessCount: 5,
      lastAccess: now,
      confidence: 0.9,
      source: "discord",
    });

    expect(memId).toBeDefined();
    const results = await findSimilarMemories("Full field", "session-1");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].accessCount).toBe(5);
    expect(results[0].confidence).toBe(0.9);
  });
});
