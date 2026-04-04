# create-skill Reference Guide

> This is Tier 2 documentation for the create-skill skill. It's loaded on-demand when you need detailed information. For quick routing and examples, see `SKILL.md`.

---

## Progressive Disclosure Templates

When creating a new skill, use these proven templates. They balance startup efficiency with complete functionality.

### Template 1: Minimal SKILL.md (~75 lines)

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

### Template 2: Detailed Reference.md (~120 lines)

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

[Document which tools this skill uses and why]

### Recommended Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| [Tool Name] | [What it does] | [When to use it] |
| [Tool Name] | [What it does] | [When to use it] |

## Standards and Best Practices

- Standard 1: [Explanation]
- Standard 2: [Explanation]
- Standard 3: [Explanation]

## Common Patterns

### Pattern 1: [Use Case]

[Description of how to handle this common scenario]

### Pattern 2: [Use Case]

[Description of how to handle this common scenario]

---

**Key Point:** This skill prioritizes [primary value] above [secondary concern].
```

---

## Creating a New Skill Step-by-Step

### Step 1: Gather Requirements

Ask the user:
1. What does this skill do?
2. What should trigger it?
3. What workflows does it need?
4. What's the primary methodology/philosophy?

### Step 2: Create Directory Structure

```bash
mkdir -p ${PAI_DIR}/Skills/[SkillName]/workflows
mkdir -p ${PAI_DIR}/Skills/[SkillName]/tools
```

### Step 3: Create Minimal SKILL.md

Using the Template 1 above:
- Fill in `name:` (TitleCase)
- Write single-line `description:` with USE WHEN clause
- Create Workflow Routing table for each workflow
- Add 2-3 concrete examples
- Include pointer to Reference.md

**Key Rules:**
- Target: ~60-80 lines
- YAML frontmatter must be complete
- Description must include USE WHEN keyword
- Examples must show actual user requests and outcomes

### Step 4: Create Detailed Reference.md

Using the Template 2 above:
- Document the skill's philosophy and approach
- Provide detailed methodology sections
- Include domain-specific knowledge
- Document all tools used
- List standards and best practices
- Provide common pattern examples

**Key Rules:**
- Target: ~100-150 lines
- No YAML frontmatter needed
- Include "Tier 2 documentation" note at top
- Reference back to SKILL.md for quick info

### Step 5: Create Workflow Files

For each workflow in the routing table:

```bash
touch ${PAI_DIR}/Skills/[SkillName]/workflows/[WorkflowName].md
```

Write actionable workflow documentation inside.

### Step 6: Verify Structure

```bash
ls -la ${PAI_DIR}/Skills/[SkillName]/
```

Checklist:
- [ ] `SKILL.md` exists (uppercase)
- [ ] `Reference.md` exists (TitleCase)
- [ ] `workflows/` directory exists with TitleCase files
- [ ] `tools/` directory exists (even if empty)
- [ ] All workflow routing entries have corresponding files

### Step 7: Final Validation

Verify the skill meets all requirements:

**SKILL.md Checklist:**
- [ ] YAML has `name:` in TitleCase
- [ ] YAML has single-line `description:` with USE WHEN
- [ ] Workflow Routing table is complete
- [ ] All examples are concrete and realistic
- [ ] Pointer to Reference.md exists

**Reference.md Checklist:**
- [ ] Includes "Tier 2 documentation" note
- [ ] Philosophy section explains core approach
- [ ] Methodology sections are detailed
- [ ] Tool usage is documented
- [ ] Standards and best practices listed
- [ ] Common patterns explained

**File Structure Checklist:**
- [ ] TitleCase used everywhere except SKILL.md
- [ ] All workflow files have routing entries
- [ ] Routing file paths match actual files exactly
- [ ] No backup files inside skill directory
- [ ] tools/ directory exists

---

## Updating an Existing Skill

To add workflows or modify a skill while maintaining progressive disclosure:

1. **Minimal Change:** Only edit `SKILL.md` routing table if adding workflow
2. **Major Addition:** Update both SKILL.md and Reference.md
3. **New Methodology:** Always update Reference.md first, then SKILL.md examples

Always verify TitleCase naming in workflow files.

---

## Token Savings Analysis

Following the progressive disclosure pattern provides significant context efficiency:

- **SKILL.md only (startup):** ~60-80 lines (~30-40 tokens)
- **Reference.md (on-demand):** ~100-150 lines (~50-75 tokens)
- **Traditional monolithic approach:** ~160-230 lines (~80-115 tokens)

**Result:** 50-60% reduction in session startup context while maintaining full functionality.

---

## Common Mistakes to Avoid

1. **Multi-line descriptions:** Keep description single-line in YAML
2. **Separate triggers array:** Use USE WHEN in description instead
3. **Lowercase workflow names:** Always use TitleCase
4. **Missing examples:** Skill won't activate properly without examples
5. **Backups in skill dir:** Use History directory instead
6. **No tools/ directory:** Must exist even if empty
7. **Reference.md without context note:** Always include "Tier 2" indicator
8. **Overly detailed SKILL.md:** Keep startup file minimal, move details to Reference.md

