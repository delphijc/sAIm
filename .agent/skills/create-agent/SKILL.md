---
name: create-agent
description: "Create custom subagents following Claude Code documentation. USE WHEN creating a new agent definition, validating, or updating agents for task delegation and parallel execution. NOT WHEN creating a new skill (use create-skill)."
disable-model-invocation: false
user-invocable: true
---

# create-agent

Create new subagents following [Claude Code Agent documentation](https://code.claude.com/docs/en/sub-agents) with proper YAML frontmatter and system prompts.

## Quick Reference: Agent File Structure

```
.claude/agents/
├── my-agent/
│   ├── AGENT.md          # Subagent configuration + system prompt
│   └── (optional supporting files)
```

## Agent Configuration (AGENT.md Format)

Agents are defined in markdown with YAML frontmatter. The frontmatter controls the agent's behavior, and the markdown body becomes the system prompt:

```yaml
---
name: lowercase-with-hyphens
description: Brief description. Use WHEN [trigger condition]. [Key capability].
tools: Read, Grep, Glob, Bash
model: sonnet
skills:
  - skill-name-1
  - skill-name-2
permissionMode: default
maxTurns: 10
---

# Agent System Prompt

You are a [role]. Your responsibilities:
1. [Core task 1]
2. [Core task 2]

When working on tasks:
- [Principle 1]
- [Principle 2]

Output format: [Describe how you structure responses]
```

## YAML Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (lowercase, hyphens only, max 64 chars) |
| `description` | Yes | What agent does + USE WHEN trigger + key capability |
| `tools` | No | Tools agent can use (inherits all if omitted) |
| `disallowedTools` | No | Tools to explicitly deny |
| `model` | No | `sonnet`, `opus`, `haiku`, or `inherit` (default: inherit) |
| `permissionMode` | No | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | Max agentic turns before stopping |
| `skills` | No | Skills to preload into agent context |
| `mcpServers` | No | MCP servers available to agent |
| `hooks` | No | Lifecycle hooks for agent |
| `memory` | No | Persistent memory scope: `user`, `project`, `local` |
| `background` | No | Set to `true` for background execution |
| `isolation` | No | Set to `worktree` for git worktree isolation |

## Examples

**Example 1: Code Reviewer Agent**
```yaml
---
name: code-reviewer
description: Expert code review specialist. Use WHEN reviewing code for quality and best practices. Identifies bugs, performance issues, and security concerns.
tools: Read, Grep, Glob, Bash
model: sonnet
---

You are a senior code reviewer ensuring high standards...
```

**Example 2: Research Agent with Preloaded Skills**
```yaml
---
name: researcher
description: Deep research specialist. Use WHEN conducting comprehensive investigations. Synthesizes information from multiple sources.
tools: Read, Grep, Glob, Bash, WebFetch
skills:
  - research
  - content-creation
model: sonnet
---

You are a research specialist...
```

**Example 3: Data Scientist with Restricted Tools**
```yaml
---
name: data-scientist
description: Data analysis expert. Use WHEN analyzing data or generating reports. Read-only database access.
tools: Bash, Read
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
model: sonnet
---

You are a data scientist with read-only access...
```

## Creating Agents: Step-by-Step

### Step 1: Determine Agent Specs
- **Name**: lowercase-with-hyphens (matches directory name)
- **Purpose**: Clear description with USE WHEN trigger
- **Model**: haiku (fast), sonnet (balanced), opus (reasoning)
- **Tools**: Only what's necessary
- **Skills**: Which preloaded skills does it need?

### Step 2: Create Agent Directory
```bash
mkdir -p .claude/agents/my-agent
```

### Step 3: Write AGENT.md
- Keep under 150 lines (context efficient)
- Frontmatter with all required fields
- System prompt explaining agent role and approach
- Clear output format specification

### Step 4: Add Supporting Files (Optional)
- Templates for common outputs
- Example workflows
- Reference documentation

### Step 5: Test the Agent
```bash
claude --agent my-agent [test-description]
```

## Scope and Locations

| Location | Scope | Priority |
|----------|-------|----------|
| `.claude/agents/` | Current project | Highest |
| `~/.claude/agents/` | All projects (user-level) | Medium |
| Plugin's `agents/` | Where plugin enabled | Lowest |

**Project agents** should be committed to version control for team collaboration.

## Model Selection Guide

| Model | Best For | Speed | Cost |
|-------|----------|-------|------|
| **haiku** | Simple tasks, parallel execution | Fastest | Cheapest |
| **sonnet** | Standard work, balanced | Fast | Moderate |
| **opus** | Complex reasoning, analysis | Slower | More expensive |

## Tool Access Patterns

```yaml
# Allow only read tools
tools: Read, Grep, Glob

# Allow specific Bash commands
tools: Bash

# Restrict with disallowedTools
tools: Read, Write, Edit
disallowedTools: Bash, WebFetch

# Only specific Agent types can be spawned
tools: Agent(worker, researcher)
```

## Common Patterns

### Read-Only Reviewer
```yaml
tools: Read, Grep, Glob, Bash
```

### Code Implementer
```yaml
tools: Read, Write, Edit, Bash, Grep, Glob
```

### Web Research Specialist
```yaml
tools: Read, Grep, Glob, WebFetch, Bash
```

### Parallel Workers
```yaml
tools: Agent(worker), Read, Write, Bash
maxTurns: 20
```

## Validation Checklist

- [ ] Agent in `.claude/agents/[name]/AGENT.md`
- [ ] YAML frontmatter is valid
- [ ] `name` field matches directory name
- [ ] `description` includes USE WHEN trigger
- [ ] Only necessary tools granted
- [ ] System prompt is clear and actionable
- [ ] Output format explicitly defined
- [ ] Skills listed match actual skill names
- [ ] No sensitive data in system prompt

## Next Steps

1. **Create your first agent**: Describe what the agent should do
2. **Test delegation**: Use the Agent tool to invoke your agent
3. **Iterate**: Refine the system prompt based on behavior
4. **Document**: Add supporting files if complex workflows

For detailed examples and patterns, see:
- [Claude Code Subagents Guide](https://code.claude.com/docs/en/sub-agents)
- [Subagent Examples](https://code.claude.com/docs/en/sub-agents#example-subagents)
