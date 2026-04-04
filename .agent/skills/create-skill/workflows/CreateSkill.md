# create-skill Workflow

Create a new skill following the canonical structure with proper TitleCase naming.

## Step 1: Read the Authoritative Sources

**REQUIRED FIRST:**

1. Read the skill system documentation: `${PAI_DIR}/Skills/CORE/SkillSystem.md`
2. Read the canonical example: `${PAI_DIR}/Skills/Blogging/SKILL.md`

## Step 2: Understand the Request

Ask the user:
1. What does this skill do?
2. What should trigger it?
3. What workflows does it need?

## Step 3: Determine TitleCase Names

**All names must use TitleCase (PascalCase).**

| Component | Format | Example |
|-----------|--------|---------|
| Skill directory | TitleCase | `Blogging`, `Daemon`, `create-skill` |
| Workflow files | TitleCase.md | `Create.md`, `UpdateDaemonInfo.md` |
| Reference docs | TitleCase.md | `ProsodyGuide.md`, `ApiReference.md` |
| Tool files | TitleCase.ts | `ManageServer.ts` |
| Help files | TitleCase.help.md | `ManageServer.help.md` |

**Wrong naming (NEVER use):**
- `create-skill`, `create_skill`, `CREATESKILL` → Use `create-skill`
- `create.md`, `CREATE.md`, `create-info.md` → Use `Create.md`, `CreateInfo.md`

## Step 4: Create the Skill Directory

```bash
mkdir -p ${PAI_DIR}/Skills/[SkillName]/workflows
mkdir -p ${PAI_DIR}/Skills/[SkillName]/tools
```

**Example:**
```bash
mkdir -p ${PAI_DIR}/Skills/Daemon/workflows
mkdir -p ${PAI_DIR}/Skills/Daemon/tools
```

## Step 5: Create Minimal SKILL.md

Create a lightweight startup file (~75 lines):

```yaml
---
name: SkillName
description: [What it does]. USE WHEN [intent triggers using OR]. [Additional capabilities].
---

# SkillName

[One-sentence overview of what this skill does]

## Workflow Routing

**When executing a workflow, output this notification:**

```
Running the **WorkflowName** workflow from the **SkillName** skill...
```

| Workflow | Trigger | File |
|----------|---------|------|
| **WorkflowOne** | "trigger phrase" | `workflows/WorkflowOne.md` |
| **WorkflowTwo** | "another trigger" | `workflows/WorkflowTwo.md` |

## Examples

**Example 1: [Common use case]**
```
User: "[Typical user request]"
→ Invokes WorkflowOne workflow
→ [What skill does]
→ [What user gets back]
```

**Example 2: [Another use case]**
```
User: "[Different request]"
→ Invokes WorkflowTwo workflow
→ [Process]
→ [Output]
```

## Extended Context

For detailed methodology and standards, see `Reference.md`
```

## Step 5.5: Create Detailed Reference.md

Create the on-demand reference file (~120 lines) for progressive disclosure:

```markdown
# SkillName Reference Guide

> This is Tier 2 documentation for the SkillName skill. It's loaded on-demand when you need detailed information. For quick routing and examples, see `SKILL.md`.

---

## Skill Philosophy

[One paragraph explaining the purpose and core philosophy of this skill]

## Core Methodology

### [Methodology Section 1]

[Detailed explanation of how this skill approaches its primary function]

- Point 1
- Point 2
- Point 3

### [Methodology Section 2]

[Additional methodology explaining secondary functions or key patterns]

## [Domain-Specific Section]

### [Concept 1]

[Detailed explanation with examples]

### [Concept 2]

[Detailed explanation with examples]

## Tool Usage

### Recommended Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| [Tool Name] | [What it does] | [When to use it] |
| [Tool Name] | [What it does] | [When to use it] |

## Standards and Best Practices

- Standard 1: [Explanation]
- Standard 2: [Explanation]

## Common Patterns

### Pattern 1: [Use Case]

[Description of how to handle this common scenario]

### Pattern 2: [Use Case]

[Description of how to handle this common scenario]
```

**Key Rules for Reference.md:**
- Target: ~100-150 lines
- No YAML frontmatter
- Include "Tier 2 documentation" note at top
- Document philosophy, methodology, standards, patterns
- Reference back to SKILL.md for quick info

## Step 6: Create Workflow Files

For each workflow in the routing section:

```bash
touch ${PAI_DIR}/Skills/[SkillName]/workflows/[WorkflowName].md
```

**Examples (TitleCase):**
```bash
touch ${PAI_DIR}/Skills/Daemon/workflows/UpdateDaemonInfo.md
touch ${PAI_DIR}/Skills/Daemon/workflows/UpdatePublicRepo.md
touch ${PAI_DIR}/Skills/Blogging/workflows/Create.md
touch ${PAI_DIR}/Skills/Blogging/workflows/Publish.md
```

## Step 7: Verify TitleCase

Run this check:
```bash
ls ${PAI_DIR}/Skills/[SkillName]/
ls ${PAI_DIR}/Skills/[SkillName]/workflows/
ls ${PAI_DIR}/Skills/[SkillName]/tools/
```

Verify ALL files use TitleCase:
- `SKILL.md` ✓ (exception - always uppercase)
- `WorkflowName.md` ✓
- `ToolName.ts` ✓
- `ToolName.help.md` ✓

## Step 8: Final Checklist

### Progressive Disclosure Structure
- [ ] `SKILL.md` exists (uppercase, ~75 lines for startup)
- [ ] `Reference.md` exists (TitleCase, ~120 lines for on-demand)
- [ ] SKILL.md has pointer to Reference.md at bottom
- [ ] Reference.md has "Tier 2 documentation" note at top

### Naming (TitleCase)
- [ ] Skill directory uses TitleCase (e.g., `Blogging`, `Daemon`)
- [ ] All workflow files use TitleCase (e.g., `Create.md`, `UpdateInfo.md`)
- [ ] All reference docs use TitleCase (e.g., `ProsodyGuide.md`)
- [ ] All tool files use TitleCase (e.g., `ManageServer.ts`)
- [ ] Routing table workflow names match file names exactly

### SKILL.md Contents
- [ ] YAML frontmatter: `name:` in TitleCase
- [ ] YAML frontmatter: Single-line `description:` with USE WHEN clause
- [ ] No separate `triggers:` or `workflows:` arrays in YAML
- [ ] Description uses intent-based language
- [ ] Description is under 1024 characters
- [ ] `## Workflow Routing` section with table format
- [ ] All workflow files have routing entries
- [ ] `## Examples` section with 2-3 concrete usage patterns

### Reference.md Contents
- [ ] "Tier 2 documentation" indicator at top
- [ ] Skill Philosophy section explaining core approach
- [ ] Core Methodology sections with detailed explanations
- [ ] Domain-Specific sections for key concepts
- [ ] Tool Usage section with recommendations
- [ ] Standards and Best Practices listed
- [ ] Common Patterns section with real-world examples

### File Structure
- [ ] `workflows/` directory exists with all workflow files
- [ ] `tools/` directory exists (even if empty)
- [ ] No `backups/` directory inside skill
- [ ] No backup files (.bak, etc.)

## Done

Skill created following canonical progressive disclosure structure:
- Minimal SKILL.md (~75 lines) loads at session startup
- Detailed Reference.md (~120 lines) loads on-demand
- Results in 50-60% reduction in session startup context
