/**
 * Export Engine
 *
 * Core logic for exporting conversation history from the SQLite memory database.
 * Supports JSON, Markdown, and HTML formats with configurable date ranges.
 */

import type { Database } from "bun:sqlite";

// ============================================================================
// Types
// ============================================================================

export interface ExportOptions {
  format: "json" | "markdown" | "html";
  range: string; // e.g., 'last-7-days', 'last-30-days', 'last-24-hours', 'all'
  userId?: string;
  sessionId?: string;
  includeMetadata?: boolean;
}

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
  turnCount: number;
  sessionCount: number;
  dateRange: { start: Date; end: Date };
}

export interface ConversationTurn {
  id: string;
  sessionId: string;
  discordUserId: string;
  discordChannelId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata: {
    messageType?: string;
    attachmentCount?: number;
    tokens?: number;
  };
  source: string;
}

export interface SessionGroup {
  sessionId: string;
  turns: ConversationTurn[];
  startTime: number;
  endTime: number;
  turnCount: number;
  totalTokens: number;
}

// ============================================================================
// Range Parsing
// ============================================================================

/**
 * Parse a range string into a start timestamp (epoch ms).
 * Returns { start, end } where start is the earliest included timestamp.
 */
export function parseRange(range: string): { start: number; end: number } {
  const now = Date.now();
  const normalised = (range || "").trim().toLowerCase();

  const hourMatch = normalised.match(/^last-(\d+)-hours?$/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    return { start: now - hours * 60 * 60 * 1000, end: now };
  }

  const dayMatch = normalised.match(/^last-(\d+)-days?$/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return { start: now - days * 24 * 60 * 60 * 1000, end: now };
  }

  // Named aliases
  switch (normalised) {
    case "last-24-hours":
      return { start: now - 24 * 60 * 60 * 1000, end: now };
    case "last-1-hour":
    case "last-hour":
      return { start: now - 60 * 60 * 1000, end: now };
    case "last-7-days":
    case "last-week":
      return { start: now - 7 * 24 * 60 * 60 * 1000, end: now };
    case "last-30-days":
    case "last-month":
      return { start: now - 30 * 24 * 60 * 60 * 1000, end: now };
    case "all":
      return { start: 0, end: now };
    default:
      // Invalid range — default to last-7-days
      console.warn(`[ExportEngine] Unknown range "${range}", defaulting to last-7-days`);
      return { start: now - 7 * 24 * 60 * 60 * 1000, end: now };
  }
}

// ============================================================================
// Data Extraction
// ============================================================================

/**
 * Query conversations from the database grouped by session_id.
 */
export function fetchConversations(
  db: Database,
  options: ExportOptions
): SessionGroup[] {
  const { start, end } = parseRange(options.range);

  const params: (string | number)[] = [start, end];
  let whereClause = "WHERE timestamp >= ? AND timestamp <= ?";

  if (options.userId) {
    whereClause += " AND discord_user_id = ?";
    params.push(options.userId);
  }

  if (options.sessionId) {
    whereClause += " AND session_id = ?";
    params.push(options.sessionId);
  }

  const sql = `
    SELECT id, session_id, discord_user_id, discord_channel_id,
           role, content, timestamp, metadata, source
    FROM conversations
    ${whereClause}
    ORDER BY session_id, timestamp ASC
  `;

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    session_id: string;
    discord_user_id: string;
    discord_channel_id: string;
    role: string;
    content: string;
    timestamp: number;
    metadata: string;
    source: string;
  }>;

  // Group rows by session_id
  const sessionMap = new Map<string, ConversationTurn[]>();

  for (const row of rows) {
    let meta: ConversationTurn["metadata"] = {};
    try {
      meta = row.metadata ? JSON.parse(row.metadata) : {};
    } catch {
      meta = {};
    }

    const turn: ConversationTurn = {
      id: row.id,
      sessionId: row.session_id,
      discordUserId: row.discord_user_id,
      discordChannelId: row.discord_channel_id,
      role: row.role as "user" | "assistant",
      content: row.content,
      timestamp: row.timestamp,
      metadata: meta,
      source: row.source,
    };

    if (!sessionMap.has(row.session_id)) {
      sessionMap.set(row.session_id, []);
    }
    sessionMap.get(row.session_id)!.push(turn);
  }

  // Build SessionGroup objects
  const groups: SessionGroup[] = [];

  for (const [sessionId, turns] of sessionMap) {
    const timestamps = turns.map((t) => t.timestamp);
    const totalTokens = turns.reduce((sum, t) => sum + (t.metadata.tokens || 0), 0);

    groups.push({
      sessionId,
      turns,
      startTime: Math.min(...timestamps),
      endTime: Math.max(...timestamps),
      turnCount: turns.length,
      totalTokens,
    });
  }

  // Sort groups by start time
  groups.sort((a, b) => a.startTime - b.startTime);

  return groups;
}

