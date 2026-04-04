# Fabric Skill - Complete Usage Guide

> Native Fabric pattern execution for Claude Code. Process content with 248+ specialized patterns directly in Claude's context without CLI overhead.

---

## Overview

The fabric skill integrates [Daniel Miessler's Fabric patterns](https://github.com/danielmiessler/fabric) natively into Claude Code. Instead of spawning the `fabric` CLI for each operation, patterns are read and applied directly using Claude's full capabilities.

### Key Benefits

| Feature | Native Execution | CLI Execution |
|---------|------------------|---------------|
| **Model** | Your Claude subscription (Opus/Sonnet) | Fabric's configured default |
| **Context** | Full conversation history preserved | Isolated input only |
| **Speed** | Instant (no process spawn) | ~1-2s CLI overhead per call |
| **Integration** | Seamless with Claude Code session | External tool invocation |
| **Customization** | Full prompt modification possible | Fixed pattern only |

---

## Quick Start

### Basic Usage

Simply describe what you want to do, and the fabric skill will select and apply the appropriate pattern:

```
User: "Extract wisdom from this podcast transcript"
→ Applies extract_wisdom pattern
→ Returns structured IDEAS, INSIGHTS, QUOTES, HABITS, FACTS, REFERENCES

User: "Create a threat model for this API design"
→ Applies create_threat_model pattern
→ Returns comprehensive threat analysis

User: "Summarize this research paper"
→ Applies summarize_paper pattern
→ Returns structured academic summary
```

### Invoking the Skill

The skill auto-activates when:
- Processing content with recognized Fabric patterns
- User mentions pattern names (extract_wisdom, summarize, analyze_claims, etc.)
- Tasks match pattern categories (threat modeling, summarization, analysis)

To explicitly invoke: `/fabric` or mention the skill context.

---

## Pattern Categories

The skill includes **248 patterns** organized into categories:

### Threat Modeling & Security (12 patterns)

| Pattern | Description | Use Case |
|---------|-------------|----------|
| `create_threat_model` | General threat modeling with scenarios | API/system security analysis |
| `create_stride_threat_model` | STRIDE methodology analysis | Enterprise security reviews |
| `create_threat_scenarios` | Generate threat scenarios | Security planning |
| `analyze_threat_report` | Parse threat intelligence | Incident response |
| `create_sigma_rules` | Generate SIGMA detection rules | SOC/SIEM integration |
| `write_nuclei_template_rule` | Nuclei scanner templates | Vulnerability scanning |
| `write_semgrep_rule` | Semgrep static analysis rules | Code security scanning |
| `analyze_malware` | Malware behavior analysis | Reverse engineering |
| `analyze_incident` | Security incident analysis | Post-mortem reviews |
| `analyze_email_headers` | Email header forensics | Phishing investigation |
| `ask_secure_by_design_questions` | Security design review | Architecture review |
| `t_threat_model_plans` | Threat model planning | Security roadmaps |

### Summarization (15 patterns)

| Pattern | Description | Use Case |
|---------|-------------|----------|
| `summarize` | General summarization | Any content |
| `create_5_sentence_summary` | Ultra-concise summary | Quick briefs |
| `summarize_paper` | Academic paper summary | Research review |
| `summarize_meeting` | Meeting notes extraction | Business meetings |
| `youtube_summary` | Video content summary | YouTube videos |
| `summarize_podcast` | Podcast episode summary | Audio content |
| `summarize_debate` | Debate analysis/summary | Political/academic debates |
| `summarize_micro` | Micro-summary (tweet-length) | Social sharing |
| `summarize_git_diff` | Git diff explanation | Code review |
| `create_micro_summary` | Brief content digest | Quick reviews |

### Wisdom & Insight Extraction (10 patterns)

| Pattern | Description | Use Case |
|---------|-------------|----------|
| `extract_wisdom` | Comprehensive insight extraction | Podcasts, interviews, talks |
| `extract_insights` | Key insights only | Quick analysis |
| `extract_main_idea` | Core message extraction | Thesis identification |
| `extract_recommendations` | Actionable recommendations | Decision support |
| `extract_alpha` | High-value unique insights | Investment/research alpha |
| `extract_decisions` | Key decisions and outcomes | Meeting follow-up |
| `extract_ideas` | Idea extraction | Brainstorming content |
| `extract_questions` | Question extraction | Interview prep |
| `extract_article_wisdom` | Article-specific wisdom | Blog/article analysis |
| `capture_thinkers_work` | Capture thought leadership | Intellectual content |

### Analysis (25+ patterns)

| Pattern | Description | Use Case |
|---------|-------------|----------|
| `analyze_claims` | Claim verification | Fact-checking |
| `analyze_paper` | Academic paper analysis | Research review |
| `analyze_debate` | Debate analysis | Argumentation review |
| `analyze_sentiment` | Sentiment analysis | Social listening |
| `analyze_code` | Code analysis | Code review |
| `analyze_logs` | Log file analysis | Debugging/ops |
| `analyze_prose` | Writing quality analysis | Editing |
| `analyze_personality` | Personality assessment | HR/coaching |
| `analyze_presentation` | Presentation analysis | Slide review |
| `analyze_risk` | Risk assessment | Decision making |
| `analyze_sales_call` | Sales call analysis | Sales coaching |
| `analyze_spiritual_text` | Religious text analysis | Theological study |
| `analyze_tech_impact` | Technology impact analysis | Tech assessment |
| `analyze_candidates` | Candidate comparison | Hiring/voting |
| `analyze_interviewer_techniques` | Interview technique review | Interview coaching |
| `analyze_product_feedback` | Product feedback analysis | Product management |
| `analyze_proposition` | Proposition analysis | Critical thinking |
| `analyze_military_strategy` | Military strategy analysis | Strategic studies |

### Content Creation (20+ patterns)

| Pattern | Description | Use Case |
|---------|-------------|----------|
| `create_prd` | Product Requirements Document | Product management |
| `create_design_document` | Technical design docs | Engineering |
| `create_mermaid_visualization` | Mermaid diagram generation | Documentation |
| `write_essay` | Essay writing | Long-form content |
| `write_essay_pg` | Paul Graham style essay | Startup/tech essays |
| `create_report_finding` | Security findings report | Penetration testing |
| `write_proposal` | Proposal writing | Business development |
| `create_case_study` | Case study documentation | Marketing/sales |
| `create_quiz` | Quiz generation | Education |
| `create_npc` | NPC character creation | Game development |
| `create_story_explanation` | Narrative explanations | Storytelling |
| `create_aphorisms` | Aphorism generation | Wisdom content |
| `create_outline` | Content outline | Planning |
| `create_conceptmap` | Concept map creation | Learning |
| `create_markmap_visualization` | Markmap diagram | Mind mapping |
| `tweet` | Tweet composition | Social media |

### Improvement & Enhancement (10 patterns)

| Pattern | Description | Use Case |
|---------|-------------|----------|
| `improve_writing` | Writing enhancement | Editing |
| `improve_prompt` | Prompt engineering | AI optimization |
| `review_code` | Code review | Quality assurance |
| `humanize` | Humanize AI text | Content polish |
| `explain_code` | Code explanation | Documentation |
| `simplify_language` | Language simplification | Accessibility |
| `fix_typos` | Typo correction | Proofreading |
| `enrich_blog_post` | Blog post enhancement | Content marketing |
| `translate` | Translation | Localization |

### Research & Investigation (8 patterns)

| Pattern | Description | Use Case |
|---------|-------------|----------|
| `research` | General research guidance | Investigation |
| `investigate` | Investigation methodology | Deep analysis |
| `compare_products` | Product comparison | Purchase decisions |
| `find_logical_fallacies` | Logical fallacy detection | Critical analysis |
| `fact_check` | Fact verification | Journalism |
| `check_agreement` | Agreement analysis | Contract review |
| `recommend_artists` | Artist recommendations | Cultural exploration |
| `recommend_talkpanel_topics` | Panel topic suggestions | Event planning |

---

## Pattern Structure

Each pattern in `.agent/skills/fabric/tools/patterns/` follows this structure:

```
patterns/
├── extract_wisdom/
│   ├── system.md      # Main pattern instructions (required)
│   ├── user.md        # Example user input (optional)
│   └── README.md      # Pattern documentation (optional)
├── create_threat_model/
│   └── system.md
├── summarize/
│   └── system.md
└── ... (248 total patterns)
```

### Pattern Format

The `system.md` file contains:
1. **IDENTITY and PURPOSE** - Role definition
2. **STEPS** - Processing instructions
3. **OUTPUT INSTRUCTIONS** - Format requirements
4. **INPUT** - Where content goes

Example (`extract_wisdom`):
```markdown
# IDENTITY and PURPOSE
You extract surprising, insightful, and interesting information...

# STEPS
- Extract a summary of the content in 25 words...
- Extract 20 to 50 of the most surprising, insightful ideas...

# OUTPUT INSTRUCTIONS
- Only output Markdown
- Write the IDEAS bullets as exactly 16 words
```

---

## Advanced Usage

### Combining Patterns

Chain patterns for comprehensive analysis:

```
Task: "Analyze this research paper thoroughly"

Step 1: analyze_paper → Understand methodology and findings
Step 2: extract_wisdom → Extract key insights and quotes
Step 3: summarize → Create executive summary
Step 4: extract_recommendations → Actionable next steps
```

### Custom Pattern Parameters

Patterns accept variations:

```
"Summarize this in 3 sentences" → Adjusted summarize pattern
"Extract wisdom focused on leadership" → Targeted extract_wisdom
"Create a threat model using STRIDE" → Specific methodology
```

### Context-Aware Processing

Native execution preserves conversation context:

```
User: [Shares transcript]
User: "Extract wisdom from that"
→ Pattern applies to previously shared content

User: "Now focus on the productivity habits"
→ Refines extraction using session context
```

---

## When to Use CLI vs Native

### Use Native Execution (Default)

For all pattern-based content processing:
- Summarization
- Wisdom extraction
- Analysis tasks
- Content creation
- Threat modeling
- Code review

### Use CLI Only For

| Operation | Command | Reason |
|-----------|---------|--------|
| YouTube transcripts | `fabric -y "URL"` | Requires video download |
| Pattern updates | `fabric -U` | GitHub sync |
| List all patterns | `fabric -l` | Quick reference |

---

## Updating Patterns

### Sync Latest Patterns

```bash
# Navigate to Fabric tools directory
cd .agent/skills/fabric/tools

# Run update script
./update-patterns.sh
```

This will:
1. Execute `fabric -U` to fetch upstream updates
2. Sync patterns to `tools/patterns/`

### Requirements

Install Fabric CLI for updates:
```bash
go install github.com/danielmiessler/fabric@latest
```

### Update Frequency

- **Monthly**: Keep patterns current
- **After releases**: When new patterns announced
- **As needed**: For specific new patterns

---

## Output Formats

Patterns produce structured Markdown output. Example `extract_wisdom` output:

```markdown
## SUMMARY
[25-word summary of content and speakers]

## IDEAS
- [Exactly 16 words capturing a surprising insight from the content]
- [Another 16-word idea...]
- ... (20-50 ideas)

## INSIGHTS
- [Refined 16-word insight synthesized from ideas]
- ... (10-20 insights)

## QUOTES
- "Exact quote from the content." - Speaker Name
- ... (15-30 quotes)

## HABITS
- [16-word description of a personal habit mentioned]
- ... (15-30 habits)

## FACTS
- [16-word fact about the greater world mentioned]
- ... (15-30 facts)

## REFERENCES
- Book/article/tool mentioned
- ... (all references)

## ONE-SENTENCE TAKEAWAY
[15-word sentence capturing the essence]

## RECOMMENDATIONS
- [16-word actionable recommendation]
- ... (15-30 recommendations)
```

---

## Troubleshooting

### Pattern Not Found

1. Check spelling and capitalization
2. Run `./tools/update-patterns.sh` to sync
3. Browse `tools/patterns/` for correct name

### Unexpected Output Format

1. Review pattern's `system.md` for exact format
2. Check if pattern has optional sections
3. Ensure input matches pattern expectations

### Want Custom Pattern

1. Copy existing pattern directory
2. Modify `system.md` instructions
3. Save to `tools/patterns/your_pattern_name/`

---

## Pattern Discovery

### Browse Available Patterns

```bash
ls .agent/skills/fabric/tools/patterns/
```

### Search for Specific Capability

```bash
# Find security patterns
ls .agent/skills/fabric/tools/patterns/ | grep -i threat
ls .agent/skills/fabric/tools/patterns/ | grep -i security

# Find analysis patterns
ls .agent/skills/fabric/tools/patterns/ | grep -i analyze
```

### Read Pattern Instructions

```bash
cat .agent/skills/fabric/tools/patterns/{pattern_name}/system.md
```

---

## Best Practices

1. **Match task to pattern**: Use the most specific pattern for your task
2. **Provide quality input**: Better input yields better pattern output
3. **Chain when needed**: Combine patterns for complex analysis
4. **Leverage context**: Native execution preserves conversation history
5. **Customize output**: Request format adjustments when needed
6. **Update regularly**: Keep patterns current with upstream

---

## Quick Reference

| Task | Pattern | Output |
|------|---------|--------|
| Podcast notes | `extract_wisdom` | IDEAS, INSIGHTS, QUOTES, HABITS |
| Paper review | `summarize_paper` | Structured academic summary |
| Security review | `create_threat_model` | Threat scenarios + mitigations |
| Code review | `review_code` | Quality assessment + suggestions |
| Writing polish | `improve_writing` | Enhanced text |
| Fact check | `analyze_claims` | Claim verification |
| Meeting notes | `summarize_meeting` | Action items + decisions |

---

*Last updated: 2026-01-29*
*Pattern count: 248*
*Skill location: `.agent/skills/fabric/`*
