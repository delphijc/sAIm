-- Migration: Muninn Cognitive Architecture Upgrade
-- Adds ACT-R activation scoring, Bayesian confidence, and Hebbian associations
-- Non-destructive: preserves existing data, adds new fields with safe defaults

-- Semantic table: Add ACT-R and confidence fields
ALTER TABLE semantic ADD COLUMN access_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE semantic ADD COLUMN last_access INTEGER;
ALTER TABLE semantic ADD COLUMN confidence REAL NOT NULL DEFAULT 0.5;
ALTER TABLE semantic ADD COLUMN source TEXT NOT NULL DEFAULT 'discord';

-- Conversations table: Add source tracking
ALTER TABLE conversations ADD COLUMN source TEXT NOT NULL DEFAULT 'discord';

-- Backfill: Initialize last_access from created_at where null
UPDATE semantic SET last_access = created_at WHERE last_access IS NULL;

-- Hebbian associations table: Weighted links between related memories
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

-- FTS5 Triggers: Ensure index consistency on delete/update operations
CREATE TRIGGER IF NOT EXISTS semantic_ad AFTER DELETE ON semantic BEGIN
    INSERT INTO semantic_fts(semantic_fts, rowid, topic, summary)
    VALUES ('delete', old.id, old.topic, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS semantic_au AFTER UPDATE ON semantic BEGIN
    INSERT INTO semantic_fts(semantic_fts, rowid, topic, summary)
    VALUES ('delete', old.id, old.topic, old.summary);
    INSERT INTO semantic_fts(rowid, topic, summary)
    VALUES (new.id, new.topic, new.summary);
END;
