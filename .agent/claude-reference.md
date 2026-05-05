# claude-reference.md — Sam Technical Reference

Detailed technical reference for Sam agent's operation, architecture, and workflows.

**Quick version:** See [CLAUDE.md](CLAUDE.md) for Sam's role and capabilities.
**Project context:** See [../CLAUDE.md](../CLAUDE.md) for project overview.

---

## Skills System

### What are Skills?

Skills are self-contained capability packages with:
- **Domain expertise** — Specific knowledge area
- **Routing logic** — How to recognize when to use this skill
- **Workflows** — Multi-step procedures (`.md` files)
- **Tools** — CLI functions (`.ts` files)

Skills activate automatically based on "USE WHEN" clauses in their YAML frontmatter. I don't load unused skills—only what's needed for your request.

### Skill Structure

```
skill-name/                    ← kebab-case directory
├── SKILL.md                  ← Frontmatter + Tier 1 docs
│   - YAML metadata (USE WHEN, description, etc.)
│   - Quick reference (~200–500 tokens)
│
├── reference.md              ← Tier 2 (extended docs, ~500–2000 lines)
├── workflows/                ← Multi-step procedures (.md files)
│   ├── create-cli.md
│   ├── debugging.md
│   └── ...
│
└── tools/                    ← CLI functions (TypeScript .ts files)
    ├── validate-input.ts
    ├── generate-config.ts
    └── ...
```

### Progressive Disclosure Tiers

**Tier 1 — Always Active**
- YAML frontmatter (100–200 tokens)
- Quick reference (100–300 tokens)
- I know this skill exists and what it does

**Tier 2 — Loaded on Demand**
- Extended documentation (500–2000 lines)
- Detailed workflows
- Full API reference
- I load this when you request detailed info or I need the skill

**Tier 3 — Just-in-Time**
- Deep reference docs
- Troubleshooting guides
- Architecture deep-dives
- I load this only if needed for complex tasks

**Why this matters:** Your context window stays focused. I load exactly what's needed, not everything at once.

### Example Skill: `research`

**Tier 1 (SKILL.md frontmatter):**
```yaml
name: research
description: Multi-source parallel research with Perplexity and Gemini
USE WHEN: user asks to research something, find information, investigate a topic
```

**Tier 2 (reference.md):**
- How to use Perplexity vs Gemini
- Query strategies
- Source evaluation
- Synthesis techniques

**Tier 3 (workflows/):**
- `multi-source-research.md` — Complex investigation procedure
- `fact-checking.md` — Verification workflow

**Tools (tools/):**
- `call-perplexity.ts` — Make Perplexity API call
- `call-gemini.ts` — Make Gemini API call
- `synthesize.ts` — Combine results

### All 27+ Skills

See [wiki/skills-catalog.md](wiki/skills-catalog.md) for the complete skill list with use cases.

---

## Agent System

### What are Agents?

Agents are specialized AI personas with:
- Specific expertise (engineering, architecture, research, security, design, etc.)
- Defined permissions (which tools they can use)
- Consistent behavior and approach

I delegate to agents when their specialty is needed, then coordinate results.

### Agent Structure

Each agent is a YAML file in `.agent/agents/`:

```yaml
name: engineer
model: claude-opus-4-7
color: blue
voiceId: Mark
description: Principal-level software engineering specialist
permissions:
  allow:
    - "Bash"
    - "Read(_)"
    - "Write(_)"
    - "Edit(_)"
    - "Grep(_)"
  deny:
    - "destructive operations"
```

### Agent Types

| Agent | Role | When to Use |
|-------|------|------------|
| **engineer** | Software implementation & debugging | Complex bugs, performance, system design |
| **architect** | System architecture & design | Planning features, tech decisions |
| **researcher** | Deep information synthesis | Complex research questions |
| **pentester** | Offensive security testing | Security testing, vulnerability discovery |
| **designer** | UX/UI design | Interface design, user flows |
| **product-manager** | Requirements & planning | Feature specs, PRD creation |
| **security-architect** | Secure system design | Security design reviews |
| **analyst** | Brainstorming & ideation | Exploring ideas, creative thinking |
| ... 19+ more | Various specialties | See `.agent/agents/` |

