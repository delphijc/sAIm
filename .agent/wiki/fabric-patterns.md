# Fabric Patterns

Sam integrates 248 Fabric patterns for content processing directly into Claude's context.

---

## Overview

Fabric patterns are AI prompts originally created by Daniel Miessler for specific content processing tasks. Sam maintains these patterns locally with manual refreshes from the upstream [danielmiessler/fabric](https://github.com/danielmiessler/fabric) repository for LTS stability. Instead of spawning the `fabric` CLI, Sam applies patterns natively using Claude's full capabilities.

### Benefits of Native Execution

| Aspect | Native | CLI |
|--------|--------|-----|
| Model | Your Claude subscription | Fabric's default |
| Context | Full conversation history | Isolated input |
| Speed | Instant | ~1-2s overhead |
| Customization | Full prompt access | Fixed pattern |

---

## Pattern Categories

### Extraction (20+ patterns)

| Pattern | Description |
|---------|-------------|
| `extract_wisdom` | Comprehensive insight extraction |
| `extract_insights` | Key insights only |
| `extract_main_idea` | Core message |
| `extract_recommendations` | Actionable items |
| `extract_alpha` | High-value unique insights |
| `extract_decisions` | Key decisions/outcomes |
| `extract_ideas` | Idea extraction |
| `extract_questions` | Question extraction |
| `extract_quotes` | Notable quotes |
| `extract_skills` | Skill identification |

### Summarization (15+ patterns)

| Pattern | Description |
|---------|-------------|
| `summarize` | General summarization |
| `summarize_paper` | Academic paper summary |
| `summarize_meeting` | Meeting notes |
| `summarize_podcast` | Podcast episodes |
| `summarize_debate` | Debate summary |
| `summarize_micro` | Tweet-length summary |
| `summarize_git_diff` | Git changes explanation |
| `create_5_sentence_summary` | Ultra-concise |

### Analysis (25+ patterns)

| Pattern | Description |
|---------|-------------|
| `analyze_claims` | Claim verification |
| `analyze_paper` | Academic analysis |
| `analyze_code` | Code analysis |
| `analyze_malware` | Malware behavior |
| `analyze_debate` | Argumentation review |
| `analyze_sentiment` | Sentiment analysis |
| `analyze_incident` | Security incident |
| `analyze_logs` | Log file analysis |
| `analyze_prose` | Writing quality |
| `analyze_threat_report` | Threat intelligence |

### Security (12+ patterns)

| Pattern | Description |
|---------|-------------|
| `create_threat_model` | General threat modeling |
| `create_stride_threat_model` | STRIDE methodology |
| `create_threat_scenarios` | Scenario generation |
| `create_sigma_rules` | SIGMA detection rules |
| `write_nuclei_template_rule` | Nuclei scanner |
| `write_semgrep_rule` | Semgrep analysis |
| `analyze_malware` | Malware analysis |
| `create_network_threat_landscape` | Network threats |

### Content Creation (20+ patterns)

| Pattern | Description |
|---------|-------------|
| `create_prd` | Product Requirements |
| `create_design_document` | Technical design |
| `write_essay` | Essay writing |
| `write_essay_pg` | Paul Graham style |
| `create_report_finding` | Security findings |
| `write_proposal` | Formal proposals |
| `create_case_study` | Case studies |
| `create_quiz` | Quiz generation |
| `create_outline` | Content outline |
| `tweet` | Tweet composition |

### Improvement (10+ patterns)

| Pattern | Description |
|---------|-------------|
| `improve_writing` | Writing enhancement |
| `improve_prompt` | Prompt engineering |
| `review_code` | Code review |
| `humanize` | Humanize AI text |
| `explain_code` | Code explanation |
| `simplify_language` | Simplification |
| `fix_typos` | Typo correction |
| `translate` | Translation |

---

## Using Patterns

### Natural Language

Just describe what you want:

```
"Extract wisdom from this transcript"
→ Applies extract_wisdom pattern

"Summarize this research paper"
→ Applies summarize_paper pattern

"Create a threat model for this API"
→ Applies create_threat_model pattern
```

### Explicit Pattern Request

```
"Use the extract_wisdom pattern on this content"
"Apply the analyze_claims pattern"
```

### Chaining Patterns

```
"First summarize this paper, then extract the key recommendations"
"Analyze this code, then create a threat model for it"
```

---

## Pattern Output Format

### extract_wisdom Output

```markdown
## SUMMARY
[25-word summary]

## IDEAS
- [16-word insight]
- [16-word insight]
... (20-50 ideas)

## INSIGHTS
- [16-word refined insight]
... (10-20 insights)

## QUOTES
- "Exact quote" - Speaker
... (15-30 quotes)

## HABITS
- [16-word habit description]
... (15-30 habits)

## FACTS
- [16-word fact]
... (15-30 facts)

## REFERENCES
- Book/article/tool mentioned
...

## ONE-SENTENCE TAKEAWAY
[15-word essence]

## RECOMMENDATIONS
- [16-word recommendation]
... (15-30 recommendations)
```

### create_threat_model Output

```markdown
## THREAT MODEL

### Assets
- [What needs protection]

### Threat Actors
- [Who might attack]

### Attack Vectors
- [How they might attack]

### Vulnerabilities
- [Weaknesses to exploit]

### Mitigations
- [How to defend]

### Risk Matrix
| Threat | Likelihood | Impact | Risk |
|--------|------------|--------|------|
```

---

## Pattern Storage

Patterns are stored at:
```
~/.claude/skills/fabric/tools/patterns/
├── extract_wisdom/
│   ├── system.md      # Pattern instructions
│   ├── user.md        # Example input (optional)
│   └── README.md      # Documentation (optional)
├── create_threat_model/
│   └── system.md
└── ... (248 total patterns)
```

---

## Updating Patterns

### Sync Latest

```bash
cd ~/.claude/skills/fabric/tools
./update-patterns.sh
```

This runs:
1. `fabric -U` to fetch upstream
2. Syncs to local patterns directory

### Requirements

Install Fabric CLI (optional, for YouTube transcripts):
```bash
go install github.com/danielmiessler/fabric@latest
```

> [!NOTE]
> Fabric patterns in Sam are maintained locally for LTS stability. Updates are manually refreshed from upstream rather than automatically synced.

---

## When to Use CLI

Use the `fabric` CLI only for operations requiring external services:

| Operation | Command | Reason |
|-----------|---------|--------|
| YouTube transcripts | `fabric -y "URL"` | Video download |
| Pattern updates | `fabric -U` | GitHub sync |
| List patterns | `fabric -l` | Quick reference |

For everything else, use native patterns.

---

## Custom Patterns

### Creating Custom Pattern

1. Create directory:
   ```bash
   mkdir ~/.claude/skills/fabric/tools/patterns/my_pattern
   ```

2. Create `system.md`:
   ```markdown
   # IDENTITY and PURPOSE
   You are an expert in [domain]...

   # STEPS
   - Step 1
   - Step 2

   # OUTPUT INSTRUCTIONS
   - Format requirements

   # INPUT
   INPUT:
   ```

3. Test:
   ```
   "Apply my_pattern to this content"
   ```

### Pattern Best Practices

1. **Clear identity** - Define the expert role
2. **Specific steps** - Break down the process
3. **Output format** - Specify exact structure
4. **Word limits** - Constrain output length
5. **Examples** - Show expected results

---

## Common Use Cases

### Podcast/Interview Analysis

```
"Extract wisdom from this podcast transcript"
→ IDEAS, INSIGHTS, QUOTES, HABITS, FACTS, RECOMMENDATIONS
```

### Research Paper Review

```
"Summarize this paper and extract the methodology"
→ Academic summary + methodology breakdown
```

### Security Assessment

```
"Create a threat model for this API design"
→ Assets, threats, vectors, mitigations
```

### Content Improvement

```
"Improve this blog post and make it more engaging"
→ Enhanced, polished content
```

### Code Review

```
"Review this code and identify potential issues"
→ Code quality assessment + suggestions
```

---

## Pattern Quick Reference

| Task | Pattern |
|------|---------|
| Podcast notes | `extract_wisdom` |
| Paper summary | `summarize_paper` |
| Security review | `create_threat_model` |
| Code review | `review_code` |
| Writing polish | `improve_writing` |
| Fact check | `analyze_claims` |
| Meeting notes | `summarize_meeting` |
| Detection rules | `create_sigma_rules` |

---

*See also: [Skills System](Skills-System.md) | [Usage Guide](Usage-Guide.md)*

*Full pattern documentation: `~/.claude/skills/fabric/Reference.md`*
