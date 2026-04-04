# Progressive Disclosure - Context Optimization Guide

**Purpose:** Optimize context usage through three-tier loading pattern
**Updated:** January 1, 2026
**Applies to:** All skills and agent configurations

---

## Overview

Progressive disclosure is PAI's strategy for loading context efficiently:
- **Tier 1:** Always loaded (system prompt)
- **Tier 2:** On-demand (when skill activated)
- **Tier 3:** Just-in-time (when specific detail needed)

**Goal:** Minimize base context while maintaining full functionality

---

## Three-Tier Loading Pattern

### Tier 1: System Prompt (Always Active)

**What:** Minimal essential context loaded in every conversation
**Size Target:** < 5,000 tokens total
**Frequency:** Every message

**Components:**
1. **Skill YAML Frontmatter** (~200-500 words each)
   - name, description, USE WHEN clause
   - Triggers for activation
   - No implementation details

2. **CORE Skill Header** (~2,600 tokens)
   - PAI identity and response format
   - Workflow routing table
   - Stack preferences
   - Security protocols

3. **MCP Tool Definitions** (~125 tokens per MCP)
   - Tool names and descriptions
   - Reduced by using MCP profiles

4. **Agent Definitions** (~75 tokens per agent)
   - Agent names and capabilities
   - Only when relevant

**Optimization Strategies:**

```yaml
# ✅ GOOD: Concise YAML frontmatter
---
name: research
description: Multi-source parallel research. USE WHEN user says 'do research' OR 'find information about'.
---

# ❌ BAD: Verbose frontmatter
---
name: research
description: This is a comprehensive research skill that provides multi-source parallel research capabilities using various researcher agents including Claude, Perplexity, and Gemini. It also includes content extraction, YouTube processing, and Fabric pattern integration. USE WHEN the user says 'do research' or 'research this topic' or 'find information about X' or any other research-related request.
---
```

**Current Tier 1 Size:**
- CORE skill: ~2,600 tokens
- 14 MCPs: ~1,750 tokens
- 8 agents: ~600 tokens
- **Total: ~4,950 tokens** ✅ Within target

### Tier 2: On-Demand Loading (Skill Activation)

**What:** Full skill content loaded when skill is activated
**Size:** 500-2,000 lines per skill
**Frequency:** Once per skill per conversation

**Components:**
1. **SKILL.md Body**
   - Complete workflow routing
   - Examples and use cases
   - Implementation details
   - Tool usage patterns

2. **Skill-Specific Context**
   - Configuration instructions
   - API requirements
   - Best practices

**When Loaded:**
- User triggers skill via USE WHEN clause
- Agent explicitly invokes skill
- Workflow references skill

**Example Flow:**
```
User: "Do research on X"
→ Triggers Research skill
→ Loads Research/SKILL.md (232 lines)
→ Loads relevant workflow file
→ Executes research
```

**Optimization Strategies:**

1. **Keep SKILL.md Focused**
   ```markdown
   # ✅ GOOD: Clear sections, scannable
   ## Workflow Routing
   [Table with clear triggers → actions]

   ## Examples
   [2-3 concrete examples]

   ## Key Principles
   [Bullet points]

   # ❌ BAD: Verbose explanations
   This skill provides comprehensive research capabilities...
   [Long paragraphs of explanation]
   ```

2. **Use References Instead of Duplication**
   ```markdown
   # ✅ GOOD: Reference to external docs
   For API configuration, see: ${PAI_DIR}/Skills/CORE/APISetup.md

   # ❌ BAD: Duplicate content
   [Entire API setup guide repeated in skill]
   ```

3. **Workflow Files for Complex Logic**
   ```markdown
   # ✅ GOOD: Separate workflow files
   → READ: workflows/conduct.md
   → READ: workflows/claude-research.md

   # ❌ BAD: All workflows inline in SKILL.md
   [Hundreds of lines of workflow logic]
   ```

### Tier 3: Just-In-Time Loading (Deep Dive)

**What:** Detailed reference documentation loaded only when needed
**Size:** Unlimited (loaded rarely)
**Frequency:** As needed for specific questions

**Components:**
1. **Reference Documentation**
   - CONSTITUTION.md (1,502 lines)
   - HookSystem.md (1,082 lines)
   - ModelSelectionGuide.md (350 lines)
   - Detailed implementation guides

2. **Deep Technical Details**
   - Architecture specifications
   - Advanced configuration
   - Troubleshooting guides

**When Loaded:**
- User asks specific question about architecture
- Agent needs deep implementation details
- Debugging complex issues

**Example Flow:**
```
User: "How does the hook system work?"
→ Agent reads HookSystem.md (Tier 3)
→ Provides detailed answer
→ User continues conversation
→ HookSystem.md not re-loaded unless needed again
```

**Optimization Strategy:**
```markdown
# ✅ GOOD: Reference when needed
For complete hook documentation:
${PAI_DIR}/Skills/CORE/HookSystem.md

# ❌ BAD: Load everything upfront
[Entire 1,000+ line documentation in Tier 2]
```

