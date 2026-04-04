-- Migration 003: Add project column to semantic memories
-- Enables project-scoped memory isolation so work across distinct projects
-- doesn't get confused in session briefings and context injection.

ALTER TABLE semantic ADD COLUMN project TEXT NOT NULL DEFAULT 'sam';

-- Index for fast project-scoped queries
CREATE INDEX IF NOT EXISTS idx_semantic_project ON semantic (project, created_at DESC);

-- Composite index for project + topic lookups (used by consolidation and dedup)
CREATE INDEX IF NOT EXISTS idx_semantic_project_topic ON semantic (project, topic);
