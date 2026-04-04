-- Muninn Cognitive Memory System - Initial Schema
-- Non-destructive, idempotent DDL for SQLite

-- Episodic memory: conversation turn history
CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id  TEXT NOT NULL,
    discord_user_id    TEXT NOT NULL,
    discord_channel_id TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    timestamp   INTEGER NOT NULL,
    metadata    TEXT DEFAULT '{}',
    source TEXT NOT NULL DEFAULT 'discord'
);

CREATE INDEX IF NOT EXISTS idx_conversations_session
    ON conversations (session_id, timestamp DESC);

-- Semantic memory: fact storage with ACT-R activation
CREATE TABLE IF NOT EXISTS semantic (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id      TEXT NOT NULL,
    topic           TEXT NOT NULL,
    summary         TEXT NOT NULL,
    relevance_score REAL NOT NULL DEFAULT 1.0,
    created_at      INTEGER NOT NULL,
    source_message_ids TEXT DEFAULT '[]',
    access_count INTEGER NOT NULL DEFAULT 0,
    last_access INTEGER,
    confidence REAL NOT NULL DEFAULT 0.5,
    source TEXT NOT NULL DEFAULT 'discord',
    project TEXT NOT NULL DEFAULT 'sam'
);

CREATE INDEX IF NOT EXISTS idx_semantic_project ON semantic (project, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_semantic_project_topic ON semantic (project, topic);

-- Full-text search index for semantic topics and summaries
CREATE VIRTUAL TABLE IF NOT EXISTS semantic_fts USING fts5(
    topic,
    summary,
    content='semantic',
    content_rowid='rowid'
);

-- FTS5 INSERT trigger: maintains FTS index on semantic table inserts
CREATE TRIGGER IF NOT EXISTS semantic_ai AFTER INSERT ON semantic BEGIN
    INSERT INTO semantic_fts(rowid, topic, summary)
    VALUES (new.rowid, new.topic, new.summary);
END;

-- FTS5 DELETE trigger: maintains FTS index on semantic table deletes
CREATE TRIGGER IF NOT EXISTS semantic_ad AFTER DELETE ON semantic BEGIN
    INSERT INTO semantic_fts(semantic_fts, rowid, topic, summary)
    VALUES ('delete', old.rowid, old.topic, old.summary);
END;

-- FTS5 UPDATE trigger: maintains FTS index on semantic table updates
CREATE TRIGGER IF NOT EXISTS semantic_au AFTER UPDATE ON semantic BEGIN
    INSERT INTO semantic_fts(semantic_fts, rowid, topic, summary)
    VALUES ('delete', old.rowid, old.topic, old.summary);
    INSERT INTO semantic_fts(rowid, topic, summary)
    VALUES (new.rowid, new.topic, new.summary);
END;

-- Hebbian associations: weighted links between co-retrieved memories
CREATE TABLE IF NOT EXISTS associations (
    source_id TEXT NOT NULL REFERENCES semantic(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES semantic(id) ON DELETE CASCADE,
    weight REAL NOT NULL DEFAULT 0.1,
    co_activation_count INTEGER NOT NULL DEFAULT 1,
    last_activated INTEGER NOT NULL,
    PRIMARY KEY (source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_associations_source
    ON associations (source_id, weight DESC);
