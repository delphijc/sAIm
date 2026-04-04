# Sam Architecture

This document explains how Sam is built and how its components work together.

---

## Overview

Sam follows a **Skills-as-Containers** architecture with event-driven automation. It transforms Claude Code into a full personal AI system through layered abstractions.

```
┌─────────────────────────────────────────────────────────────┐
│                        USER                                 │
├─────────────────────────────────────────────────────────────┤
│                    CLAUDE CODE                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    HOOKS                              │  │
│  │  SessionStart → Load CORE → Route to Skills          │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    SKILLS                             │  │
│  │  28+ capabilities with routing, workflows, tools      │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    AGENTS                             │  │
│  │  10 specialized personas for delegation              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 TASK RUNNER                           │  │
│  │  Job queue, multi-LLM backends, dashboard            │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE                           │
│  Voice Server │ History System │ MCP Integrations          │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Skills System

Skills are the atomic units of capability in Sam. Each skill is a self-contained package:

```
SkillName/
├── SKILL.md           # Definition with YAML frontmatter
├── Reference.md       # Extended documentation (Tier 2)
├── workflows/         # Execution procedures
│   └── Create.md
├── tools/             # CLI tools
│   └── tool.ts
└── templates/         # Optional templates
```

**Key Concepts:**
- **USE WHEN clause** - Triggers skill activation
- **Progressive Disclosure** - 3-tier context loading
- **TitleCase naming** - Convention for all files/directories

### 2. Agents System

Agents are specialized AI personas with specific capabilities:

```yaml
# Agent definition
---
name: engineer
description: Software engineering specialist
model: sonnet
color: green
voiceId: Tom
permissions:
  allow: [Bash, Read, Write, Edit]
---
```

**Delegation Patterns:**
- Sequential: Main → Agent → Complete
- Parallel: Main → [Agent1, Agent2, Agent3] → Synthesize
- Nested: Main → Architect → Engineer → Verify

### 3. Hooks System

Hooks are TypeScript scripts triggered by lifecycle events:

| Hook Type | Trigger | Purpose |
|-----------|---------|---------|
| `SessionStart` | Session begins | Load CORE context |
| `SessionEnd` | Session ends | Generate summaries |
| `PreToolUse` | Before tool | Security validation |
| `PostToolUse` | After tool | Capture output |
| `Stop` | Response complete | Voice notification |
| `SubagentStop` | Agent completes | Tracking |

### 4. Task Runner

The job orchestration engine with:

- **JSONL Queues** - jobs.jsonl, todo.jsonl, done.jsonl
- **Multi-LLM Backends** - Claude, Gemini, Ollama, Qwen
- **Git Isolation** - Worktree-based sandboxing
- **React Dashboard** - Real-time monitoring UI

### 5. Voice Server

Text-to-speech integration:

- **Endpoint**: `http://localhost:8888/notify`
- **Provider**: ElevenLabs (configurable)
- **Trigger**: Automatic on response completion

---

## Data Flow

### Request Processing

```
User Input
    │
    ▼
┌─────────────────┐
│ Claude Code CLI │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SessionStart   │──► Load CORE context
│     Hook        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Skill Routing   │──► Match intent to skill
│   (USE WHEN)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Skill Execution │──► Apply workflows/tools
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Stop Hook     │──► Voice notification
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ History Capture │──► Save to UOCS
└─────────────────┘
```

### Job Orchestration

```
Job Submission (Dashboard/API)
    │
    ▼
┌─────────────────┐
│  jobs.jsonl     │  Pending queue
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Queue Monitor   │  jobs_queue_monitor.sh
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Git Worktree    │  Isolated sandbox
│   Creation      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backend Runner  │  Claude/Gemini/Ollama/Qwen
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Result Capture  │  done.jsonl / failed.jsonl
└─────────────────┘
```

---

## Progressive Disclosure

Sam uses a 3-tier context loading system for token efficiency:

### Tier 1: System Prompt (Always Active)
- Skill YAML frontmatter (~200-500 words)
- USE WHEN triggers
- Loaded at session start

### Tier 2: SKILL.md Body (On-Demand)
- Main reference content (~500-2000 lines)
- Workflows and routing logic
- Loaded when skill activated

### Tier 3: Reference Files (Just-In-Time)
- Deep-dive documentation
- Loaded only when specific detail needed
- Examples: CONSTITUTION.md, HookSystem.md

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Language | TypeScript |
| Package Manager | Bun |
| Frontend | React + Vite |
| Backend | Bun HTTP Server |
| Data Format | JSONL |
| Testing | Vitest, BATS |
| Voice | ElevenLabs API |

**Mandatory Choices:**
- Bun over Node.js
- TypeScript over Python (for infrastructure)
- Markdown over HTML
- JSONL over SQLite (for simplicity)

---

## Security Architecture

### Two Repository Model

```
Sam Public (this repo)          Private Setup (~/.claude)
├── Sanitized template          ├── API keys
├── Example configurations      ├── Personal data
├── Community skills            ├── Custom workflows
└── Generic documentation       └── Private integrations
```

### Protected Files
- `SAM_CONTRACT.md`
- `README.md`
- `.env.example`
- `SECURITY.md`

### Security Features
- Pre-commit validation via `validate-protected.ts`
- Prompt injection defense (external content READ-ONLY)
- Input sanitization for shell commands

---

## File Organization

### Directory Structure

```
.agent/
├── skills/           # Skill definitions (28+)
├── agents/           # Agent configurations (10)
├── hooks/            # Lifecycle hooks (24)
├── Tools/            # CLI utilities
├── voice-server/     # TTS system
├── History/          # UOCS archives
├── projects/         # Multi-project state
├── session-env/      # Per-session state
├── settings.json     # Global configuration
└── .env              # API keys (never commit)
```

### Naming Conventions

| Pattern | Description |
|---------|-------------|
| TitleCase | Directories and files |
| SKILL.md | Main skill definition (uppercase) |
| *.jsonl | Newline-delimited JSON |
| *.ts | TypeScript scripts |
| *.sh | Shell scripts |

---

## Integration Points

### MCP (Model Context Protocol)

Sam integrates with MCP servers for extended capabilities:
- Bright Data for web scraping
- Custom MCP servers for specialized tools

### External Services

| Service | Purpose | Required Key |
|---------|---------|--------------|
| ElevenLabs | Voice synthesis | ELEVENLABS_API_KEY |
| Perplexity | Web research | PERPLEXITY_API_KEY |
| Google | Gemini research | GOOGLE_API_KEY |
| Bright Data | Web scraping | BRIGHTDATA_API_KEY |

---

## Performance Considerations

### Context Management
- Progressive disclosure reduces token usage
- Skills load only when needed
- Tier 3 content loaded just-in-time

### Job Processing
- Git worktrees provide isolation without full clones
- JSONL files enable simple, fast persistence
- SSE streaming for real-time updates

### Voice Latency
- Async voice notifications
- Background processing
- Configurable voice settings

---

*See also: [Skills System](Skills-System.md) | [Hooks System](Hooks-System.md) | [Task Runner](Task-Runner.md)*
