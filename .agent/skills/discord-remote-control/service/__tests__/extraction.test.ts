/**
 * Semantic Memory Extraction Tests
 * Tests automatic fact extraction from conversation turns
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import {
  extractSemanticFacts,
  extractAndSaveMemories,
  detectProject,
  detectAndRecordSkills,
  detectAndRecordAgents,
  _resetDetectionCaches,
} from "../memory/extraction.ts";
import {
  _setDbForTesting,
  getMemoryInstance,
  findSimilarMemories,
} from "../memory/db.ts";
import { createTestDb } from "./test-helpers.ts";

let testDb: Database;

async function initTestDb() {
  testDb = createTestDb();
  _setDbForTesting(testDb);
}

afterEach(() => {
  mock.restore();
});

describe("Semantic Extraction - extractSemanticFacts", () => {
  it("should extract facts from completion markers", () => {
    const userMsg = "Fix the security validator timeout";
    const response = "Fixed the security validator to fail closed with a 500ms timeout. ✅";

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    expect(facts.length).toBeGreaterThan(0);
    expect(facts.some((f) => f.topic.startsWith("Completed:"))).toBe(true);
  });

  it("should extract facts from table-formatted status updates", () => {
    const userMsg = "What's the status?";
    const response = `| **CSO-005** | Remediated | Added fail-closed design with timeout |
| **STA-015** | Fixed | Added 20 new patterns to validator |`;

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    expect(facts.some((f) => f.topic.includes("Remediated"))).toBe(true);
  });

  it("should skip casual conversation without completion or substantive markers", () => {
    const userMsg = "How are you doing?";
    const response = "I'm doing well! How can I help you today?";

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    expect(facts.length).toBe(0);
  });

  it("should extract security-related facts", () => {
    const userMsg = "Add input validation";
    const response = "Done. Added security validation with prompt injection detection patterns and sanitization for all user input. ✅";

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    expect(facts.length).toBeGreaterThan(0);
  });

  it("should extract decision facts", () => {
    const userMsg = "Which approach should we use?";
    const response = "Decided to use FTS5 for semantic search instead of vector embeddings. It's simpler and works well for our use case. ✅";

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    expect(facts.some((f) => f.topic.startsWith("Decision:"))).toBe(true);
  });

  it("should deduplicate similar facts", () => {
    const userMsg = "Fix bugs";
    const response = "Fixed the timeout issue. Also fixed the timeout problem in the validator. ✅";

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    // Should deduplicate near-identical summaries
    const timeoutFacts = facts.filter((f) =>
      f.summary.toLowerCase().includes("timeout")
    );
    expect(timeoutFacts.length).toBeLessThanOrEqual(2);
  });

  it("should cap summary length at 400 characters", () => {
    const longDetail = "a".repeat(500);
    const userMsg = "Do the thing";
    const response = `Fixed ${longDetail} and it's all done now. ✅`;

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    for (const fact of facts) {
      expect(fact.summary.length).toBeLessThanOrEqual(400);
    }
  });

  it("should extract from substantive responses with markdown headers", () => {
    const userMsg = "Review the memory system";
    const response = `## Gap Analysis: SQLite DB vs Memory Files

### Current State

| System | Contents | Status |
|--------|----------|--------|
| **SQLite conversations** | 94 turns | Working |

Found 5 issues that need to be addressed. The root cause was a missing bridge between persistent files and SQLite.`;

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    expect(facts.length).toBeGreaterThan(0);
  });

  it("should extract from quantified findings", () => {
    const userMsg = "Check the status";
    const response = "Found 18 hook event types — we're only using 8. Here's what the analysis revealed about the configuration gaps.";

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    expect(facts.length).toBeGreaterThan(0);
  });

  it("should skip short trivial responses even with markers", () => {
    const userMsg = "Clear it";
    const response = "Done.";

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    expect(facts.length).toBe(0);
  });

  it("should extract recommendation patterns", () => {
    const userMsg = "What should we do next?";
    const response = "## Recommendations\n\nI recommend implementing a bidirectional sync between memory files and the SQLite database for better data fidelity. ✅";

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    expect(facts.some((f) => f.topic.startsWith("Recommendation:"))).toBe(true);
  });

  it("should extract from table rows with Remediated/Working/Stale status", () => {
    const userMsg = "Status check";
    const response = `| **SA-010** | Remediated | Session cleanup timer now called from index.ts |
| **STA-013** | Working | Audio path validation against TEMP_DIR |`;

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    expect(facts.some((f) => f.topic.includes("Remediated"))).toBe(true);
  });
});

describe("Project Detection", () => {
  it("should detect sam project from memory system keywords", () => {
    const project = detectProject("How is the memory server?", "The semantic memory system is working.");
    expect(project).toBe("sam");
  });

  it("should detect cyber-alert-mgr project", () => {
    const project = detectProject("Check the cyber alert dashboard", "The cyber alert manager is up.");
    expect(project).toBe("cyber-alert-mgr");
  });

  it("should default to sam for unrecognized content", () => {
    const project = detectProject("Hello", "Hi there!");
    expect(project).toBe("sam");
  });
});

describe("Quality Gate", () => {
  it("should reject incoherent fragments in extraction", () => {
    const userMsg = "Check things";
    // This response contains a pattern match that produces a fragment
    const response = "The status update: ab cd. ✅";

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    // Any extracted facts should be coherent (have 3+ meaningful words)
    for (const fact of facts) {
      const words = fact.summary.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(w => w.length > 2);
      expect(words.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("should include project field on all extracted facts", () => {
    const userMsg = "Fix the memory server";
    const response = "Fixed the memory server connection pooling issue with proper cleanup. ✅";

    const facts = extractSemanticFacts(userMsg, response, "session-1");

    for (const fact of facts) {
      expect(fact.project).toBeDefined();
      expect(typeof fact.project).toBe("string");
    }
  });
});

describe("Semantic Extraction - extractAndSaveMemories", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should save extracted facts to semantic memory", async () => {
    const count = await extractAndSaveMemories(
      "Fix the rate limiter",
      "Fixed the rate limiter to use a sliding window with 5 requests per 60 seconds. ✅",
      "session-1"
    );

    expect(count).toBeGreaterThan(0);

    const memory = getMemoryInstance();
    const results = memory.query("semantic", { sessionId: "session-1" });
    expect(results.length).toBeGreaterThan(0);
  });

  it("should not save duplicates on repeated calls", async () => {
    const msg = "Fix the validator";
    const resp = "Fixed the security validator timeout to 500ms. ✅";

    await extractAndSaveMemories(msg, resp, "session-1");
    const firstCount = getMemoryInstance().query("semantic", { sessionId: "session-1" }).length;

    await extractAndSaveMemories(msg, resp, "session-1");
    const secondCount = getMemoryInstance().query("semantic", { sessionId: "session-1" }).length;

    expect(secondCount).toBe(firstCount);
  });

  it("should return 0 for casual conversation", async () => {
    const count = await extractAndSaveMemories(
      "Hello",
      "Hi there! How can I help?",
      "session-1"
    );

    expect(count).toBe(0);
  });

  it("should save tags to the database", async () => {
    await extractAndSaveMemories(
      "Fix the rate limiter",
      "Fixed the rate limiter to use a sliding window with 5 requests per 60 seconds. ✅",
      "session-1"
    );

    const memory = getMemoryInstance();
    const results = memory.query("semantic", { sessionId: "session-1" });

    expect(results.length).toBeGreaterThan(0);
    // Tags should be populated, not empty
    const withTags = results.filter((r: any) => r.tags && r.tags.length > 0);
    expect(withTags.length).toBeGreaterThan(0);
  });

  it("should save project field to the database", async () => {
    await extractAndSaveMemories(
      "Fix the cyber alert manager",
      "Fixed the cyber alert manager's notification system with proper error handling. ✅",
      "session-1"
    );

    const memory = getMemoryInstance();
    const results = memory.query("semantic", { sessionId: "session-1" });

    const cyberResults = results.filter((r: any) => r.project === "cyber-alert-mgr");
    expect(cyberResults.length).toBeGreaterThan(0);
  });

  it("should handle errors gracefully", async () => {
    _setDbForTesting(null);

    const count = await extractAndSaveMemories(
      "test",
      "Fixed something important in the system ✅",
      "session-1"
    );

    expect(count).toBe(0);
  });

  it("should detect duplicates GLOBALLY across sessions", async () => {
    // Save a fact in session-1
    await extractAndSaveMemories(
      "Fix the validator",
      "Fixed the security validator timeout to 500ms. ✅",
      "session-1"
    );

    // Try to save the same fact in session-2 — should be detected as duplicate
    const count = await extractAndSaveMemories(
      "Fix the validator",
      "Fixed the security validator timeout to 500ms. ✅",
      "session-2"
    );

    expect(count).toBe(0);
  });
});

describe("Cross-Session Semantic Search", () => {
  beforeEach(async () => {
    await initTestDb();
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should find memories across all sessions when no sessionId provided", async () => {
    await extractAndSaveMemories(
      "Fix CSO-005",
      "Fixed CSO-005 by implementing fail-closed security validator with 500ms timeout. ✅",
      "session-1"
    );

    await extractAndSaveMemories(
      "Add rate limiting",
      "Implemented per-user rate limiting with sliding window algorithm. ✅",
      "session-2"
    );

    // Search without sessionId - should find across all sessions
    const results = await findSimilarMemories("security", undefined, 10);

    expect(results.length).toBeGreaterThan(0);
  });

  it("should filter by project when provided", async () => {
    await extractAndSaveMemories(
      "Fix the cyber alert dashboard",
      "Fixed the cyber alert manager's dashboard rendering issue with proper state management. ✅",
      "session-1"
    );

    await extractAndSaveMemories(
      "Fix memory server",
      "Fixed the memory server connection pooling and cleanup timer. ✅",
      "session-1"
    );

    // Search for project-specific memories
    const cyberResults = await findSimilarMemories("fixed", undefined, 10, "cyber-alert-mgr");
    const samResults = await findSimilarMemories("fixed", undefined, 10, "sam");

    // cyber-alert-mgr results should only contain cyber alert memories
    for (const r of cyberResults) {
      expect(r.project).toBe("cyber-alert-mgr");
    }

    // sam results should only contain sam memories
    for (const r of samResults) {
      expect(r.project).toBe("sam");
    }
  });

  it("should still filter by sessionId when provided", async () => {
    await extractAndSaveMemories(
      "Fix validator",
      "Fixed the security validator to handle edge cases properly. ✅",
      "session-1"
    );

    await extractAndSaveMemories(
      "Fix validator",
      "Fixed the security input sanitizer for Discord messages. ✅",
      "session-2"
    );

    const results = await findSimilarMemories("security", "session-1", 10);

    for (const r of results) {
      expect(r.sessionId).toBe("session-1");
    }
  });
});

describe("Skill Detection", () => {
  beforeEach(async () => {
    await initTestDb();
    _resetDetectionCaches();
    // Create skill_invocations table for test DB
    testDb.run(`
      CREATE TABLE IF NOT EXISTS skill_invocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_name TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        success INTEGER NOT NULL DEFAULT 1,
        duration_ms INTEGER,
        mode TEXT,
        manual_override INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        trigger_context TEXT
      )
    `);
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should detect slash commands at start of message", () => {
    detectAndRecordSkills("/retrospective", "Running the retrospective analysis...");
    const rows = testDb.query("SELECT * FROM skill_invocations").all() as any[];
    expect(rows.some((r: any) => r.skill_name === "retrospective")).toBe(true);
  });

  it("should detect slash commands mid-sentence", () => {
    detectAndRecordSkills("leverage /party-mode and /researcher skills", "Got it, using party mode...");
    const rows = testDb.query("SELECT * FROM skill_invocations").all() as any[];
    const names = rows.map((r: any) => r.skill_name);
    expect(names).toContain("party-mode");
  });

  it("should detect workflow announcement pattern", () => {
    detectAndRecordSkills("do something", "Running the **SecurityAudit** workflow from the **security-grc** skill...");
    const rows = testDb.query("SELECT * FROM skill_invocations").all() as any[];
    expect(rows.some((r: any) => r.skill_name === "security-grc")).toBe(true);
  });

  it("should detect Skill tool invocation pattern", () => {
    detectAndRecordSkills("check things", 'I\'ll use Skill("fabric") to process this.');
    const rows = testDb.query("SELECT * FROM skill_invocations").all() as any[];
    expect(rows.some((r: any) => r.skill_name === "fabric")).toBe(true);
  });

  it("should reject short names like 'x' or 'a'", () => {
    detectAndRecordSkills("/x run this", "Done.");
    const rows = testDb.query("SELECT * FROM skill_invocations").all() as any[];
    expect(rows.length).toBe(0);
  });

  it("should reject deny-listed words like 'users' and 'skill'", () => {
    detectAndRecordSkills("check the users skill status", "Using the users skill to check.");
    const rows = testDb.query("SELECT * FROM skill_invocations").all() as any[];
    expect(rows.length).toBe(0);
  });

  it("should record trigger_context for each detection", () => {
    detectAndRecordSkills("/retrospective", "Running retrospective...");
    const rows = testDb.query("SELECT * FROM skill_invocations").all() as any[];
    const retro = rows.find((r: any) => r.skill_name === "retrospective");
    expect(retro?.trigger_context).toBe("slash-command");
  });

  it("should detect failure when error text follows skill name", () => {
    detectAndRecordSkills("/fabric", "The fabric skill failed with error: timeout.");
    const rows = testDb.query("SELECT * FROM skill_invocations").all() as any[];
    const fabric = rows.find((r: any) => r.skill_name === "fabric");
    expect(fabric?.success).toBe(0);
  });
});

describe("Agent Detection", () => {
  beforeEach(async () => {
    await initTestDb();
    _resetDetectionCaches();
    // Create agent_invocations table for test DB
    testDb.run(`
      CREATE TABLE IF NOT EXISTS agent_invocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        success INTEGER NOT NULL DEFAULT 1,
        duration_ms INTEGER,
        trigger_context TEXT,
        notes TEXT
      )
    `);
  });

  afterEach(() => {
    if (testDb) {
      _setDbForTesting(null);
      testDb.close();
    }
  });

  it("should detect subagent_type references", () => {
    detectAndRecordAgents("research this", 'Launching agent with subagent_type: "researcher"');
    const rows = testDb.query("SELECT * FROM agent_invocations").all() as any[];
    expect(rows.some((r: any) => r.agent_name === "researcher")).toBe(true);
  });

  it("should detect 'launching the X agent' pattern", () => {
    detectAndRecordAgents("help me", "Launching the engineer agent to implement this feature.");
    const rows = testDb.query("SELECT * FROM agent_invocations").all() as any[];
    expect(rows.some((r: any) => r.agent_name === "engineer")).toBe(true);
  });

  it("should detect bold agent references", () => {
    detectAndRecordAgents("check security", "I'll use the **pentester** agent for this assessment.");
    const rows = testDb.query("SELECT * FROM agent_invocations").all() as any[];
    expect(rows.some((r: any) => r.agent_name === "pentester")).toBe(true);
  });

  it("should reject short names and deny-listed words", () => {
    detectAndRecordAgents("use agent", "Using the new agent for this.");
    const rows = testDb.query("SELECT * FROM agent_invocations").all() as any[];
    expect(rows.length).toBe(0);
  });

  it("should record trigger_context", () => {
    detectAndRecordAgents("test", 'subagent_type="architect"');
    const rows = testDb.query("SELECT * FROM agent_invocations").all() as any[];
    const arch = rows.find((r: any) => r.agent_name === "architect");
    expect(arch?.trigger_context).toBe("subagent-type");
  });
});
