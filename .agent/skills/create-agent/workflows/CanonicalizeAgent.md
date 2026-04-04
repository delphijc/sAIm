# CanonicalizeAgent Workflow

**Purpose:** Fix an existing agent to follow the canonical progressive disclosure structure if it doesn't already comply.

---

## Step 1: Read the Authoritative Sources

**REQUIRED FIRST:**

1. Run ValidateAgent to identify issues:
   - What checks are failing?
   - What needs to be fixed?

2. Read canonical structure:
   ```
   ${PAI_DIR}/Skills/CORE/SkillSystem.md
   ```

3. Read a compliant agent:
   ```
   ${PAI_DIR}/Agents/Engineer/AGENT.md
   ${PAI_DIR}/Agents/Engineer/Reference.md
   ```

---

## Step 2: Identify What Needs Fixing

Run ValidateAgent first:
- Check which validation points fail
- Determine if it's AGENT.md issues or Reference.md issues
- Understand what structure is missing

Common issues:
1. No Reference.md file (must create)
2. AGENT.md is too large (must split)
3. Missing YAML fields
4. Malformed YAML structure
5. Missing progressive disclosure pointer
6. Inconsistent tool documentation

---

## Step 3: Fix AGENT.md Issues

### Issue: Missing YAML Fields

Add any missing required fields to AGENT.md frontmatter:

```yaml
---
name: AgentName                    # Required: TitleCase
description: [Description]         # Required: with USE WHEN
model: sonnet                      # Required: haiku|sonnet|opus
color: green                       # Required: unique identifier
voiceId: Tom (Enhanced)            # Required: distinctive voice
permissions:                       # Required: array structure
  allow:
    - "Bash"
    - "Read(*)"
---
```

### Issue: YAML Syntax Errors

Common fixes:
- Add quotes around values: `color: "green"` (not required but safe)
- Fix indentation: Use 2 spaces, not tabs
- Add `-` prefix to array items: `- "Bash"` (not `-"Bash"`)
- Ensure colons have space after: `name: Agent` (not `name:Agent`)

### Issue: AGENT.md Too Large

If AGENT.md is >100 lines:
1. Extract detailed sections to Reference.md
2. Keep only: name, description, Core Mission, Communication Style, Output Format overview
3. Add reference to Reference.md at bottom

### Issue: Malformed Permissions Array

Fix structure to:
```yaml
permissions:
  allow:
    - "Bash"
    - "Read(*)"
    - "Write(*)"
    - "Edit(*)"
```

Not:
```yaml
permissions:
  - Bash           # WRONG: missing quotes, wrong structure
  - read           # WRONG: lowercase, wrong structure
permissions: [Bash, Read]  # WRONG: wrong format
```

### Issue: Missing Communication Style

Ensure these sections exist in AGENT.md markdown:
```markdown
## Core Mission
[One paragraph explaining primary responsibility]

## Communication Style
[How this agent interacts with users]

## Output Format
[Brief description of response structure]
```

---

## Step 4: Create or Fix Reference.md

### If Reference.md Doesn't Exist

Create using template:

```markdown
# AgentName Reference Guide

> This is Tier 2 documentation for the AgentName agent. It's loaded on-demand when you need detailed information. For quick delegation info, see `AGENT.md`.

---

## Agent Philosophy

[What this agent believes and how it approaches work]

## Core Competencies

### [Domain 1]

[What it does in this domain]

### [Domain 2]

[What it does in this domain]

## Methodology

### [Process 1]

[How it handles this process]

## Tool Usage and Permissions

### Included Permissions

| Tool | Purpose | When |
|------|---------|------|
| Bash | Execute system commands | Complex automation |
| Read(*) | File inspection | Code analysis |
| Write(*) | File creation | Code generation |
| Edit(*) | File modification | Code updates |
| Grep(*) | Content search | Finding patterns |
| Glob(*) | File patterns | Batch operations |
| WebFetch(domain:*) | URL retrieval | Research |

## Standards and Best Practices

- Standard 1: [Explanation]
- Standard 2: [Explanation]

## Output Format (MANDATORY)

[Complete description of response structure]

## Security and Authorization

[Any authorization requirements or restrictions]
```

### If Reference.md Exists but Needs Fixing