---

## Skill Creation Checklist

When creating or updating skills, verify progressive disclosure:

### Tier 1 (YAML Frontmatter)

- [ ] **name:** Clear, TitleCase
- [ ] **description:** < 1,024 characters
- [ ] **USE WHEN clause:** Intent-based triggers
- [ ] No implementation details in description
- [ ] Triggers are user intent, not exact strings

### Tier 2 (SKILL.md Body)

- [ ] Workflow routing table (clear triggers → actions)
- [ ] 2-3 concrete examples (REQUIRED for 90% accuracy)
- [ ] Key principles as bullet points
- [ ] References to Tier 3 docs instead of duplication
- [ ] Workflow files for complex multi-step procedures

### Tier 3 (Reference Docs)

- [ ] Deep technical details in separate files
- [ ] Referenced from Tier 2 when relevant
- [ ] Not loaded unless specifically needed
- [ ] Clear file naming (TitleCase)

---

## Context Cleanup Best Practices

### When to Use /compact

**ALWAYS after:**
- Multi-agent research (9+ agents in parallel)
- Architecture planning sessions (lots of back-and-forth)
- Long debugging sessions
- After 15+ conversation turns

**RECOMMENDED after:**
- Completing a major task
- Before switching to new topic
- When conversation feels sluggish
- After 10+ turns

**Pattern:**
```markdown
1. Complete task
2. Present results to user
3. Wait for user acknowledgment
4. Use /compact
5. Start fresh on next task
```

### Automated Reminders

**Compact Reminder Hook:** Suggests /compact after 15 turns

**Check Reminder Status:**
```bash
# View compact reminder state
cat ~/.claude/.compact-reminder-state.json
```

**Monitor Context:**
```bash
# Show current context usage
bun ~/.claude/Tools/context-monitor.ts

# Estimate token usage
bun ~/.claude/Tools/context-monitor.ts estimate

# Get optimization suggestions
bun ~/.claude/Tools/context-monitor.ts suggestions
```

---

## MCP Profile Strategy

Reduce Tier 1 context by disabling unused MCPs:

### Profile Selection

**Minimal (3 MCPs)** - Everyday use
```bash
bun ~/.claude/Tools/mcp-profile-switch.ts minimal
```
- content, daemon, Foundry
- Fastest performance
- ~375 tokens for MCPs

**Medium (7 MCPs)** - Development work
```bash
bun ~/.claude/Tools/mcp-profile-switch.ts medium
```
- Minimal + 4 Jagent MCPs
- Balanced functionality
- ~875 tokens for MCPs

**Full (14 MCPs)** - Maximum capabilities
```bash
bun ~/.claude/Tools/mcp-profile-switch.ts full
```
- All MCPs enabled
- ~1,750 tokens for MCPs
- Use when specific tools needed

**Impact:**
- Minimal vs Full: **1,375 token savings** (~30% Tier 1 reduction)

---

## Agent Model Selection

Optimize Tier 1 by matching model to task complexity:

### Model Distribution

**Target:**
- 70% Haiku (fast, parallel operations)
- 25% Sonnet (standard implementation)
- 5% Opus (deep reasoning only)

**Current Configuration:**
```yaml
# Research agents (parallel operations)
claude-researcher: haiku
gemini-researcher: haiku
perplexity-researcher: haiku

# Implementation agents
engineer: sonnet
designer: sonnet
pentester: sonnet
researcher: sonnet

# Strategic planning
architect: opus
```

**Benefits:**
- 10-20x faster parallel operations
- 80% token reduction
- Maintains quality for complex tasks

---

## Monitoring & Validation

### Context Health Checks

**Weekly:**
```bash
# Check context usage
bun ~/.claude/Tools/context-monitor.ts

# Review suggestions
bun ~/.claude/Tools/context-monitor.ts suggestions

# Check MCP profile
bun ~/.claude/Tools/mcp-profile-switch.ts status
```

**Monthly:**
```bash
# Review skill sizes
find ~/.claude/Skills -name "SKILL.md" -exec wc -l {} \; | sort -rn

# Check CORE skill size
wc -l ~/.claude/Skills/CORE/SKILL.md
```

### Optimization Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Tier 1 Base Context** | < 5,000 tokens | ~4,950 | ✅ |
| **CORE Skill Size** | < 3,000 tokens | ~2,600 | ✅ |
| **MCP Count (default)** | ≤ 7 | 14 (full) | ⚠️ Switch to medium |
| **Skill Description** | < 1,024 chars | Varies | ✓ |
| **Turns Between /compact** | < 15 | 0 (new) | ✅ |

---

## Common Mistakes

### ❌ Mistake 1: Verbose YAML Descriptions

