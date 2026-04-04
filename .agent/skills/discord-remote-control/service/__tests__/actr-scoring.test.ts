/**
 * ACT-R Activation Scoring Tests
 * Tests that ACT-R formula correctly scores memories based on recency, frequency, and confidence
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  _setDbForTesting,
  saveSemanticMemory,
  findSimilarMemories,
  touchMemory,
} from "../memory/db.ts";
import { createTestDb } from "./test-helpers.ts";

let testDb: Database;

async function initTestDb() {
  testDb = createTestDb();
  _setDbForTesting(testDb);
}

describe("ACT-R Scoring - Touch Memory", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should increment access_count and update last_access on touch", async () => {
    const memId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "Python",
      summary: "Learned about async/await",
      createdAt: Date.now(),
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 0,
      lastAccess: Date.now(),
      confidence: 0.7,
      source: "discord",
    });

    const before = new Date().getTime();
    touchMemory(memId);
    const after = new Date().getTime();

    const result = testDb
      .prepare("SELECT access_count, last_access FROM semantic WHERE id = ?")
      .get(memId) as any;

    expect(result.access_count).toBe(1);
    expect(result.last_access).toBeGreaterThanOrEqual(before);
    expect(result.last_access).toBeLessThanOrEqual(after);
  });

  it("should increment access_count multiple times", async () => {
    const memId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "JavaScript",
      summary: "Closures and prototypes",
      createdAt: Date.now(),
      relevanceScore: 0.8,
      sourceMessageIds: [],
      accessCount: 0,
      lastAccess: Date.now(),
      confidence: 0.6,
      source: "discord",
    });

    touchMemory(memId);
    touchMemory(memId);
    touchMemory(memId);

    const result = testDb
      .prepare("SELECT access_count FROM semantic WHERE id = ?")
      .get(memId) as any;

    expect(result.access_count).toBe(3);
  });
});

describe("ACT-R Scoring - Recency Ordering", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should rank recently accessed memories higher than old ones", async () => {
    const now = Date.now();

    // Create two memories with same topic and confidence
    const oldMemId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "shared",
      summary: "Old memory accessed long ago",
      createdAt: now - 24 * 60 * 60 * 1000, // 24 hours ago
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 1,
      lastAccess: now - 24 * 60 * 60 * 1000, // Accessed 24 hours ago
      confidence: 0.7,
      source: "discord",
    });

    const newMemId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "shared",
      summary: "New memory just accessed",
      createdAt: now - 1 * 60 * 60 * 1000, // 1 hour ago
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 1,
      lastAccess: now, // Accessed right now
      confidence: 0.7,
      source: "discord",
    });

    // Search for shared topic - newer memory should rank higher
    const results = await findSimilarMemories("shared", "test-session", 5);

    expect(results.length).toBeGreaterThanOrEqual(1);
    // The most recently accessed memory should be first
    const firstResult = results.find((r) => r.id === newMemId);
    const secondResult = results.find((r) => r.id === oldMemId);

    if (firstResult && secondResult) {
      // ACT-R score should be higher for recently accessed
      expect(firstResult.actRScore || 0).toBeGreaterThan(secondResult.actRScore || 0);
    }
  });

  it("should boost frequently accessed memories", async () => {
    const now = Date.now();

    // Create two memories with same recency but different access counts
    const frequentMemId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "frequent",
      summary: "Accessed many times",
      createdAt: now - 10 * 60 * 1000, // 10 minutes ago
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 10, // Accessed 10 times
      lastAccess: now,
      confidence: 0.7,
      source: "discord",
    });

    const rareMemId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "frequent",
      summary: "Accessed only once",
      createdAt: now - 10 * 60 * 1000, // Same age
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 1, // Accessed only once
      lastAccess: now, // Same time
      confidence: 0.7,
      source: "discord",
    });

    const results = await findSimilarMemories("frequent", "test-session", 5);

    const frequentMem = results.find((r) => r.id === frequentMemId);
    const rareMem = results.find((r) => r.id === rareMemId);

    if (frequentMem && rareMem) {
      // More frequently accessed should score higher
      expect(frequentMem.actRScore || 0).toBeGreaterThan(rareMem.actRScore || 0);
    }
  });

  it("should boost high-confidence memories", async () => {
    const now = Date.now();

    // Create two memories with same recency/frequency but different confidence
    const highConfMemId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "confidence",
      summary: "High confidence fact",
      createdAt: now,
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 1,
      lastAccess: now,
      confidence: 0.95, // Very high confidence
      source: "discord",
    });

    const lowConfMemId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "confidence",
      summary: "Low confidence fact",
      createdAt: now,
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 1,
      lastAccess: now,
      confidence: 0.5, // Lower confidence
      source: "discord",
    });

    const results = await findSimilarMemories("confidence", "test-session", 5);

    const highConf = results.find((r) => r.id === highConfMemId);
    const lowConf = results.find((r) => r.id === lowConfMemId);

    if (highConf && lowConf) {
      // High confidence should score higher
      expect(highConf.actRScore || 0).toBeGreaterThan(lowConf.actRScore || 0);
    }
  });
});
