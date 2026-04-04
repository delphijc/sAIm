---
name: story-explanation
description: Create compelling story-format summaries using UltraThink to find the best narrative framing. Support multiple formats - 3-part narrative, n-length with inline links, abridged 5-line, or comprehensive via Foundry MCP. USE WHEN user says 'create story explanation', 'narrative summary', 'explain as a story', or wants content in conversational first-person voice.
---

# story-explanation Skill - Narrative Storytelling

## Workflow Routing

Execute storytelling workflows based on narrative format preference:

| Workflow | Trigger | Format | Use Case |
|----------|---------|--------|----------|
| **Create** | "story explanation", "narrative story", "explain as story" | 3-part narrative | Default comprehensive storytelling |
| **CreateWithLinks** | "story with links", "narrative with references" | Multi-part with inline citations | Preserve source attribution |
| **CreateAbridged** | "brief story", "5-line summary", "short narrative" | 5-line condensed story | Quick narrative overview |
| **CSE** | "Claude Search Engine story" | Research-powered narrative | Fact-verified storytelling |
| **CSE5** | "5-line CSE story", "brief fact-checked narrative" | 5-line with verification | Quick fact-checked summary |

## How It Works

1. **Input Detection** - Accepts YouTube URLs, article links, file paths, pasted text, or previous conversation content
2. **Deep Analysis** - Uses UltraThink to determine best narrative framing and angle
3. **Content Gathering** - Fetches content from source (YouTube transcripts via Fabric, articles via WebFetch, files via Read)
4. **Narrative Generation** - Applies selected storytelling workflow (3-part, 5-line, with links, fact-checked)
5. **Scratchpad Archival** - Saves raw content and narrative output to timestamped scratchpad directory

## Examples

**Example 1: Convert article to 3-part narrative**
```
User: "Create a story explanation for this tech article URL"
→ Activates Create workflow
→ WebFetch article content
→ Uses UltraThink for narrative framing
→ Returns 3-part story in conversational voice
```

**Example 2: YouTube transcript to fact-checked summary**
```
User: "5-line fact-checked story from this YouTube video"
→ Activates CSE5 workflow
→ Extracts transcript via Fabric
→ Verifies claims via Claude Search Engine
→ Returns verified 5-line narrative
```

## Extended Context

For complete workflow details, content handling, narrative framing strategies, and output formats, see `Reference.md`
