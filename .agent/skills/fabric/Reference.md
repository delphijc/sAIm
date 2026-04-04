# Fabric Reference Guide

> This is Tier 2 documentation for the fabric skill. It's loaded on-demand when you use Fabric patterns. For quick usage, see `SKILL.md`.

---

## Skill Philosophy

Fabric patterns are a powerful toolkit for content analysis, summarization, and transformation. Instead of using the CLI wrapper, Claude Code applies patterns natively using your full subscription power. This approach:

- Uses your chosen model (Opus/Sonnet) instead of Fabric's defaults
- Maintains full conversation context
- Eliminates CLI overhead
- Provides identical results with better integration

---

## Pattern Categories (248 Total)

### Threat Modeling & Security
- `create_threat_model` - General threat modeling
- `create_stride_threat_model` - STRIDE methodology
- `create_threat_scenarios` - Threat scenario generation
- `analyze_threat_report` - Threat report analysis
- `create_sigma_rules` - SIGMA detection rules
- `write_nuclei_template_rule` - Nuclei scanner templates
- `write_semgrep_rule` - Semgrep static analysis rules

### Summarization
- `summarize` - General summarization
- `create_5_sentence_summary` - Ultra-concise summary
- `summarize_paper` - Academic paper summary
- `summarize_meeting` - Meeting notes
- `youtube_summary` - Video summary
- `summarize_podcast` - Podcast episode summary

### Wisdom Extraction
- `extract_wisdom` - General wisdom extraction
- `extract_insights` - Key insights
- `extract_main_idea` - Core message
- `extract_recommendations` - Actionable recommendations
- `extract_alpha` - High-value insights
- `extract_decisions` - Key decisions and outcomes

### Analysis
- `analyze_claims` - Claim verification
- `analyze_code` - Code analysis
- `analyze_malware` - Malware analysis
- `analyze_paper` - Academic paper analysis
- `analyze_debate` - Debate analysis
- `analyze_sentiment` - Sentiment analysis
- `analyze_incident` - Incident analysis

### Content Creation
- `create_prd` - Product Requirements Document
- `create_design_document` - Design documentation
- `create_mermaid_visualization` - Mermaid diagrams
- `write_essay` - Essay writing
- `create_report_finding` - Security findings
- `write_proposal` - Proposal writing
- `create_case_study` - Case study documentation

### Improvement
- `improve_writing` - Writing enhancement
- `improve_prompt` - Prompt engineering
- `review_code` - Code review
- `humanize` - Humanize AI text
- `explain_code` - Code explanation
- `simplify_language` - Simplification for accessibility

### Research & Investigation
- `research` - General research guidance
- `investigate` - Investigation methodology
- `compare_products` - Product comparison
- `find_logical_fallacies` - Logical fallacy detection
- `fact_check` - Fact checking

### Content Organization
- `create_outline` - Content outline
- `create_tags` - Tag generation
- `create_taxonomy` - Taxonomy creation
- `create_detailed_outline` - Detailed outline with structure

---

## How to Use Patterns in Claude Code

### Basic Pattern Application

For most patterns:

```
1. Identify which pattern matches the task
2. Read tools/patterns/{pattern_name}/system.md
3. Apply the pattern instructions to your content
4. Generate the output in the specified format
```

### Example Workflow

```
User: "Extract wisdom from this interview transcript"

→ Detect: extract_wisdom pattern needed
→ Read: tools/patterns/extract_wisdom/system.md
→ Apply: Instructions to transcript
→ Output: Structured IDEAS, INSIGHTS, QUOTES, REFERENCES
```

### Pattern Structure

Each pattern directory contains:
- `system.md` - The main prompt/instructions (this is what gets applied)
- `README.md` - Documentation (optional)
- `user.md` - Example user input (optional)

---

## Advanced Usage

### Combining Patterns

Some tasks benefit from sequential pattern application:

```
Task: "Analyze this research paper and extract key findings"

→ First: Use analyze_paper pattern
→ Then: Use extract_recommendations pattern on output
→ Finally: Use summarize pattern for 5-sentence summary
```

