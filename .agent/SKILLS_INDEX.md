# PAI Skills Index
**Last Updated:** 2026-04-04
**Total Skills:** 36 | **Location:** `$PAI_DIR/skills/`

---

## Infrastructure & Core (5 skills)
- **CORE** — System identity and initialization. Auto-loads at session start. USE WHEN any session begins or user asks about PAI identity.
- **observability** — Real-time agent monitoring dashboard (port 5172). USE WHEN monitoring agents or debugging multi-agent workflows.
- **discord-remote-control** — Discord-based remote interface for Sam with persistent SQLite memory. USE WHEN interacting through Discord.
- **stack-broker** — Data operations through shell scripts for reliability and file locking. USE WHEN persisting to JSONL or ensuring atomic writes.
- **launchd-service** — Create macOS launchd services following the PAI pattern. USE WHEN adding background services or scheduled jobs.

---

## Development & Code Generation (8 skills)
- **create-cli** — Generate production-quality TypeScript CLIs. USE WHEN user says "create a CLI" or "build a command-line tool".
- **create-agent** — Scaffold custom subagents for task delegation. USE WHEN creating a new agent. NOT WHEN creating a skill (use create-skill).
- **create-skill** — Build reusable skills extending Claude Code. USE WHEN building new skill packages. NOT WHEN creating an agent (use create-agent).
- **playwright-testing** — Playwright E2E testing framework. USE WHEN setting up, writing, or debugging E2E tests.
- **quick-flow** — Fast-track development for small changes. USE WHEN delivering bug fixes, hotfixes, or rapid prototypes without full Agile ceremony.
- **tdd-manager** — Enforces Red-Green-Refactor cycle. USE WHEN starting TDD implementation tasks or verifying TDD compliance.
- **audit-committer** — Git commits with task summaries via git notes. USE WHEN committing code needing audit trails or documentation compliance.
- **simplify** — Code review for reuse, quality, and efficiency.

---

## Research & Analysis (5 skills)
- **fabric** — Native Fabric pattern execution (245 patterns). USE WHEN processing content with extract_wisdom, summarize, analyze_claims, create_threat_model, create_prd, review_code, improve_writing, create_mermaid_visualization, and 230+ more. NOT WHEN needing YouTube transcripts (use fabric CLI with -y).
- **claude-api** — Build apps with the Anthropic SDK and Claude API. USE WHEN code imports anthropic or user asks about Claude API.
- **prompting** — Prompt engineering standards based on Anthropic best practices. USE WHEN writing or improving prompts or agent instructions.
- **retrospective** — Analyze semantic memories for patterns and improvements. USE WHEN user says "run retrospective" or wants system health insights.
- **bright-data** — Progressive four-tier URL scraping with fallback. USE WHEN scraping URLs with bot detection or access restrictions.

---

## Content & Creative (5 skills)
- **art** — Visual content system (Tron-meets-Excalidraw aesthetic). USE WHEN creating visual assets, diagrams, illustrations. NOT WHEN designing UIs (use designer agent).
- **content** — End-to-end content creation — writing, design, images, assets. USE WHEN creating blog posts, articles, newsletters, or managing content workflows.
- **story-explanation** — Story-format narrative summaries with multiple formats. USE WHEN user says "create story explanation" or wants narrative framing.
- **transcribe-audio** — Transform raw audio into structured Markdown. USE WHEN transcribing audio or formatting session notes.
- **aggregate-transcriptions** — Aggregate and summarize transcription files. USE WHEN consolidating multiple transcription files.

---

## Security & Governance (3 skills)
- **security-grc** — Enterprise security, GRC, and compliance. USE WHEN developing security policies, risk assessments, or compliance frameworks.
- **architecture-rules** — Architectural constraints and design principles. USE WHEN reviewing architecture decisions or enforcing design constraints.
- **ffuf** — Web fuzzing guidance for pentesting. USE WHEN doing directory enumeration, parameter testing, or web vulnerability discovery.

---

## Business & Strategy (4 skills)
- **architect** — Generates epics, stories, and master plans from PRD/tech-spec/BDD wizard outputs.
- **alex-hormozi-pitch** — Irresistible offers using $100M Offers methodology. USE WHEN crafting pitches, pricing strategies, or value frameworks.
- **life-management** — Personal organization, scheduling, goals. USE WHEN planning trips, managing schedules, or organizing personal projects.
- **agile** — Agile pipeline knowledge — phases, ceremonies, metrics. USE WHEN planning sprints, running ceremonies, or applying Scrum.

---

## Design Thinking & Ideation (2 skills)
- **cis** — Creative Intelligence Suite — structured ideation and innovation. USE WHEN running creativity exercises, ideation sessions, or innovation workshops.
- **party-mode** — Dynamic multi-agent collaboration with 17+ agents. USE WHEN tasks require multiple agent perspectives simultaneously.

---

## Documentation & Process (2 skills)
- **phase-checkpoint** — Verifies changes, coverage, and acceptance criteria at phase completion.
- **read-aloud** — Read file contents aloud via voice system. USE WHEN user says "read this to me" or requests audio playback.

---

## Data & Web Services (3 skills)
- **jina-download** — Convert URLs to clean Markdown via Jina Reader API. USE WHEN user says "download as markdown" or needs URL content as text.
- **rsync-sync-missing** — Sync missing files with rsync --ignore-existing. USE WHEN adding missing files without overwriting existing ones.
- **open-file** — Open files in default viewer/editor. USE WHEN user wants to open or view a file.

---

## Specialized (2 skills)
- **game-dev** — Complete game development pipeline (BMGD). USE WHEN designing games, building mechanics, or managing game projects.
- **schedule** — Create and manage scheduled remote agents on cron schedules.

---

## Integration Points

- **architect + create-cli** → Full system from spec to CLI tool
- **fabric + research agents** → Deep analysis with structured pattern output
- **discord-remote-control + party-mode** → Orchestrated multi-agent chat
- **observability + audit-committer** → Track and verify changes in real-time
- **tdd-manager + phase-checkpoint** → Quality-gated development lifecycle
- **create-skill + create-agent** → Extend PAI with new capabilities (skills for knowledge, agents for personas)

---

**Next Review:** 2026-07-04 (quarterly)
**Maintenance Owner:** PAI System
