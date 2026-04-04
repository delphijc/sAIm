/**
 * Export Plugin & Engine Tests
 *
 * Tests for:
 * 1. Range parsing (parseRange)
 * 2. JSON export format
 * 3. Markdown export format
 * 4. HTML export format
 * 5. Command parsing (parseExportCommand)
 * 6. Plugin integration (canHandle / handle)
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { Database } from "bun:sqlite";
import { _setDbForTesting } from "../memory/db.ts";
import {
  parseRange,
  generateExport,
  generateSessionList,
  fetchConversations,
} from "../plugins/export/engine.ts";
import { parseExportCommand } from "../plugins/export/index.ts";
import exportPlugin from "../plugins/export/index.ts";
import { createTestDb } from "./test-helpers.ts";

// ============================================================================
// Test DB Setup
// ============================================================================

let testDb: Database;

function initTestDb() {
  testDb = createTestDb();
  _setDbForTesting(testDb);
}

function teardownTestDb() {
  _setDbForTesting(null);
}

// Helpers
function insertTurn(opts: {
  sessionId: string;
  userId?: string;
  channelId?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  tokens?: number;
  messageType?: string;
}) {
  const meta = JSON.stringify({
    tokens: opts.tokens ?? 50,
    messageType: opts.messageType ?? "text",
  });
  testDb.run(
    `INSERT INTO conversations (id, session_id, discord_user_id, discord_channel_id, role, content, timestamp, metadata, source)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, 'discord')`,
    [
      opts.sessionId,
      opts.userId ?? "user_001",
      opts.channelId ?? "channel_001",
      opts.role,
      opts.content,
      opts.timestamp,
      meta,
    ]
  );
}

// ============================================================================
// 1. Range Parsing
// ============================================================================

describe("parseRange", () => {
  test("last-7-days returns start 7 days ago", () => {
    const now = Date.now();
    const { start, end } = parseRange("last-7-days");
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(end).toBeGreaterThanOrEqual(now - 100);
    expect(end).toBeLessThanOrEqual(now + 100);
    // start should be approximately 7 days ago (within 1 second tolerance)
    expect(Math.abs(now - start - sevenDaysMs)).toBeLessThan(1000);
  });

  test("last-30-days returns start 30 days ago", () => {
    const now = Date.now();
    const { start } = parseRange("last-30-days");
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(now - start - thirtyDaysMs)).toBeLessThan(1000);
  });

  test("last-24-hours returns start 24 hours ago", () => {
    const now = Date.now();
    const { start } = parseRange("last-24-hours");
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    expect(Math.abs(now - start - twentyFourHoursMs)).toBeLessThan(1000);
  });

  test("last-1-hour returns start 1 hour ago", () => {
    const now = Date.now();
    const { start } = parseRange("last-1-hour");
    const oneHourMs = 60 * 60 * 1000;
    expect(Math.abs(now - start - oneHourMs)).toBeLessThan(1000);
  });

  test("all returns epoch 0 as start", () => {
    const { start } = parseRange("all");
    expect(start).toBe(0);
  });

  test("invalid range defaults to last-7-days", () => {
    const now = Date.now();
    const { start } = parseRange("last-banana");
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(now - start - sevenDaysMs)).toBeLessThan(1000);
  });

  test("empty string defaults to last-7-days", () => {
    const now = Date.now();
    const { start } = parseRange("");
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(now - start - sevenDaysMs)).toBeLessThan(1000);
  });

  test("last-2-hours parses generic numeric hours", () => {
    const now = Date.now();
    const { start } = parseRange("last-2-hours");
    const twoHoursMs = 2 * 60 * 60 * 1000;
    expect(Math.abs(now - start - twoHoursMs)).toBeLessThan(1000);
  });

  test("last-14-days parses generic numeric days", () => {
    const now = Date.now();
    const { start } = parseRange("last-14-days");
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    expect(Math.abs(now - start - fourteenDaysMs)).toBeLessThan(1000);
  });

  test("end is always current time", () => {
    const before = Date.now();
    const { end } = parseRange("last-7-days");
    const after = Date.now();
    expect(end).toBeGreaterThanOrEqual(before);
    expect(end).toBeLessThanOrEqual(after + 100);
  });
});

// ============================================================================
// 2. JSON Export
// ============================================================================

describe("JSON export", () => {
  beforeEach(() => {
    initTestDb();
  });

  afterEach(() => {
    teardownTestDb();
    mock.restore();
  });

  test("produces valid JSON output", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_json_01", role: "user", content: "Hello Sam", timestamp: now - 1000 });
    insertTurn({ sessionId: "sess_json_01", role: "assistant", content: "Hello!", timestamp: now });

    const result = generateExport(testDb, { format: "json", range: "all" });
    expect(() => JSON.parse(result.content)).not.toThrow();
  });

  test("JSON output has correct top-level structure", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_json_02", role: "user", content: "Test", timestamp: now });

    const result = generateExport(testDb, { format: "json", range: "all" });
    const parsed = JSON.parse(result.content);

    expect(parsed).toHaveProperty("exportedAt");
    expect(parsed).toHaveProperty("format", "json");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("sessions");
    expect(Array.isArray(parsed.sessions)).toBe(true);
  });

  test("JSON sessions contain turns with role and content", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_json_03", role: "user", content: "What time is it?", timestamp: now - 500 });
    insertTurn({ sessionId: "sess_json_03", role: "assistant", content: "It is now.", timestamp: now });

    const result = generateExport(testDb, { format: "json", range: "all" });
    const parsed = JSON.parse(result.content);
    const session = parsed.sessions.find((s: any) => s.sessionId === "sess_json_03");

    expect(session).toBeTruthy();
    expect(session.turns).toHaveLength(2);
    expect(session.turns[0].role).toBe("user");
    expect(session.turns[0].content).toBe("What time is it?");
    expect(session.turns[1].role).toBe("assistant");
  });

  test("JSON summary stats are accurate", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_json_04a", role: "user", content: "A", timestamp: now - 2000 });
    insertTurn({ sessionId: "sess_json_04a", role: "assistant", content: "B", timestamp: now - 1000 });
    insertTurn({ sessionId: "sess_json_04b", role: "user", content: "C", timestamp: now });

    const result = generateExport(testDb, { format: "json", range: "all" });
    const parsed = JSON.parse(result.content);

    expect(parsed.summary.sessionCount).toBe(2);
    expect(parsed.summary.turnCount).toBe(3);
  });

  test("JSON includes metadata when includeMetadata is true", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_json_05", role: "user", content: "With meta", timestamp: now, tokens: 42 });

    const result = generateExport(testDb, { format: "json", range: "all", includeMetadata: true });
    const parsed = JSON.parse(result.content);
    const turn = parsed.sessions[0].turns[0];

    expect(turn.metadata).toBeTruthy();
    expect(turn.metadata.tokens).toBe(42);
  });

  test("JSON on empty DB returns empty sessions array", () => {
    const result = generateExport(testDb, { format: "json", range: "all" });
    const parsed = JSON.parse(result.content);

    expect(parsed.sessions).toHaveLength(0);
    expect(parsed.summary.turnCount).toBe(0);
  });

  test("JSON turnCount in result matches actual turns", () => {
    const base = Date.now() - 10000;
    for (let i = 0; i < 5; i++) {
      insertTurn({ sessionId: "sess_json_07", role: i % 2 === 0 ? "user" : "assistant", content: `msg ${i}`, timestamp: base + i * 100 });
    }

    const result = generateExport(testDb, { format: "json", range: "all" });
    expect(result.turnCount).toBe(5);
  });
});

// ============================================================================
// 3. Markdown Export
// ============================================================================

describe("Markdown export", () => {
  beforeEach(() => {
    initTestDb();
  });

  afterEach(() => {
    teardownTestDb();
    mock.restore();
  });

  test("output contains session header with date", () => {
    const ts = new Date("2025-01-15T10:00:00Z").getTime();
    insertTurn({ sessionId: "sess_md_01", role: "user", content: "Hello", timestamp: ts });

    const result = generateExport(testDb, { format: "markdown", range: "all" });
    expect(result.content).toContain("## Session:");
  });

  test("output contains user turn with User label", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_md_02", role: "user", content: "My question here", timestamp: now });

    const result = generateExport(testDb, { format: "markdown", range: "all" });
    expect(result.content).toContain("**User**");
    expect(result.content).toContain("My question here");
  });

  test("output contains assistant turn with Sam label", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_md_03", role: "assistant", content: "My answer here", timestamp: now });

    const result = generateExport(testDb, { format: "markdown", range: "all" });
    expect(result.content).toContain("**Sam**");
    expect(result.content).toContain("My answer here");
  });

  test("horizontal rules appear between sessions", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_md_04a", role: "user", content: "Session A", timestamp: now - 10000 });
    insertTurn({ sessionId: "sess_md_04b", role: "user", content: "Session B", timestamp: now });

    const result = generateExport(testDb, { format: "markdown", range: "all" });
    // Should have at least one horizontal rule between sessions
    expect(result.content).toMatch(/---/);
  });

  test("timestamps appear in turn headers", () => {
    const ts = new Date("2025-06-01T14:30:00.000Z").getTime();
    insertTurn({ sessionId: "sess_md_05", role: "user", content: "Timestamped", timestamp: ts });

    const result = generateExport(testDb, { format: "markdown", range: "all" });
    // Should contain some time-formatted string (flexible format check)
    expect(result.content).toMatch(/\d{1,2}:\d{2}/);
  });

  test("empty database produces a no-conversations notice", () => {
    const result = generateExport(testDb, { format: "markdown", range: "all" });
    expect(result.content).toContain("No conversations");
  });

  test("filename has .md extension", () => {
    const result = generateExport(testDb, { format: "markdown", range: "all" });
    expect(result.filename).toMatch(/\.md$/);
  });

  test("mimeType is text/markdown", () => {
    const result = generateExport(testDb, { format: "markdown", range: "all" });
    expect(result.mimeType).toBe("text/markdown");
  });
});

// ============================================================================
// 4. HTML Export
// ============================================================================

describe("HTML export", () => {
  beforeEach(() => {
    initTestDb();
  });

  afterEach(() => {
    teardownTestDb();
    mock.restore();
  });

  test("output contains <style> tag with dark theme", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_html_01", role: "user", content: "Hello", timestamp: now });

    const result = generateExport(testDb, { format: "html", range: "all" });
    expect(result.content).toContain("<style>");
    // Dark background color
    expect(result.content).toMatch(/#0d1117|background.*#1/);
  });

  test("user message has class 'user'", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_html_02", role: "user", content: "User message", timestamp: now });

    const result = generateExport(testDb, { format: "html", range: "all" });
    expect(result.content).toContain('class="turn user"');
  });

  test("assistant message has class 'assistant'", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_html_03", role: "assistant", content: "Sam reply", timestamp: now });

    const result = generateExport(testDb, { format: "html", range: "all" });
    expect(result.content).toContain('class="turn assistant"');
  });

  test("session header is present", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_html_04", role: "user", content: "hi", timestamp: now });

    const result = generateExport(testDb, { format: "html", range: "all" });
    expect(result.content).toContain('class="session-header"');
  });

  test("summary stats section is present", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_html_05", role: "user", content: "hi", timestamp: now });

    const result = generateExport(testDb, { format: "html", range: "all" });
    expect(result.content).toContain('class="stats"');
    expect(result.content).toContain("Sessions");
    expect(result.content).toContain("Turns");
  });

  test("output is valid HTML structure", () => {
    const result = generateExport(testDb, { format: "html", range: "all" });
    expect(result.content).toContain("<!DOCTYPE html>");
    expect(result.content).toContain("<html");
    expect(result.content).toContain("</html>");
    expect(result.content).toContain("<head>");
    expect(result.content).toContain("<body>");
  });

  test("filename has .html extension", () => {
    const result = generateExport(testDb, { format: "html", range: "all" });
    expect(result.filename).toMatch(/\.html$/);
  });

  test("mimeType is text/html", () => {
    const result = generateExport(testDb, { format: "html", range: "all" });
    expect(result.mimeType).toBe("text/html");
  });

  test("HTML escapes < and > in content", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_html_09", role: "user", content: "Hello <world>", timestamp: now });

    const result = generateExport(testDb, { format: "html", range: "all" });
    expect(result.content).toContain("&lt;world&gt;");
    expect(result.content).not.toContain("<world>");
  });
});

// ============================================================================
// 5. Command Parsing
// ============================================================================

describe("parseExportCommand", () => {
  test("!export alone defaults to markdown, last-7-days", () => {
    const parsed = parseExportCommand("!export");
    expect(parsed.subcommand).toBe("export");
    expect(parsed.format).toBe("markdown");
    expect(parsed.range).toBe("last-7-days");
    expect(parsed.error).toBeUndefined();
  });

  test("!export format:json selects JSON format", () => {
    const parsed = parseExportCommand("!export format:json");
    expect(parsed.format).toBe("json");
    expect(parsed.range).toBe("last-7-days");
  });

  test("!export format:html range:last-30-days parses both", () => {
    const parsed = parseExportCommand("!export format:html range:last-30-days");
    expect(parsed.format).toBe("html");
    expect(parsed.range).toBe("last-30-days");
  });

  test("!export format:markdown range:all parses both", () => {
    const parsed = parseExportCommand("!export format:markdown range:all");
    expect(parsed.format).toBe("markdown");
    expect(parsed.range).toBe("all");
  });

  test("!export sessions triggers session listing", () => {
    const parsed = parseExportCommand("!export sessions");
    expect(parsed.subcommand).toBe("sessions");
  });

  test("/export format:markdown works with slash prefix", () => {
    const parsed = parseExportCommand("/export format:markdown");
    expect(parsed.format).toBe("markdown");
    expect(parsed.subcommand).toBe("export");
  });

  test("invalid format sets error message", () => {
    const parsed = parseExportCommand("!export format:pdf");
    expect(parsed.error).toBeTruthy();
    expect(parsed.error).toContain("pdf");
  });

  test("unknown format error message mentions valid formats", () => {
    const parsed = parseExportCommand("!export format:docx");
    expect(parsed.error).toContain("json");
    expect(parsed.error).toContain("markdown");
    expect(parsed.error).toContain("html");
  });

  test("format and range are case-insensitive for keys", () => {
    const parsed = parseExportCommand("!export FORMAT:JSON RANGE:last-7-days");
    expect(parsed.format).toBe("json");
    expect(parsed.range).toBe("last-7-days");
  });

  test("!export session (singular) also triggers session listing", () => {
    const parsed = parseExportCommand("!export session");
    expect(parsed.subcommand).toBe("sessions");
  });
});

// ============================================================================
// 6. Plugin Integration
// ============================================================================

describe("Export plugin integration", () => {
  beforeEach(() => {
    initTestDb();
  });

  afterEach(() => {
    teardownTestDb();
    mock.restore();
  });

  function makeMessage(content: string): any {
    const replies: string[] = [];
    return {
      content,
      author: { id: "user_001" },
      channelId: "channel_001",
      reply: mock(async (text: string | object) => {
        if (typeof text === "string") replies.push(text);
        else if (typeof text === "object" && (text as any).content) replies.push((text as any).content);
      }),
      channel: { send: mock(async () => {}) },
      _replies: replies,
    };
  }

  const dummyConfig: any = {};
  const textContext: any = { messageType: "text" };
  const fileContext: any = { messageType: "file" };

  test("canHandle returns true for !export", () => {
    const msg = makeMessage("!export");
    expect(exportPlugin.canHandle(msg, textContext)).toBe(true);
  });

  test("canHandle returns true for /export", () => {
    const msg = makeMessage("/export");
    expect(exportPlugin.canHandle(msg, textContext)).toBe(true);
  });

  test("canHandle returns false for regular messages", () => {
    const msg = makeMessage("How are you?");
    expect(exportPlugin.canHandle(msg, textContext)).toBe(false);
  });

  test("canHandle returns false for file messages", () => {
    const msg = makeMessage("!export");
    expect(exportPlugin.canHandle(msg, fileContext)).toBe(false);
  });

  test("handle returns handled:true for export command", async () => {
    const msg = makeMessage("!export");
    const result = await exportPlugin.handle(msg, dummyConfig, textContext);
    expect(result.handled).toBe(true);
  });

  test("handle returns fileAttachments for a valid export", async () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_plugin_01", role: "user", content: "Test message", timestamp: now });

    const msg = makeMessage("!export");
    const result = await exportPlugin.handle(msg, dummyConfig, textContext);

    expect(result.handled).toBe(true);
    expect(result.fileAttachments).toBeTruthy();
    expect(result.fileAttachments!.length).toBe(1);
    expect(result.fileAttachments![0].name).toMatch(/\.md$/);
  });

  test("handle returns session list text for !export sessions", async () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_plugin_list_01", role: "user", content: "Hello", timestamp: now });

    const msg = makeMessage("!export sessions");
    const result = await exportPlugin.handle(msg, dummyConfig, textContext);

    expect(result.handled).toBe(true);
    expect(result.responseSent).toBe(true);
    // The reply should have been called with session listing
    expect(msg.reply).toHaveBeenCalled();
  });

  test("handle reports error for invalid format", async () => {
    const msg = makeMessage("!export format:pdf");
    const result = await exportPlugin.handle(msg, dummyConfig, textContext);

    expect(result.handled).toBe(true);
    expect(result.responseSent).toBe(true);
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining("error"));
  });
});

// ============================================================================
// 7. Session Listing
// ============================================================================

describe("generateSessionList", () => {
  beforeEach(() => {
    initTestDb();
  });

  afterEach(() => {
    teardownTestDb();
    mock.restore();
  });

  test("returns no-sessions message when DB is empty", () => {
    const result = generateSessionList(testDb, "all");
    expect(result).toContain("No sessions");
  });

  test("lists sessions when data is present", () => {
    const now = Date.now();
    insertTurn({ sessionId: "sess_list_01", role: "user", content: "Hello", timestamp: now - 60000 });
    insertTurn({ sessionId: "sess_list_01", role: "assistant", content: "Hi", timestamp: now });

    const result = generateSessionList(testDb, "all");
    expect(result).toContain("sess_list_01".slice(0, 8));
  });

  test("includes turn count in listing", () => {
    const base = Date.now() - 5000;
    insertTurn({ sessionId: "sess_list_02", role: "user", content: "A", timestamp: base });
    insertTurn({ sessionId: "sess_list_02", role: "assistant", content: "B", timestamp: base + 1000 });

    const result = generateSessionList(testDb, "all");
    expect(result).toContain("2 turns");
  });
});
