# ValidateAgent Workflow

**Purpose:** Check if an existing agent follows the canonical progressive disclosure structure with proper YAML and permissions.

---

## Step 1: Read the Authoritative Source

**REQUIRED FIRST:** Read the canonical structure:

```
${PAI_DIR}/Skills/CORE/SkillSystem.md
```

---

## Step 2: Read the Target Agent Files

Progressive disclosure structure requires both files:

```bash
${PAI_DIR}/Agents/[AgentName]/AGENT.md
${PAI_DIR}/Agents/[AgentName]/Reference.md
```

---

## Step 3: Check Progressive Disclosure Structure

### Both Files Exist?
```bash
ls -la ${PAI_DIR}/Agents/[AgentName]/
```

Verify:
- ✓ `AGENT.md` exists (uppercase, ~60-80 lines)
- ✓ `Reference.md` exists (TitleCase, ~100-150 lines)
- ✓ AGENT.md has pointer to Reference.md
- ✓ Reference.md has "Tier 2 documentation" note at top

**Expected output:**
```
AGENT.md
Reference.md
```

---

## Step 4: Validate AGENT.md YAML

### Check YAML Syntax

```bash
cat ${PAI_DIR}/Agents/[AgentName]/AGENT.md | head -20
```

Verify the frontmatter:
```yaml
---
name: AgentName
description: [What it does]. USE WHEN [triggers]. [Capabilities].
model: haiku|sonnet|opus
color: color-name
voiceId: Voice Name (Enhanced)
permissions:
  allow:
    - "Tool1"
    - "Tool2"
---
```

**Check for violations:**
- Missing `name:` field (WRONG)
- `name:` not in TitleCase (WRONG)
- Missing `description:` field (WRONG)
- Description missing USE WHEN keyword (WRONG)
- Missing `model:` field (WRONG)
- `model:` not in (haiku|sonnet|opus) (WRONG)
- Missing `color:` field (WRONG)
- Missing `voiceId:` field (WRONG)
- Missing `permissions:` array (WRONG)
- `permissions:` not structured as array with `allow:` list (WRONG)
- `allow:` list items missing `-` prefix (WRONG)
- Inconsistent indentation (WRONG)

---

## Step 5: Check Agent Metadata

### Name Validation
```bash
grep "^name:" ${PAI_DIR}/Agents/[AgentName]/AGENT.md
```

Verify:
- ✓ `name:` matches directory name (TitleCase)
- ✓ No hyphens or underscores in name
- ✓ Single word or CamelCase

Examples:
- ✓ `name: Engineer`
- ✓ `name: PentestAgent`
- ✗ `name: pentestagent` (lowercase)
- ✗ `name: pentest-agent` (hyphenated)

### Description Validation
```bash
grep "^description:" ${PAI_DIR}/Agents/[AgentName]/AGENT.md
```

Verify:
- ✓ Single-line description with USE WHEN clause
- ✓ Format: "[What it does]. USE WHEN [triggers using OR]. [Capabilities]."
- ✓ Under 1024 characters
- ✓ Intent-based triggers, not exact phrases

Example:
- ✓ "Conducts security testing. USE WHEN user requests penetration tests, vulnerability assessments, or security audits. Authorized testing only."
- ✗ "Security testing agent" (missing USE WHEN)
- ✗ "Conducts |..." (multiline)

### Model Validation
```bash
grep "^model:" ${PAI_DIR}/Agents/[AgentName]/AGENT.md
```

Verify:
- ✓ One of: `haiku`, `sonnet`, `opus`
- ✗ Empty or invalid model names

### Voice and Color Validation
```bash
grep "voiceId:\|color:" ${PAI_DIR}/Agents/[AgentName]/AGENT.md
```

Verify:
- ✓ Both fields present
- ✓ Unique voice across agents
- ✓ Unique color across agents
- ✓ Voice format: "Name (Tier)" e.g., "Tom (Enhanced)", "Jessica"

---

## Step 6: Validate Permissions Array

### Check Permissions Exist
```bash
grep -A 5 "^permissions:" ${PAI_DIR}/Agents/[AgentName]/AGENT.md
```

Verify:
- ✓ `permissions:` key exists
- ✓ `allow:` key exists under it
- ✓ Array items use `-` prefix
- ✓ Tools are quoted strings

### Check Tool Validity

Valid tools:
- ✓ `"Bash"`
- ✓ `"Read(*)"`
- ✓ `"Write(*)"`
- ✓ `"Edit(*)"`
- ✓ `"MultiEdit(*)"`
- ✓ `"Grep(*)"`
- ✓ `"Glob(*)"`
- ✓ `"WebFetch(domain:*)"`
- ✓ `"mcp__*"`
- ✓ `"TodoWrite(*)"`

