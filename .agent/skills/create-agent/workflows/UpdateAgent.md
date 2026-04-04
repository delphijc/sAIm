# UpdateAgent Workflow

**Purpose:** Add capabilities, modify an existing agent, or update permissions while maintaining canonical structure.

---

## Step 1: Read the Authoritative Source

**REQUIRED FIRST:** Read the canonical structure:

```
${PAI_DIR}/Skills/CORE/SkillSystem.md
```

---

## Step 2: Read the Current Agent

```bash
${PAI_DIR}/Agents/[AgentName]/AGENT.md
${PAI_DIR}/Agents/[AgentName]/Reference.md
```

Understand the current:
- Name and description (single-line with USE WHEN)
- Model, color, and voice configuration
- Current permissions array
- Core mission and communication style

---

## Step 3: Understand the Update

What needs to change?
- Adding a new tool to permissions?
- Modifying the description/delegation triggers?
- Updating methodology or output format?
- Adding new capabilities?
- Changing model or voice configuration?

---

## Step 4: Make Changes

### To Add a Tool to Permissions:

1. **Determine which tool is needed:**
   - ✓ `Bash` - System command execution
   - ✓ `Read(*)` - All file reads
   - ✓ `Write(*)` - All file writes
   - ✓ `Edit(*)` - File editing
   - ✓ `Grep(*)` - Content search
   - ✓ `Glob(*)` - File patterns
   - ✓ `WebFetch(domain:*)` - Web access
   - ✗ Don't add tools the agent won't use

2. **Update AGENT.md permissions:**
   ```yaml
   permissions:
     allow:
       - "Bash"
       - "Read(*)"
       - "[NewTool]"  # Add here
   ```

3. **Update Reference.md Tool Usage section:**
   ```markdown
   | [New Tool] | [What it does] | [When to use] |
   ```

4. **Explain new capability in Reference.md:**
   Add section explaining how agent uses the new tool

### To Modify Description/Triggers:

Update single-line `description` in AGENT.md YAML:
```yaml
description: [What it does]. USE WHEN [updated delegation triggers using OR]. [Capabilities].
```

Examples:
- ✓ "Conducts security testing. USE WHEN user requests penetration tests, vulnerability assessment, or security audits. Authorized testing only."
- ✗ "Security agent" (too vague, missing USE WHEN)

### To Update Methodology:

1. **Update Reference.md Methodology section first**
2. **Then update AGENT.md Communication Style if needed**
3. **Ensure output format is still valid**

### To Add a New Capability:

1. **Add to AGENT.md Key Capabilities list:**
   ```markdown
   **Key Capabilities:**
   - Existing capability
   - [New Capability]
   ```

2. **Document in Reference.md Core Competencies:**
   ```markdown
   ### [New Capability Domain]

   [Detailed explanation of how agent handles this]
   ```

3. **Add required tools to permissions if needed**

### To Change Model/Voice/Color:

Update in AGENT.md YAML:
```yaml
model: sonnet  # Changed from haiku
color: purple  # Changed from blue
voiceId: Tom (Enhanced)  # Changed from Jessica
```

Document the change in Reference.md if it affects capabilities or output.

---

## Step 5: Verify YAML Validity

```bash
cat ${PAI_DIR}/Agents/[AgentName]/AGENT.md | head -30
```

Verify:
- All YAML quotes are consistent
- Indentation is proper (2 spaces)
- All array items have `-` prefix
- All field names are lowercase in YAML

---

## Step 6: Verify Changes

### Check Consistency:
- [ ] AGENT.md permissions match Reference.md documentation
- [ ] Description USE WHEN clause is accurate
- [ ] All tools in permissions are documented in Reference.md
- [ ] Model choice aligns with capabilities
- [ ] Voice and color are still unique

### Check Completeness:
- [ ] New tools are explained in Reference.md
- [ ] Output format still applies with new capabilities
- [ ] Standards and best practices cover new features
- [ ] Security boundaries still defined (if applicable)

---

## Step 7: Test the Updated Agent

Verify the agent still works:

```typescript
Task({
  description: "Test updated agent",
  prompt: "Test the updated capabilities",
  subagent_type: "agent-name",
  model: "haiku"
})
```

---

## Step 8: Final Checklist

### AGENT.md Changes
- [ ] New permissions added (only if necessary)
- [ ] Description still has USE WHEN clause
- [ ] YAML is valid and complete
- [ ] Core Mission still accurately describes role
- [ ] Communication Style updated if relevant
- [ ] Key Capabilities list includes new items

### Reference.md Changes
- [ ] Tool Usage section matches AGENT.md
- [ ] New tools explained with use cases
- [ ] Methodology sections updated if needed
- [ ] Output format still valid with changes
- [ ] Standards and practices cover new features
- [ ] Security/authorization still defined

### Validation
- [ ] Agent still delegates correctly
- [ ] All permissions are documented
- [ ] YAML is still valid
- [ ] No orphaned or unused tools

---

## Done

Agent updated while maintaining canonical progressive disclosure structure:
- AGENT.md remains minimal (~75 lines)
- Reference.md expanded with new capabilities (~120+ lines)
- Agent immediately available with new features