### Delegation Pattern

```
Your Request
    ↓
Sam (me) - Assess which agent(s) needed
    ↓
Delegate to Specialist Agent(s)
    ├── Agent works on assigned task
    ├── Reports back with results
    └── I coordinate and synthesize
    ↓
Report Final Results to You
```

### Sequential vs Parallel Delegation

**Sequential:** One agent → results → next agent
- Used when later agents need earlier results
- Example: First architect plans, then engineer implements

**Parallel:** Multiple agents work simultaneously
- Used for independent tasks
- Example: Research from 3 sources in parallel
- Faster, less context overhead

---

## Hooks System

### What are Hooks?

Hooks are TypeScript scripts triggered by Claude Code lifecycle events. They enable automation and custom behavior.

### Hook Types

| Hook | When It Fires | Purpose | Example |
|------|---------------|---------|---------|
| **SessionStart** | When Claude Code starts | Load Sam's identity, prepare context | Load CORE skill |
| **SessionEnd** | When Claude Code closes | Cleanup, save state | Archive history |
| **PreToolUse** | Before running any tool (Bash, Read, etc.) | Validate, filter, block | Security screening |
| **PostToolUse** | After tool execution | Logging, analysis | Capture results |
| **Stop** | Before Claude Code exits | Final cleanup | Voice notification |
| **SubagentStop** | When a delegated agent finishes | Aggregate results | Coordinate results |
| **PreCompact** | Before context compression | Archive important info | Save to History |
| **UserPromptSubmit** | When you send a message | Capture intent, logging | Event logging |

### Hook Configuration

Hooks are bound in `.agent/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "path": "~/.claude/hooks/load-core-context.ts",
        "blocking": true
      }
    ],
    "PreToolUse": [
      {
        "path": "~/.claude/hooks/security-validator.ts",
        "blocking": true
      }
    ]
  }
}
```

**blocking: true** means the hook must complete successfully before continuing.

### Key Hooks

