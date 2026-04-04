---
name: art
description: "Complete visual content system for PAI. Tron-meets-Excalidraw aesthetic - dark backgrounds, neon accents, hand-drawn sketch style. USE WHEN creating visual assets, diagrams, illustrations, header images, or design system elements. NOT WHEN designing user interfaces (use designer agent)."
triggers:
  - USE WHEN user wants to create visual content, illustrations, or diagrams
  - USE WHEN user mentions art, header images, visualizations, or any visual request
  - USE WHEN user references mermaid, flowchart, technical diagram, or infographic

# Workflow Routing
workflows:
  - USE WHEN user wants blog header or editorial illustration: workflows/workflow.md
  - USE WHEN user wants visualization or is unsure which format: workflows/visualize.md
  - USE WHEN user wants mermaid flowchart or sequence diagram: workflows/mermaid.md
  - USE WHEN user wants technical or architecture diagram: workflows/technical-diagrams.md
  - USE WHEN user wants taxonomy or classification grid: workflows/taxonomies.md
  - USE WHEN user wants timeline or chronological progression: workflows/timelines.md
  - USE WHEN user wants framework or 2x2 matrix: workflows/frameworks.md
  - USE WHEN user wants comparison or X vs Y: workflows/comparisons.md
  - USE WHEN user wants annotated screenshot: workflows/annotated-screenshots.md
  - USE WHEN user wants recipe card or step-by-step: workflows/recipe-cards.md
  - USE WHEN user wants aphorism or quote card: workflows/aphorisms.md
  - USE WHEN user wants conceptual map or territory: workflows/maps.md
  - USE WHEN user wants stat card or big number visual: workflows/stats.md
  - USE WHEN user wants comic or sequential panels: workflows/comics.md
---



## Extended Context

For detailed information, see `Reference.md`
