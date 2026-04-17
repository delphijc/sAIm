# SQLite Memory Migration Plan

## Replacing Muninn with bun:sqlite for Discord Remote Control

**Date**: 2026-03-05
**Status**: REVIEW (awaiting approval before implementation)
**Risk Level**: Low - db.ts is the only file that changes; all consumers use the same exported function signatures

---

## 1. Problem Statement

The `muninn` npm package used for the memory system is broken/unmaintained. It fails at runtime, making the entire memory subsystem non-functional. We need to replace it with a reliable, zero-dependency alternative that preserves the exact same interface so that `episodic.ts`, `injection.ts`, `subprocess.ts`, and `index.ts` require no changes.

## 2. Design Decisions

### 2.1 Storage Engine: bun:sqlite

**Choice**: `bun:sqlite` (Bun's built-in SQLite binding)

**Rationale**:
- Zero npm dependencies (built into Bun runtime)
- Synchronous API that is extremely fast (we wrap in async for interface compat)
- WAL mode for concurrent read/write safety
- Persistent file on disk at `$PAI_DIR/discord-remote-control/memory.db`
- Battle-tested SQLite engine underneath

### 2.2 Semantic Search: BM25 via SQLite FTS5

**Choice**: SQLite FTS5 (Full-Text Search) with BM25 ranking

**Rationale**:
- FTS5 is built into SQLite, no extensions needed
- BM25 ranking provides genuine relevance scoring based on term frequency
- Far superior to substring matching for natural language queries
- No need for external embedding APIs or vector math
- Matches the use case perfectly: finding relevant prior conversation topics by keyword similarity
- The current Muninn code never actually generates real embeddings anyway (no embedding API call exists in the codebase)

**How it works**:
- A virtual FTS5 table shadows the `semantic` table's `topic` and `summary` columns
- `semanticSearch()` queries via `MATCH` with BM25 ranking
- Results are filtered by `sessionId` and sorted by relevance score
- Fallback: if FTS5 match returns nothing, falls back to `LIKE '%query%'` on topic+summary

### 2.3 Interface Compatibility Strategy

The key insight: `episodic.ts` and `injection.ts` only import these functions from `db.ts`:

```
episodic.ts imports:
  - saveConversationMemory
  - getSessionConversations
  - getMuninInstance        (used in searchConversation only)

injection.ts imports:
  - findSimilarMemories

index.ts imports:
  - initializeMuninMemory
```

**Strategy**: Replace every function body inside `db.ts` while keeping identical signatures. The `getMuninInstance()` function becomes `getDbInstance()` internally, but we also keep `getMuninInstance()` as an export that returns a lightweight adapter object with `.query()` so `episodic.ts` line 106-114 (`searchConversation`) continues to work.

---

## 3. SQL Schema

### 3.1 Conversations Table (Episodic Memory)

```sql
CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id  TEXT NOT NULL,
    discord_user_id    TEXT NOT NULL,
    discord_channel_id TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    timestamp   INTEGER NOT NULL,
    metadata    TEXT DEFAULT '{}',  -- JSON string

    -- Indexes for common queries
    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_session
    ON conversations (session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_session_role
    ON conversations (session_id, role);
```

### 3.2 Semantic Table (Semantic Memory)

```sql
CREATE TABLE IF NOT EXISTS semantic (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id      TEXT NOT NULL,
    topic           TEXT NOT NULL,
    summary         TEXT NOT NULL,
    relevance_score REAL NOT NULL DEFAULT 1.0,
    created_at      INTEGER NOT NULL,
    source_message_ids TEXT DEFAULT '[]',  -- JSON array

    CONSTRAINT valid_score CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0)
);

CREATE INDEX IF NOT EXISTS idx_semantic_session
    ON semantic (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_relevance
    ON semantic (session_id, relevance_score DESC);
```

### 3.3 FTS5 Virtual Table (for semantic search)

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS semantic_fts USING fts5(
    topic,
    summary,
    content='semantic',
    content_rowid='rowid'
);

-- Triggers to keep FTS in sync with semantic table
CREATE TRIGGER IF NOT EXISTS semantic_ai AFTER INSERT ON semantic BEGIN
    INSERT INTO semantic_fts(rowid, topic, summary)
    VALUES (new.rowid, new.topic, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS semantic_ad AFTER DELETE ON semantic BEGIN
    INSERT INTO semantic_fts(semantic_fts, rowid, topic, summary)
    VALUES ('delete', old.rowid, old.topic, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS semantic_au AFTER UPDATE ON semantic BEGIN
    INSERT INTO semantic_fts(semantic_fts, rowid, topic, summary)
    VALUES ('delete', old.rowid, old.topic, old.summary);
    INSERT INTO semantic_fts(rowid, topic, summary)
    VALUES (new.rowid, new.topic, new.summary);
END;
```

**Note on FTS5 content sync**: We use content-sync triggers so the FTS index automatically stays in sync when rows are inserted, updated, or deleted from the `semantic` table.

---

## 4. Function Signatures and Implementation

Every exported function retains its exact current signature. Only the body changes.

### 4.1 initializeMuninMemory

```typescript
// BEFORE: new Muninn({...}), createCollection(...)
// AFTER:  Database from bun:sqlite, CREATE TABLE statements

import { Database } from "bun:sqlite";

let db: Database | null = null;

export async function initializeMuninMemory(
  config: MemoryConfig
): Promise<any> {
  if (db) {
    console.log("Already initialized");
    return db;
  }

  const dbDir = path.join(config.paiDir, "discord-remote-control");
  mkdirSync(dbDir, { recursive: true });

  const dbPath = path.join(dbDir, "memory.db");
  db = new Database(dbPath, { create: true });

  // Enable WAL mode for better concurrent performance
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  // Create tables (SQL from Section 3)
  db.run(CONVERSATIONS_TABLE_SQL);
  db.run(CONVERSATIONS_SESSION_INDEX_SQL);
  db.run(SEMANTIC_TABLE_SQL);
  db.run(SEMANTIC_SESSION_INDEX_SQL);
  db.run(SEMANTIC_FTS_SQL);
  db.run(SEMANTIC_FTS_INSERT_TRIGGER);
  db.run(SEMANTIC_FTS_DELETE_TRIGGER);
  db.run(SEMANTIC_FTS_UPDATE_TRIGGER);

  console.log(`Muninn (SQLite) initialized at ${dbPath}`);
  return db;
}
```

### 4.2 getMuninInstance (compatibility shim)

```typescript
// Returns an adapter object with .query() method
// so episodic.ts searchConversation() keeps working

export function getMuninInstance(): any {
  if (!db) {
    throw new Error("Muninn not initialized. Call initializeMuninMemory first.");
  }

  return {
    query: (collection: string, opts: any) => {
      if (collection === "conversations") {
        return queryConversations(opts);
      } else if (collection === "semantic") {
        return querySemantic(opts);
      }
      return [];
    },
    insert: (collection: string, doc: any) => {
      if (collection === "conversations") return insertConversation(doc);
      if (collection === "semantic") return insertSemantic(doc);
      throw new Error(`Unknown collection: ${collection}`);
    },
    semanticSearch: (collection: string, query: string, opts: any) => {
      return semanticSearchInternal(collection, query, opts);
    },
    update: (collection: string, id: string, changes: any) => {
      return updateDocument(collection, id, changes);
    },
  };
}
```

### 4.3 saveConversationMemory

```typescript
export async function saveConversationMemory(
  memory: ConversationMemory
): Promise<string> {
  if (!db) throw new Error("Not initialized");

  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO conversations (id, session_id, discord_user_id, discord_channel_id, role, content, timestamp, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    memory.sessionId,
    memory.discordUserId,
    memory.discordChannelId,
    memory.role,
    memory.content,
    memory.timestamp,
    JSON.stringify(memory.metadata || {})
  );

  console.log(`Saved conversation turn: ${id}`);
  return id;
}
```

### 4.4 getSessionConversations

```typescript
export async function getSessionConversations(
  sessionId: string,
  limit: number = 10
): Promise<ConversationMemory[]> {
  if (!db) throw new Error("Not initialized");

  const stmt = db.prepare(`
    SELECT * FROM conversations
    WHERE session_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(sessionId, limit) as any[];
  return rows.map(rowToConversationMemory);
}
```

### 4.5 saveSemanticMemory

```typescript
export async function saveSemanticMemory(
  memory: SemanticMemory
): Promise<string> {
  if (!db) throw new Error("Not initialized");

  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO semantic (id, session_id, topic, summary, relevance_score, created_at, source_message_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    memory.sessionId,
    memory.topic,
    memory.summary,
    memory.relevanceScore,
    memory.createdAt,
    JSON.stringify(memory.sourceMessageIds || [])
  );

  console.log(`Saved semantic memory: ${id} (topic: ${memory.topic})`);
  return id;
}
```

### 4.6 findSimilarMemories (FTS5 semantic search)

```typescript
export async function findSimilarMemories(
  query: string,
  sessionId: string,
  limit: number = 5
): Promise<SemanticMemory[]> {
  if (!db) throw new Error("Not initialized");

  // Sanitize the query for FTS5 (escape special characters, build OR query)
  const ftsQuery = sanitizeFtsQuery(query);

  try {
    // Primary: FTS5 BM25 search
    const stmt = db.prepare(`
      SELECT s.*, bm25(semantic_fts) AS rank
      FROM semantic s
      JOIN semantic_fts ON semantic_fts.rowid = s.rowid
      WHERE semantic_fts MATCH ?
        AND s.session_id = ?
      ORDER BY rank
      LIMIT ?
    `);

    const rows = stmt.all(ftsQuery, sessionId, limit) as any[];

    if (rows.length > 0) {
      return rows.map(rowToSemanticMemory);
    }
  } catch {
    // FTS5 MATCH can throw on malformed queries
  }

  // Fallback: LIKE-based search
  const fallbackStmt = db.prepare(`
    SELECT * FROM semantic
    WHERE session_id = ?
      AND (topic LIKE ? OR summary LIKE ?)
    ORDER BY relevance_score DESC
    LIMIT ?
  `);

  const likePattern = `%${query}%`;
  const rows = fallbackStmt.all(sessionId, likePattern, likePattern, limit) as any[];
  return rows.map(rowToSemanticMemory);
}
```

### 4.7 decayOldMemories

```typescript
export async function decayOldMemories(
  sessionId: string,
  ageHours: number = 24
): Promise<number> {
  if (!db) throw new Error("Not initialized");

  const cutoffTime = Date.now() - ageHours * 60 * 60 * 1000;

  const stmt = db.prepare(`
    UPDATE semantic
    SET relevance_score = MAX(0, relevance_score * 0.7)
    WHERE session_id = ?
      AND created_at < ?
      AND relevance_score > 0
  `);

  const result = stmt.run(sessionId, cutoffTime);
  const decayedCount = result.changes;

  if (decayedCount > 0) {
    console.log(`Decayed ${decayedCount} memories older than ${ageHours} hours`);
  }

  return decayedCount;
}
```

### 4.8 Helper: Row-to-Object Mappers

```typescript
function rowToConversationMemory(row: any): ConversationMemory {
  return {
    id: row.id,
    sessionId: row.session_id,
    discordUserId: row.discord_user_id,
    discordChannelId: row.discord_channel_id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
    metadata: JSON.parse(row.metadata || "{}"),
  };
}

function rowToSemanticMemory(row: any): SemanticMemory {
  return {
    id: row.id,
    sessionId: row.session_id,
    topic: row.topic,
    summary: row.summary,
    relevanceScore: row.relevance_score,
    createdAt: row.created_at,
    sourceMessageIds: JSON.parse(row.source_message_ids || "[]"),
  };
}
```

### 4.9 Helper: FTS5 Query Sanitizer

```typescript
function sanitizeFtsQuery(query: string): string {
  // Remove FTS5 special characters, split into words, join with OR
  const words = query
    .replace(/[^\w\s]/g, " ")  // Strip punctuation
    .split(/\s+/)
    .filter(w => w.length > 1)  // Drop single chars
    .map(w => `"${w}"`)         // Quote each term
    .join(" OR ");

  return words || `"${query.replace(/"/g, "")}"`;
}
```

### 4.10 Helper: queryConversations / querySemantic (for getMuninInstance adapter)

```typescript
function queryConversations(opts: any): any[] {
  if (!db) return [];

  let sql = "SELECT * FROM conversations WHERE 1=1";
  const params: any[] = [];

  if (opts.sessionId) {
    sql += " AND session_id = ?";
    params.push(opts.sessionId);
  }

  if (opts.filter?.content?.$contains) {
    sql += " AND content LIKE ?";
    params.push(`%${opts.filter.content.$contains}%`);
  }

  if (opts.orderBy?.timestamp === "desc") {
    sql += " ORDER BY timestamp DESC";
  } else {
    sql += " ORDER BY timestamp ASC";
  }

  if (opts.limit) {
    sql += " LIMIT ?";
    params.push(opts.limit);
  }

  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(rowToConversationMemory);
}

function querySemantic(opts: any): any[] {
  if (!db) return [];

  let sql = "SELECT * FROM semantic WHERE 1=1";
  const params: any[] = [];

  if (opts.sessionId) {
    sql += " AND session_id = ?";
    params.push(opts.sessionId);
  }

  if (opts.filter?.createdAt?.$lt) {
    sql += " AND created_at < ?";
    params.push(opts.filter.createdAt.$lt);
  }

  sql += " ORDER BY created_at DESC";

  if (opts.limit) {
    sql += " LIMIT ?";
    params.push(opts.limit);
  }

  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(rowToSemanticMemory);
}
```

---

## 5. File Changes Summary

### Files Modified (1 file)

| File | Change | Impact |
|------|--------|--------|
| `service/memory/db.ts` | Complete rewrite: Muninn -> bun:sqlite | **Only modified file** |

### Files Unchanged (verified no changes needed)

| File | Why Unchanged |
|------|---------------|
| `service/memory/episodic.ts` | Imports `saveConversationMemory`, `getSessionConversations`, `getMuninInstance` -- all signatures preserved |
| `service/memory/injection.ts` | Imports `findSimilarMemories` -- signature preserved |
| `service/claude/subprocess.ts` | Imports from `episodic.ts` and `injection.ts` -- no direct db.ts usage |
| `service/index.ts` | Imports `initializeMuninMemory` -- signature preserved |

### Files Added (0)

No new files required.

### Dependencies Removed

| Package | Reason |
|---------|--------|
| `muninn` | Replaced by bun:sqlite (built-in) |

The `package.json` should have `muninn` removed from dependencies. The `node_modules/muninn` directory can be cleaned up.

---

## 6. Migration Strategy

### 6.1 No Data Migration Needed

The Muninn package was broken and never worked in production. There is no existing data to migrate. The SQLite database will be created fresh on first run.

### 6.2 Rollout Steps

1. Rewrite `db.ts` with SQLite implementation
2. Remove `muninn` from `package.json`
3. Run `bun install` to clean lockfile
4. Run existing memory tests (should pass with real DB now)
5. Write new integration tests that exercise actual SQLite operations
6. Manual smoke test: start bot, send messages, verify memory persists across restarts

### 6.3 Rollback

If SQLite causes issues, `db.ts` can be reverted via git. No other files were changed.

---

## 7. Testing Strategy

### 7.1 Unit Tests for SQLite db.ts (NEW: `__tests__/sqlite-memory.test.ts`)

These tests use real SQLite (in-memory mode via `:memory:`) for fast, isolated testing.

```typescript
// Test categories:

describe("SQLite Memory - Initialization", () => {
  // 1. Creates database and tables on init
  // 2. Idempotent (calling init twice returns same instance)
  // 3. Creates directory if missing
});

describe("SQLite Memory - Conversations (Episodic)", () => {
  // 4. Insert conversation turn and get ID back
  // 5. Query by sessionId returns matching turns
  // 6. Query respects limit parameter
  // 7. Results ordered by timestamp DESC
  // 8. Metadata stored and retrieved as JSON
  // 9. Multiple sessions are isolated
});

describe("SQLite Memory - Semantic", () => {
  // 10. Insert semantic memory and get ID back
  // 11. Query by sessionId returns matching memories
  // 12. Update relevance score
  // 13. Decay old memories reduces scores
  // 14. Decay skips memories within age threshold
});

describe("SQLite Memory - FTS5 Semantic Search", () => {
  // 15. Finds memories matching topic keywords
  // 16. Finds memories matching summary keywords
  // 17. Ranks results by relevance (BM25)
  // 18. Filters by sessionId
  // 19. Respects limit parameter
  // 20. Fallback to LIKE when FTS5 match fails
  // 21. Handles special characters in query
  // 22. Returns empty array for no matches
});

describe("SQLite Memory - getMuninInstance Adapter", () => {
  // 23. .query("conversations", ...) works
  // 24. .query("semantic", ...) works
  // 25. .query with $contains filter works
  // 26. .query with $lt filter works
  // 27. .insert works for both collections
  // 28. .semanticSearch works
  // 29. .update works
  // 30. Throws if not initialized
});

describe("SQLite Memory - Stats & Cleanup", () => {
  // 31. getMemoryStats returns correct counts
  // 32. cleanupSessionMemory removes session data
});
```

**Total: ~32 test cases**

### 7.2 Test Isolation Pattern

```typescript
import { Database } from "bun:sqlite";
import { beforeEach, afterEach } from "bun:test";

let testDb: Database;

beforeEach(() => {
  // Use in-memory DB for test isolation
  testDb = new Database(":memory:");
  // Run schema creation
  // Inject testDb into module (via exported _setDbForTesting helper)
});

afterEach(() => {
  testDb.close();
});
```

We will add a `_setDbForTesting(db: Database | null)` export to `db.ts` that is only used by tests to inject an in-memory database. This avoids file I/O in tests and gives perfect isolation.

### 7.3 Existing Tests

The existing `memory.test.ts` tests (20 tests) are all pure unit tests that test formatting/tokenization logic without touching the database. They will continue to pass unchanged.

---

## 8. Implementation Checklist

Step-by-step execution order:

- [ ] **Step 1**: Rewrite `service/memory/db.ts`
  - Remove `import Muninn from "muninn"`
  - Add `import { Database } from "bun:sqlite"`
  - Add SQL schema constants (all CREATE TABLE/INDEX/TRIGGER statements)
  - Implement `initializeMuninMemory()` with SQLite setup
  - Implement `getMuninInstance()` returning adapter object
  - Implement `saveConversationMemory()` with INSERT
  - Implement `getSessionConversations()` with SELECT ... ORDER BY timestamp DESC
  - Implement `saveSemanticMemory()` with INSERT
  - Implement `findSimilarMemories()` with FTS5 MATCH + LIKE fallback
  - Implement `decayOldMemories()` with UPDATE
  - Implement `cleanupSessionMemory()` with DELETE
  - Implement `getMemoryStats()` with COUNT queries
  - Add `_setDbForTesting()` helper for test injection
  - Add helper functions: `rowToConversationMemory`, `rowToSemanticMemory`, `sanitizeFtsQuery`
  - Add helper functions: `queryConversations`, `querySemantic`, `insertConversation`, `insertSemantic`, `updateDocument`

- [ ] **Step 2**: Update `service/package.json`
  - Remove `muninn` from dependencies

- [ ] **Step 3**: Run `bun install` in service directory

- [ ] **Step 4**: Write `__tests__/sqlite-memory.test.ts`
  - All 32 test cases from Section 7.1
  - Use `:memory:` SQLite for isolation
  - Use `_setDbForTesting()` to inject test DB

- [ ] **Step 5**: Run all tests
  - `cd service && bun test` -- all tests should pass
  - Verify existing `memory.test.ts` still passes
  - Verify new `sqlite-memory.test.ts` passes

- [ ] **Step 6**: Manual smoke test
  - Start the Discord bot
  - Send a message
  - Verify `memory.db` file created in `$PAI_DIR/discord-remote-control/`
  - Send another message, verify context injection works
  - Restart bot, verify memories persist

- [ ] **Step 7**: Clean up
  - Remove `node_modules/muninn` if needed
  - Update MEMORY.md with Phase 3 revised status

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| FTS5 not available in Bun's SQLite | Very Low | High | FTS5 is compiled into all standard SQLite builds including Bun's. Fallback to LIKE exists anyway. |
| Row mapper misses a field | Low | Medium | Tests cover all fields explicitly |
| Concurrent access from multiple bot instances | Low | Low | WAL mode handles this. Single bot instance expected. |
| Large conversation histories slow queries | Low | Low | Indexes on session_id + timestamp. LIMIT always applied. |
| FTS5 trigger sync fails | Very Low | Medium | Content-sync triggers are the standard FTS5 pattern. Tests verify sync. |

---

## 10. Performance Expectations

| Operation | Expected Performance |
|-----------|---------------------|
| Insert conversation turn | < 1ms |
| Query 10 recent turns | < 1ms |
| FTS5 semantic search | < 5ms for < 10K records |
| Decay old memories | < 10ms (single UPDATE) |
| Database initialization | < 50ms (table creation is fast) |

SQLite with WAL mode and proper indexes will be significantly faster than Muninn's JSON-file-based approach would have been. The bottleneck in the Discord Remote Control pipeline is the Claude subprocess (seconds), not memory operations (microseconds).

---

## 11. Summary

This is a clean, surgical replacement:

- **1 file rewritten**: `db.ts` (Muninn -> bun:sqlite)
- **0 files modified**: All consumers keep working via preserved function signatures
- **1 dependency removed**: `muninn` npm package
- **0 dependencies added**: `bun:sqlite` is built-in
- **32 new tests**: Comprehensive coverage of all SQLite operations
- **20 existing tests**: Unchanged and still passing
- **FTS5 semantic search**: Real relevance ranking via BM25, with LIKE fallback
