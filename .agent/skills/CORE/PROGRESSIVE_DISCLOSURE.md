# Progressive Disclosure Implementation Guide

## Overview

Progressive Disclosure is a smart context loading system that loads documentation in three tiers based on when it's needed:

- **Tier 1 (Session Start):** Load minimal files (SKILL.md + AGENT.md) - ~50-120 lines each
- **Tier 2 (On-Demand):** Load Reference.md files when skills/agents are activated
- **Tier 3 (Explicit Request):** Load full documentation on user request

This reduces initial session context by ~67% while ensuring full documentation is available exactly when needed.

## Architecture

### Current Files

```
~/.claude/Hooks/
├── load-core-context.ts           # SessionStart hook - loads minimal SKILL.md
├── load-on-demand-references.ts   # UserPromptSubmit hook - loads Reference.md on-demand
└── lib/
    ├── pai-paths.ts               # Path resolution (existing)
    └── progressive-loader.ts      # NEW: Helper library for all three tiers
```

### How It Works

#### Tier 1: Session Start
```
SessionStart Hook
    ↓
load-core-context.ts
    ↓
Reads minimal CORE SKILL.md (~60 lines)
    ↓
Injects as <system-reminder>
    ↓
✅ Session ready with ~700 tokens (down from ~1,500)
```

#### Tier 2: On-Demand (When User Mentions Skill/Agent)
```
User message: "Use the /research skill to investigate..."
    ↓
UserPromptSubmit Hook
    ↓
load-on-demand-references.ts
    ↓
Detects "/research" in message
    ↓
Checks if Research/Reference.md exists
    ↓
Loads and injects Reference.md (if not already loaded)
    ↓
✅ Full documentation now available mid-session
```

#### Tier 3: Explicit Request
```
User: "Tell me about the PAI constitution"
    ↓
You detect request in response
    ↓
Use progressive-loader.ts to load CONSTITUTION.md
    ↓
Inject into context
    ↓
✅ Detailed information available
```

## Skills and Agents Setup

### Current Status

**Refactored (Ready):**
- ✅ CORE SKILL.md - Already split into minimal + Reference.md pattern

**Refactoring Candidates:**
- Use the migration tool: `bun ~/.claude/Tools/skill-refactor.ts analyze SkillName`

### Manual Skill Refactoring (Example: ffuf)

**Step 1: Read Original File**
```bash
wc -l ~/.claude/Skills/ffuf/SKILL.md
# Output: 501 lines
```

**Step 2: Create New Minimal SKILL.md**
Keep only:
- YAML frontmatter (lines 1-7)
- Workflow routing table (lines 10-20)
- 2-3 key examples (lines 22-40)
- Extended Context section pointing to Reference.md (~5 lines)
- **Target:** 80-120 lines

**Step 3: Create Reference.md**
Move these sections:
- Detailed command documentation (old lines 41-200)
- Configuration guides (old lines 201-250)
- Advanced techniques (old lines 251-350)
- Troubleshooting (old lines 351-450)
- Best practices (old lines 451-501)
- **Target:** 400+ lines

**Step 4: Test**
```bash
# Minimal SKILL.md loads at session start
# Reference.md loads when user mentions /ffuf
```

## Usage Examples

### Example 1: Automatic Tier 2 Loading

```
User: "I need to do some web fuzzing with the /ffuf skill"

System detects: "/ffuf" in message
↓
Checks: Does ffuf/Reference.md exist?
↓
Loads: ffuf Reference.md (~400 lines) if not already loaded
↓
Injects: Full fuzzing documentation available
```

### Example 2: Skill Activation Detection

The `load-on-demand-references.ts` hook detects:

**Pattern 1: Slash commands**
```
/research       → Loads Research/Reference.md
/architect      → Loads Architect/Reference.md
/fabric         → Loads Fabric/Reference.md
```

**Pattern 2: Agent delegation**
```
"Use the engineer agent"    → Loads Engineer/Reference.md
"Delegate to architect"     → Loads Architect/Reference.md
"Call the designer agent"   → Loads Designer/Reference.md
```

**Pattern 3: Task tool with agent**
```
Task({ subagent_type: "engineer", ... })
→ Detects "engineer" agent
→ Loads Engineer/Reference.md
```

## Progressive Loader API

Located in `~/.claude/Hooks/lib/progressive-loader.ts`

### Loading Functions

