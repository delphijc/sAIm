# create-agent Workflow

Create a new agent following the canonical progressive disclosure structure with proper YAML and permissions.

## Step 1: Read the Authoritative Sources

**REQUIRED FIRST:**

1. Read the agent system documentation: `${PAI_DIR}/Skills/CORE/SkillSystem.md` (covers agent structure)
2. Read an existing agent: `${PAI_DIR}/Agents/Engineer/AGENT.md`
3. Read its reference: `${PAI_DIR}/Agents/Engineer/Reference.md`

## Step 2: Understand the Request

Ask the user:
1. What domain/expertise should this agent have?
2. What specific tasks should it handle?
3. Should it be fast (haiku), standard (sonnet), or reasoning-focused (opus)?
4. What tools does it absolutely need?
5. Is this a security agent requiring authorization boundaries?

## Step 3: Determine Agent Metadata

**Model Selection:**
- `haiku` - Simple/parallel tasks, 10-20x faster
- `sonnet` - Standard implementation, best balance
- `opus` - Complex reasoning, deep analysis

**Voice and Color:**
- Assign unique voice ID (e.g., "Tom (Enhanced)", "Jessica", "Ava (Premium)")
- Assign distinct color (e.g., "green", "purple", "cyan", "blue")
- Ensures recognizable agent identity

**Permissions Design:**
Think about what tools are absolutely necessary:
- Does the agent need to run system commands? → `Bash`
- Does it analyze code? → `Read(*)`, `Grep(*)`
- Does it write code? → `Write(*)`, `Edit(*)`
- Does it search the web? → `WebFetch(domain:*)`
- Does it use MCP tools? → `mcp__*`

## Step 4: Create Agent Directory

Agents live in `.claude/Agents/` not Skills:

```bash
mkdir -p ${PAI_DIR}/Agents/[AgentName]
```

**Example:**
```bash
mkdir -p ${PAI_DIR}/Agents/PentestAgent
```

## Step 5: Create Minimal AGENT.md

Create a lightweight agent definition (~75 lines):

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

[One paragraph explaining the agent's primary responsibility]

## Communication Style

[How this agent communicates - tone, formality, approach]

## Output Format

[Brief description of response structure]

For complete methodology and standards, see `Reference.md`

---

**Key Capabilities:**
- [Capability 1]
- [Capability 2]
- [Capability 3]
```

**Key Rules for AGENT.md:**
- Target: ~60-80 lines
- YAML frontmatter must be complete and valid
- Description must include USE WHEN keyword for delegation
- Permissions use wildcard patterns for flexibility
- No unnecessary tool grants
- Core Mission clearly explains responsibility

## Step 5.5: Create Detailed Reference.md

Create the on-demand reference file (~120 lines) for progressive disclosure:

```markdown
# AgentName Reference Guide

> This is Tier 2 documentation for the AgentName agent. It's loaded on-demand when you need detailed information. For quick delegation info, see `AGENT.md`.

---

## Agent Philosophy

[One paragraph explaining the agent's core philosophy, approach, and values]

## Core Competencies

### [Competency Area 1]

[Detailed explanation of what this agent excels at]

- Skill 1
- Skill 2
- Skill 3

### [Competency Area 2]

[Additional competencies]

## Methodology

### [Key Process 1]

[How the agent approaches this with specific steps]

### [Key Process 2]

[Another important workflow]

## Tool Usage and Permissions

### Included Permissions

| Tool | Purpose | When |
|------|---------|------|
| [Tool] | [What it does] | [When to use] |

## Standards and Best Practices

- Standard 1: [Explanation]
- Standard 2: [Explanation]

## Output Format (MANDATORY)

[Complete description of response structure]

## Security and Authorization

[Any authorization boundaries or restrictions]
```

**Key Rules for Reference.md:**
- Target: ~100-150 lines
- No YAML frontmatter
- Include "Tier 2 documentation" note at top
- Document philosophy, competencies, methodology
- List tool usage and standards
- Specify complete output format
- Define any security/authorization boundaries

## Step 6: Verify Structure

```bash
ls -la ${PAI_DIR}/Agents/[AgentName]/
```

Checklist:
- [ ] `AGENT.md` exists (uppercase)
- [ ] `Reference.md` exists (TitleCase)
- [ ] YAML is valid JSON-compatible format
- [ ] All permissions tools exist and are necessary

## Step 7: Verify YAML Validity

```bash
cat ${PAI_DIR}/Agents/[AgentName]/AGENT.md | head -20
```

Verify:
- All YAML quotes are consistent
- No trailing colons without values
- Indentation is consistent (2 spaces)
- All array items use `-` prefix

## Step 8: Test Delegation

Test that the agent can be used:

```typescript
// Should be able to delegate to the new agent
Task({
  description: "Test task",
  prompt: "Test the new agent",
  subagent_type: "agent-name",  // Must match name field
  model: "haiku"
})
```

For agents that write code or modify files, use `isolation: "worktree"` to sandbox execution in a temporary git worktree. The worktree is auto-cleaned if no changes are made; if changes are made, the branch is returned for review:

```typescript
Task({
  description: "Test task with isolation",
  prompt: "Test the new agent",
  subagent_type: "agent-name",
  isolation: "worktree"
})
```

## Step 9: Final Checklist

### AGENT.md Structure
- [ ] `name:` uses TitleCase (matches directory name)
- [ ] `description:` is single-line with USE WHEN
- [ ] `model:` is valid (haiku/sonnet/opus)
- [ ] `color:` is unique and recognizable
- [ ] `voiceId:` is set to distinctive voice
- [ ] `permissions:` array uses wildcard patterns
- [ ] Core Mission clearly explains purpose
- [ ] Communication Style describes approach
- [ ] Pointer to Reference.md at bottom

### Reference.md Structure
- [ ] "Tier 2 documentation" note at top
- [ ] Agent Philosophy explains core approach
- [ ] Core Competencies documented
- [ ] Methodology sections explain processes
- [ ] Tool Usage matches AGENT.md permissions
- [ ] Standards and best practices listed
- [ ] Output format completely specified
- [ ] Security/authorization defined (if applicable)

### Naming Conventions
- [ ] Agent directory uses TitleCase (e.g., `PentestAgent`)
- [ ] AGENT.md filename is uppercase
- [ ] Reference.md filename uses TitleCase
- [ ] `name:` field matches directory name

### Permissions Validation
- [ ] Only necessary tools are granted
- [ ] Wildcard patterns used appropriately
- [ ] All permissions documented in Reference.md
- [ ] Security agents define authorization boundaries

## Done

Agent created following canonical progressive disclosure structure:
- Minimal AGENT.md (~75 lines) loaded at delegation time
- Detailed Reference.md (~120 lines) loaded on-demand
- Results in 50-60% reduction in delegation context
- Agent immediately ready for use in Task() delegation
