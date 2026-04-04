#!/usr/bin/env bun
/**
 * Retroactive population of agent_invocations and skill_invocations tables.
 * Scans: conversations table, semantic memories, History files, and project dirs.
 */

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import path from "path";

const HOME = process.env.HOME || "";
const PAI_DIR = process.env.PAI_DIR || path.join(HOME, ".claude");
// Runtime DB is at $PAI_DIR/discord-remote-control/memory.db (where the server opens it)
const DB_PATH = path.join(PAI_DIR, "discord-remote-control", "memory.db");

// Known agents from $PAI_DIR/agents/
const KNOWN_AGENTS = new Set(
  readdirSync(path.join(PAI_DIR, "agents"))
    .filter(e => {
      try { return statSync(path.join(PAI_DIR, "agents", e)).isDirectory(); } catch { return false; }
    })
    .map(e => e.toLowerCase())
);
// Add built-in agents
["general-purpose", "explore", "plan"].forEach(a => KNOWN_AGENTS.add(a));

// Known skills from $PAI_DIR/skills/
const KNOWN_SKILLS = new Set(
  readdirSync(path.join(PAI_DIR, "skills"))
    .filter(e => {
      try { return statSync(path.join(PAI_DIR, "skills", e)).isDirectory(); } catch { return false; }
    })
    .map(e => e.toLowerCase())
);
// Add native Claude Code skills
["batch", "claude-api", "claude-in-chrome", "debug", "keybindings-help", "loop", "schedule", "simplify", "update-config"].forEach(s => KNOWN_SKILLS.add(s));

console.log(`Known agents (${KNOWN_AGENTS.size}):`, [...KNOWN_AGENTS].join(", "));
console.log(`Known skills (${KNOWN_SKILLS.size}):`, [...KNOWN_SKILLS].join(", "));

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode=WAL");

// Ensure tables exist
try {
  db.exec(`CREATE TABLE IF NOT EXISTS agent_invocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    success INTEGER DEFAULT 1,
    duration_ms INTEGER,
    trigger_context TEXT,
    notes TEXT
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS skill_invocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    success INTEGER DEFAULT 1,
    duration_ms INTEGER,
    mode TEXT,
    manual_override INTEGER DEFAULT 0,
    notes TEXT,
    trigger_context TEXT
  )`);
} catch (e) {
  console.log("Tables already exist or creation skipped:", e);
}

// Clear existing data for clean backfill
console.log("\nClearing existing invocation data for clean backfill...");
db.exec("DELETE FROM agent_invocations");
db.exec("DELETE FROM skill_invocations");

const agentCounts = new Map<string, number>();
const skillCounts = new Map<string, number>();

function detectAgentsInText(text: string, timestamp: number): void {
  const lower = text.toLowerCase();

  for (const agent of KNOWN_AGENTS) {
    const patterns = [
      `subagent_type: "${agent}"`,
      `subagent_type:"${agent}"`,
      `subagent_type: '${agent}'`,
      `subagent_type="${agent}"`,
      `${agent} agent`,
      `${agent} subagent`,
      `the **${agent}** agent`,
      `"subagent_type":"${agent}"`,
    ];

    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1);
        break; // Only count once per text block per agent
      }
    }
  }
}

function detectSkillsInText(text: string, timestamp: number): void {
  const lower = text.toLowerCase();

  for (const skill of KNOWN_SKILLS) {
    const patterns = [
      `/${skill}`,
      `skill: "${skill}"`,
      `skill:"${skill}"`,
      `the **${skill}** skill`,
      `${skill} skill`,
      `Skill(${skill})`,
    ];

    // Special patterns for specific skills
    if (skill === "fabric") {
      patterns.push("fabric:", "fabric pattern");
    }

    for (const pattern of patterns) {
      if (lower.includes(pattern.toLowerCase())) {
        skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
        break;
      }
    }
  }

  // Detect fabric:[pattern] specifically
  const fabricMatches = text.matchAll(/fabric[:\s]+(\w[\w_-]{2,})/gi);
  for (const match of fabricMatches) {
    const pattern = match[1].toLowerCase();
    if (!["the", "skill", "native", "pattern", "patterns", "cli", "pattern", "for"].includes(pattern)) {
      skillCounts.set("fabric", (skillCounts.get("fabric") || 0) + 1);
    }
  }
}

