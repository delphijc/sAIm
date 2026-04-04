-- Migration 002: Add tags column to semantic memory
-- Enables classification of facts as pain-point, preference, anti-pattern, etc.
-- The retrospective skill uses tags to cluster and analyze patterns.

ALTER TABLE semantic ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';

-- Index for tag-based queries (JSON array stored as TEXT)
CREATE INDEX IF NOT EXISTS idx_semantic_tags ON semantic (tags);

-- Skill invocations table: tracks which skills get used, their outcomes,
-- and where manual workarounds happen (feeds into retrospective analytics)
CREATE TABLE IF NOT EXISTS skill_invocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    success INTEGER NOT NULL DEFAULT 1,
    duration_ms INTEGER,
    mode TEXT,
    manual_override INTEGER NOT NULL DEFAULT 0,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_skill_invocations_name
    ON skill_invocations (skill_name, timestamp DESC);

-- Retrospective outputs table: stores generated retrospective reports
-- so they can be referenced and don't need to be regenerated
CREATE TABLE IF NOT EXISTS retrospectives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    summary TEXT NOT NULL,
    recommendations TEXT NOT NULL DEFAULT '[]',
    memory_count INTEGER NOT NULL DEFAULT 0,
    patterns_found INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_retrospectives_timestamp
    ON retrospectives (timestamp DESC);
