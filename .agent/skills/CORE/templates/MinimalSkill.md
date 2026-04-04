---
name: SkillName
description: [What it does]. USE WHEN [intent triggers with OR]. [Capabilities].
contributor: Name (@handle)
location: user
---

# SkillName

[2-3 sentence overview - what this skill does and why it exists]

## Workflow Routing

| Intent | Workflow | When to Use |
|--------|----------|-------------|
| [User wants X] | [WorkflowName] | [Specific trigger condition] |
| [User wants Y] | [WorkflowName2] | [Specific trigger condition] |
| [User wants Z] | [WorkflowName3] | [Specific trigger condition] |

**Available workflows:**
- `workflows/WorkflowName.md` - [One sentence description]
- `workflows/WorkflowName2.md` - [One sentence description]

## Examples

**Example 1: [Primary use case]**
```
User: "[typical user request]"
→ Invokes [Workflow] workflow
→ [Key step 1]
→ [Key step 2]
→ [Expected outcome]
```

**Example 2: [Secondary use case]**
```
User: "[another typical request]"
→ Invokes [Workflow2] workflow
→ [Key step 1]
→ [Expected outcome]
```

**Example 3: [Edge case or alternative]** (optional)
```
User: "[special request]"
→ Invokes [Workflow3] workflow
→ [Handling note]
```

## Core Principles (Optional)

[3-5 bullet points of key principles or philosophy - MAX 50 words total]

## Quick Reference (Optional)

[Bullet list of key facts - MAX 10 bullets, MAX 100 words total]

## Extended Context

For detailed information, see:
- `Reference.md` - [What it contains - one sentence]
- `${PAI_DIR}/Skills/CORE/RelatedDoc.md` - [Cross-reference if needed]

---

**Note:** This skill follows PAI's progressive disclosure pattern. Essential routing and examples are here; detailed methodology lives in Reference files loaded on-demand.

---

## Template Usage

**Key Constraints:**
- YAML frontmatter: Always includes name, description, contributor (optional)
- USE WHEN clause: MANDATORY in description (Claude Code parses this)
- Workflow Routing: CRITICAL section - must be clear and complete
- Examples: MINIMUM 2, MAXIMUM 3 (improves tool selection from 72% to 90%)
- Core Principles: Optional, but if included, keep under 50 words
- Quick Reference: Optional, but if included, keep under 100 words
- Extended Context: MANDATORY - points to Reference.md files

**What to EXCLUDE from SKILL.md:**
- Detailed command reference (→ Reference.md)
- Configuration examples (→ Reference.md)
- Troubleshooting guides (→ Reference.md)
- Best practices lists (→ Reference.md)
- Advanced techniques (→ Reference.md)
- Long-form philosophy (→ Reference.md)

**Target Size:** 80-120 lines for most skills
