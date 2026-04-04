/**
 * Hook Events SQLite Database
 * Normalized storage for all Claude Code hook events
 *
 * Follows conventions from discord-remote-control/service/memory/db.ts:
 * - bun:sqlite with WAL mode
 * - TEXT PRIMARY KEY with crypto.randomUUID()
 * - JSON metadata columns for flexibility
 * - Proper indexes for common query patterns
 * - FTS5 not needed here (structured data, not free-text search)
 *
 * Schema (normalized):
 *   sessions      - One row per Claude Code session
 *   hook_events   - Every hook event (raw, with JSON payload)
 *   tool_uses     - Extracted from PreToolUse/PostToolUse events
 *   file_changes  - Extracted from tool_uses (Edit, Write, Read, etc.)
 *   bash_commands  - Extracted from tool_uses (Bash tool)
 */

import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { PAI_DIR } from "./pai-paths";
import { sanitizePayload, sanitizeString } from "./sanitize-credentials";

let db: Database | null = null;

// --- Schema DDL ---

const SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS sessions (
    id               TEXT PRIMARY KEY,
    conversation_id  TEXT NOT NULL,
    started_at       INTEGER NOT NULL,
    ended_at         INTEGER,
    agent_name       TEXT NOT NULL DEFAULT 'pai',
    focus            TEXT DEFAULT 'general-work',
    metadata         TEXT DEFAULT '{}'
)`;

const SESSIONS_CONV_INDEX = `
CREATE INDEX IF NOT EXISTS idx_sessions_conversation
    ON sessions (conversation_id)`;

const HOOK_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS hook_events (
    id             TEXT PRIMARY KEY,
    session_id     TEXT NOT NULL,
    event_type     TEXT NOT NULL,
    source_app     TEXT NOT NULL DEFAULT 'pai',
    tool_name      TEXT,
    timestamp      INTEGER NOT NULL,
    timestamp_pst  TEXT NOT NULL,
    payload        TEXT DEFAULT '{}'
)`;

const HOOK_EVENTS_SESSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_hook_events_session
    ON hook_events (session_id, timestamp DESC)`;

const HOOK_EVENTS_TYPE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_hook_events_type
    ON hook_events (event_type, timestamp DESC)`;

const HOOK_EVENTS_TOOL_INDEX = `
CREATE INDEX IF NOT EXISTS idx_hook_events_tool
    ON hook_events (tool_name, timestamp DESC)`;

const TOOL_USES_TABLE = `
CREATE TABLE IF NOT EXISTS tool_uses (
    id           TEXT PRIMARY KEY,
    event_id     TEXT NOT NULL,
    session_id   TEXT NOT NULL,
    tool_name    TEXT NOT NULL,
    tool_input   TEXT DEFAULT '{}',
    file_path    TEXT,
    description  TEXT,
    timestamp    INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES hook_events(id)
)`;

const TOOL_USES_SESSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_tool_uses_session
    ON tool_uses (session_id, timestamp DESC)`;

const TOOL_USES_TOOL_INDEX = `
CREATE INDEX IF NOT EXISTS idx_tool_uses_tool
    ON tool_uses (tool_name, timestamp DESC)`;

const FILE_CHANGES_TABLE = `
CREATE TABLE IF NOT EXISTS file_changes (
    id           TEXT PRIMARY KEY,
    tool_use_id  TEXT NOT NULL,
    session_id   TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    change_type  TEXT NOT NULL,
    timestamp    INTEGER NOT NULL,
    FOREIGN KEY (tool_use_id) REFERENCES tool_uses(id)
)`;

const FILE_CHANGES_SESSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_file_changes_session
    ON file_changes (session_id, timestamp DESC)`;

const FILE_CHANGES_PATH_INDEX = `
CREATE INDEX IF NOT EXISTS idx_file_changes_path
    ON file_changes (file_path)`;