/**
 * List all sessions with summary info (for !export sessions command).
 */
export function listSessions(
  db: Database,
  options: Pick<ExportOptions, "range" | "userId">
): Array<{
  sessionId: string;
  startTime: number;
  endTime: number;
  turnCount: number;
  durationMs: number;
}> {
  const { start, end } = parseRange(options.range);

  const params: (string | number)[] = [start, end];
  let whereClause = "WHERE timestamp >= ? AND timestamp <= ?";

  if (options.userId) {
    whereClause += " AND discord_user_id = ?";
    params.push(options.userId);
  }

  const sql = `
    SELECT
      session_id,
      MIN(timestamp) AS start_time,
      MAX(timestamp) AS end_time,
      COUNT(*) AS turn_count
    FROM conversations
    ${whereClause}
    GROUP BY session_id
    ORDER BY start_time DESC
  `;

  const rows = db.prepare(sql).all(...params) as Array<{
    session_id: string;
    start_time: number;
    end_time: number;
    turn_count: number;
  }>;

  return rows.map((r) => ({
    sessionId: r.session_id,
    startTime: r.start_time,
    endTime: r.end_time,
    turnCount: r.turn_count,
    durationMs: r.end_time - r.start_time,
  }));
}

// ============================================================================
// Timestamp Formatting
// ============================================================================

