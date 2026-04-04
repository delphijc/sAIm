/**
 * SQLite Memory Database
 * Semantic and episodic memory storage for Discord conversations
 * Uses bun:sqlite with FTS5 for semantic search
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import path from "path";
import { existsSync, readdirSync, readFileSync } from "fs";

/**
 * Escape LIKE wildcard characters to prevent over-broad matching
 */
function escapeLike(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

interface MemoryConfig {
  paiDir: string;
}

interface ConversationMemory {
  id?: string;
  sessionId: string;
  discordUserId: string;
  discordChannelId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata?: {
    messageType?: string;
    attachmentCount?: number;
    tokens?: number;
  };
}

interface SemanticMemory {
  id?: string;
  sessionId: string;
  topic: string;
  summary: string;
  embedding?: number[];
  createdAt: number;
  relevanceScore: number;
  sourceMessageIds?: string[];
  // ACT-R activation scoring
  accessCount: number;
  lastAccess: number;
  confidence: number;
  source: string;
  actRScore?: number;
  tags?: string[];
  /** Project context — isolates memories by project to prevent cross-pollination */
  project?: string;
}

let db: Database | null = null;

// Column name mapping (camelCase <-> snake_case)
const CONV_COLUMN_MAP: Record<string, string> = {
  sessionId: "session_id",
  discordUserId: "discord_user_id",
  discordChannelId: "discord_channel_id",
};

const SEM_COLUMN_MAP: Record<string, string> = {
  sessionId: "session_id",
  relevanceScore: "relevance_score",
  createdAt: "created_at",
  sourceMessageIds: "source_message_ids",
  accessCount: "access_count",
  lastAccess: "last_access",
  confidence: "confidence",
  source: "source",
  tags: "tags",
  project: "project",
};

/**
 * For testing: inject a database instance
 */
export function _setDbForTesting(testDb: Database | null): void {
  db = testDb;
}

/**
 * Load and execute SQL from file (handles schema and migrations)
 */
function executeSqlFile(database: Database, filePath: string): void {
  if (!existsSync(filePath)) {
    console.warn(`SQL file not found: ${filePath}`);
    return;
  }

  const sqlContent = readFileSync(filePath, "utf-8");

  // Split by semicolon, but handle multi-line statements properly
  const statements = [];
  let current = "";
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i];
    const nextChar = sqlContent[i + 1];

    // Handle string literals
    if ((char === "'" || char === '"') && (i === 0 || sqlContent[i - 1] !== "\\")) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    // Handle statement separator
    if (char === ";" && !inString) {
      current += char;
      const trimmed = current.trim();
      // Remove comments and filter empty statements
      const lines = trimmed.split("\n")
        .map(l => {
          const commentIdx = l.indexOf("--");
          return commentIdx >= 0 ? l.substring(0, commentIdx) : l;
        })
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .join(" ");

      if (lines.length > 0 && !lines.startsWith("--")) {
        statements.push(lines);
      }
      current = "";
    } else {
      current += char;
    }
  }

  for (const statement of statements) {
    try {
      database.run(statement);
    } catch (e: any) {
      const errorStr = String(e);
      // Silently ignore schema idempotency errors
      if (!errorStr.includes("duplicate column") &&
          !errorStr.includes("already exists") &&
          !errorStr.includes("no such column") &&
          !errorStr.includes("cannot commit") &&
          !errorStr.includes("incomplete input")) {
        console.warn(`SQL execution warning: ${statement.substring(0, 50)}...`, e);
      }
    }
  }
}

/**
 * Initialize SQLite database
 * Loads schema.sql and runs migrations from migrations/ directory
 */
export async function initializeMemory(
  config: MemoryConfig
): Promise<ReturnType<typeof getMemoryInstance>> {
  if (db) {
    console.log("Already initialized");
    return getMemoryInstance();
  }

  const dbPath = path.join(config.paiDir, "discord-remote-control", "memory.db");
  console.log(`Initializing SQLite memory at ${dbPath}`);

  db = new Database(dbPath);
  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");

  // Load initial schema from schema.sql
  const schemaPath = path.join(import.meta.dir, "schema.sql");
  executeSqlFile(db, schemaPath);

  // Run migrations
  runMigrations(db);

  console.log("SQLite memory initialized successfully");
  return getMemoryInstance();
}

