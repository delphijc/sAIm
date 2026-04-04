# create-agent Reference Guide

> This is Tier 2 documentation for the create-agent skill. It's loaded on-demand when you need detailed information. For quick routing and examples, see `SKILL.md`.

---

## Agent Architecture Overview

PAI agents are specialized AI personalities designed for specific domains. Each agent has:
- **Minimal AGENT.md** - Loaded at delegation time with metadata and permissions
- **Detailed Reference.md** - Loaded when agent is activated for detailed capabilities
- **Distinct voice/color** - For identification and feedback
- **Specific model choice** - Haiku (fast), Sonnet (standard), Opus (reasoning)

## Progressive Disclosure Templates

When creating a new agent, use these proven templates. They balance delegation efficiency with complete functionality.

### Template 1: Minimal AGENT.md (~75 lines)

```yaml
---
name: AgentName
description: [What this agent does]. USE WHEN [agent delegation trigger]. [Key capabilities].
model: haiku|sonnet|opus
color: color-name
voiceId: Voice Name (Enhanced)
permissions:
  allow:
    - "Bash"
    - "Read(*)"
    - "Write(*)"
    - "Edit(*)"
    - "Grep(*)"
    - "Glob(*)"
    - "WebFetch(domain:*)"
---

# AgentName

[One-sentence overview of this agent's purpose]

## Core Mission

[One paragraph explaining the agent's primary responsibility and philosophy]

## Communication Style

[How this agent communicates with users - tone, formality, verbosity]

## Output Format

[Brief description of how outputs are structured]

For complete methodology and standards, see `Reference.md`

---

**Key Capabilities:**
- [Capability 1]
- [Capability 2]
- [Capability 3]
```

### Template 2: Detailed Reference.md (~120 lines)

```markdown
# AgentName Reference Guide

> This is Tier 2 documentation for the AgentName agent. It's loaded on-demand when you need detailed information. For quick delegation info, see `AGENT.md`.

---

## Agent Philosophy

[One paragraph explaining the agent's core philosophy, approach, and values]

## Core Competencies

### [Competency Area 1]

[Detailed explanation of what this agent excels at and how it approaches this domain]

- Specific skill 1
- Specific skill 2
- Specific skill 3

### [Competency Area 2]

[Detailed explanation of secondary competencies]

## Methodology

### [Key Process 1]

[How the agent approaches this process with specific steps and best practices]

### [Key Process 2]

[Another important workflow]

## Tool Usage and Permissions

### Included Permissions

| Tool | Usage | When |
|------|-------|------|
| Bash | Execute system commands | Complex automation tasks |
| Read | File inspection | Code analysis, configuration review |
| Write | File creation | Code generation, configuration |
| Edit | File modification | Code refactoring, updates |
| Grep | Content search | Finding patterns, code navigation |
| Glob | File discovery | Pattern matching, batch operations |
| WebFetch | URL content retrieval | Research, documentation access |

## Standards and Best Practices

### [Standard Category 1]

- Standard 1: [Explanation and rationale]
- Standard 2: [Explanation and rationale]
- Standard 3: [Explanation and rationale]

### [Standard Category 2]

- Standard 4: [Explanation and rationale]
- Standard 5: [Explanation and rationale]

## Output Format (MANDATORY)

[Complete description of how this agent structures responses, including sections, tone, formatting]

### Structure

```
[Example response structure for this agent]
```

## Security and Authorization

[Any authorization boundaries, restrictions, or security considerations specific to this agent]

---

**Key Point:** This agent prioritizes [primary value] above [secondary concern].
```

---

## Creating a New Agent Step-by-Step

### Step 1: Define Agent Purpose

Ask yourself:
1. What is the primary domain of expertise?
2. What specific tasks should this agent handle?
3. Who is the primary audience?
4. What model is appropriate (haiku/sonnet/opus)?
5. What tools are absolutely necessary?

### Step 2: Choose Agent Metadata

**Model Selection:**
- `haiku` - Quick tasks, grunt work, parallelizable operations (10-20x faster)
- `sonnet` - Standard implementation, most agent work, balance of speed/capability
- `opus` - Deep reasoning, complex architecture, comprehensive analysis

**Voice and Color:**
- Assign unique voice ID (e.g., "Tom (Enhanced)", "Jessica", "Ava (Premium)")
- Assign distinct color for UI identification
- Ensures user recognizes which agent is active

**Permissions Design:**
```yaml
permissions:
  allow:
    - "Bash"           # System commands
    - "Read(*)"        # All file reads
    - "Write(*)"       # All file writes
    - "Edit(*)"        # File editing
    - "MultiEdit(*)"   # Batch edits
    - "Grep(*)"        # Content search
    - "Glob(*)"        # File patterns
    - "WebFetch(domain:*)"  # Any domain
    - "mcp__*"         # All MCP tools
    - "TodoWrite(*)"   # Task tracking
```

### Step 3: Create Directory

Agents live in `.claude/Agents/` (not Skills):

```bash
mkdir -p ${PAI_DIR}/Agents/[AgentName]
```

Example:
```bash
mkdir -p ${PAI_DIR}/Agents/PentestAgent
```

### Step 4: Create Minimal AGENT.md

Using Template 1 above:
- Fill in `name:` (TitleCase)
- Write single-line `description:` with USE WHEN clause for delegation
- Set appropriate `model:` (haiku/sonnet/opus)
- Assign unique `color:` and `voiceId:`
- Define `permissions:` array with necessary tools
- Write Core Mission (one paragraph)
- Describe Communication Style
- Include pointer to Reference.md