function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function safeFilename(label: string): string {
  return label.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

// ============================================================================
// JSON Export
// ============================================================================

function exportJson(
  sessions: SessionGroup[],
  options: ExportOptions,
  dateRange: { start: number; end: number }
): string {
  const totalTurns = sessions.reduce((s, g) => s + g.turnCount, 0);
  const totalTokens = sessions.reduce((s, g) => s + g.totalTokens, 0);

  const sessionData = sessions.map((group) => ({
    sessionId: group.sessionId,
    startTime: new Date(group.startTime).toISOString(),
    endTime: new Date(group.endTime).toISOString(),
    durationMs: group.endTime - group.startTime,
    turnCount: group.turnCount,
    totalTokens: group.totalTokens,
    turns: group.turns.map((turn) => {
      const base: Record<string, unknown> = {
        id: turn.id,
        role: turn.role,
        content: turn.content,
        timestamp: new Date(turn.timestamp).toISOString(),
      };

      if (options.includeMetadata !== false) {
        base.metadata = {
          tokens: turn.metadata.tokens || 0,
          messageType: turn.metadata.messageType || "text",
          attachmentCount: turn.metadata.attachmentCount || 0,
          source: turn.source,
        };
      }

      return base;
    }),
  }));

  const output = {
    exportedAt: new Date().toISOString(),
    format: "json",
    range: options.range,
    dateRange: {
      start: new Date(dateRange.start).toISOString(),
      end: new Date(dateRange.end).toISOString(),
    },
    summary: {
      sessionCount: sessions.length,
      turnCount: totalTurns,
      totalTokens,
    },
    sessions: sessionData,
  };

  return JSON.stringify(output, null, 2);
}

// ============================================================================
// Markdown Export
// ============================================================================

function exportMarkdown(
  sessions: SessionGroup[],
  options: ExportOptions,
  dateRange: { start: number; end: number }
): string {
  const totalTurns = sessions.reduce((s, g) => s + g.turnCount, 0);
  const lines: string[] = [];

  lines.push("# Sam Conversation Export");
  lines.push("");
  lines.push(
    `**Exported:** ${formatTimestamp(Date.now())}  `
  );
  lines.push(
    `**Range:** ${formatTimestamp(dateRange.start)} — ${formatTimestamp(dateRange.end)}  `
  );
  lines.push(
    `**Sessions:** ${sessions.length}  **Turns:** ${totalTurns}`
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  for (let i = 0; i < sessions.length; i++) {
    const group = sessions[i];

    lines.push(`## Session: ${formatDate(group.startTime)}`);
    lines.push("");
    lines.push(
      `*Session ID: \`${group.sessionId}\` · ${group.turnCount} turns · ${formatDuration(group.endTime - group.startTime)}*`
    );
    lines.push("");

    for (const turn of group.turns) {
      const label = turn.role === "user" ? "**User**" : "**Sam**";
      const ts = formatTimestamp(turn.timestamp);
      lines.push(`${label} *(${ts})*:`);
      lines.push("");
      lines.push(turn.content);
      lines.push("");
    }

    // Horizontal rule between sessions (not after last)
    if (i < sessions.length - 1) {
      lines.push("---");
      lines.push("");
    }
  }

  if (sessions.length === 0) {
    lines.push("*No conversations found in the selected date range.*");
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// HTML Export
// ============================================================================

function exportHtml(
  sessions: SessionGroup[],
  options: ExportOptions,
  dateRange: { start: number; end: number }
): string {
  const totalTurns = sessions.reduce((s, g) => s + g.turnCount, 0);
  const totalTokens = sessions.reduce((s, g) => s + g.totalTokens, 0);

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      padding: 24px;
    }
    .header {
      max-width: 900px;
      margin: 0 auto 32px;
      padding: 24px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
    }
    .header h1 {
      color: #58a6ff;
      font-size: 24px;
      margin-bottom: 12px;
    }
    .stats {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .stat {
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 8px 16px;
    }
    .stat-label { color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { color: #58a6ff; font-size: 20px; font-weight: 600; }
    .session {
      max-width: 900px;
      margin: 0 auto 32px;
    }
    .session-header {
      padding: 12px 20px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px 8px 0 0;
      border-bottom: 2px solid #58a6ff;
    }
    .session-header h2 { color: #e6edf3; font-size: 16px; }
    .session-meta { color: #8b949e; font-size: 12px; margin-top: 4px; }
    .session-body { padding: 16px; background: #161b22; border: 1px solid #30363d; border-top: 0; border-radius: 0 0 8px 8px; }
    .turn { margin-bottom: 16px; display: flex; flex-direction: column; }
    .turn.user { align-items: flex-end; }
    .turn.assistant { align-items: flex-start; }
    .turn-header { font-size: 12px; color: #8b949e; margin-bottom: 4px; }
    .turn.user .turn-header { text-align: right; }
    .bubble {
      max-width: 75%;
      padding: 10px 14px;
      border-radius: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
    }
    .turn.user .bubble {
      background: #1f6feb;
      color: #ffffff;
      border-radius: 12px 12px 2px 12px;
    }
    .turn.assistant .bubble {
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid #30363d;
      border-radius: 12px 12px 12px 2px;
    }
    .empty { color: #8b949e; font-style: italic; text-align: center; padding: 32px; }
  `.trim();

  const sessionHtml = sessions.map((group) => {
    const headerDate = formatDate(group.startTime);
    const duration = formatDuration(group.endTime - group.startTime);

    const turnsHtml = group.turns.map((turn) => {
      const roleClass = turn.role === "user" ? "user" : "assistant";
      const label = turn.role === "user" ? "You" : "Sam";
      const ts = formatTimestamp(turn.timestamp);
      const escapedContent = turn.content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      return `
      <div class="turn ${roleClass}">
        <div class="turn-header">${label} &middot; ${ts}</div>
        <div class="bubble">${escapedContent}</div>
      </div>`.trimStart();
    }).join("\n      ");

    return `
    <div class="session">
      <div class="session-header">
        <h2>${headerDate}</h2>
        <div class="session-meta">
          Session: <code>${group.sessionId}</code> &nbsp;&middot;&nbsp;
          ${group.turnCount} turns &nbsp;&middot;&nbsp; ${duration}
          ${group.totalTokens > 0 ? ` &nbsp;&middot;&nbsp; ~${group.totalTokens.toLocaleString()} tokens` : ""}
        </div>
      </div>
      <div class="session-body">
        ${turnsHtml}
      </div>
    </div>`.trimStart();
  }).join("\n");

  const emptyHtml = sessions.length === 0
    ? '<div class="empty">No conversations found in the selected date range.</div>'
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sam Conversation Export</title>
  <style>${css}</style>
</head>
<body>
  <div class="header">
    <h1>Sam Conversation Export</h1>
    <p>
      Range: <strong>${formatTimestamp(dateRange.start)}</strong> &mdash;
      <strong>${formatTimestamp(dateRange.end)}</strong><br>
      Exported: ${formatTimestamp(Date.now())}
    </p>
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Sessions</div>
        <div class="stat-value">${sessions.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Turns</div>
        <div class="stat-value">${totalTurns}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Tokens</div>
        <div class="stat-value">${totalTokens > 0 ? totalTokens.toLocaleString() : "N/A"}</div>
      </div>
    </div>
  </div>
  ${sessionHtml}${emptyHtml}
</body>
</html>`;
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Generate an export from the SQLite database.
 *
 * @param db - A bun:sqlite Database instance (or in-memory test DB)
 * @param options - Export configuration
 * @returns ExportResult with content string, filename, MIME type, and stats
 */
export function generateExport(db: Database, options: ExportOptions): ExportResult {
  const dateRange = parseRange(options.range);
  const sessions = fetchConversations(db, options);

  const totalTurns = sessions.reduce((s, g) => s + g.turnCount, 0);

  let content: string;
  let mimeType: string;
  let ext: string;

  switch (options.format) {
    case "json":
      content = exportJson(sessions, options, dateRange);
      mimeType = "application/json";
      ext = "json";
      break;
    case "html":
      content = exportHtml(sessions, options, dateRange);
      mimeType = "text/html";
      ext = "html";
      break;
    case "markdown":
    default:
      content = exportMarkdown(sessions, options, dateRange);
      mimeType = "text/markdown";
      ext = "md";
      break;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rangeSlug = safeFilename(options.range || "export");
  const filename = `sam-export_${rangeSlug}_${ts}.${ext}`;

  return {
    content,
    filename,
    mimeType,
    turnCount: totalTurns,
    sessionCount: sessions.length,
    dateRange: {
      start: new Date(dateRange.start),
      end: new Date(dateRange.end),
    },
  };
}

/**
 * Generate a formatted session listing.
 */
export function generateSessionList(
  db: Database,
  range: string,
  userId?: string
): string {
  const sessions = listSessions(db, { range: range || "last-30-days", userId });

  if (sessions.length === 0) {
    return "No sessions found in the selected date range.";
  }

  const lines: string[] = [
    `**Sessions** (${sessions.length} found in \`${range || "last-30-days"}\`):`,
    "",
  ];

  for (const session of sessions) {
    const date = formatDate(session.startTime);
    const duration = formatDuration(session.durationMs);
    const shortId = session.sessionId.slice(0, 8) + "...";
    lines.push(
      `**${date}** — ${session.turnCount} turns, ${duration} (\`${shortId}\`)`
    );
  }

  return lines.join("\n");
}
