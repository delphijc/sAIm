---
name: CORE
description: PAI (Personal AI Infrastructure) - Your AI system core. AUTO-LOADS at session start. USE WHEN any session begins OR user asks about PAI identity, response format, stack preferences, security protocols, or delegation patterns.
---

# CORE - Personal AI Infrastructure

**Auto-loads at session start.** This skill defines your PAI's identity, mandatory response format, and core operating principles.

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

| Action | Trigger | Behavior |
|--------|---------|----------|
| **CLI Creation** | "create a CLI", "build command-line tool" | Use `system-createcli` skill |
| **Git** | "push changes", "commit to repo" | Run git workflow |
| **Delegation** | "use parallel interns", "parallelize" | Deploy parallel agents |
| **Merge** | "merge conflict", "complex decision" | Use /plan mode |

## Examples

**Example 1: Push PAI updates to GitHub**
```
User: "Push these changes"
→ Invokes Git workflow
→ Runs sensitive data check
→ Commits with structured message
→ Pushes to private PAI repo
```

**Example 2: Delegate parallel research tasks**
```
User: "Research these 5 companies for me"
→ Invokes Delegation workflow
→ Launches 5 intern agents in parallel
→ Each researches one company
→ Synthesizes results when all complete
```

## Extended Context

For detailed information, see `Reference.md`:
- MANDATORY RESPONSE FORMAT and voice system requirements
- CORE Identity, Personality Calibration, Operating Principles
- Documentation Index and Stack Preferences
- File Organization, Security Protocols, Delegation Patterns
- Permission to Fail, History System guidance
