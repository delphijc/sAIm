-- Migration 004: Add agent_invocations table
-- Tracks which agents get used, their outcomes, and duration.
-- Combined with skill_invocations, gives full picture of tool utilization
-- for informed pruning decisions.

CREATE TABLE IF NOT EXISTS agent_invocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    success INTEGER NOT NULL DEFAULT 1,
    duration_ms INTEGER,
    trigger_context TEXT,  -- what prompted the agent invocation
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_invocations_name
    ON agent_invocations (agent_name, timestamp DESC);

-- Add trigger_context column to skill_invocations for better tracking
-- (what user action or pattern triggered the skill)
ALTER TABLE skill_invocations ADD COLUMN trigger_context TEXT;
