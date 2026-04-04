# Analyze Plugin (`!analyze`)

Conversation analysis engine that provides topic detection, sentiment analysis, helpful response ranking, and token efficiency metrics for Discord conversation history. Part of the export plugin module.

## Commands

| Command | Description |
|---------|-------------|
| `!analyze` | Full analysis, last 7 days, Discord summary format |
| `!analyze range:last-30-days` | Override date range |
| `!analyze format:markdown` | Full Markdown report as file attachment |
| `!analyze format:html` | Styled HTML report with dark cyberpunk theme |
| `!analyze topics` | Topics breakdown only (Discord text) |
| `!analyze sentiment` | Sentiment analysis only (Discord text) |
| `!analyze tokens` | Token efficiency only (Discord text) |
| `!analyze range:all format:html` | Combine options |

## Analysis Components

### 1. Topic Detection

Keyword-based classification across 10 categories:

| Category | Example Keywords |
|----------|-----------------|
| Code & Development | code, function, bug, fix, refactor, test, deploy |
| Architecture & Design | architecture, design, pattern, system, schema, api |
| Security | vulnerability, authentication, encryption, pentest |
| DevOps & Infrastructure | docker, kubernetes, ci/cd, pipeline, server |
| AI & Machine Learning | model, prompt, llm, claude, embedding, agent |
| Project Management | epic, story, task, sprint, milestone, plan |
| Creative & Content | image, art, design, video, audio, narrative |
| Research | research, investigate, analyze, compare, evaluate |
| Configuration | config, setting, environment, setup, install |
| General Discussion | Catch-all for unmatched messages |

Each user message is scored against all keyword sets. Messages matching no specific category fall into "General Discussion." Results are sorted by frequency with percentage breakdowns and example snippets.

### 2. Sentiment Analysis

Word-list sentiment scoring with negation handling:

- **Positive words**: great, awesome, perfect, excellent, thanks, love, amazing, crushing, sweet...
- **Negative words**: bad, wrong, error, fail, broken, terrible, frustrated, stuck, issue...
- **Negation modifiers**: not, don't, doesn't, isn't, can't, won't, never, no...

Scoring:
- Each sentiment word contributes +0.5 (positive) or -0.5 (negative)
- Negation flips the sign (e.g., "not great" scores -0.5 instead of +0.5)
- Per-message scores are normalized to [-1, 1] range
- Sessions get a weighted average score
- Overall sentiment is the weighted mean across all sessions

Labels: **positive** (> 0.1), **neutral** (-0.1 to 0.1), **negative** (< -0.1)

### 3. Helpful Response Ranking

Assistant responses are scored on multiple factors:

| Factor | Points | Condition |
|--------|--------|-----------|
| Good length (100-1000 chars) | +2 | Sweet spot for helpfulness |
| Adequate length (50-100) | +1 | Short but useful |
| Detailed response (1000-3000) | +1 | Thorough explanation |
| Very short (< 50 chars) | -1 | Too brief to be helpful |
| Code block | +2 | Contains ``` block |
| Inline code | +1 | Contains backtick spans |
| Table | +2 | Contains markdown table |
| List | +1 | Contains bullet/numbered list |
| Headers | +1 | Contains markdown headers |
| Positive follow-up (> 0.3) | +3 | User responded positively |
| Mildly positive follow-up | +1 | User somewhat positive |
| Good token ratio (0.3-2.0) | +1 | Efficient output/input balance |

Top 10 responses are returned, sorted by score.

### 4. Token Efficiency

Aggregates token usage from conversation metadata:

- **Total input/output tokens** across all conversations
- **Average per turn** for both input and output
- **Efficiency ratio** (output / input)
- **Most/least efficient sessions** by ratio

Supports both current format (`{ tokens: { input: N, output: N } }`) and legacy format (`{ tokens: N }`).

## Output Formats

### Discord (default)
Concise summary under 2000 characters with:
- Date range and session/turn counts
- Top 5 topics with percentages
- Overall sentiment with emoji indicator
- Top helpful response snippet
- Token efficiency summary

### Markdown (`format:markdown`)
Full detailed report with:
- Complete topic table with examples
- Per-session sentiment table with scores and samples
- All top 10 ranked responses with reasons
- Token efficiency metric table

Saved as file attachment: `analysis-<timestamp>.md`

### HTML (`format:html`)
Styled report with dark cyberpunk theme:
- Color scheme: `#0a0a1a` background, `#00ff88` accent, `#ff00ff` secondary
- CSS bar charts for topic distribution
- Color-coded sentiment indicators (green/gray/red)
- Ranked response cards with scores
- Token efficiency data table
- Fully self-contained inline CSS

Saved as file attachment: `analysis-<timestamp>.html`

## Architecture

| File | Purpose |
|------|---------|
| `plugins/export/analysis.ts` | Pure analysis functions — topic detection, sentiment scoring, response ranking, token metrics |
| `plugins/export/analysis-formatter.ts` | Format renderers — Discord (concise), Markdown (full), HTML (styled) |
| `plugins/export/analyze-handler.ts` | Command handler — argument parsing, data fetching, orchestration |

### Design Principles

- **Pure functions**: Analysis engine accepts data arrays, no database dependency — fully testable
- **Dependency injection**: `AnalysisMemoryDB` interface allows mock injection for testing
- **Separation of concerns**: Analysis logic, formatting, and command handling are in separate files

### Key Types

- **`AnalysisResult`** — Complete analysis output (topics, sentiment, rankings, token metrics)
- **`TopicSummary`** — Topic name, count, percentage, example snippets
- **`SentimentTimeline`** — Overall sentiment label + per-session segments with scores
- **`RankedResponse`** — Truncated content, score, reason, session/timestamp
- **`TokenMetrics`** — Totals, averages, efficiency ratio, best/worst sessions
- **`ConversationRow`** — Input data shape matching the memory database schema

## Tests

114 tests in `__tests__/analysis.test.ts` covering:
- Topic detection (single/multi-topic, catch-all, keyword matching)
- Sentiment scoring (positive, negative, neutral, negation handling)
- Response ranking (code blocks, tables, follow-up sentiment, length scoring)
- Token efficiency (legacy format, current format, empty data)
- Formatter output (Discord length limits, Markdown structure, HTML validity)
- Command parsing (format, range, mode shortcuts)
