# CLAUDE-REFERENCE.md - Complete Project Guide

> This is Tier 3 on-demand documentation. For quick startup reference, see `CLAUDE.md`.

---

## What is Sam?

Sam (formerly PAI) is an open-source template for building AI-powered operating systems on top of Claude Code. It's platform-agnostic scaffolding that transforms Claude Code from a chatbot into a full personal AI system with memory, skills, automation, and multi-agent capabilities.

**Critical distinction:** Sam (this public repository) is sanitized scaffolding. Users build their own private system on top of it.

## Core Architecture

Sam follows a **Skills-as-Containers** architecture with four main components:

1. **Skills** (`.claude/skills/`) - Self-contained domain expertise with routing, workflows, and tools
2. **Agents** (`.claude/agents/`) - Specialized AI personalities (engineer, researcher, designer, pentester)
3. **Hooks** (`.claude/hooks/`) - Event-driven automation triggered by lifecycle events
4. **History** (`.claude/History/`) - Universal Output Capture System (UOCS) for automatic documentation
5. **`README.md`** - Overview and quickstart

## Essential Commands

```bash
# Installation
git clone https://github.com/your-repo/sam.git ~/sam
ln -s ~/sam/.claude ~/.claude
bash .agent/setup.sh

# Health check
bun ${PAI_DIR}/hooks/self-test.ts

# Voice server (optional, requires ELEVENLABS_API_KEY)
~/.claude/voice-server/manage.sh start|stop|status

# Observability dashboard (optional)
~/.claude/skills/observability/manage.sh start|stop

# Update Sam (from within Claude Code)
/samupdate

# Update Fabric patterns
.claude/skills/fabric/tools/update-patterns.sh
```

**No traditional build system:** TypeScript files execute directly via Bun. No compilation step.

## Service Management & Infrastructure

Sam **optionally** includes four systemctl-managed services that auto-start on boot. These are **optional enhancements** that provide advanced functionality but are not required for core operations.

### Service Manifest

| Service | Port | Type | Status | Purpose | Requirement |
|---------|------|------|--------|---------|------------|
| **voice-server** | 8888 | Node.js HTTP | ✅ Active | Text-to-speech API via ElevenLabs | Optional |
| **observability-dashboard** | 5172 | Node.js HTTP | ✅ Active | Real-time agent activity monitoring | Optional |
| **python-sidecar** | 8889 | Python HTTP | ✅ Active | TTS model inference server | Optional |
| **discord-remote-control** | — | Node.js | ✅ Active | Discord bot remote interface | Optional |

### Service Configuration

Service units are registered in `~/.config/systemd/user/`:
- `voice-server.service`
- `observability-dashboard.service`
- `python-sidecar.service`
- `discord-remote-control.service`

### Management

```bash
# Check all services
systemctl --user status voice-server observability-dashboard python-sidecar discord-remote-control

# Control individual service
systemctl --user start|stop|restart|status SERVICE.service

# View service logs
journalctl --user -u SERVICE.service -n 50 --no-pager

# Enable/disable auto-start on boot
systemctl --user enable SERVICE.service
systemctl --user disable SERVICE.service
```

### Optional Dependency Model

All services are completely optional. Core functionality operates independently:
- **Without voice-server:** No text-to-speech feedback (but full CLI operation)
- **Without observability-dashboard:** No real-time agent monitoring (but all agents function normally)
- **Without python-sidecar:** No local TTS inference (but external TTS still works)
- **Without discord-remote-control:** No Discord interface (but all CLI interfaces work)

---

## Technology Stack

**MANDATORY choices (not preferences):**

- **Runtime:** Bun (NOT Node.js)
- **Language:** TypeScript (NOT Python for infrastructure)
- **Package Manager:** Bun (NOT npm/yarn/pnpm)
- **Format:** Markdown (NOT HTML for basic content, NOT XML tags in prompts)
- **CLI Style:** llcli-style with manual arg parsing (zero dependencies by default)
- **Testing:** Vitest (when needed)
- **Platform:** Claude Code v2.0+

## Skills System (Critical Pattern)

Every skill MUST follow this structure with **TitleCase naming**:

```
SkillName/                              # TitleCase directory
├── SKILL.md                           # ALWAYS UPPERCASE, contains YAML frontmatter
├── workflows/                         # Execution procedures
│   ├── Create.md                     # TitleCase workflow files
│   └── Update.md
├── tools/                             # CLI tools (even if empty)
│   └── ToolName.ts                   # TitleCase TypeScript tools
└── ReferenceDoc.md                    # TitleCase reference docs
```

### SKILL.md Structure (MANDATORY)

```yaml
---
name: SkillName
description: [What it does]. USE WHEN [intent triggers]. [Capabilities].
---

# SkillName

## Workflow Routing
[Table mapping user intents to specific workflows]

## Examples
[2-3 concrete examples - REQUIRED for 90% accuracy]

## [Additional sections]
```

**Critical Rules:**