```typescript
// Tier 1: Load minimal files (used at session start)
loadMinimalSkill(skillName: string): { content: string; size: number } | null
loadMinimalAgent(agentName: string): { content: string; size: number } | null

// Tier 2: Load Reference files on-demand
loadSkillReference(skillName: string): { content: string; size: number } | null
loadAgentReference(agentName: string): { content: string; size: number } | null

// Tier 3: Load full documentation
loadFullDoc(docPath: string): { content: string; size: number } | null
```

### Utility Functions

```typescript
// Check if something is already loaded
isLoaded(name: string, type: 'skill' | 'agent' | 'reference'): boolean

// Get loading statistics
getLoadingStats(): {
  tier1_skills: number;
  tier1_agents: number;
  tier2_references: number;
  tier3_full_docs: number;
  total_tokens_estimate: number;
  uptime_ms: number;
}

// Format content for injection
formatAsSystemReminder(title: string, content: string): string
formatMultipleAsSystemReminder(title: string, items: Array<{label, content}>): string

// Clear loaded context (testing only)
clearLoadedContext(): void
```

## Token Savings Analysis

### Before Progressive Disclosure
```
Session Start:
- CORE SKILL.md:        325 lines ≈ 850 tokens
- Agent YAML:           9 × 200 lines ≈ 4,500 tokens
- Skill YAML:           27 × 50 lines ≈ 3,400 tokens
- MCP definitions:      14 MCPs ≈ 1,750 tokens
────────────────────────────────────
TOTAL:                             ≈ 10,500 tokens (70% of session)
```

### After Progressive Disclosure
```
Session Start (Tier 1 only):
- CORE SKILL.md:        50 lines ≈ 130 tokens ✅ -720
- Agent YAML:           9 × 20 lines ≈ 450 tokens ✅ -4,050
- Skill YAML:           27 × 30 lines ≈ 2,000 tokens ✅ -1,400
- MCP definitions:      7 MCPs ≈ 875 tokens ✅ -875
────────────────────────────────────
TOTAL:                             ≈ 3,455 tokens (23% of session)

Per-Activation Savings (Tier 2):
- ffuf: 501 → 100 lines = ~1,000 tokens saved per activation
- Engineer: 236 → 70 lines = ~420 tokens saved per activation
- Architect: 223 → 70 lines = ~380 tokens saved per activation
```

**Overall Impact: ~67% context reduction at session start**

## Configuration

### Enable in settings.json

The progressive loader is automatically enabled via hook configuration:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/Hooks/load-core-context.ts"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/Hooks/load-on-demand-references.ts"
          }
        ]
      }
    ]
  }
}
```

### Manual Testing

```bash
# Test the progressive loader directly
cd ~/.claude
bun Hooks/load-core-context.ts          # Should output minimal CORE context
bun Hooks/load-on-demand-references.ts  # Requires user message on stdin
```

## Refactoring Checklist

For each skill/agent you want to optimize:

### Skill Refactoring Checklist

- [ ] **Analyze** the current SKILL.md
  ```bash
  bun ~/.claude/Tools/skill-refactor.ts analyze SkillName
  ```

- [ ] **Create minimal SKILL.md** (80-120 lines)
  - Keep: YAML frontmatter
  - Keep: Workflow routing table
  - Keep: 2-3 key examples
  - Keep: Extended Context section
  - Move everything else to Reference.md

- [ ] **Create Reference.md** (200+ lines)
  - Detailed methodology
  - Command reference
  - Best practices
  - Troubleshooting
  - Configuration guides

- [ ] **Update Extended Context section**
  ```markdown
  ## Extended Context

  For detailed information, see:
  - `Reference.md` - [Brief description]
  - Related files if applicable
  ```

- [ ] **Test skill activation**
  ```bash
  # In Claude Code, trigger the skill
  /skillname
  # Verify Reference.md loads automatically
  ```

- [ ] **Verify no broken references**
  - All workflows still link to correct files
  - All examples still work
  - All tool references are valid

### Agent Refactoring Checklist

- [ ] **Create Agents/AgentName/ directory** (if not already directory-based)
  ```bash
  mkdir -p ~/.claude/Agents/AgentName
  mv ~/.claude/Agents/AgentName.md ~/.claude/Agents/AgentName/AGENT.md
  ```

- [ ] **Create minimal AGENT.md** (60-80 lines)
  - Keep: YAML frontmatter
  - Keep: Core Identity (brief)
  - Keep: Primary Competencies (5 bullets max)
  - Keep: Communication Style (3 bullets max)
  - Keep: Extended Context section
  - Move methodology and standards to Reference.md

- [ ] **Create Reference.md** (200+ lines)
  - Philosophy & Approach
  - Detailed Competencies
  - Methodology
  - Standards & Requirements
  - Tool Usage Guide
  - Common Workflows

- [ ] **Test agent delegation**
  ```bash
  Task({
    subagent_type: "agentName",
    prompt: "Test task...",
    model: "haiku"
  })
  # Verify Reference.md loads automatically
  ```

- [ ] **Update Extended Context section**
  ```markdown
  ## Extended Context

  For detailed information, see:
  - `Reference.md` - Complete methodology and standards
  ```

## Monitoring and Validation

### Check Loading Status

In your response after running a skill/agent:

```typescript
import { getLoadingStats } from '~/.claude/Hooks/lib/progressive-loader';