// ── Source 1: Conversations table ──
console.log("\n📊 Scanning conversations table...");
try {
  const rows = db.query("SELECT content, timestamp, role FROM conversations ORDER BY timestamp").all() as any[];
  console.log(`  Found ${rows.length} conversation entries`);
  for (const row of rows) {
    if (row.content) {
      detectAgentsInText(row.content, row.timestamp);
      detectSkillsInText(row.content, row.timestamp);
    }
  }
} catch (e) {
  console.warn("  Could not scan conversations:", e);
}

// ── Source 2: Semantic memories ──
console.log("📊 Scanning semantic memories...");
try {
  const rows = db.query("SELECT summary, created_at FROM semantic ORDER BY created_at").all() as any[];
  console.log(`  Found ${rows.length} semantic entries`);
  for (const row of rows) {
    if (row.summary) {
      const ts = new Date(row.created_at).getTime();
      detectAgentsInText(row.summary, ts);
      detectSkillsInText(row.summary, ts);
    }
  }
} catch (e) {
  console.warn("  Could not scan semantic:", e);
}

// ── Source 3: History files ──
console.log("📊 Scanning History files...");
const historyBase = path.join(PAI_DIR, "History");
function scanHistoryDir(dirPath: string, depth = 0): void {
  if (depth > 3) return;
  try {
    const entries = readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          scanHistoryDir(fullPath, depth + 1);
        } else if (entry.endsWith(".md") || entry.endsWith(".txt")) {
          const content = readFileSync(fullPath, "utf-8");
          const ts = stat.mtimeMs;
          detectAgentsInText(content, ts);
          detectSkillsInText(content, ts);
        }
      } catch { /* skip unreadable files */ }
    }
  } catch { /* skip unreadable dirs */ }
}

if (existsSync(historyBase)) {
  scanHistoryDir(historyBase);
}

// ── Source 4: Project session files ──
console.log("📊 Scanning project session files...");
const projectsBase = path.join(PAI_DIR, "projects");
if (existsSync(projectsBase)) {
  try {
    const projectDirs = readdirSync(projectsBase);
    for (const projDir of projectDirs) {
      const projPath = path.join(projectsBase, projDir);
      try {
        if (!statSync(projPath).isDirectory()) continue;
        // Check for session files, memory files, etc.
        const scanDirs = ["memory", "sessions", ""];
        for (const sub of scanDirs) {
          const scanPath = sub ? path.join(projPath, sub) : projPath;
          if (!existsSync(scanPath)) continue;
          try {
            const files = readdirSync(scanPath);
            for (const f of files) {
              if (f.endsWith(".md") || f.endsWith(".txt") || f.endsWith(".json")) {
                try {
                  const content = readFileSync(path.join(scanPath, f), "utf-8");
                  detectAgentsInText(content, Date.now());
                  detectSkillsInText(content, Date.now());
                } catch { /* skip */ }
              }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  } catch (e) {
    console.warn("  Could not scan projects:", e);
  }
}

// ── Insert results ──
console.log("\n📝 Inserting agent invocations...");
const insertAgent = db.prepare(
  "INSERT INTO agent_invocations (agent_name, timestamp, success, trigger_context, notes) VALUES (?, ?, 1, ?, ?)"
);
const now = Date.now();
const sortedAgents = [...agentCounts.entries()].sort((a, b) => b[1] - a[1]);
for (const [agent, count] of sortedAgents) {
  // Insert individual records spread across time for a more realistic distribution
  for (let i = 0; i < count; i++) {
    const ts = now - (count - i) * 3600000; // spread over hours
    insertAgent.run(agent, ts, "backfill-retroactive", `Retroactive detection from content scan`);
  }
  console.log(`  ${agent}: ${count} occurrences`);
}

console.log("\n📝 Inserting skill invocations...");
const insertSkill = db.prepare(
  "INSERT INTO skill_invocations (skill_name, timestamp, success, trigger_context, notes) VALUES (?, ?, 1, ?, ?)"
);
const sortedSkills = [...skillCounts.entries()].sort((a, b) => b[1] - a[1]);
for (const [skill, count] of sortedSkills) {
  for (let i = 0; i < count; i++) {
    const ts = now - (count - i) * 3600000;
    insertSkill.run(skill, ts, "backfill-retroactive", `Retroactive detection from content scan`);
  }
  console.log(`  ${skill}: ${count} occurrences`);
}

// Summary
console.log("\n✅ Backfill complete!");
console.log(`  Agents: ${sortedAgents.length} unique, ${[...agentCounts.values()].reduce((a, b) => a + b, 0)} total records`);
console.log(`  Skills: ${sortedSkills.length} unique, ${[...skillCounts.values()].reduce((a, b) => a + b, 0)} total records`);

db.close();