1. **USE WHEN clause is MANDATORY** - System parses this for skill activation
2. **TitleCase everywhere** - directories, files, YAML names (except `SKILL.md` which is uppercase)
3. **Intent matching** - "user wants to create blog" NOT exact string matches
4. **Examples section REQUIRED** - Improves tool selection from 72% to 90%
5. **tools/ directory always present** - even if empty

## Hooks System

Hooks are TypeScript scripts triggered by lifecycle events, configured in `settings.json`:

**Available Hook Types:**

- `SessionStart` - Load context, initialize state
- `SessionEnd` - Generate summaries, cleanup
- `UserPromptSubmit` - Pre-process prompts, update tabs
- `PreToolUse` - Security validation, logging
- `PostToolUse` - Capture output, observability
- `Stop` - Voice notifications, tab titles
- `SubagentStop` - Agent completion tracking
- `PreCompact` - Context compression

**Path Resolution:**

- ALL hooks use `${PAI_DIR}/` variable (never hardcoded paths)
- Centralized library: `.claude/Hooks/lib/pai-paths.ts`
- Falls back to `~/.claude` if PAI_DIR not set

## Agent System

Agents are specialized personalities defined in `.claude/agents/`:

```yaml
---
name: engineer
description: [Agent purpose]
model: sonnet # haiku/sonnet/opus
color: green
voiceId: Tom (Enhanced)
permissions:
  allow: [list of tools]
---
```

**Delegation Patterns:**

- **Sequential:** Main → Engineer → Complete
- **Parallel:** Main → [Intern1, Intern2, Intern3] → Synthesize
- **Nested:** Main → Architect → Engineer → Verify
- **Spotcheck:** [N Interns] → Spotcheck validates all

**Model Selection (CRITICAL for performance):**

- `haiku` - Simple checks, grunt work (10-20x faster)
- `sonnet` - Standard implementation, most coding
- `opus` - Deep reasoning, complex architecture

## The Thirteen Founding Principles

These architectural principles are **constitutional** and must be followed:

1. **Clear Thinking + Prompting is King** - Quality thinking before code
2. **Scaffolding > Model** - System architecture > AI model power
3. **As Deterministic as Possible** - Same input → same output
4. **Code Before Prompts** - Write code to solve, use prompts to orchestrate
5. **Spec / Test / Evals First** - Define behavior before implementation
6. **UNIX Philosophy** - Do one thing well, compose tools
7. **ENG / SRE Principles** - Treat AI infrastructure with engineering rigor
8. **CLI as Interface** - Every operation accessible via command line
9. **Goal → Code → CLI → Prompts → Agents** - Proper development pipeline
10. **Meta / Self Update System** - System can improve itself
11. **Custom Skill Management** - Skills are organizational unit
12. **Custom History System** - Automatic capture of valuable work
13. **Custom Agent Personalities** - Specialized agents for different tasks

## CLI-First Architecture

**Development Pattern:**

```
Requirements → CLI Tool → Prompting Layer → Agent Orchestration
   (what)         (how)      (orchestration)    (execution)
```

**Three-Tier CLI Templates:**

1. **Tier 1 (DEFAULT): llcli-style** - Manual arg parsing, zero dependencies
2. **Tier 2: Commander.js** - Complex subcommands, option parsing
3. **Tier 3: Full Framework** - Plugins, config, advanced features

**Always prefer Tier 1 unless complexity demands higher tiers.**

## Progressive Disclosure System

Three-tier context loading for token efficiency:

1. **Tier 1: System Prompt** (Always Active)

   - Skill YAML frontmatter (~200-500 words)
   - Triggers for activation
   - Loaded at session start

2. **Tier 2: SKILL.md Body** (On-Demand)

   - Main reference content (~500-2000 lines)
   - Workflows and routing logic
   - Loaded when skill activated

3. **Tier 3: Reference Files** (Just-In-Time)
   - Deep-dive documentation
   - Loaded only when specific detail needed
   - Examples: `CONSTITUTION.md`, `HookSystem.md`

## Voice System Integration

**MANDATORY Response Format** (for task-based responses):

```markdown
SUMMARY: [One sentence - what this response is about]
ANALYSIS: [Key findings, insights, or observations]
ACTIONS: [Steps taken or tools used]
RESULTS: [Outcomes, what was accomplished]
STATUS: [Current state of the task/system]
CAPTURE: [Required - context worth preserving for this session]
NEXT: [Recommended next steps or options]
STORY EXPLANATION:

1. [First key point in the narrative]
2. [Second key point]
3. [Third key point]
4. [Fourth key point]
5. [Fifth key point]
6. [Sixth key point]
7. [Seventh key point]
8. [Eighth key point - conclusion]
   COMPLETED: [50 words max - drives voice output - REQUIRED]
```

**Why this matters:**

- Voice server extracts COMPLETED line for TTS
- CAPTURE section ensures learning preservation
- Consistent format for session history
- 50-word limit allows for more verbose, descriptive completion messages

## History System (UOCS)

Universal Output Capture System with automatic documentation.

**File Naming Convention:**

```
YYYY-MM-DD-HHMMSS_[PROJECT]_[TYPE]_[HIERARCHY]_[DESCRIPTION].md
```

**Types:** FEATURE, BUG, REFACTOR, RESEARCH, DECISION, LEARNING, SESSION

