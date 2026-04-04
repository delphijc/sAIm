---
name: jina-download
description: |
  Convert any URL to clean markdown using Jina Reader API. Appends target URL to https://r.jina.ai/ and returns the markdown content.

  USE WHEN user says "download as markdown", "get markdown from URL", "jina download",
  "convert page to markdown", "read this URL as markdown", or needs web page content
  converted to clean readable markdown format.
---

# Jina Download Skill

Converts any web URL into clean, readable markdown using the Jina Reader API.

## How It Works

Prepend `https://r.jina.ai/` to any target URL to get a markdown-formatted version of the page content.

**Format:** `https://r.jina.ai/{TARGET_URL}`

## Workflow

1. **Receive URL** from user (with or without protocol prefix)
2. **Normalize URL** — ensure it has `https://` prefix if missing
3. **Fetch markdown** via WebFetch from `https://r.jina.ai/{NORMALIZED_URL}`
4. **Return content** — display the markdown to the user
5. **Optionally save** — if user requests, save to a file

## Usage Examples

```
User: "jina download https://example.com/article"
→ WebFetch https://r.jina.ai/https://example.com/article
→ Returns markdown content

User: "download this as markdown: news.ycombinator.com"
→ Normalizes to https://news.ycombinator.com
→ WebFetch https://r.jina.ai/https://news.ycombinator.com
→ Returns markdown content

User: "convert this page to markdown and save it: https://docs.python.org/3/tutorial/"
→ WebFetch https://r.jina.ai/https://docs.python.org/3/tutorial/
→ Saves to file, returns path
```

## Implementation

When this skill is triggered:

1. Extract the URL from the user's message
2. Strip any existing `https://r.jina.ai/` prefix (avoid double-wrapping)
3. Ensure the target URL has a protocol (`https://` if missing)
4. Use `WebFetch` tool to retrieve: `https://r.jina.ai/{TARGET_URL}`
5. Present the markdown content to the user
6. If the user asked to save it, write to a file (default: `~/Projects/sam/downloads/{domain}_{timestamp}.md`)

## Notes

- Jina Reader is free and requires no API key
- Works best with article/documentation pages
- May not work well with JavaScript-heavy SPAs
- Rate limits may apply for heavy usage
