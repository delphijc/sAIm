# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**sAIm** is an open-source template for building AI-powered personal operating systems on top of Claude Code. It transforms Claude Code from a chatbot into a structured personal AI system with memory, skills, automation, and multi-agent orchestration. The `.agent/` directory is symlinked to `~/.claude`, so it is loaded automatically by Claude Code.

## Runtime & Tooling

- **Runtime:** Bun (NOT Node.js) — TypeScript files run directly via `bun`, no compilation step
- **Language:** TypeScript with strict mode (`tsconfig.json` has `strict: true`)
- **No ESLint/Prettier** — TypeScript strict mode is the primary quality gate

```bash
# Type-check a service
cd .agent/skills/observability/apps/server && bun run lint  # runs: tsc --noEmit

# Run a hook directly
bun ~/.claude/hooks/<hook-name>.ts

# Health check
bun ~/.claude/hooks/self-test.ts
```

There is no global test suite. Individual services may have `bun test` available.

## Architecture

The system is built in layers, all living under `.agent/` (symlinked to `~/.claude`):

### 1. Hooks (`.agent/hooks/`)
TypeScript scripts triggered by Claude Code lifecycle events: `SessionStart`, `SessionEnd`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `PreCompact`, `UserPromptSubmit`. Hook bindings are defined in `.agent/settings.json`. All hooks resolve paths via `$PAI_DIR` env var (falls back to `~/.claude`).

Key hooks: `load-core-context.ts` (loads CORE skill on session start), `stop-hook.ts` (voice notification), `security-validator.ts` (tool safety gate), `capture-all-events.ts` (interaction logging).

### 2. Skills (`.agent/skills/`)
Self-contained capability packages. Each skill activates based on "USE WHEN" clauses in its YAML frontmatter. Skills use a three-tier progressive disclosure model:
- **Tier 1:** YAML frontmatter metadata (~200–500 tokens, always active)
- **Tier 2:** `SKILL.md` body (~500–2000 lines, loaded on demand)
- **Tier 3:** `Reference.md` and deep-dive docs (just-in-time)

**Mandatory skill structure:**
```
SkillName/          ← TitleCase directory
├── SKILL.md        ← UPPERCASE filename, contains YAML frontmatter with USE WHEN
├── Reference.md    ← Extended docs (Tier 2)
├── workflows/      ← TitleCase .md files
└── tools/          ← TitleCase .ts files, even if empty
```

### 3. Agents (`.agent/agents/`)
27 specialized AI personas (engineer, architect, researcher, pentester, etc.) defined as YAML with `model`, `color`, `voiceId`, and `permissions`. Agents support sequential, parallel, nested, and spotcheck delegation patterns.

### 4. History / UOCS (`.agent/History/`)
Universal Output Capture System — hooks auto-save valuable work with structured filenames:
`YYYY-MM-DD-HHMMSS_[PROJECT]_[TYPE]_[HIERARCHY]_[DESCRIPTION].md`

### 5. Infrastructure Services (`.agent/skills/` and `.agent/services/`)
Optional background services for monitoring, dashboards, and remote access:

| Service | Port | Location | Purpose |
|---------|------|----------|---------|
| service-monitor-dashboard | 6000 (server), 5175 (client) | `.agent/skills/service-monitor-dashboard` | Real-time PAI service monitoring |
| observability-dashboard | 5172 | `.agent/services/observability-dashboard` | Real-time agent activity monitoring |
| discord-remote-control | — | `.agent/skills/discord-remote-control/service` | Discord bot interface (optional client) |

### 6. Standalone Optional Dependencies

sAIm integrates with standalone projects that are installed separately:

| Dependency | Location | Port(s) | Purpose | Integration |
|-----------|----------|---------|---------|---|
| **memory-system** | `~/Projects/memory-system` | 4242 | Semantic memory database for persistent knowledge extraction and graph-based retrieval | `ENABLE_MEMORY_HOOKS=true` in `.agent/.env` |
| **voice-server** | `~/Projects/voice-server` | 8888 | Text-to-speech via HTTP API | `setup.sh` installs via symlink |
| **awareness-dashboard** | `~/Projects/awareness` | 4100, 5173 | Awareness operations & briefings backend + frontend | `setup.sh` installs via symlink |

**Code & Service Management Model:**
- **Code repositories:** Both `voice-server` and `awareness-dashboard` are **independent git repositories** with separate release cycles
- **Service management:** Launchd (macOS) and systemd (Linux) service definitions are **centralized in this project** (`.agent/services/`) for consistency and simplified deployment
- **Integration:** When installed via `setup.sh`, they are symlinked into `.agent/services/` and monitored by the service-monitor-dashboard (metrics & restart controls)

**Service Management (Centralized via sAIm):**

On macOS:
```bash
# Use sAIm's startup scripts
.agent/services/voice-server/start.sh
.agent/services/awareness-dashboard/start.sh
```

On Linux:
```bash
systemctl --user status pai-infrastructure.target
systemctl --user restart voice-server
systemctl --user restart awareness-dashboard-server
journalctl --user -u voice-server.service -n 20 --no-pager
```

Services are grouped under `pai-infrastructure.target` for unified lifecycle management.

## Memory System Integration (Optional)

**sAIm works perfectly without the memory system.** Semantic memory extraction and management are entirely optional and controlled via environment variables.