**load-core-context.ts**
- Fires: SessionStart
- Effect: Loads CORE skill (Sam's identity)
- Ensures Sam loads consistently every session

**security-validator.ts**
- Fires: PreToolUse
- Effect: Screens Bash commands for attack patterns
- Blocks reverse shells, credential exfiltration, destructive ops

**capture-all-events.ts**
- Fires: UserPromptSubmit
- Effect: Logs interactions to `.agent/History/`
- Creates UOCS (Universal Output Capture System) archive

---

## Rules & Enforcement

### Git Isolation Rule

**Location:** `.agent/rules/git-isolation.md`

**Purpose:** Prevent accidents across sibling projects in `~/Projects/`

**Enforcement:**
1. Before git operations, I verify repo identity
2. Security validator blocks certain patterns
3. Pre-commit hook validates protected files

**What I Check:**
```bash
git rev-parse --show-toplevel        # Must be ~/Projects/sam
git remote get-url origin            # Must be expected remote
# Never `git add .` or `git add -A` across boundaries
```

### Protected Files Rule

**Location:** `.sam-protected.json`

**Purpose:** Prevent commits containing secrets or personal data

**Patterns Blocked:**
- API keys (ANTHROPIC_API_KEY, GROQ_API_KEY, etc.)
- Personal emails (your-email@domain.com)
- Private paths (/Users/yourname/...)
- Discord tokens, AWS credentials, etc.

**Enforcement:** `validate-protected.ts` hook runs before commits

### Language & Tooling Policy

**Location:** Not in rules/ (enforced at request time)

**Approved Stack:**
- ✅ Bash — shell automation
- ✅ Go — performance-critical code
- ✅ Bun (TypeScript) — hooks, CLI tools
- ✅ SQL, YAML, JSON — data/config

**Pre-approved Exception:**
- ⚠️ Python — only for LLM integration (existing models)

**Not Allowed:**
- 🚫 Node.js, npm — use Bun instead
- 🚫 Vite, Yarn, Webpack — not needed
- 🚫 Other languages/frameworks — requires explicit approval

**Process if needed:**
1. Ask user for approval with clear rationale
2. Create memory documenting the exception
3. Keep separate from core code
4. Don't expand without new approval

---

## Memory Architecture

### Session Memory (Always Available)

**What:** Local file-based memory in `.agent/History/`

**How:** Every session creates a timestamped file:
```
.agent/History/2026-05-04-172100_sam_CODE_S0_initial-setup.md
.agent/History/2026-05-04-180030_sam_CODE_S1_feature-implementation.md
```

**Includes:**
- Session context
- Commands run
- Files modified
- Results and outputs

**Always available**, no extra setup needed.

### Persistent Memory (Optional, via memory-system)

**What:** Semantic memory with fact extraction and graph learning

**Requires:** `~/Projects/memory-system` add-on

**How It Works:**
1. Each session extracts semantic facts (12 patterns)
2. Facts persist in SQLite database
3. Facts are connected via association graph
4. Future sessions can retrieve relevant facts

**Enable/Disable:**
```bash
# .agent/.env
ENABLE_MEMORY_HOOKS=true   # Enable extraction
MEMORY_SERVICE_URL=http://localhost:4242
```

**API Endpoints (via memory-system):**
- `POST /memory/extract` — Extract facts from text
- `GET /memory/search` — Hybrid search (keyword + semantic)
- `GET /api/graph` — Graph visualization
- `POST /memory/consolidation/run` — Weekly cleanup

### Memory Types

| Type | Scope | Storage | Lifespan |
|------|-------|---------|----------|
| **Session** | Current session | File system | Until session ends |
| **Episodic** | Conversation history | File-based history | Persistent |
| **Semantic** | General knowledge | memory-system DB (optional) | Persistent across sessions |
| **Procedural** | How-tos and workflows | Skills and tools | Embedded in code |

---

## Workflow Patterns

### Pattern 1: Research Task

```
User: "Research modern LLM architectures"

Sam:
1. Identify skill needed: "research"
2. Load research skill reference
3. Delegate to researcher agent OR run multi-source research
4. Coordinate results from Perplexity + Gemini
5. Synthesize findings
6. Report summary + sources
```

### Pattern 2: Implementation Task

```
User: "Build a CLI tool to validate JSON"

Sam:
1. Identify skills: "create-cli"
2. Run create-cli skill workflow
3. Generate CLI scaffolding
4. Implement validation logic
5. Add tests and documentation
6. Verify and report results
```

### Pattern 3: Complex Coordination

```
User: "Design and implement a new API endpoint"

Sam:
1. Delegate to architect agent: "Design the endpoint"
   - Architect plans schema, auth, error handling
2. Delegate to engineer agent: "Implement it"
   - Engineer codes the endpoint
   - Engineer writes tests
3. Coordinate results
4. Report: Design + Implementation complete
```

### Pattern 4: Security Review

```
User: "Review this code for security issues"

Sam:
1. Identify skill: "security-review"
2. Delegate to security-architect agent
3. Security architect checks:
   - Input validation
   - Authentication/authorization
   - Secrets management
   - Common vulnerabilities
4. Report findings + recommendations
```

---

## Error Handling Strategy

### When Things Go Wrong

**I don't just retry or work around problems. I:**

1. **Investigate** — Understand root cause
2. **Communicate** — Tell you what failed and why
3. **Propose fixes** — Suggest solutions
4. **Verify** — Test before marking done

### Example: Hook Fails

```
Hook error: PreToolUse hook failed
  ↓
I investigate: Check .agent/settings.json for configuration
  ↓
Root cause: Hook timeout (500ms deadline exceeded)
  ↓
I propose: Optimize hook logic or increase timeout
  ↓
You decide: Which approach to take
  ↓
I implement and verify the fix
```

### Example: Test Fails

```
Test failure: security-validator-tests.ts failed
  ↓
I investigate: Run test in isolation, check logs
  ↓
Root cause: Test assumes service running, but service isn't available
  ↓
I propose: Mock the service, or check for graceful degradation
  ↓
You decide: Which pattern to follow
  ↓
I implement and verify all tests pass
```

---

## Configuration Reference

### .agent/settings.json

Global configuration:

```json
{
  "hooks": { "EventName": [...] },        // Hook bindings
  "permissions": { "allow": [...] },      // Allowed tools
  "enableAllProjectMcpServers": true,     // MCP servers
  "model": "sonnet"                       // Default model
}
```

### .agent/.env

Environment variables:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional (add-ons)
ENABLE_MEMORY_HOOKS=false                      # Enable semantic memory
MEMORY_SERVICE_URL=http://localhost:4242       # Memory backend
DISCORD_BOT_TOKEN=...                          # Discord remote control
PAI_USE_JAY_GENTIC=false                       # Use local LLM
```

### .agent/.env.example

Template for `.env` configuration.

---

## Useful Commands

### Health Checks

```bash
# Verify Sam installation
bun ~/.claude/hooks/self-test.ts

# Check git isolation setup
git rev-parse --show-toplevel

# Validate protected files
bun ~/.claude/hooks/validate-protected.ts --staged
```

### Skill Management

```bash
# List all skills
ls ~/.claude/skills/

# Read a skill (load Tier 1)
cat ~/.claude/skills/create-cli/SKILL.md

# Load reference (Tier 2)
read ~/.claude/skills/create-cli/reference.md
```

### Hook Management

```bash
# List hooks
ls ~/.claude/hooks/

# Run a hook directly
bun ~/.claude/hooks/load-core-context.ts

# Check hook configuration
cat ~/.claude/settings.json | grep -A10 hooks
```

### Memory

```bash
# View session history
ls ~/.claude/History/

# Search history
grep -r "keyword" ~/.claude/History/

# If memory-system installed, query semantic memory
curl http://localhost:4242/memory/search?q=topic
```

---

## Performance Tuning

### Reduce Context Load

**Problem:** Context window growing too large

**Solution:**
1. Archive old History files
2. Disable unused skills
3. Use memory-system for long-term facts (optional)

### Speed Up Hooks

**Problem:** Hooks running slowly

**Solution:**
1. Profile hook performance
2. Optimize regex patterns
3. Use early returns
4. Increase timeout if needed

### Optimize Delegation

**Problem:** Agent delegation taking too long

**Solution:**
1. Use parallel delegation when possible
2. Break into smaller tasks
3. Reduce agent context

---

## Troubleshooting Guide

### Sam Not Loading

**Symptom:** Claude Code starts but Sam's greeting doesn't appear

**Check:**
1. SessionStart hook configured?
   ```bash
   cat ~/.claude/settings.json | grep -A5 SessionStart
   ```
2. CORE skill accessible?
   ```bash
   ls ~/.claude/skills/CORE/SKILL.md
   ```
3. Hook executable?
   ```bash
   bun ~/.claude/hooks/self-test.ts
   ```

### Skill Not Found

**Symptom:** "Skill X not found" error

**Check:**
1. Skill directory exists?
   ```bash
   ls ~/.claude/skills/skill-name/
   ```
2. SKILL.md has proper frontmatter?
3. Skill structure follows convention?
   - SKILL.md at root level
   - reference.md optional
   - workflows/ and tools/ directories

### Hook Timeout

**Symptom:** "Hook exceeded 500ms deadline"

**Solutions:**
1. Optimize hook logic (remove slow operations)
2. Increase timeout in settings.json
3. Break into multiple smaller hooks

### Memory Not Persisting

**Symptom:** Facts not remembered across sessions

**Check:**
1. Is memory-system installed?
   ```bash
   ls ~/Projects/memory-system/
   ```
2. Is extraction enabled?
   ```bash
   grep ENABLE_MEMORY_HOOKS ~/.agent/.env
   ```
3. Is service running?
   ```bash
   curl http://localhost:4242/health
   ```

---

## Further Reading

- [CLAUDE.md](CLAUDE.md) — Sam's role and capabilities
- [../CLAUDE.md](../CLAUDE.md) — Project overview
- [wiki/getting-started.md](wiki/getting-started.md) — Setup guide
- [wiki/optional-addons.md](wiki/optional-addons.md) — Optional features
- [wiki/skills-catalog.md](wiki/skills-catalog.md) — All skills
- [.agent/skills/CORE/constitution.md](.agent/skills/CORE/constitution.md) — Philosophy
- [.agent/rules/](rules/) — Enforcement rules