1. **Add "Tier 2 documentation" note** at very top if missing
2. **Check section completeness:**
   - Agent Philosophy: ✓ Present and explains approach
   - Core Competencies: ✓ Documented with detail
   - Methodology: ✓ Explains key processes
   - Tool Usage: ✓ Table matches AGENT.md permissions
   - Standards: ✓ Best practices listed
   - Output Format: ✓ Completely specified
   - Security: ✓ Boundaries defined (if applicable)

3. **Verify tool documentation** matches AGENT.md permissions exactly

4. **Add missing sections** if needed

---

## Step 5: Ensure Consistency

### Verify AGENT.md ↔ Reference.md Match

- [ ] All tools in AGENT.md `permissions:` are documented in Reference.md
- [ ] Tool Usage table in Reference.md matches permissions exactly
- [ ] Core Mission in AGENT.md aligns with Agent Philosophy in Reference.md
- [ ] Output Format in AGENT.md matches detailed format in Reference.md
- [ ] Model choice (haiku/sonnet/opus) aligns with described competencies
- [ ] Name in both files is identical

### Line Count Validation

- [ ] AGENT.md is ~60-80 lines (delegation minimal)
- [ ] Reference.md is ~100-150 lines (on-demand detailed)

### Add Cross-References

AGENT.md should have at bottom:
```markdown
## Extended Context

For complete methodology and standards, see `Reference.md`
```

Reference.md should have at top:
```markdown
> This is Tier 2 documentation for the AgentName agent. It's loaded on-demand when you need detailed information. For quick delegation info, see `AGENT.md`.
```

---

## Step 6: Validate Fixed Structure

Run the following checks:

### YAML Validation
```bash
cat ${PAI_DIR}/Agents/[AgentName]/AGENT.md | head -15
# Should show valid YAML without errors
```

### File Existence
```bash
ls -la ${PAI_DIR}/Agents/[AgentName]/
# Should show:
# AGENT.md
# Reference.md
```

### Line Counts
```bash
wc -l ${PAI_DIR}/Agents/[AgentName]/{AGENT.md,Reference.md}
# AGENT.md should be 60-80 lines
# Reference.md should be 100-150 lines
```

---

## Step 7: Re-Run ValidateAgent

After fixes:

1. Run ValidateAgent workflow on the agent
2. Verify all checks now pass
3. Address any remaining failures
4. Repeat if needed

---

## Step 8: Test the Canonicalized Agent

Verify the agent still works after canonicalization:

```typescript
Task({
  description: "Test canonicalized agent",
  prompt: "Test that the agent works correctly",
  subagent_type: "agent-name",
  model: "haiku"
})
```

---

## Step 9: Final Checklist

### AGENT.md Structure
- [ ] All required YAML fields present
- [ ] YAML syntax is valid
- [ ] `name:` in TitleCase
- [ ] `description:` has USE WHEN clause
- [ ] `model:` is valid (haiku|sonnet|opus)
- [ ] `color:` is unique
- [ ] `voiceId:` is unique
- [ ] `permissions:` array properly structured
- [ ] ~60-80 lines (minimal for delegation)
- [ ] Core Mission present
- [ ] Communication Style present
- [ ] Output Format present
- [ ] Pointer to Reference.md at bottom

### Reference.md Structure
- [ ] "Tier 2 documentation" note at top
- [ ] Agent Philosophy explains approach
- [ ] Core Competencies documented
- [ ] Methodology explains processes
- [ ] Tool Usage table matches AGENT.md permissions
- [ ] Standards and best practices listed
- [ ] Output Format completely specified
- [ ] Security/authorization defined (if applicable)
- [ ] ~100-150 lines (detailed for on-demand)

### Consistency
- [ ] All AGENT.md tools documented in Reference.md
- [ ] No orphaned or unused permissions
- [ ] Missions/philosophies aligned
- [ ] Output formats match
- [ ] Model choice fits competencies

### Naming
- [ ] Agent directory uses TitleCase
- [ ] AGENT.md is uppercase
- [ ] Reference.md uses TitleCase
- [ ] `name:` field matches directory

---

## Done

Agent canonicalized to follow progressive disclosure structure:
- Minimal AGENT.md (~60-80 lines) for delegation
- Detailed Reference.md (~100-150 lines) for on-demand
- All validation checks passing
- 50-60% reduction in delegation context
- Agent immediately ready for use