### Architecture

The memory-system is a **completely standalone project** (`~/Projects/memory-system/`) with its own repository, code, and lifecycle. It is the **authoritative backend** for all semantic memory operations.

```
sAIm Project
├── .agent/hooks/memory-capture.ts
│   └─ Checks: ENABLE_MEMORY_HOOKS=true?
│       ├─ Yes → HTTP call to memory-system API (localhost:4242)
│       └─ No  → Skip memory extraction (default)
│
└── .agent/skills/discord-remote-control/service/
    └─ Memory retrieval (optional, only if memory-system is enabled)
        └─ HTTP calls to memory-system API for semantic context

Memory System Project (memory-system) [AUTHORITATIVE BACKEND]
├─ src/memory/
│   ├─ db.ts (SQLite database layer)
│   ├─ extraction.ts (fact extraction engine - 12 patterns)
│   ├─ consolidation.ts (duplicate detection & pruning)
│   ├─ graph.ts (association graph queries - Hebbian learning)
│   ├─ associations.ts (temporal + topic-based linking)
│   └─ [semantic memory logic]
│
└─ services/
    └─ HTTP server on port 4242
        ├─ POST /memory/extract (fact extraction)
        ├─ POST /memory/consolidation/run (weekly cleanup)
        ├─ POST /memory/journal/generate (briefings)
        ├─ GET /memory/search (hybrid search)
        └─ GET /api/graph (graph visualization)
```

### Separation of Concerns

**Discord-remote-control does NOT own memory logic:**
- Maintains only **episodic memory** (recent conversation history) in local SQLite
- Does NOT extract facts, build associations, or consolidate memories
- Is an **optional client** that can retrieve semantic context from memory-system API
- Continues functioning normally if memory-system is disabled or unavailable

**Memory-system owns all semantic memory operations:**
- Fact extraction from conversation transcripts (12 extraction patterns)
- Association building (temporal proximity + topic clustering)
- Consolidation cycles (deduplication, noise pruning, insights surfacing)
- Graph queries (neighbor discovery, path finding, community detection)
- Database health management (ACT-R activation, Hebbian learning)

### Setup

Memory extraction is **disabled by default**. To enable:

1. Ensure memory-system is installed: `~/Projects/memory-system/`
2. Start the memory service: `cd ~/Projects/memory-system && bun run start`
3. Enable in sAIm: Add to `.agent/.env`:
   ```bash
   ENABLE_MEMORY_HOOKS=true
   MEMORY_SERVICE_URL=http://localhost:4242
   ```
4. Restart Claude Code session

### Behavior

- **When disabled** (`ENABLE_MEMORY_HOOKS=false`, default):
  - sAIm works standalone
  - No external dependencies
  - Session transcripts captured normally, no semantic memory extraction
  - Discord-remote-control stores only episodic memory (recent messages)
  
- **When enabled** (`ENABLE_MEMORY_HOOKS=true`):
  - Each session extracts semantic facts automatically via hook
  - Facts persist in memory-system database
  - Discord-remote-control can optionally retrieve semantic context
  - If memory service is unavailable, sAIm logs a warning and continues (graceful degradation)

### Key Points

- **No tight coupling:** sAIm's core functionality does not depend on memory-system
- **Independent evolution:** Memory-system owns all semantic memory logic; can change without affecting discord-remote-control
- **Clear boundaries:** discord-remote-control is a Discord bot interface, NOT a memory manager
- **Fail-safe integration:** If memory service crashes, all components continue normally
- **Separated codebases:** Memory implementation lives exclusively in memory-system project
- **Env-var controlled:** Turn memory on/off without code changes

For detailed memory-system documentation, see `~/Projects/memory-system/README.md`.
For discord-remote-control documentation, see `.agent/skills/discord-remote-control/SKILL.md`.

## Git Isolation (Critical)

Strict isolation prevents cross-pollination between sibling projects in `~/Projects/`.

Before any git operation:
1. Verify repo root: `git rev-parse --show-toplevel`
2. Verify remote: `git remote get-url origin`
3. Never `git add .` or `git add -A`
4. Run `bun .claude/hooks/validate-protected.ts --staged` before committing
5. `.saim-protected.json` defines forbidden patterns (API keys, emails, private paths)

## Two-Repository Security Model

- **Private setup (`~/.claude/`)** — contains secrets, personal data, voice IDs. NEVER public.
- **Public sAIm repo** — sanitized template only. No personal data, no API keys.

`.saim-protected.json` is the manifest enforcing this boundary. The `validate-protected.ts` pre-commit hook checks staged files against it.

## CLI Development Convention

New tools follow a **CLI-first** pipeline: Requirements → CLI Tool → Prompting Layer → Agent Orchestration.

Default to **Tier 1 (llcli-style)**: manual arg parsing, zero external dependencies. Use Commander.js only for complex subcommands.

## Key Reference Files

| File | Purpose |
|------|---------|
| `.agent/CLAUDE.md` | Quick startup reference loaded by Claude Code |
| `.agent/claude-reference.md` | Full project reference guide |
| `.agent/skills/CORE/constitution.md` | Foundational philosophy |
| `.agent/wiki/architecture.md` | Detailed technical architecture |
| `.agent/settings.json` | Hook definitions and global config |
| `.saim-protected.json` | Protected files manifest |
