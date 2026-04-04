# Custom Skill System

**The MANDATORY configuration system for ALL PAI skills.**

---

## THIS IS THE AUTHORITATIVE SOURCE

This document defines the **required structure** for every skill in the PAI system.

**ALL skill creation MUST follow this structure.**

**"Canonicalize a skill"** = Restructure it to match this exact format, including TitleCase naming.

---

## TitleCase Naming Convention (MANDATORY)

**All naming in the skill system MUST use TitleCase (PascalCase).**

| Component | Wrong | Correct |
|-----------|-------|---------|
| Skill directory | `createskill`, `create-skill` | `create-skill` |
| Workflow files | `create.md`, `update-info.md` | `Create.md`, `UpdateInfo.md` |
| Reference docs | `prosody-guide.md` | `ProsodyGuide.md` |
| Tool files | `manage-server.ts` | `ManageServer.ts` |
| YAML name | `name: create-skill` | `name: create-skill` |

**Exception:** `SKILL.md` is always uppercase (convention for the main skill file).

---

## The Required Structure

Every SKILL.md has two parts:

### 1. YAML Frontmatter (Single-Line Description)

```yaml
---
name: SkillName
description: [What it does]. USE WHEN [intent triggers using OR]. [Additional capabilities].
---
```

**Rules:**
- `name` uses **TitleCase**
- `description` is a **single line** (not multi-line with `|`)
- `USE WHEN` keyword is **MANDATORY** (Claude Code parses this for skill activation)
- Use intent-based triggers with `OR` for multiple conditions
- Max 1024 characters (Anthropic hard limit)

### 2. Markdown Body

```markdown
# SkillName

[Brief description]

## Workflow Routing

**When executing a workflow, do BOTH of these:**

1. **Call the notification script** (for observability tracking):
   ```bash
   ~/.claude/Tools/SkillWorkflowNotification WORKFLOWNAME SKILLNAME
   ```

2. **Output the text notification** (for user visibility):
   ```
   Running the **WorkflowName** workflow from the **SKILLNAME** skill...
   ```

This ensures workflows appear in the observability dashboard AND the user sees the announcement.

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

## [Additional Sections]
```

---

## Examples Section (REQUIRED)

**Every skill MUST have an `## Examples` section** showing 2-3 concrete usage patterns.

**Why Examples Matter:**
- Anthropic research shows examples improve tool selection accuracy from 72% to 90%
- Descriptions tell Claude WHEN to activate; examples show HOW the skill works

**Example Format:**
```markdown
## Examples

**Example 1: [Use case name]**
```
User: "[Actual user request]"
→ Invokes WorkflowName workflow
→ [What the skill does]
→ [What user receives back]
```
```

---

## Progressive Disclosure Pattern (SKILL.md + Reference.md)

Starting 2026-01-07, all new skills and refactored skills follow the **Progressive Disclosure Pattern** for optimal token efficiency.

### The Pattern: Minimal SKILL.md + Detailed Reference.md

The goal: Keep SKILL.md minimal (80-120 lines) for session startup efficiency, move detailed content to `Reference.md` (loaded on-demand).

**Tier 1 (Always Loaded at Session Start):**
- YAML frontmatter (~20 lines)
- Workflow routing table (~10 lines)
- 2-3 brief examples (~20 lines)
- Extended Context section pointing to Reference.md

**Tier 2 (Loaded When Skill Activates):**
- Full `Reference.md` file
- Detailed methodology, configuration, troubleshooting
- Best practices, common patterns
- No size limits—as detailed as needed

### How to Use the Templates

**For New Skills:**
1. Copy `${PAI_DIR}/Skills/CORE/templates/MinimalSkill.md` → Your skill's `SKILL.md`
2. Copy `${PAI_DIR}/Skills/CORE/templates/SkillReference.md` → Your skill's `Reference.md`
3. Fill in the templates with your skill's content
4. **Keep SKILL.md under 120 lines**
5. Put everything detailed in Reference.md

**For Refactoring Existing Skills:**
1. Use the `skill-refactor.ts` tool (see Phase 6 in implementation plan)
2. Or manually split using the templates above
3. Test that skill activation still works
4. Verify Reference.md loads correctly