**Key Rules:**
- Target: ~60-80 lines
- YAML frontmatter must be complete and valid
- Description must include USE WHEN keyword
- Permissions use wildcard patterns for flexibility
- No unnecessary tool grants

### Step 5: Create Detailed Reference.md

Using Template 2 above:
- Document the agent's philosophy and approach
- Provide detailed competency sections
- Explain methodology for key processes
- Document all tools and why they're needed
- List standards and best practices
- Specify complete output format
- Include any authorization boundaries

**Key Rules:**
- Target: ~100-150 lines
- No YAML frontmatter
- Include "Tier 2 documentation" note at top
- Reference back to AGENT.md for quick info
- Be explicit about security constraints if applicable

### Step 6: Verify Structure

```bash
ls -la ${PAI_DIR}/Agents/[AgentName]/
```

Checklist:
- [ ] `AGENT.md` exists (uppercase)
- [ ] `Reference.md` exists (TitleCase)
- [ ] YAML is valid and complete
- [ ] All tools in permissions are available

### Step 7: Test Delegation

Test that the agent can be delegated to:

```typescript
Task({
  description: "Test task",
  prompt: "Test prompt",
  subagent_type: "agent-name",  // Must match agent YAML name
  model: "haiku"
})
```

### Step 8: Final Validation

Verify the agent meets all requirements:

**AGENT.md Checklist:**
- [ ] YAML has `name:` in TitleCase
- [ ] YAML has single-line `description:` with USE WHEN
- [ ] `model:` is valid (haiku/sonnet/opus)
- [ ] `color:` is set to unique identifier
- [ ] `voiceId:` is set with voice name
- [ ] `permissions:` array is valid and uses wildcards appropriately
- [ ] Core Mission explains primary responsibility
- [ ] Communication Style describes interaction approach
- [ ] Pointer to Reference.md exists

**Reference.md Checklist:**
- [ ] Includes "Tier 2 documentation" note at top
- [ ] Agent Philosophy section explains core approach
- [ ] Core Competencies documented with details
- [ ] Methodology sections explain key processes
- [ ] Tool Usage table matches AGENT.md permissions
- [ ] Standards and best practices listed
- [ ] Complete output format specified
- [ ] Security/authorization boundaries defined

---

## Updating an Existing Agent

To add capabilities or modify an agent while maintaining progressive disclosure:

1. **Minor Update:** Only edit AGENT.md permissions if adding tool
2. **Capability Addition:** Update both AGENT.md and Reference.md
3. **Methodology Change:** Always update Reference.md first, then AGENT.md

Always verify that:
- Permissions in AGENT.md match documented usage in Reference.md
- New capabilities are explained in Reference.md
- USE WHEN clause still accurately describes agent
- Voice and color remain unique

---

## Delegation Pattern

Agents are activated through delegation:

```typescript
Task({
  description: "What the agent will do",
  prompt: "Detailed instructions",
  subagent_type: "agent-name",  // From AGENT.md name field
  model: "haiku|sonnet|opus"    // Override or match AGENT.md
})
```

The agent's AGENT.md loads immediately, Reference.md loads on-demand when activated.

---

## Security and Authorization

### For Security Agents (Pentester, etc.)

Agents requiring authorization must clearly document:
- **Authorization Requirement:** What context/approval is needed
- **Scope Boundaries:** What the agent will/won't do
- **Destructive Operations:** What commands are prohibited
- **Compliance:** Relevant regulations or guidelines

### Permission Levels

- **Full Tools:** `Bash`, `Write(*)`, `Edit(*)` for complete control
- **Read-Only:** `Read(*)`, `Grep(*)` for analysis-only agents
- **Domain-Specific:** `WebFetch(domain:specific-domain)` for restricted access
- **Scoped MCP:** `mcp__tool-name` for specific MCP tools only

---

## Common Mistakes to Avoid

1. **Missing YAML fields:** Always include name, description, model, color, voiceId, permissions
2. **Permissions too broad:** Don't use `Bash` for agents that only need file reading
3. **Permissions too narrow:** Don't restrict agents unnecessarily - use wildcards
4. **Unclear description:** USE WHEN clause must match delegation triggers
5. **Verbose AGENT.md:** Keep it minimal, move details to Reference.md
6. **Inconsistent tooling:** Document all permissions in Reference.md
7. **Missing authorization:** Security agents must define clear boundaries
8. **No output format:** Always specify how agent structures responses

---

## Token Savings Analysis

Following the progressive disclosure pattern for agents provides efficiency:

- **AGENT.md only (delegation):** ~60-80 lines (~30-40 tokens)
- **Reference.md (on-demand):** ~100-150 lines (~50-75 tokens)
- **Traditional monolithic approach:** ~160-230 lines (~80-115 tokens)

**Result:** 50-60% reduction in delegation context while maintaining full capability reference.

---

## Agent Naming Convention

Agents stored in `.claude/Agents/` follow these conventions:

```
.claude/Agents/
├── EngineerAgent/           # TitleCase
│   ├── AGENT.md            # Always uppercase
│   └── Reference.md        # TitleCase
├── PentestAgent/
│   ├── AGENT.md
│   └── Reference.md
├── ResearchAgent/
│   ├── AGENT.md
│   └── Reference.md
```

**Naming Rules:**
- Directories use TitleCase
- AGENT.md is always uppercase
- Reference.md uses TitleCase
- `name:` field in YAML uses TitleCase