**Directory Structure:**

```
.claude/History/
├── Sessions/YYYY-MM/          # Session summaries
├── Learnings/YYYY-MM/         # Problem-solving narratives
├── Research/YYYY-MM/          # Investigation reports
├── Decisions/YYYY-MM/         # Architectural decisions
├── Execution/                 # Features/Bugs/Refactors
└── Raw-Outputs/YYYY-MM/       # JSONL event logs
```

**Auto-capture via hooks** - no manual intervention required.

## Security Protocols

**Two Repository Model:**

- **Private Setup** (`~/.claude/`) - Contains secrets, API keys, personal data (NEVER PUBLIC)
- **Public Sam** (this repo) - Sanitized template only

**Protected files** (must never contain secrets):

- `SAIM_CONTRACT.md`
- `README.md`
- `.env.example` (template only, no actual keys)
- `SECURITY.md`

**Security features:**

- `.saim-protected.json` - Manifest of protected files
- `validate-protected.ts` - Pre-commit validation
- Prompt injection defense - External content is READ-ONLY

## Environment Configuration

**settings.json** (identity and paths):

```json
{
  "env": {
    "PAI_DIR": "/Users/username/.claude",
    "DA": "Sam", // Digital Assistant name - appears everywhere
    "PAI_SIMPLE_COLORS": "0",
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "64000"
  }
}
```

**.env** (API keys - NEVER commit):

```bash
PERPLEXITY_API_KEY=...
GOOGLE_API_KEY=...
ELEVENLABS_API_KEY=...
BRIGHTDATA_API_KEY=...
```

## File Organization (CRITICAL)

**Three zones:**

1. **Scratchpad** (`${PAI_DIR}/scratchpad/`) - Temporary files ONLY. Delete when done.
2. **History** (`${PAI_DIR}/History/`) - Permanent valuable outputs.
3. **Backups** (`${PAI_DIR}/History/backups/`) - All backups go here, NEVER inside skill directories.

**Rules:**

- Save valuable work to History, not scratchpad
- Never create `backups/` directories inside Skills
- Never use `.bak` suffixes

## Sam Contract (Core vs Configured vs Example)

**Core Guarantees (always work):**

- Hook system executes without errors
- Skills load and route correctly
- Agents delegate properly
- History captures automatically

**Configured Functionality (needs setup):**

- Voice server (requires `ELEVENLABS_API_KEY`)
- Research skills (requires various API keys)
- MCP integrations (requires provider keys)

**Examples (community contributions):**

- Skills in `.claude/skills/` are starting points
- May require updates as APIs change
- Check each skill's `SKILL.md` for requirements

## Common Patterns

### Creating a New Skill

1. Use `create-skill` skill template
2. Follow TitleCase naming convention
3. Include YAML frontmatter with USE WHEN clause
4. Add 2-3 examples (REQUIRED)
5. Create `tools/` directory (even if empty)
6. Test skill activation: `/skillname`

### Launching Parallel Agents

```typescript
// WRONG - sequential, slow
await Task({ prompt: "Task 1", subagent_type: "intern" });
await Task({ prompt: "Task 2", subagent_type: "intern" });

// RIGHT - parallel, fast
// Send SINGLE message with MULTIPLE Task calls
Task({ prompt: "Task 1", subagent_type: "intern", model: "haiku" });
Task({ prompt: "Task 2", subagent_type: "intern", model: "haiku" });
```

### Writing a CLI Tool

1. Use Tier 1 (llcli-style) by default
2. Manual arg parsing, zero dependencies
3. Clear `--help` output
4. Exit codes: 0 (success), 1 (error)
5. Output to stdout, errors to stderr

## What Makes Sam Different

1. **Skills-as-Containers** - Domain expertise packaged with routing/workflows/tools
2. **Progressive Disclosure** - 3-tier context loading for efficiency
3. **Event-Driven Architecture** - Hooks capture everything automatically
4. **Voice-First Feedback** - TTS notifications for completions
5. **Multi-Agent Orchestration** - Parallel specialized agents
6. **CLI-First Philosophy** - Deterministic tools wrapped with AI
7. **Universal History System** - Zero-effort documentation
8. **Native Fabric Patterns** - 248 AI patterns in context
9. **Self-Updating System** - Can improve itself via `/samupdate`
10. **Platform-Agnostic Design** - Architecture designed for portability

## Troubleshooting

**Hooks failing with "No such file or directory":**

```bash
# Run setup script to fix PAI_DIR
bash ~/.claude/setup.sh
```

**Voice not working:**

```bash
# Check if server is running
curl http://localhost:8888/health

# Check .env has keys
grep ELEVENLABS ~/.claude/.env
```

**Skill not activating:**

- Verify USE WHEN clause in YAML frontmatter
- Check TitleCase naming
- Ensure examples section exists

**Agent not working:**

- Check model parameter (haiku/sonnet/opus)
- Verify permissions in agent YAML
- Check agent file exists in `.claude/agents/`

---

**Status:** ✅ Complete reference guide | Optimized with progressive disclosure in CLAUDE.md
