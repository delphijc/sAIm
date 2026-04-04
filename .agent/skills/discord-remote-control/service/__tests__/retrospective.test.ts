import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { _setDbForTesting } from "../memory/db.ts";
import {
  clusterByTopic,
  detectPainPoints,
  detectPreferenceDrift,
  runRetrospective,
  formatForDiscord,
  recordSkillInvocation,
  getSkillUsageAnalytics,
} from "../memory/retrospective.ts";
import { readFileSync, existsSync } from "fs";
import { createTestDb } from "./test-helpers.ts";

let testDb: Database;

function initTestDb(): Database {
  return createTestDb();
}

function seedMemory(
  db: Database,
  topic: string,
  summary: string,
  tags: string[] = [],
  confidence = 0.7,
  createdAt?: number
) {
  const id = crypto.randomUUID();
  const now = createdAt || Date.now();
  db.prepare(`
    INSERT INTO semantic (id, session_id, topic, summary, relevance_score, created_at, source_message_ids, access_count, last_access, confidence, source, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, "test-session", topic, summary, 1.0, now, "[]", 0, now, confidence, "test", JSON.stringify(tags));
  return id;
}

beforeEach(() => {
  testDb = initTestDb();
  _setDbForTesting(testDb);
});

afterEach(() => {
  _setDbForTesting(null);
  testDb.close();
  mock.restore();
});

describe("clusterByTopic", () => {
  test("groups memories by topic and counts occurrences", () => {
    const memories = [
      { topic: "Debugging", summary: "SQLite lock issue", tags: '["pain-point"]', confidence: 0.7, created_at: 1000 },
      { topic: "Debugging", summary: "SQLite timeout fix", tags: '["pain-point"]', confidence: 0.8, created_at: 2000 },
      { topic: "Architecture", summary: "Added caching layer", tags: '["architectural-decision"]', confidence: 0.7, created_at: 3000 },
    ];

    const clusters = clusterByTopic(memories);

    expect(clusters.length).toBe(2);
    expect(clusters[0].topic).toBe("Debugging");
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].tags).toContain("pain-point");
    expect(clusters[1].topic).toBe("Architecture");
    expect(clusters[1].count).toBe(1);
  });

  test("marks topics with 3+ entries as recurring", () => {
    const memories = [
      { topic: "Security", summary: "XSS fix 1", tags: '["security"]', confidence: 0.7, created_at: 1000 },
      { topic: "Security", summary: "XSS fix 2", tags: '["security"]', confidence: 0.7, created_at: 2000 },
      { topic: "Security", summary: "XSS fix 3", tags: '["security"]', confidence: 0.7, created_at: 3000 },
    ];

    const clusters = clusterByTopic(memories);

    expect(clusters[0].isRecurring).toBe(true);
    expect(clusters[0].count).toBe(3);
  });

  test("returns empty array for empty input", () => {
    expect(clusterByTopic([])).toEqual([]);
  });
});

describe("detectPainPoints", () => {
  test("detects pain points from tagged debugging memories", () => {
    const memories = [
      { topic: "Debugging", summary: "SQLite locking issue in concurrent access", tags: '["pain-point"]', confidence: 0.7, created_at: Date.now() - 1000 },
      { topic: "Debugging", summary: "SQLite locking issue when writing", tags: '["pain-point"]', confidence: 0.7, created_at: Date.now() },
    ];

    const painPoints = detectPainPoints(memories);

    expect(painPoints.length).toBeGreaterThanOrEqual(1);
    expect(painPoints[0].occurrences).toBeGreaterThanOrEqual(2);
  });

  test("detects pain points from summary content even without tags", () => {
    const memories = [
      { topic: "Completed", summary: "Fixed the broken test runner again", tags: "[]", confidence: 0.7, created_at: Date.now() - 1000 },
      { topic: "Completed", summary: "Fixed the broken test runner crash", tags: "[]", confidence: 0.7, created_at: Date.now() },
    ];

    const painPoints = detectPainPoints(memories);

    expect(painPoints.length).toBeGreaterThanOrEqual(1);
  });

  test("assigns high severity to frequent recent issues", () => {
    const now = Date.now();
    const memories = [
      { topic: "Debugging", summary: "Memory leak in service handler code", tags: '["pain-point"]', confidence: 0.7, created_at: now - 86400000 },
      { topic: "Debugging", summary: "Memory leak in service handler again", tags: '["pain-point"]', confidence: 0.7, created_at: now - 43200000 },
      { topic: "Debugging", summary: "Memory leak in service handler third", tags: '["pain-point"]', confidence: 0.7, created_at: now - 3600000 },
      { topic: "Debugging", summary: "Memory leak in service handler fourth", tags: '["pain-point"]', confidence: 0.7, created_at: now },
    ];

    const painPoints = detectPainPoints(memories);

    expect(painPoints.length).toBeGreaterThanOrEqual(1);
    expect(painPoints[0].severity).toBe("high");
  });

  test("returns empty for single-occurrence issues", () => {
    const memories = [
      { topic: "Debugging", summary: "One-off error in parsing", tags: '["pain-point"]', confidence: 0.7, created_at: Date.now() },
    ];

    expect(detectPainPoints(memories)).toEqual([]);
  });
});

describe("detectPreferenceDrift", () => {
  test("detects contradicting decisions", () => {
    const memories = [
      { topic: "Decision", summary: "Going with SQLite for storage backend persistence", tags: '["architectural-decision"]', confidence: 0.7, created_at: 1000 },
      { topic: "Decision", summary: "Switched to PostgreSQL instead of SQLite for storage backend", tags: '["architectural-decision"]', confidence: 0.7, created_at: 2000 },
    ];

    const drifts = detectPreferenceDrift(memories);

    expect(drifts.length).toBe(1);
    expect(drifts[0].conflictScore).toBeGreaterThan(0);
    expect(drifts[0].earlier.timestamp).toBeLessThan(drifts[0].later.timestamp);
  });

  test("ignores unrelated decisions", () => {
    const memories = [
      { topic: "Decision", summary: "Using React for frontend components", tags: '["architectural-decision"]', confidence: 0.7, created_at: 1000 },
      { topic: "Decision", summary: "Chose PostgreSQL for database backend", tags: '["architectural-decision"]', confidence: 0.7, created_at: 2000 },
    ];

    const drifts = detectPreferenceDrift(memories);

    expect(drifts.length).toBe(0);
  });

  test("returns empty for non-decision memories", () => {
    const memories = [
      { topic: "Fact", summary: "The sky is blue today", tags: '["fact"]', confidence: 0.7, created_at: 1000 },
    ];

    expect(detectPreferenceDrift(memories)).toEqual([]);
  });
});

describe("runRetrospective (integration)", () => {
  test("daily mode runs on recent memories", () => {
    // Seed some recent memories
    seedMemory(testDb, "Completed", "Fixed the login bug in auth module", ["completion"]);
    seedMemory(testDb, "Debugging", "Root cause was null pointer in session handler", ["pain-point"]);
    seedMemory(testDb, "Architecture", "Added retry logic to API calls", ["architectural-decision"]);

    const report = runRetrospective("daily");

    expect(report.mode).toBe("daily");
    expect(report.memoryCount).toBe(3);
    expect(report.clusters.length).toBe(3);
    expect(report.timestamp).toBeGreaterThan(0);
    expect(report.summary).toContain("3 memories");
  });

  test("full mode includes all-time memories", () => {
    // Seed memories at different times
    const oldTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
    seedMemory(testDb, "Completed", "Deployed v1.0 to production successfully", ["completion"], 0.9, oldTime);
    seedMemory(testDb, "Debugging", "Fixed crash in startup sequence twice", ["pain-point"]);

    const report = runRetrospective("full");

    expect(report.mode).toBe("full");
    expect(report.memoryCount).toBe(2);
  });

  test("weekly mode analyzes preference drift", () => {
    seedMemory(testDb, "Decision", "Going with REST API for the service layer", ["architectural-decision"], 0.7, Date.now() - 86400000);
    seedMemory(testDb, "Decision", "Switched to GraphQL instead of REST API for service", ["architectural-decision"]);

    const report = runRetrospective("weekly");

    expect(report.mode).toBe("weekly");
    // Weekly mode includes drift analysis
    expect(report.preferenceDrifts).toBeDefined();
  });

  test("generates recommendations for recurring pain points", () => {
    const now = Date.now();
    seedMemory(testDb, "Debugging", "SQLite locking issue fixed again first time", ["pain-point"], 0.7, now - 3000);
    seedMemory(testDb, "Debugging", "SQLite locking issue fixed again second time", ["pain-point"], 0.7, now - 2000);
    seedMemory(testDb, "Debugging", "SQLite locking issue fixed again third time", ["pain-point"], 0.7, now - 1000);
    seedMemory(testDb, "Debugging", "SQLite locking issue fixed again fourth time", ["pain-point"], 0.7, now);

    const report = runRetrospective("daily");

    expect(report.painPoints.length).toBeGreaterThanOrEqual(1);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  test("handles empty database gracefully", () => {
    const report = runRetrospective("daily");

    expect(report.memoryCount).toBe(0);
    expect(report.clusters).toEqual([]);
    expect(report.painPoints).toEqual([]);
    expect(report.recommendations).toEqual([]);
    expect(report.summary).toContain("0 memories");
  });
});

describe("formatForDiscord", () => {
  test("produces concise Discord-friendly output", () => {
    seedMemory(testDb, "Debugging", "Fixed memory leak in handler process", ["pain-point"]);
    seedMemory(testDb, "Debugging", "Fixed memory leak in handler system", ["pain-point"]);
    seedMemory(testDb, "Completed", "Deployed new feature to staging environment", ["completion"]);

    const report = runRetrospective("daily");
    const output = formatForDiscord(report);

    expect(output).toContain("Retrospective Report");
    expect(output).toContain(report.mode);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  test("includes recommendations when present", () => {
    const now = Date.now();
    // Create enough pain points to trigger recommendations
    for (let i = 0; i < 4; i++) {
      seedMemory(testDb, "Debugging", `Error in parsing module iteration ${i}`, ["pain-point"], 0.7, now - i * 1000);
    }

    const report = runRetrospective("daily");
    const output = formatForDiscord(report);

    if (report.recommendations.length > 0) {
      expect(output).toContain("Recommendations");
    }
  });
});

describe("skill invocation tracking", () => {
  test("records and retrieves skill invocations", () => {
    recordSkillInvocation("test-skill", true, 150, "daily", false, "test run");
    recordSkillInvocation("test-skill", false, 500, "weekly", true, "failed");
    recordSkillInvocation("other-skill", true, 100);

    const usage = getSkillUsageAnalytics();

    expect(usage.length).toBe(2);
    const testSkill = usage.find((s) => s.skillName === "test-skill");
    expect(testSkill).toBeDefined();
    expect(testSkill!.invocations).toBe(2);
    expect(testSkill!.successRate).toBe(0.5);
    expect(testSkill!.manualOverrides).toBe(1);
  });

  test("handles empty invocations table", () => {
    const usage = getSkillUsageAnalytics();
    expect(usage).toEqual([]);
  });
});