### Custom Pattern Parameters

Many patterns accept variations in their instructions:

- `summarize` - Can specify length, style, or focus area
- `extract_wisdom` - Can target specific types of insights
- `create_threat_model` - Can specify methodology (STRIDE, OWASP, etc.)

### Context-Aware Application

Patterns work better with full context:

- Reference previous conversation elements
- Include relevant domain knowledge
- Specify output format preferences
- Note any constraints or requirements

---

## Pattern Recommendations by Use Case

### For Research & Learning
- `extract_wisdom` - Find key learnings
- `summarize` - Condense information
- `create_outline` - Organize knowledge
- `research` - Investigate topics

### For Code Work
- `analyze_code` - Understand code
- `review_code` - Quality assessment
- `explain_code` - Documentation
- `improve_code` - Enhancement suggestions

### For Security Work
- `create_threat_model` - Identify threats
- `analyze_malware` - Analyze samples
- `create_sigma_rules` - Detection rules
- `analyze_threat_report` - Understand incidents

### For Writing & Content
- `improve_writing` - Polish text
- `write_essay` - Long-form content
- `create_prd` - Product documentation
- `humanize` - Make AI text feel natural

### For Decision Making
- `analyze_claims` - Verify statements
- `create_comparison` - Compare options
- `extract_recommendations` - Find next steps
- `find_logical_fallacies` - Critical analysis

---

## Updating Patterns

### Sync Latest Patterns

Run the update script to sync latest patterns from upstream:

```bash
./tools/update-patterns.sh
```

This will:
1. Run `fabric -U` to fetch upstream updates
2. Sync patterns to `tools/patterns/`

**Requirements:** `fabric` CLI must be installed:
```bash
go install github.com/danielmiessler/fabric@latest
```

### When to Update Patterns

- When new patterns are released upstream
- When you want the latest versions of existing patterns
- When Fabric releases new categories
- Periodically (monthly) to stay current

### Checking Available Patterns

```bash
ls tools/patterns/
```

Or browse: `tools/patterns/{pattern_name}/system.md`

---

## CLI vs Native Comparison

| Aspect | Native Patterns | fabric CLI |
|--------|-----------------|------------|
| Model | Your subscription (Opus/Sonnet) | Fabric's configured model |
| Context | Full conversation history | Just the input |
| Speed | Instant (no process spawn) | ~1-2s CLI overhead |
| Integration | Seamless with Claude Code | External tool call |
| Flexibility | Full prompt customization | Limited to pattern |

**The patterns are identical.** The difference is execution context and model power.

---

## Common Patterns Quick Reference

### Most Used
- `extract_wisdom` - Extract key insights from content
- `summarize` - Create concise summaries
- `analyze_claims` - Verify information accuracy
- `improve_writing` - Enhance text quality
- `review_code` - Assess code quality

### Security-Focused
- `create_threat_model` - Identify potential threats
- `analyze_threat_report` - Understand security issues
- `create_sigma_rules` - Create detection rules

### Research-Focused
- `research` - Structured research methodology
- `extract_recommendations` - Find actionable items
- `find_logical_fallacies` - Critical analysis

### Documentation
- `create_prd` - Product Requirements
- `create_design_document` - System design
- `write_proposal` - Formal proposals

---

## Troubleshooting

**Pattern not found?**
- Check spelling and capitalization
- Run `./tools/update-patterns.sh` to update
- Browse `tools/patterns/` to find correct name

**Output format unexpected?**
- Review the pattern's `system.md` for exact format
- Check if pattern has variations in its instructions
- Ensure your input matches the pattern's expectations

**Need custom pattern?**
- Fabric patterns are just markdown prompts
- You can copy and modify existing patterns
- Create new patterns in `tools/patterns/`

---

## Key Point

This skill prioritizes **native pattern execution** over CLI wrapping. You get the benefits of both Fabric's structured prompts and Claude's superior language models - without the CLI overhead.
