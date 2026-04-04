---
name: fabric
description: "Native Fabric pattern execution for Claude Code (245 patterns). USE WHEN processing content with patterns like extract_wisdom, summarize, analyze_claims, create_threat_model, create_prd, create_design_document, analyze_incident, write_pull-request, improve_writing, review_code, explain_code, create_mermaid_visualization, summarize_git_changes, extract_ideas, extract_recommendations, or create_stride_threat_model. Patterns run natively in Claude's context — no CLI spawning needed. NOT WHEN you need YouTube transcript extraction (use fabric CLI with -y flag)."
---

# Fabric Skill - Native Pattern Execution

## The Key Insight

**Fabric patterns are just markdown prompts.** Instead of spawning `fabric -p pattern_name` for every task, Claude Code reads and applies patterns directly. This gives you:

- **Your Claude subscription's full power** - Opus/Sonnet intelligence, not Fabric's default model
- **Full conversation context** - Patterns work with your entire session
- **No CLI overhead** - Faster execution, no process spawning
- **Same 248 patterns** - All the patterns you know, just applied natively

## When to Use Native Patterns (Default)

For any pattern-based processing:
1. Read `tools/patterns/{pattern_name}/system.md`
2. Apply the pattern instructions directly to the content
3. Return results without external CLI calls

**Examples:**
```
User: "Extract wisdom from this transcript"
→ Apply extract_wisdom pattern to content
→ Return structured output (IDEAS, INSIGHTS, QUOTES, etc.)

User: "Create a threat model for this API"
→ Apply create_threat_model pattern to the API description
→ Return threat model

User: "Summarize this article"
→ Apply summarize pattern to article
→ Return summary
```

## When to Use Fabric CLI

Only use the `fabric` command for operations requiring external services:

| Operation | Command | Why CLI Needed |
|-----------|---------|----------------|
| YouTube transcripts | `fabric -y "URL"` | Downloads video, extracts transcript |
| Update patterns | `fabric -U` | Pulls from GitHub |
| List patterns | `fabric -l` | Quick reference |

**For everything else, use native patterns.**

## Extended Context

For complete pattern catalog (248+ patterns), updating procedures, and advanced usage, see `Reference.md`