const BASH_COMMANDS_TABLE = `
CREATE TABLE IF NOT EXISTS bash_commands (
    id           TEXT PRIMARY KEY,
    tool_use_id  TEXT NOT NULL,
    session_id   TEXT NOT NULL,
    command      TEXT NOT NULL,
    description  TEXT,
    timestamp    INTEGER NOT NULL,
    FOREIGN KEY (tool_use_id) REFERENCES tool_uses(id)
)`;

const BASH_COMMANDS_SESSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_bash_commands_session
    ON bash_commands (session_id, timestamp DESC)`;

// --- Initialization ---

function getDbPath(): string {
  const dbDir = join(PAI_DIR, "hook-events");
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }
  return join(dbDir, "events.db");
}

export function getHookDb(): Database {
  if (db) return db;

  const dbPath = getDbPath();
  db = new Database(dbPath, { create: true });

  // WAL mode for safe concurrent access (hooks run in parallel)
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  // Create tables
  db.run(SESSIONS_TABLE);
  db.run(SESSIONS_CONV_INDEX);
  db.run(HOOK_EVENTS_TABLE);
  db.run(HOOK_EVENTS_SESSION_INDEX);
  db.run(HOOK_EVENTS_TYPE_INDEX);
  db.run(HOOK_EVENTS_TOOL_INDEX);
  db.run(TOOL_USES_TABLE);
  db.run(TOOL_USES_SESSION_INDEX);
  db.run(TOOL_USES_TOOL_INDEX);
  db.run(FILE_CHANGES_TABLE);
  db.run(FILE_CHANGES_SESSION_INDEX);
  db.run(FILE_CHANGES_PATH_INDEX);
  db.run(BASH_COMMANDS_TABLE);
  db.run(BASH_COMMANDS_SESSION_INDEX);

  return db;
}

// --- Insert operations ---

export function insertHookEvent(event: {
  sessionId: string;
  eventType: string;
  sourceApp: string;
  toolName?: string;
  timestamp: number;
  timestampPst: string;
  payload: Record<string, any>;
}): string {
  const database = getHookDb();
  const id = crypto.randomUUID();

  const stmt = database.prepare(`
    INSERT INTO hook_events (id, session_id, event_type, source_app, tool_name, timestamp, timestamp_pst, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    event.sessionId,
    event.eventType,
    event.sourceApp,
    event.toolName || null,
    event.timestamp,
    event.timestampPst,
    JSON.stringify(event.payload)
  );

  return id;
}

