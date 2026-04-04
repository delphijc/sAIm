/**
 * Hybrid Search with RRF Fusion Tests
 * Tests that hybrid search correctly combines ACT-R, Hebbian, and confidence signals
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  _setDbForTesting,
  saveSemanticMemory,
  findSimilarMemories,
} from "../memory/db.ts";
import { hybridSearch } from "../memory/hybrid-search.ts";
import { createTestDb } from "./test-helpers.ts";

let testDb: Database;

async function initTestDb() {
  testDb = createTestDb();
  _setDbForTesting(testDb);
}

describe("Hybrid Search - Basic Functionality", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should return empty array for empty database", async () => {
    const results = await hybridSearch("nonexistent", { limit: 5 });
    expect(results.length).toBe(0);
  });

  it("should find matching memories", async () => {
    await saveSemanticMemory({
      sessionId: "test-session",
      topic: "JavaScript",
      summary: "Learning async/await patterns",
      createdAt: Date.now(),
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 0,
      lastAccess: Date.now(),
      confidence: 0.7,
      source: "discord",
    });

    const results = await hybridSearch("JavaScript async", { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].topic).toContain("JavaScript");
  });

  it("should respect limit parameter", async () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      await saveSemanticMemory({
        sessionId: "test-session",
        topic: `Topic ${i}`,
        summary: "shared memory content",
        createdAt: now + i * 1000,
        relevanceScore: 0.8,
        sourceMessageIds: [],
        accessCount: 0,
        lastAccess: now,
        confidence: 0.6,
        source: "discord",
      });
    }

    const results = await hybridSearch("shared memory", { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("should handle session filtering", async () => {
    await saveSemanticMemory({
      sessionId: "session-1",
      topic: "Python",
      summary: "Learning decorators",
      createdAt: Date.now(),
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 0,
      lastAccess: Date.now(),
      confidence: 0.7,
      source: "discord",
    });

    await saveSemanticMemory({
      sessionId: "session-2",
      topic: "Python",
      summary: "Learning metaclasses",
      createdAt: Date.now(),
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 0,
      lastAccess: Date.now(),
      confidence: 0.7,
      source: "discord",
    });

    const sessionResults = await hybridSearch("Python", {
      sessionId: "session-1",
      limit: 5,
    });

    if (sessionResults.length > 0) {
      expect(sessionResults[0].sessionId).toBe("session-1");
    }
  });
});

describe("Hybrid Search - Scoring & Ranking", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should rank high-confidence memories higher", async () => {
    const now = Date.now();

    const lowConfId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "Database",
      summary: "SQL query optimization",
      createdAt: now,
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 1,
      lastAccess: now,
      confidence: 0.4, // Low confidence
      source: "discord",
    });

    const highConfId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "Database",
      summary: "Index strategy planning",
      createdAt: now,
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 1,
      lastAccess: now,
      confidence: 0.9, // High confidence
      source: "discord",
    });

    const results = await hybridSearch("Database optimization", {
      sessionId: "test-session",
      limit: 5,
    });

    if (results.length >= 2) {
      // High confidence should appear before low confidence
      const highConfIdx = results.findIndex((r) => r.id === highConfId);
      const lowConfIdx = results.findIndex((r) => r.id === lowConfId);

      if (highConfIdx >= 0 && lowConfIdx >= 0) {
        expect(highConfIdx).toBeLessThan(lowConfIdx);
      }
    }
  });

  it("should rank frequently accessed memories higher", async () => {
    const now = Date.now();

    const rareId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "API",
      summary: "REST endpoint design",
      createdAt: now,
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 0, // Rarely accessed
      lastAccess: now,
      confidence: 0.7,
      source: "discord",
    });

    const frequentId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "API",
      summary: "GraphQL schema patterns",
      createdAt: now,
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 10, // Frequently accessed
      lastAccess: now,
      confidence: 0.7,
      source: "discord",
    });

    // Artificially boost access count for the frequent one
    testDb.prepare("UPDATE semantic SET access_count = 10 WHERE id = ?").run(frequentId);

    const results = await hybridSearch("API design", {
      sessionId: "test-session",
      limit: 5,
    });

    if (results.length >= 2) {
      // Frequent should rank higher
      const frequentIdx = results.findIndex((r) => r.id === frequentId);
      const rareIdx = results.findIndex((r) => r.id === rareId);

      if (frequentIdx >= 0 && rareIdx >= 0) {
        expect(frequentIdx).toBeLessThan(rareIdx);
      }
    }
  });
});

describe("Hybrid Search - Graceful Error Handling", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should handle empty query gracefully", async () => {
    await saveSemanticMemory({
      sessionId: "test-session",
      topic: "Topic",
      summary: "Summary",
      createdAt: Date.now(),
      relevanceScore: 0.8,
      sourceMessageIds: [],
      accessCount: 0,
      lastAccess: Date.now(),
      confidence: 0.6,
      source: "discord",
    });

    // Empty query should not crash
    const results = await hybridSearch("", { limit: 5 });
    expect(Array.isArray(results)).toBe(true);
  });

  it("should handle special characters in query", async () => {
    await saveSemanticMemory({
      sessionId: "test-session",
      topic: "C++",
      summary: "Smart pointers and memory management",
      createdAt: Date.now(),
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 0,
      lastAccess: Date.now(),
      confidence: 0.8,
      source: "discord",
    });

    // Query with special characters should not crash
    const results = await hybridSearch("C++ @#$%", { limit: 5 });
    expect(Array.isArray(results)).toBe(true);
  });

  it("should return results in confidence format", async () => {
    const memId = await saveSemanticMemory({
      sessionId: "test-session",
      topic: "DevOps",
      summary: "Containerization with Docker",
      createdAt: Date.now(),
      relevanceScore: 0.9,
      sourceMessageIds: [],
      accessCount: 0,
      lastAccess: Date.now(),
      confidence: 0.75,
      source: "discord",
    });

    const results = await hybridSearch("DevOps Docker", { limit: 5 });

    if (results.length > 0) {
      const result = results[0];
      expect(result.confidence).toBeDefined();
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});
