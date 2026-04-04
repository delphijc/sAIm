# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sam** is an open-source template for building AI-powered personal operating systems on top of Claude Code. It transforms Claude Code from a chatbot into a structured personal AI system with memory, skills, automation, and multi-agent orchestration. The `.agent/` directory is symlinked to `~/.claude`, so it is loaded automatically by Claude Code.

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

### 4. Task Runner (`.agent/task_runner/`)
JSONL-based job queue (`jobs.jsonl`, `todo.jsonl`, `done.jsonl`) with multi-LLM support (Claude, Gemini, Ollama, Qwen) and git worktree isolation for sandboxed execution.

### 5. History / UOCS (`.agent/History/`)
Universal Output Capture System — hooks auto-save valuable work with structured filenames:
`YYYY-MM-DD-HHMMSS_[PROJECT]_[TYPE]_[HIERARCHY]_[DESCRIPTION].md`

### 6. Infrastructure Services (`.agent/services/`)
Optional systemd services under `pai-infrastructure.target`:

| Service | Port | Purpose |
|---------|------|---------|
| voice-server | 8888 | ElevenLabs TTS |
| observability-dashboard | 5172 | Real-time agent monitoring (React/Bun) |
| discord-remote-control | — | Discord bot interface |
| awareness-dashboard-server | 4100 | Awareness backend |
| awareness-dashboard-client | 5173 | Vue/Vite frontend |

```bash
systemctl --user status pai-infrastructure.target
journalctl --user -u voice-server.service -n 20 --no-pager
```

## Git Isolation (Critical)

Strict isolation prevents cross-pollination between sibling projects in `~/Projects/`.

Before any git operation:
1. Verify repo root: `git rev-parse --show-toplevel`
2. Verify remote: `git remote get-url origin`
3. Never `git add .` or `git add -A`
4. Run `bun .claude/hooks/validate-protected.ts --staged` before committing
5. `.sam-protected.json` defines forbidden patterns (API keys, emails, private paths)

## Two-Repository Security Model

- **Private setup (`~/.claude/`)** — contains secrets, personal data, voice IDs. NEVER public.
- **Public Sam repo** — sanitized template only. No personal data, no API keys.

`.sam-protected.json` is the manifest enforcing this boundary. The `validate-protected.ts` pre-commit hook checks staged files against it.

## CLI Development Convention

New tools follow a **CLI-first** pipeline: Requirements → CLI Tool → Prompting Layer → Agent Orchestration.

Default to **Tier 1 (llcli-style)**: manual arg parsing, zero external dependencies. Use Commander.js only for complex subcommands.

## Key Reference Files

| File | Purpose |
|------|---------|
| `.agent/CLAUDE.md` | Quick startup reference loaded by Claude Code |
| `.agent/CLAUDE-REFERENCE.md` | Full project reference guide |
| `.agent/skills/CORE/CONSTITUTION.md` | Foundational philosophy |
| `.agent/wiki/architecture.md` | Detailed technical architecture |
| `.agent/settings.json` | Hook definitions and global config |
| `.sam-protected.json` | Protected files manifest |