const stats = getLoadingStats();
console.error(`
  📊 Loading Statistics:
  - Tier 1 Skills loaded: ${stats.tier1_skills}
  - Tier 1 Agents loaded: ${stats.tier1_agents}
  - Tier 2 References loaded: ${stats.tier2_references}
  - Total tokens estimated: ${stats.total_tokens_estimate}
  - Session uptime: ${stats.uptime_ms}ms
`);
```

### Verify Correct Files Loaded

```bash
# Check if Reference.md exists for a skill
ls -la ~/.claude/Skills/SkillName/Reference.md

# Check if Reference.md exists for an agent
ls -la ~/.claude/Agents/AgentName/Reference.md
```

## Troubleshooting

### Issue: Reference.md not loading automatically

**Symptom:** User mentions a skill/agent but Reference.md doesn't appear

**Solution:**
1. Check file exists: `ls ~/.claude/Skills/SkillName/Reference.md`
2. Check syntax in load-on-demand-references.ts matches skill name
3. Verify skill directory uses TitleCase naming (e.g., `ffuf` not `ffuf`)
4. Check settings.json has load-on-demand-references.ts in UserPromptSubmit hooks

### Issue: Wrong file loaded

**Symptom:** Loaded file is minimal SKILL.md instead of Reference.md

**Solution:**
1. Verify Reference.md file exists
2. Check that minimal SKILL.md points to Reference.md in "Extended Context"
3. Check that the hook is actually running (should see messages in console)

### Issue: Duplicate content in context

**Symptom:** Same content appears twice in context

**Solution:**
1. Progressive loader tracks loaded context to prevent duplicates
2. If you see duplicates, check `isLoaded()` function is being called
3. May be a cache issue - restart Claude Code session

## Best Practices

### Do's ✅

- **Split skills/agents regularly** - Keep minimal files lean
- **Use Reference.md consistently** - All skills/agents should follow the pattern
- **Test skill activation** - Verify Reference.md loads when expected
- **Document in Extended Context** - Link to Reference files clearly
- **Keep Tier 1 files small** - Target 50-120 lines for SKILL.md

### Don'ts ❌

- **Don't duplicate content** - Keep content in only one place
- **Don't load Reference.md at session start** - Only load on-demand
- **Don't change file names** - Use generic `Reference.md` for consistency
- **Don't break routing tables** - Keep routing clear and accurate
- **Don't remove examples** - Keep 2-3 key examples in SKILL.md

## Future Enhancements

### Potential Improvements

1. **Smart caching** - Cache loaded Reference.md across sessions
2. **Partial loading** - Load only needed sections of Reference.md
3. **Compression** - Compress Reference.md files in storage
4. **Indexing** - Create index for faster searching
5. **Auto-refactoring** - Tool to automatically split files by section

### Experimental Features

```typescript
// Could be added in future versions:

// Load specific section from Reference.md
loadSkillReferenceSection(skillName: string, section: string): string | null

// Load with compression
loadCompressedReference(skillName: string): { compressed: Buffer; size: number } | null

// Pre-fetch likely needed references
prefetchReferences(skillNames: string[]): Promise<void>
```

## References

- `~/.claude/Skills/CORE/SKILL.md` - Example of minimal skill file
- `~/.claude/Skills/CORE/Reference.md` - Example of reference file
- `~/.claude/Tools/skill-refactor.ts` - Automation tool for refactoring
- `~/.claude/Hooks/load-core-context.ts` - SessionStart hook implementation
- `~/.claude/Hooks/load-on-demand-references.ts` - UserPromptSubmit hook implementation
- `~/.claude/Hooks/lib/progressive-loader.ts` - Core progressive loading library