**Check for violations:**
- Tools without quotes (WRONG)
- Lowercase tool names (WRONG)
- Non-existent tools (WRONG)
- Overly restrictive patterns like `"Read(/path/only)"` when `"Read(*)"` intended (REVIEW)

---

## Step 7: Check AGENT.md Markdown Body

### Body Checklist
```bash
grep "^##" ${PAI_DIR}/Agents/[AgentName]/AGENT.md
```

Verify sections:
- [ ] One-sentence overview/description
- [ ] `## Core Mission` section (one paragraph)
- [ ] `## Communication Style` section
- [ ] `## Output Format` section
- [ ] `## Extended Context` section pointing to Reference.md
- [ ] `**Key Capabilities:**` section listing abilities

**Check for violations:**
- Missing Core Mission (WRONG)
- Missing Communication Style (WRONG)
- Missing Output Format (WRONG)
- No reference to Reference.md (WRONG)

---

## Step 8: Check Reference.md Contents

### Reference Structure
```bash
grep "^#\|^##" ${PAI_DIR}/Agents/[AgentName]/Reference.md | head -20
```

Verify major sections:
- [ ] "Tier 2 documentation" note at very top
- [ ] `# AgentName Reference Guide` title
- [ ] `## Agent Philosophy` section
- [ ] `## Core Competencies` section with subsections
- [ ] `## Methodology` section
- [ ] `## Tool Usage and Permissions` section
- [ ] `## Standards and Best Practices` section
- [ ] `## Output Format (MANDATORY)` section
- [ ] Security/Authorization section (if applicable)

### Content Validation
- [ ] Agent Philosophy explains core approach
- [ ] Core Competencies clearly define capabilities
- [ ] Methodology explains key processes
- [ ] Tool Usage table matches AGENT.md permissions exactly
- [ ] Output Format is complete and specific to agent
- [ ] All tools in AGENT.md are documented
- [ ] Security boundaries defined (for security agents)

---

## Step 9: Check Consistency

### AGENT.md ↔ Reference.md Consistency
- [ ] All tools in AGENT.md permissions are documented in Reference.md
- [ ] Tool usage in Reference.md matches permissions granted
- [ ] Core Mission in AGENT.md aligns with Agent Philosophy in Reference.md
- [ ] Output Format in AGENT.md overview matches detailed format in Reference.md
- [ ] Model choice aligns with described competencies
- [ ] Voice and color are unique across all agents

---

## Step 10: Report Results

**COMPLIANT** if all checks pass:

### Progressive Disclosure Structure
- [ ] Both `AGENT.md` and `Reference.md` exist
- [ ] AGENT.md is ~60-80 lines (delegation minimal)
- [ ] Reference.md is ~100-150 lines (on-demand detailed)
- [ ] AGENT.md has pointer to Reference.md
- [ ] Reference.md has "Tier 2 documentation" note

### YAML Frontmatter
- [ ] All required fields present (name, description, model, color, voiceId, permissions)
- [ ] `name:` uses TitleCase
- [ ] `description:` is single-line with `USE WHEN`
- [ ] `model:` is valid (haiku|sonnet|opus)
- [ ] `color:` is unique
- [ ] `voiceId:` is unique
- [ ] `permissions:` array structure is valid
- [ ] All tools in permissions are documented

### AGENT.md Markdown Body
- [ ] Core Mission section explains primary responsibility
- [ ] Communication Style section describes interaction approach
- [ ] Output Format section specifies response structure
- [ ] Extended Context section points to Reference.md
- [ ] Key Capabilities list is accurate
- [ ] One-sentence overview at top

### Reference.md Contents
- [ ] Agent Philosophy explains core approach
- [ ] Core Competencies documented with details
- [ ] Methodology explains key processes
- [ ] Tool Usage table matches AGENT.md permissions
- [ ] Standards and best practices listed
- [ ] Output Format completely specified
- [ ] Security/authorization boundaries defined (if applicable)

### Naming Conventions
- [ ] Agent directory uses TitleCase (e.g., `PentestAgent`)
- [ ] AGENT.md filename is uppercase
- [ ] Reference.md filename uses TitleCase
- [ ] `name:` field matches directory name

**NON-COMPLIANT** if any check fails. Recommend using CanonicalizeAgent workflow to fix issues.

**OPTIMAL** Result: Agent follows progressive disclosure pattern with minimal delegation footprint and full on-demand capability reference.