/**
 * Run schema migrations from migrations/ directory
 * Files are executed in sorted order (e.g., 001-*, 002-*, etc.)
 * Non-destructive: uses ALTER TABLE ADD COLUMN with idempotent DDL
 */
function runMigrations(database: Database): void {
  const migrationsDir = path.join(import.meta.dir, "migrations");

  // Return silently if no migrations directory (fresh install uses schema.sql only)
  if (!existsSync(migrationsDir)) {
    return;
  }

  // Read and sort migration files
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Running ${migrationFiles.length} migration(s)`);

  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    console.log(`  → ${file}`);
    executeSqlFile(database, migrationPath);
  }
}

function getDb(): Database {
  if (!db) {
    throw new Error("Database not initialized. Call initializeMemory first.");
  }
  return db;
}

/**
 * Get the raw SQLite Database instance for plugins that need direct query access.
 * Throws if the database has not been initialized.
 */
export function getRawDb(): Database {
  return getDb();
}

function convRowToCamel(row: any): ConversationMemory {
  return {
    id: row.id,
    sessionId: row.session_id,
    discordUserId: row.discord_user_id,
    discordChannelId: row.discord_channel_id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
  };
}

function semRowToCamel(row: any): SemanticMemory {
  return {
    id: row.id,
    sessionId: row.session_id,
    topic: row.topic,
    summary: row.summary,
    relevanceScore: row.relevance_score,
    createdAt: row.created_at,
    sourceMessageIds: row.source_message_ids ? JSON.parse(row.source_message_ids) : [],
    accessCount: row.access_count || 0,
    lastAccess: row.last_access || row.created_at || Date.now(),
    confidence: row.confidence || 0.5,
    source: row.source || 'discord',
    tags: row.tags ? JSON.parse(row.tags) : [],
    project: row.project || 'sam',
  };
}

/**
 * Get a memory adapter wrapping the SQLite database
 */
export function getMemoryInstance() {
  const database = getDb();

  return {
    query(collection: string, opts: any = {}): any[] {
      const { sessionId, filter, limit, orderBy } = opts;

      if (collection === "conversations") {
        let sql = "SELECT * FROM conversations WHERE 1=1";
        const params: any[] = [];

        if (sessionId) {
          sql += " AND session_id = ?";
          params.push(sessionId);
        }

        if (filter) {
          for (const [key, val] of Object.entries(filter)) {
            const col = CONV_COLUMN_MAP[key] || key;
            if (val && typeof val === "object") {
              const op = val as any;
              if ("$contains" in op) {
                sql += ` AND ${col} LIKE ? ESCAPE '\\'`;
                params.push(`%${escapeLike(String(op.$contains))}%`);
              }
              if ("$lt" in op) {
                sql += ` AND ${col} < ?`;
                params.push(op.$lt);
              }
            }
          }
        }

        if (orderBy) {
          const entries = Object.entries(orderBy);
          if (entries.length > 0) {
            const [col, dir] = entries[0];
            sql += ` ORDER BY ${col} ${(dir as string).toUpperCase()}`;
          }
        } else {
          sql += " ORDER BY timestamp DESC";
        }

        if (limit) {
          sql += " LIMIT ?";
          params.push(limit);
        }

        return database.prepare(sql).all(...params).map(convRowToCamel);
      }

      if (collection === "semantic") {
        let sql = "SELECT * FROM semantic WHERE 1=1";
        const params: any[] = [];

        if (sessionId) {
          sql += " AND session_id = ?";
          params.push(sessionId);
        }

        if (filter) {
          for (const [key, val] of Object.entries(filter)) {
            const col = SEM_COLUMN_MAP[key] || key;
            if (val && typeof val === "object") {
              const op = val as any;
              if ("$lt" in op) {
                sql += ` AND ${col} < ?`;
                params.push(op.$lt);
              }
              if ("$contains" in op) {
                sql += ` AND ${col} LIKE ? ESCAPE '\\'`;
                params.push(`%${escapeLike(String(op.$contains))}%`);
              }
            }
          }
        }

        sql += " ORDER BY created_at DESC";

        if (limit) {
          sql += " LIMIT ?";
          params.push(limit);
        }

        return database.prepare(sql).all(...params).map(semRowToCamel);
      }

      return [];
    },

    insert(collection: string, doc: any): string {
      const id = randomUUID();

      if (collection === "conversations") {
        database.prepare(`
          INSERT INTO conversations (id, session_id, discord_user_id, discord_channel_id, role, content, timestamp, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          doc.sessionId,
          doc.discordUserId,
          doc.discordChannelId,
          doc.role,
          doc.content,
          doc.timestamp,
          JSON.stringify(doc.metadata || {}),
        );
      } else if (collection === "semantic") {
        database.prepare(`
          INSERT INTO semantic (id, session_id, topic, summary, relevance_score, created_at, source_message_ids, access_count, last_access, confidence, source, tags, project)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          doc.sessionId,
          doc.topic,
          doc.summary,
          doc.relevanceScore,
          doc.createdAt,
          JSON.stringify(doc.sourceMessageIds || []),
          doc.accessCount || 0,
          doc.lastAccess || doc.createdAt || Date.now(),
          doc.confidence || 0.5,
          doc.source || 'discord',
          JSON.stringify(doc.tags || []),
          doc.project || 'sam',
        );
      }

      return id;
    },

    deleteOld(collection: string, sessionId: string, cutoffTimestamp: number): number {
      if (collection === "conversations") {
        const result = database.prepare(
          "DELETE FROM conversations WHERE session_id = ? AND timestamp < ?"
        ).run(sessionId, cutoffTimestamp);
        return (result as any).changes || 0;
      }
      return 0;
    },

    update(collection: string, id: string, updates: any): void {
      if (collection === "semantic") {
        const setClauses: string[] = [];
        const params: any[] = [];

        for (const [key, val] of Object.entries(updates)) {
          const col = SEM_COLUMN_MAP[key] || key;
          setClauses.push(`${col} = ?`);
          params.push(val);
        }

        params.push(id);
        database.prepare(
          `UPDATE semantic SET ${setClauses.join(", ")} WHERE id = ?`
        ).run(...params);
      }
    },

    /**
     * Execute raw SQL query (for advanced analytics like retrospective)
     */
    rawQuery(sql: string, ...params: any[]): any[] {
      return database.prepare(sql).all(...params);
    },

    /**
     * Execute raw SQL statement (INSERT/UPDATE/DELETE for analytics)
     */
    rawRun(sql: string, ...params: any[]): any {
      return database.prepare(sql).run(...params);
    },

    semanticSearch(collection: string, query: string, opts: any = {}): any[] {
      const { filter, limit } = opts;
      const sessionId = filter?.sessionId;
      const project = filter?.project;
      const maxResults = limit || 10;

      // Try FTS5 first with ACT-R scoring
      try {
        // Sanitize query for FTS5
        const sanitized = query.replace(/[^\w\s]/g, "").trim();
        if (!sanitized) throw new Error("empty query");

        let sql = `
          SELECT s.*,
            ln(s.access_count + 1)
            - 0.5 * ln(MAX(0.001, (unixepoch('now') - s.last_access / 1000.0) / 86400.0))
            + (s.confidence - 0.5) AS act_r_score,
            fts.rank AS fts_rank
          FROM semantic s
          INNER JOIN semantic_fts fts ON s.rowid = fts.rowid
          WHERE semantic_fts MATCH ?
        `;
        const params: any[] = [sanitized];

        if (sessionId) {
          sql += " AND s.session_id = ?";
          params.push(sessionId);
        }

        if (project) {
          sql += " AND s.project = ?";
          params.push(project);
        }

        sql += " ORDER BY act_r_score DESC LIMIT ?";
        params.push(maxResults);

        const results = database.prepare(sql).all(...params).map((row: any) => {
          const mem = semRowToCamel(row);
          mem.actRScore = row.act_r_score;
          return mem;
        });
        return results;
      } catch {
        // Fallback to LIKE search with ACT-R scoring
        let sql = `
          SELECT *,
            ln(access_count + 1)
            - 0.5 * ln(MAX(0.001, (unixepoch('now') - last_access / 1000.0) / 86400.0))
            + (confidence - 0.5) AS act_r_score
          FROM semantic
          WHERE (topic LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\')
        `;
        const likeQuery = `%${escapeLike(query)}%`;
        const params: any[] = [likeQuery, likeQuery];

        if (sessionId) {
          sql += " AND session_id = ?";
          params.push(sessionId);
        }

        if (project) {
          sql += " AND project = ?";
          params.push(project);
        }

        sql += " ORDER BY act_r_score DESC LIMIT ?";
        params.push(maxResults);

        const results = database.prepare(sql).all(...params).map((row: any) => {
          const mem = semRowToCamel(row);
          mem.actRScore = row.act_r_score;
          return mem;
        });
        return results;
      }
    },
  };
}

/**
 * Save conversation turn to episodic memory
 */
export async function saveConversationMemory(
  memory: ConversationMemory
): Promise<string> {
  const db = getMemoryInstance();
  const id = db.insert("conversations", {
    sessionId: memory.sessionId,
    discordUserId: memory.discordUserId,
    discordChannelId: memory.discordChannelId,
    role: memory.role,
    content: memory.content,
    timestamp: memory.timestamp,
    metadata: memory.metadata || {},
  });
  return id;
}

/**
 * Get recent conversation history for a session
 */
export async function getSessionConversations(
  sessionId: string,
  limit: number = 10
): Promise<ConversationMemory[]> {
  const memory = getMemoryInstance();
  return memory.query("conversations", {
    sessionId,
    limit,
    orderBy: { timestamp: "desc" },
  });
}

/**
 * Save semantic memory (topic-based)
 */
export async function saveSemanticMemory(
  memory: SemanticMemory
): Promise<string> {
  const db = getMemoryInstance();
  const id = db.insert("semantic", {
    sessionId: memory.sessionId,
    topic: memory.topic,
    summary: memory.summary,
    relevanceScore: memory.relevanceScore,
    createdAt: memory.createdAt,
    sourceMessageIds: memory.sourceMessageIds || [],
    accessCount: memory.accessCount || 0,
    lastAccess: memory.lastAccess || Date.now(),
    confidence: memory.confidence || 0.5,
    source: memory.source || 'discord',
    tags: memory.tags || [],
    project: memory.project || 'sam',
  });
  return id;
}

/**
 * Touch a memory to increment access count and update last_access timestamp
 * Called after retrieval to build ACT-R activation scores
 */
export function touchMemory(id: string): void {
  try {
    const database = getDb();
    database.prepare(
      "UPDATE semantic SET access_count = access_count + 1, last_access = ? WHERE id = ?"
    ).run(Date.now(), id);
  } catch (e) {
    console.warn(`Failed to touch memory ${id}:`, e);
  }
}

/**
 * Update Hebbian associations for retrieved memories
 * For each pair in the result set, create/strengthen bidirectional associations
 * called after a retrieval to build co-activation links
 */
export function updateAssociations(retrievedIds: string[]): void {
  try {
    const database = getDb();
    const now = Date.now();

    // Create bidirectional associations for all pairs
    for (let i = 0; i < retrievedIds.length; i++) {
      for (let j = i + 1; j < retrievedIds.length; j++) {
        const id1 = retrievedIds[i];
        const id2 = retrievedIds[j];

        // Forward association
        database.prepare(`
          INSERT INTO associations (source_id, target_id, weight, co_activation_count, last_activated)
          VALUES (?, ?, ?, 1, ?)
          ON CONFLICT(source_id, target_id) DO UPDATE SET
            weight = MIN(1.0, weight + 0.05),
            co_activation_count = co_activation_count + 1,
            last_activated = ?
        `).run(id1, id2, 0.1, now, now);

        // Reverse association
        database.prepare(`
          INSERT INTO associations (source_id, target_id, weight, co_activation_count, last_activated)
          VALUES (?, ?, ?, 1, ?)
          ON CONFLICT(source_id, target_id) DO UPDATE SET
            weight = MIN(1.0, weight + 0.05),
            co_activation_count = co_activation_count + 1,
            last_activated = ?
        `).run(id2, id1, 0.1, now, now);
      }
    }
  } catch (e) {
    console.warn("Failed to update associations:", e);
  }
}

/**
 * Get memories associated with a set of source IDs via Hebbian links
 * Returns target memories sorted by association weight (strongest first)
 */
export function getAssociatedMemories(sourceIds: string[], limit: number = 10): SemanticMemory[] {
  try {
    const database = getDb();
    if (sourceIds.length === 0) return [];

    const placeholders = sourceIds.map(() => "?").join(",");
    const rows = database.prepare(`
      SELECT DISTINCT s.*, a.weight as assoc_weight
      FROM associations a
      INNER JOIN semantic s ON s.id = a.target_id
      WHERE a.source_id IN (${placeholders})
        AND a.target_id NOT IN (${placeholders})
        AND a.weight >= 0.15
      ORDER BY a.weight DESC, a.co_activation_count DESC
      LIMIT ?
    `).all(...sourceIds, ...sourceIds, limit);

    return rows.map((row: any) => semRowToCamel(row));
  } catch (e) {
    console.warn("Failed to get associated memories:", e);
    return [];
  }
}

/**
 * Prune stale associations (older than 30 days with low co-activation count)
 * Called from hourly session cleanup timer
 */
export function pruneStaleAssociations(): void {
  try {
    const database = getDb();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const deleted = database.prepare(`
      DELETE FROM associations
      WHERE last_activated < ? AND co_activation_count < 3
    `).run(thirtyDaysAgo);

    if ((deleted as any).changes > 0) {
      console.log(`🧠 Pruned ${(deleted as any).changes} stale associations`);
    }
  } catch (e) {
    console.warn("Failed to prune associations:", e);
  }
}

/**
 * Find semantically similar memories using FTS5 with ACT-R scoring
 * Searches across ALL sessions by default for accumulated learning
 * Builds Hebbian associations from co-retrieved memories
 */
export async function findSimilarMemories(
  query: string,
  sessionId?: string,
  limit: number = 5,
  project?: string
): Promise<SemanticMemory[]> {
  const memory = getMemoryInstance();
  const filter: any = {};
  if (sessionId) filter.sessionId = sessionId;
  if (project) filter.project = project;
  const results = memory.semanticSearch("semantic", query, {
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    limit,
  }) as SemanticMemory[];

  const retrievedIds: string[] = [];

  // Touch each retrieved memory to build access history
  for (const mem of results) {
    if (mem.id) {
      touchMemory(mem.id);
      retrievedIds.push(mem.id);
    }
  }

  // Build Hebbian associations from co-retrieved memories
  if (retrievedIds.length > 1) {
    updateAssociations(retrievedIds);
  }

  return results;
}

/**
 * @deprecated Decay old memories is no longer used
 * ACT-R activation scoring handles recency automatically at query time.
 * Kept for backward compatibility.
 */
export async function decayOldMemories(
  sessionId: string,
  ageHours: number = 24
): Promise<number> {
  console.warn(
    "decayOldMemories() is deprecated. ACT-R activation scoring handles recency at query time."
  );
  // No-op: ACT-R scoring at query time replaces destructive decay
  return 0;
}

/**
 * Clean up memories for a session
 */
export async function cleanupSessionMemory(sessionId: string): Promise<void> {
  const database = getDb();
  database.prepare("DELETE FROM conversations WHERE session_id = ?").run(sessionId);
  database.prepare("DELETE FROM semantic WHERE session_id = ?").run(sessionId);
}

/**
 * Export memory statistics
 */
export async function getMemoryStats(sessionId: string): Promise<{
  conversationTurns: number;
  semanticMemories: number;
  oldestMemory: number;
  newestMemory: number;
}> {
  const memory = getMemoryInstance();

  const conversations = memory.query("conversations", { sessionId });
  const semantics = memory.query("semantic", { sessionId });

  const timestamps = (conversations as ConversationMemory[]).map(
    (c) => c.timestamp
  );
  const oldestMemory = timestamps.length > 0 ? Math.min(...timestamps) : 0;
  const newestMemory = timestamps.length > 0 ? Math.max(...timestamps) : 0;

  return {
    conversationTurns: conversations.length,
    semanticMemories: semantics.length,
    oldestMemory,
    newestMemory,
  };
}