export function insertToolUse(toolUse: {
  eventId: string;
  sessionId: string;
  toolName: string;
  toolInput: Record<string, any>;
  filePath?: string;
  description?: string;
  timestamp: number;
}): string {
  const database = getHookDb();
  const id = crypto.randomUUID();

  const stmt = database.prepare(`
    INSERT INTO tool_uses (id, event_id, session_id, tool_name, tool_input, file_path, description, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    toolUse.eventId,
    toolUse.sessionId,
    toolUse.toolName,
    JSON.stringify(toolUse.toolInput),
    toolUse.filePath || null,
    toolUse.description || null,
    toolUse.timestamp
  );

  return id;
}

export function insertFileChange(fileChange: {
  toolUseId: string;
  sessionId: string;
  filePath: string;
  changeType: string;
  timestamp: number;
}): string {
  const database = getHookDb();
  const id = crypto.randomUUID();

  const stmt = database.prepare(`
    INSERT INTO file_changes (id, tool_use_id, session_id, file_path, change_type, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    fileChange.toolUseId,
    fileChange.sessionId,
    fileChange.filePath,
    fileChange.changeType,
    fileChange.timestamp
  );

  return id;
}

export function insertBashCommand(cmd: {
  toolUseId: string;
  sessionId: string;
  command: string;
  description?: string;
  timestamp: number;
}): string {
  const database = getHookDb();
  const id = crypto.randomUUID();

  const stmt = database.prepare(`
    INSERT INTO bash_commands (id, tool_use_id, session_id, command, description, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    cmd.toolUseId,
    cmd.sessionId,
    cmd.command,
    cmd.description || null,
    cmd.timestamp
  );

  return id;
}

export function upsertSession(session: {
  id: string;
  conversationId: string;
  startedAt: number;
  endedAt?: number;
  agentName?: string;
  focus?: string;
  metadata?: Record<string, any>;
}): void {
  const database = getHookDb();

  const stmt = database.prepare(`
    INSERT INTO sessions (id, conversation_id, started_at, ended_at, agent_name, focus, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      ended_at = COALESCE(excluded.ended_at, sessions.ended_at),
      agent_name = COALESCE(excluded.agent_name, sessions.agent_name),
      focus = COALESCE(excluded.focus, sessions.focus),
      metadata = COALESCE(excluded.metadata, sessions.metadata)
  `);

  stmt.run(
    session.id,
    session.conversationId,
    session.startedAt,
    session.endedAt || null,
    session.agentName || "pai",
    session.focus || "general-work",
    JSON.stringify(session.metadata || {})
  );
}

// --- Helpers for event processing ---

/** Map tool name to file change type */
function toolToChangeType(toolName: string): string | null {
  switch (toolName) {
    case "Read":
      return "read";
    case "Write":
      return "write";
    case "Edit":
    case "MultiEdit":
      return "edit";
    case "NotebookEdit":
      return "edit";
    default:
      return null;
  }
}

/** Extract file path from tool input based on tool type */
function extractFilePath(toolName: string, toolInput: Record<string, any>): string | null {
  if (toolInput.file_path) return toolInput.file_path;
  if (toolInput.path) return toolInput.path;
  return null;
}

/**
 * Process a hook event and write normalized data to all relevant tables.
 * Call this from capture-all-events.ts after building the event object.
 */
export function processHookEvent(event: {
  sourceApp: string;
  sessionId: string;
  eventType: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  description?: string;
  timestamp: number;
  timestampPst: string;
  payload: Record<string, any>;
}): void {
  try {
    const now = event.timestamp;

    // Sanitize all string fields to prevent credential leakage into DB
    const safePayload = sanitizePayload(event.payload);
    const safeToolInput = event.toolInput ? sanitizePayload(event.toolInput) : undefined;

    // 1. Always insert the raw hook event
    const eventId = insertHookEvent({
      sessionId: event.sessionId,
      eventType: event.eventType,
      sourceApp: event.sourceApp,
      toolName: event.toolName,
      timestamp: now,
      timestampPst: event.timestampPst,
      payload: safePayload,
    });

    // 2. For tool events (PreToolUse), create normalized tool_use + children
    if (event.eventType === "PreToolUse" && event.toolName && safeToolInput) {
      const filePath = extractFilePath(event.toolName, safeToolInput);

      const toolUseId = insertToolUse({
        eventId,
        sessionId: event.sessionId,
        toolName: event.toolName,
        toolInput: safeToolInput,
        filePath: filePath || undefined,
        description: event.description || safeToolInput.description,
        timestamp: now,
      });

      // 3. File change normalization
      const changeType = toolToChangeType(event.toolName);
      if (changeType && filePath) {
        insertFileChange({
          toolUseId,
          sessionId: event.sessionId,
          filePath,
          changeType,
          timestamp: now,
        });
      }

      // 4. Bash command normalization
      if (event.toolName === "Bash" && safeToolInput.command) {
        insertBashCommand({
          toolUseId,
          sessionId: event.sessionId,
          command: sanitizeString(safeToolInput.command),
          description: safeToolInput.description,
          timestamp: now,
        });
      }
    }

    // 5. Session tracking
    if (event.eventType === "SessionStart") {
      upsertSession({
        id: event.sessionId,
        conversationId: event.payload.conversation_id || event.sessionId,
        startedAt: now,
        agentName: event.sourceApp,
      });
    } else if (event.eventType === "SessionEnd") {
      upsertSession({
        id: event.sessionId,
        conversationId: event.payload.conversation_id || event.sessionId,
        startedAt: now, // Will be ignored by ON CONFLICT
        endedAt: now,
      });
    }
  } catch (error) {
    // Never block Claude Code - log and continue
    console.error("hook-db: Failed to write event:", error);
  }
}