**Problem:** Long descriptions increase Tier 1 context
```yaml
# BAD
description: This is a very comprehensive research skill that provides multi-source parallel research capabilities using various researcher agents including Claude WebSearch, Perplexity API, and Google Gemini API. It also includes content extraction via bright-data, YouTube transcript processing using Fabric, and access to 242+ Fabric patterns for specialized analysis. USE WHEN user says...
```

**Solution:** Concise description, details in Tier 2
```yaml
# GOOD
description: Multi-source parallel research using available agents. USE WHEN user says 'do research' OR 'find information about'.
```

### ❌ Mistake 2: Loading Everything in Tier 2

**Problem:** SKILL.md becomes too large
```markdown
# BAD: 1,000+ lines in SKILL.md
[Complete documentation inline]
[All workflows inline]
[All configuration details]
```

**Solution:** Reference Tier 3 docs
```markdown
# GOOD: SKILL.md ~200-300 lines
[Workflow routing table]
[Key examples]
[References to detailed docs]
```

### ❌ Mistake 3: Not Using /compact

**Problem:** Conversation context bloats over time
**Solution:** Use /compact after multi-step tasks

### ❌ Mistake 4: Full MCP Profile Always

**Problem:** 1,750 tokens for MCPs vs 375 for minimal
**Solution:** Switch to minimal or medium for everyday use

### ❌ Mistake 5: Wrong Model Selection

**Problem:** Using Sonnet for parallel research (slow + token-heavy)
**Solution:** Use Haiku for parallel operations (10-20x faster)

---

## Implementation Examples

### Example 1: Optimized Skill Structure

```
Research/
├── SKILL.md                    # Tier 2: ~230 lines
│   ├── YAML frontmatter       # Tier 1: ~50 words
│   ├── Workflow routing       # Clear table
│   ├── Examples              # 2-3 concrete cases
│   └── References            # Point to Tier 3
├── workflows/                 # Tier 2: Loaded on-demand
│   ├── conduct.md
│   ├── claude-research.md
│   └── ...
└── docs/                      # Tier 3: Loaded when needed
    ├── APIConfiguration.md
    ├── TroubleshootingGuide.md
    └── AdvancedFeatures.md
```

### Example 2: Context-Aware Workflow

```markdown
## Multi-Agent Research Workflow

**Execution:**
1. Launch parallel agents (Haiku for speed)
2. Collect results with timeout
3. Synthesize findings
4. Present to user
5. **Use /compact to clean up context** ← CRITICAL
6. Ready for next task
```

### Example 3: Progressive Loading Flow

```
User: "Do research on X"
→ Skill YAML triggers (Tier 1 already loaded)
→ Load Research/SKILL.md (Tier 2)
→ Execute workflow
→ Present results
→ /compact

User: "How do I configure the Research skill?"
→ Load Research/docs/APIConfiguration.md (Tier 3)
→ Answer question
→ Tier 3 doc not needed again unless asked
```

---

## Performance Impact

### Before Optimization

**Tier 1 Context:**
- CORE skill: 3,000 tokens
- 14 MCPs: 1,750 tokens
- Verbose YAML: +500 tokens
- **Total: ~5,250 tokens**

**Issues:**
- Slower response times
- Higher token usage
- Context bloat over time

### After Optimization

**Tier 1 Context:**
- CORE skill: 2,600 tokens
- 7 MCPs (medium): 875 tokens
- Concise YAML: minimal
- **Total: ~3,475 tokens** (-34%)

**Benefits:**
- Faster initialization
- Lower token usage
- More efficient context management
- /compact reminder prevents bloat

---

## Related Documentation

- **Model Selection Guide:** `.claude/Skills/CORE/ModelSelectionGuide.md`
- **CORE Skill:** `.claude/Skills/CORE/SKILL.md`
- **Hook System:** `.claude/Skills/CORE/HookSystem.md`
- **Skill System:** `.claude/Skills/CORE/SkillSystem.md`

---

## Tools

**Context Monitor:**
```bash
bun ~/.claude/Tools/context-monitor.ts           # Show stats
bun ~/.claude/Tools/context-monitor.ts estimate  # Token estimate
bun ~/.claude/Tools/context-monitor.ts suggestions # Optimization tips
```

**MCP Profile Switcher:**
```bash
bun ~/.claude/Tools/mcp-profile-switch.ts status   # Current profile
bun ~/.claude/Tools/mcp-profile-switch.ts minimal  # Switch to minimal
bun ~/.claude/Tools/mcp-profile-switch.ts medium   # Switch to medium
bun ~/.claude/Tools/mcp-profile-switch.ts full     # Switch to full
```

**Performance Benchmarks:**
```bash
bun ~/.claude/Tools/performance-benchmark.ts       # Run benchmarks
bun ~/.claude/Tools/performance-benchmark.ts quick # Quick test
bun ~/.claude/Tools/performance-benchmark.ts report # Show results
```

---

**Version:** 1.0
**Last Updated:** January 1, 2026
**Status:** Active optimization strategy
