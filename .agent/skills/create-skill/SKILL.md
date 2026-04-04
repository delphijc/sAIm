---
name: create-skill
description: "Create reusable skills extending Claude's capabilities. USE WHEN building new skill packages for knowledge, procedures, or workflows following Claude Code documentation. NOT WHEN creating a new agent (use create-agent)."
disable-model-invocation: false
user-invocable: true
---

# create-skill

Create new skills following [Claude Code Skills documentation](https://code.claude.com/docs/en/skills) with YAML frontmatter and markdown content.

## Quick Reference: Skill File Structure

```
.claude/skills/
├── my-skill/
│   ├── SKILL.md          # Main skill definition
│   ├── reference.md      # Extended reference (optional)
│   ├── examples.md       # Usage examples (optional)
│   └── scripts/
│       └── helper.sh     # Supporting scripts (optional)
```

## Skill Configuration (SKILL.md Format)

Skills are defined in markdown with YAML frontmatter. The frontmatter controls invocation behavior, and the body contains the skill instructions Claude will follow:

```yaml
---
name: my-skill
description: Brief description. Use WHEN [trigger condition].
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Grep, Glob
model: sonnet
---

# My Skill

Skill instructions and knowledge here...
```

## YAML Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (lowercase, hyphens only) |
| `description` | Recommended | When to use this skill. Claude uses this for auto-invocation |
| `disable-model-invocation` | No | Set to `true` to prevent Claude from auto-invoking |
| `user-invocable` | No | Set to `false` to hide from `/` menu (Claude-only) |
| `allowed-tools` | No | Tools Claude can use when skill active |
| `model` | No | Model to use: `sonnet`, `opus`, `haiku`, or `inherit` |
| `context` | No | Set to `fork` to run in isolated subagent |
| `agent` | No | Which subagent type to use with `context: fork` |
| `hooks` | No | Lifecycle hooks for skill execution |
| `argument-hint` | No | Hint for autocomplete (e.g., `[filename]`) |

## Examples

**Example 1: Reference Knowledge Skill**
```yaml
---
name: api-conventions
description: API design patterns for this codebase. Use WHEN writing API endpoints.
user-invocable: false
---

# API Conventions

When writing API endpoints:
- Use RESTful naming conventions
- Return consistent error formats
- Include request validation
```

**Example 2: Task-Based Skill (User-Invocable)**
```yaml
---
name: deploy
description: Deploy the application to production. Use WHEN deploying features.
disable-model-invocation: true
allowed-tools: Bash, Read
---

# Deploy Workflow

1. Run the test suite
2. Build the application
3. Push to deployment target
4. Verify deployment succeeded
```

**Example 3: Research Skill with Forked Execution**
```yaml
---
name: deep-research
description: Research a topic thoroughly in isolation. Use WHEN deep investigation needed.
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob, Bash
---

# Deep Research

Research $ARGUMENTS thoroughly:
1. Find relevant files
2. Analyze and summarize
3. Provide specific references
```

## Skill Types

### Reference Content
Adds knowledge Claude applies to your work. Guidelines, patterns, conventions.

```yaml
---
name: coding-standards
description: Team coding standards and best practices
user-invocable: false
---

Your standards and guidelines here...
```

### Task Content
Step-by-step instructions for specific actions. Often user-invoked.

```yaml
---
name: release
description: Release process checklist
disable-model-invocation: true
---

Release checklist:
1. ...
2. ...
```

### Workflow Content
Complete procedures that combine tools and logic.

```yaml
---
name: code-review
description: Code review checklist and standards
---

Review checklist:
1. ...
```

## Creating Skills: Step-by-Step

### Step 1: Choose Skill Type
- **Reference**: Knowledge/guidelines (user-invocable: false)
- **Task**: Actions/procedures (disable-model-invocation: true)
- **Workflow**: Complex sequences (default invocation)

### Step 2: Define Invocation Behavior
- **Auto-invoke by Claude**: Leave defaults, clear description
- **User-only invocation**: Set `disable-model-invocation: true`
- **Claude-only reference**: Set `user-invocable: false`
- **Isolated subagent**: Set `context: fork`

### Step 3: Create Skill Directory
```bash
mkdir -p .claude/skills/my-skill
```

### Step 4: Write SKILL.md
- Keep under 500 lines
- Clear, actionable instructions
- Frontmatter with all settings
- Examples and use cases

### Step 5: Add Supporting Files (Optional)
```
my-skill/
├── SKILL.md          (required)
├── reference.md      (optional detailed docs)
├── examples.md       (optional usage examples)
└── scripts/
    └── helper.sh     (optional supporting scripts)
```

Reference from `SKILL.md`:
```markdown
For complete API details, see [reference.md](reference.md)
For usage examples, see [examples.md](examples.md)
```

### Step 6: Test the Skill
```bash
# Direct invocation
/my-skill

# With arguments
/my-skill --option value

# Let Claude auto-invoke
# Ask something matching the description
```

## Control Who Invokes Your Skill

| Frontmatter | You Can Use | Claude Can Use | Effect |
|---|---|---|---|
| (default) | Yes (`/skill`) | Yes (auto) | Automatic + manual |
| `disable-model-invocation: true` | Yes (`/skill`) | No | Manual only |
| `user-invocable: false` | No | Yes (auto) | Reference only |

**Use Cases:**

```yaml
# Deploy (manual control)
disable-model-invocation: true

# Architecture guidelines (reference only)
user-invocable: false

# Brainstorming (both manual and auto)
# (default settings)
```

## Advanced Features

### Dynamic Context Injection
Run shell commands before skill loads:

```yaml
---
name: pr-summary
context: fork
---

## Pull request context
- PR diff: !`gh pr diff`
- Comments: !`gh pr view --comments`

Summarize this PR...
```

### Argument Substitution
Pass arguments to skills:

```yaml
argument-hint: "[filename] [format]"
---

Convert $0 (first arg) to $1 (second arg)...
```

### Restricted Tool Access
```yaml
allowed-tools: Read, Grep, Glob
```

## Scope and Locations

| Location | Scope | Priority |
|----------|-------|----------|
| `.claude/skills/` | Current project | Highest |
| `~/.claude/skills/` | All projects (user-level) | Medium |
| Plugin's `skills/` | Where plugin enabled | Lowest |

**Project skills** should be committed to version control.

## Validation Checklist

- [ ] Skill in `.claude/skills/[name]/SKILL.md`
- [ ] YAML frontmatter is valid
- [ ] `name` matches directory name
- [ ] `description` clearly states purpose + USE WHEN
- [ ] Instructions are clear and actionable
- [ ] Supporting files referenced from SKILL.md
- [ ] No secrets or credentials in skill
- [ ] Tool access matches skill functionality
- [ ] Examples provided for complex skills

## Skill vs. Subagent

| Aspect | Skill | Subagent |
|--------|-------|----------|
| **Purpose** | Reference + procedures | Autonomous execution |
| **Context** | Inline with conversation | Isolated context window |
| **Invocation** | You or Claude | Agent delegation |
| **State** | Stateless | Can have memory |
| **Location** | `.claude/skills/` | `.claude/agents/` |

Use **Skills** for knowledge and procedures. Use **Subagents** for delegated execution.

## Next Steps

1. **Create your first skill**: Describe what the skill teaches or does
2. **Test invocation**: Use `/skill-name` or ask Claude to invoke it
3. **Add supporting files**: Reference docs, examples, scripts as needed
4. **Share with team**: Commit project skills to version control

For detailed examples and patterns, see:
- [Claude Code Skills Guide](https://code.claude.com/docs/en/skills)
- [Advanced Patterns](https://code.claude.com/docs/en/skills#advanced-patterns)
