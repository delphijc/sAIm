---
name: research
description: Comprehensive research HOW-TO skill. Orchestrates researcher agents (claude-researcher, perplexity-researcher, gemini-researcher, researcher) to perform parallel multi-source research with fact-checking and cross-validation. Deep content analysis with extended thinking. Intelligent retrieval for difficult sites. Fabric pattern selection for 242+ specialized prompts. USE WHEN user says 'do research', 'extract wisdom', 'analyze content', 'find information about', or requests web/content research.
---

## 🎯 Quick Overview

**The research SKILL provides the HOW-TO.** Researcher **AGENTS** perform the actual research.

This skill defines **10 specialized workflows** for coordinating researcher agents:

- **[conduct.md](workflows/conduct.md)** — Orchestrate researcher agents in parallel (1, 3, or 8 per type) to research same topic from different angles with fact-checking
- **[extract-knowledge.md](workflows/extract-knowledge.md)** — Extract insights from URLs, videos, PDFs
- **[retrieve.md](workflows/retrieve.md)** — Get content from blocked/protected sites
- **[claude-research.md](workflows/claude-research.md)** — Route to claude-researcher agent
- **[perplexity-research.md](workflows/perplexity-research.md)** — Route to perplexity-researcher agent
- **[interview-research.md](workflows/interview-research.md)** — Structured question-based research
- **[fabric.md](workflows/fabric.md)** — Apply 242+ Fabric patterns for content processing
- **[web-scraping.md](workflows/web-scraping.md)** — Web scraping and crawling
- **[youtube-extraction.md](workflows/youtube-extraction.md)** — Extract from YouTube videos
- **[enhance.md](workflows/enhance.md)** — Enhance and optimize content

### Researcher Agents (The Doers)
These agents **PERFORM** the research. The skill provides the **HOW-TO** to orchestrate them:

- **claude-researcher** — Deep analytical research using Claude's knowledge
- **perplexity-researcher** — Real-time web research with current information
- **gemini-researcher** — Multi-perspective research using Google's Gemini AI
- **researcher** — Comprehensive multi-source synthesis

**How they work together:** All agents research the SAME topic from different angles → results are fact-checked and cross-validated → high-confidence findings emerge from consensus.

### When to Use This Skill

| User Request | Skill Workflow | What Happens |
|-----------|----------|---|
| "Research X" / "Find information about Y" | **conduct.md** | Orchestrates 4-40 researcher agents (depending on mode) to fact-check each other |
| "Extract wisdom/insights from [URL/video]" | **extract-knowledge.md** | Routes to content analysis workflows |
| "Site is blocking me" / "CAPTCHA wall" | **retrieve.md** | Intelligent content retrieval layer |
| "Summarize this article/video" | **fabric.md** | Content processing via Fabric patterns |
| "Scrape these pages" | **web-scraping.md** | Web extraction workflows |

## Extended Context

For detailed routing, workflow descriptions, research modes, and integration patterns, see `Reference.md` (Tier 2).

For complete implementation details, see individual workflow files in `workflows/`.