### Example: ffuf Skill Refactoring

**Before (501 lines in SKILL.md):**
- YAML + description
- Full command reference
- All filtering options
- Rate limiting details
- Troubleshooting
- Best practices
- Resources
- **Problem:** Bloats context even when just routing

**After (100 lines SKILL.md + 400 lines Reference.md):**
- SKILL.md: Routing table + 3 examples + "See Reference.md for details"
- Reference.md: Everything else
- **Result:** ~400 lines saved from session startup context

### Token Savings

**Per Skill Activation:**
- ffuf: ~250 tokens saved
- story-explanation: ~200 tokens saved
- PackInstall: ~175 tokens saved

**Per Session Startup (across all skills):**
- ~1,400 tokens saved by keeping minimal SKILL.md files

### Implementation Status

| Status | Skills | Notes |
|--------|--------|-------|
| ✅ Planned | 27 total | Full refactoring roadmap in place |
| 🔄 In Progress | CORE, ffuf, story-explanation, PackInstall | Phase 2-3 of implementation |
| ⏳ Pending | 22 other skills | Phase 2 continuation |

---

## Intent Matching, Not String Matching

We use **intent matching**, not exact phrase matching.

**Example description:**
```yaml
description: Complete blog workflow. USE WHEN user mentions doing anything with their blog, website, site, including things like update, proofread, write, edit, publish, preview, blog posts, or website pages.
```

**Key Principles:**
- Use intent language: "user mentions", "user wants to", "including things like"
- Don't list exact phrases in quotes
- Cover the domain conceptually
- Use `OR` to combine multiple trigger conditions

---

## Directory Structure

Every skill follows this structure:

```
SkillName/                    # TitleCase directory name
├── SKILL.md                  # Main skill file (always uppercase)
├── ReferenceDoc.md           # Optional: Reference docs (TitleCase)
├── tools/                    # CLI tools (ALWAYS present, even if empty)
│   ├── ToolName.ts           # TypeScript CLI tool (TitleCase)
│   └── ToolName.help.md      # Tool documentation (TitleCase)
└── workflows/
    ├── Create.md             # Work execution workflow (TitleCase)
    └── Update.md             # Work execution workflow (TitleCase)
```

---

## Workflows vs Reference Documentation

**CRITICAL DISTINCTION:**

### Workflows (`workflows/` directory)
- Operational procedures (create, update, delete, deploy)
- Step-by-step execution instructions
- Actions that change state or produce output
- Things you "run" or "execute"

### Reference Documentation (skill root)
- Guides and how-to documentation
- Specifications and schemas
- Information you "read" or "reference"

---

## Complete Checklist

Before a skill is complete:

### Naming (TitleCase)
- [ ] Skill directory uses TitleCase
- [ ] All workflow files use TitleCase
- [ ] All reference docs use TitleCase
- [ ] YAML `name:` uses TitleCase

### YAML Frontmatter
- [ ] Single-line description with embedded `USE WHEN` clause
- [ ] No separate `triggers:` or `workflows:` arrays
- [ ] Description under 1024 characters

### Markdown Body
- [ ] `## Workflow Routing` section with table format
- [ ] `## Examples` section with 2-3 concrete patterns
- [ ] All workflows have routing entries

### Structure
- [ ] `tools/` directory exists (even if empty)
- [ ] No `backups/` directory inside skill
- [ ] Workflows contain ONLY execution procedures
- [ ] Reference docs live at skill root

---

## Summary

| Component | Purpose | Naming |
|-----------|---------|--------|
| **Skill directory** | Contains all skill files | TitleCase (e.g., `Blogging`) |
| **SKILL.md** | Main skill file | Always uppercase |
| **Workflow files** | Execution procedures | TitleCase (e.g., `Create.md`) |
| **Reference docs** | Information to read | TitleCase (e.g., `ApiReference.md`) |
| **Tool files** | CLI automation | TitleCase (e.g., `ManageServer.ts`) |

This system ensures:
1. Skills invoke properly based on intent (USE WHEN in description)
2. Specific functionality executes accurately (Workflow Routing in body)
3. All skills have consistent, predictable structure
4. **All naming follows TitleCase convention**
