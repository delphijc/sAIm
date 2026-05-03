# Complete Skills Catalog

**Last Updated:** March 7, 2026
**Total Skills:** 38 | **Validation Status:** ✅ All Skills Validated

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Core Infrastructure Skills](#core-infrastructure-skills)
3. [Domain Cluster Skills](#domain-cluster-skills)
4. [Utility & Content Skills](#utility--content-skills)
5. [Research & Analysis Skills](#research--analysis-skills)
6. [Specialized Skills](#specialized-skills)
7. [Skill Invocation Reference](#skill-invocation-reference)
8. [Skill Architecture](#skill-architecture)

---

## Quick Reference

### All 38 Skills by Category

| Category | Skill Name | Purpose | Trigger |
|----------|-----------|---------|---------|
| **Core** | CORE | PAI system identity and configuration | Session auto-load |
| **Domain Clusters** | life-management | Personal scheduling, vacation, goals | "schedule my appointments" |
| | quick-flow | Fast-track development (spec-dev-review) | "quick flow" |
| | party-mode | Multi-agent collaboration | "party mode" |
| | research | Deep multi-source investigation | "do research", "research this" |
| | game-dev | Complete game development pipeline (BMGD) | "game development" |
| | content | End-to-end content creation | "create content" |
| | architecture-rules | Cross-cutting architectural constraints | "architecture principles" |
| | security-grc | Enterprise security & compliance | "security assessment", "grc" |
| | CIS | Creative problem-solving suite | "brainstorming", "design thinking" |
| | agile | Agile development pipeline | "agile methodology", "sprint planning" |
| **Utility** | create-cli | Generate TypeScript CLIs | "create a CLI" |
| | start-up | Manage infrastructure services | "startup", "shutdown servers" |
| | read-aloud | Read file contents with voice | "read this to me" |
| | read-daily-devotion | Read daily devotion aloud | "read daily devotion" |
| | transcribe-audio | Transform audio to markdown | "transcribe audio" |
| | aggregate-transcriptions | Summarize session transcriptions | "aggregate transcriptions" |
| | open-file | Open files in default app | "open this file" |
| | rsync-sync-missing | Sync missing files with rsync | "sync files" |
| **Content & Creation** | Art | Visual content system (Tron aesthetic) | Design requests |
| | Fabric | Native Fabric pattern execution | "extract wisdom", "summarize" |
| | alex-hormozi-pitch | Create irresistible offers | "$100M offers" |
| | story-explanation | Create story-format summaries | "explain as a story" |
| **Research** | Research | Deep multi-source investigation | "research", "deep investigation" |
| | bright-data | URL content scraping | "scrape this URL" |
| **Analysis & Testing** | architect | Generate hierarchical Epics & Stories | PRD analysis |
| | audit-committer | Git commit with task summaries | Audit workflow |
| | phase-checkpoint | Verify phase completion | Phase validation |
| | tdd-manager | Enforce Red-Green-Refactor | TDD workflow |
| | stack-broker | Data operations via shell scripts | File operations |
| | playwright-testing | Playwright E2E testing framework | E2E testing setup |
| **Security & Penetration** | ffuf | Web fuzzing guidance | Directory enumeration |
| | investor | Financial research & paper trading | Stock analysis |
| **Developer Tools** | Prompting | Prompt engineering standards | Anthropic best practices |
| | Observability | Monitor multi-agent activity | "start observability" |
| | create-agent | Create custom subagents | Agent creation |
| | create-skill | Create reusable skills | Skill development |
| | discord-remote-control | Discord remote interface | Discord bot |

---

## Core Infrastructure Skills

### CORE - PAI System Identity

**Name:** CORE
**Status:** ✅ Essential, Auto-loads at session start
**Triggers:** Session start, PAI questions

**Purpose:** Defines the Personal AI Infrastructure system identity, mandatory response format, and core operating principles.

**Key Features:**
- Workflow routing (Git, Delegation, Merge conflicts)
- Response format specifications
- Notification protocols for observability
- Integration patterns

**Usage:** Auto-loaded, provides context for all operations.

**Files:**
- `.agent/skills/CORE/SKILL.md`
- `.agent/skills/CORE/constitution.md`
- `.agent/skills/CORE/skillsystem.md`
- `.agent/skills/CORE/hooksystem.md`

---

## Domain Cluster Skills

### 1. Life Management

**File:** `.agent/skills/life-management/SKILL.md`

**Purpose:** Personal organization, scheduling, vacation planning, and goal management. Supports Human 3.0 goals by managing personal constraints and aspirations.

**Triggers:**
- "schedule my appointments"
- "plan my vacation"
- "track my goals"
- "organize my tasks"
- "manage my time"

**Core Capabilities:**
- Appointment scheduling with calendar integration
- Goal tracking and progress monitoring
- Vacation planning with activity coordination
- Task organization and prioritization

**Workflows:**
- Schedule Showings — Calendar management with conflict detection
- Plan Vacation — Comprehensive vacation planning
- Create Task — Task creation with prioritization
- Goal Tracking — Monitor personal goal progress

**Integration Points:**
- **Input:** User goals, constraints, preferences from TELOS (TS) file
- **Output:** Schedules, plans, task lists, organized workflows

---

### 2. Quick Flow

**File:** `.agent/skills/quick-flow/SKILL.md`

**Purpose:** Fast-track development for bugs, small features, or prototypes. Executes the complete development lifecycle (Spec → Dev → Review) rapidly without multiple handoffs.

**Triggers:**
- "quick flow"
- "fast development"
- "quick dev"
- "rapid prototype"
- "quick feature"

**Agent:** quick-flow-solo-dev (Barry)

**Workflow - 3 Steps:**
1. **Create Tech Spec** (`*create-tech-spec`) — Analyze request, create lightweight technical specification
2. **Quick Dev** (`*quick-dev`) — Implement specification end-to-end
3. **Code Review** (`*code-review`) — Perform self-review or request external review

**Output Deliverables:**
- Technical Specification (lightweight)
- Implemented Code (production-ready)

**Best For:** Small scope, time-sensitive items

---

### 3. Party Mode

**File:** `.agent/skills/party-mode/SKILL.md`

**Purpose:** Orchestrates real-time multi-agent collaboration where 17+ specialized agents communicate simultaneously to solve complex, cross-functional problems.

**Triggers:**
- "party mode"
- "activate all agents"
- "multi-agent collaboration"
- "all hands on deck"
- "team collaboration"

**Workflow Steps:**
1. **Initialization** — User invokes party-mode with complex problem
2. **Role Selection** — System dynamically selects participating agents
3. **Turn-Taking** — Agents contribute sequentially or conversationally
4. **Synthesis** — Lead agent synthesizes discussion into actionable outputs
5. **Resolution** — Team arrives at comprehensive solution

**Available Agents (17+):**
- **Agile Pipeline:** analyst, product-manager, architect, developer, test-architect, scrum-master
- **Creative Intelligence:** brainstorming-coach, design-thinking-coach, innovation-oracle, master-storyteller, problem-solver
- **Security:** chief-security-officer, security-architect, security-test-analyst
- **Content & Design:** technical-writer, ux-designer
- **Specialized:** quick-flow-solo-dev

**Benefits:**
- Multi-perspective analysis from 17+ specialists
- Faster decisions through parallel thinking
- Cross-functional alignment
- Reduced handoffs
- Holistic solutions (technical, business, creative, security)

---

### 4. Research

**File:** `.agent/skills/research/SKILL.md`

**Purpose:** Deep multi-source investigation with parallel research agents for comprehensive knowledge synthesis. Uses Progressive Disclosure to load only necessary metadata on-demand.

**Triggers:**
- "do extensive research"
- "research this topic"
- "parallel research"
- "deep investigation"
- "research synthesis"

**Core Capabilities:**
- Deep multi-source investigation (web, documents, specialized APIs)
- Parallel orchestration of specialized research agents
- Information synthesis and cross-validation
- On-demand context loading (Progressive Disclosure)
- 60-70% time savings vs. sequential research

**Workflow - Extensive Research:**
1. **Intent Analysis** — Parse research request, identify dimensions
2. **Context Loading** — Load Research Skill context, set token budgets
3. **Parallel Agent Launch** — Deploy 3 specialized agents:
   - Perplexity Researcher (web-based, current info)
   - Claude Researcher (deep reasoning, synthesis)
   - Gemini Researcher (multi-modal, visual analysis)
4. **Data Collection** — Each agent executes specialized searches
5. **Synthesis & Analysis** — Identify themes, validate quality
6. **Report Generation** — Structured findings with citations

**Output Format:**
- Executive Summary
- Key Findings (numbered)
- Detailed Analysis by Subtopic
- Sources (with citations)
- Gaps & Further Research

**Performance:**
- **Time Savings:** 60-70% faster than sequential research
- **Depth:** Multi-source, cross-validated information
- **Breadth:** Diverse perspectives and analytical approaches
- **Execution Time:** 5-15 minutes depending on scope

---

### 5. Game Dev

**File:** `.agent/skills/game-dev/SKILL.md`

**Purpose:** Complete game development pipeline (BMGD) orchestrating the entire journey from concept to shipping game.

**Triggers:**
- "game development"
- "bmgd workflow"
- "create a game"
- "game design"
- "game pipeline"

**BMGD Pipeline - 4 Phases:**

**Phase 1: Preproduction (2-4 weeks)**
- **Agents:** Analyst, Product Manager
- **Steps:** Brainstorm Game → Game Brief → Market Analysis
- **Outputs:** Game Brief, Concept Art Description, Prototype Plan

**Phase 2: Game Design (3-6 weeks)**
- **Agents:** Game Designer, Technical Writer
- **Steps:** GDD Creation → Mechanics Design → Level Design → Narrative Design
- **Outputs:** Game Design Document, Level Plans, Narrative Script

**Phase 3: Technical Architecture (1-3 weeks)**
- **Agents:** Architect, Developer (Tech Lead)
- **Steps:** Engine Selection → System Architecture → Pipeline Design → Tech Spec
- **Outputs:** Technical Design Document, Architecture Diagrams

**Phase 4: Production (4-12 weeks)**
- **Agents:** Product Manager, Developer, Test Architect
- **Steps:** Sprint Planning → Development → Testing → Polish
- **Outputs:** Playable Builds (Alpha, Beta, Release), Test Reports

**Workflow Commands:**
- `*bmgd-preproduction` — Begin game concept development
- `*bmgd-game-design` — Create comprehensive design documentation
- `*bmgd-technical` — Design technical architecture
- `*bmgd-production` — Implement, test, and polish

---

### 6. Content

**File:** `.agent/skills/content/SKILL.md`

**Purpose:** End-to-end content creation encompassing technical writing, UX design, image generation, and asset management.

**Triggers:**
- "create content"
- "write blog post"
- "create documentation"
- "design user experience"
- "manage assets"

**Agents:** technical-writer (Paige), ux-designer

**Sub-Skills:**

#### Content Creation & Blogging
- Blog post creation from dictated essays
- Structured essay composition
- Content formatting and style guide application
- SEO optimization and readability enhancement

**Commands:** `write-blog`, `write-essay`, `format-content`

#### Image Creation
- Context-aware custom image generation
- Blog post header images and article banners
- Alt text and caption generation
- Brand-aligned visual creation

**Commands:** `create-custom-image`, `create-header`, `generate-caption`

#### Download Images
- Download images from URLs
- Extract and download images from Markdown/HTML files
- Make pages self-contained with local image references

**Commands:** `download-images --fpc` (full page), `download-images --io` (images only)

#### Rename Files to Title
- Extract H1 titles from Markdown files
- Auto-generate URL-friendly slugs
- Enforce filename length limits

**Commands:** `rename-files-to-title`

**Workflows:**
- **Documentation:** Analysis → Design → Documentation → Visualization → Review
- **Content Creation:** Concept → Writing → Formatting → Visual Design → Optimization → Asset Management

---

### 7. Architecture Rules

**File:** `.agent/skills/architecture-rules/SKILL.md`

**Purpose:** Defines cross-cutting architectural constraints and foundational design principles guiding all system design decisions.

**Triggers:**
- "architecture principles"
- "system design constraints"
- "platform portability"
- "zero trust security"
- "cloud storage sync"

**6 Core Rules:**

#### Rule 1: Cloud Storage & Synchronization
**Priority:** High

All specs, code, and configurations SHALL be stored in Git repositories hosted on GitHub, enabling full functionality after standard setup on any workstation within 30 minutes.

**Key Guidelines:**
- Repository structure: `org-<uuid>/{specs,code,docs,config}`
- `.gitignore` template with secrets, platform-specific dirs, build artifacts
- `.env.example` for required environment variables
- Pre-commit hooks for secret scanning

#### Rule 2: Platform Portability & Agnosticism
**Priority:** High

Use platform-agnostic file formats and standards for all specifications, enabling migration between AI-integrated IDEs without rebuilding.

**File Format Standards:**
- Specs: Markdown (.md) with YAML frontmatter
- Configuration: YAML or JSON with documented schema
- Code: Python, JavaScript, Go, TypeScript with PEP 8/StandardJS standards

#### Rule 3: Modular & Extensible Architecture
**Priority:** High

Organize capabilities into discrete, reusable modules following UNIX philosophy.

**Module Types:**
- **Agents:** Specialized roles in workflow
- **Skills:** Reusable capabilities
- **Workflows:** Step-by-step execution
- **Rules:** Constraints & requirements

#### Rule 4: Mandatory Context Loading
**Priority:** Critical

Enforce four-layer mandatory context loading protocol ensuring AI agents read foundational knowledge before executing tasks.

**Four Layers:**
1. **Context System Documentation** — Master context file (CLAUDE.md)
2. **UserPromptSubmit Hook** — Custom code hook intercepts every user message
3. **Aggressive Instructions** — ALL CAPS for critical requirements
4. **Redundant Symlinks** — Critical files accessible from multiple paths

#### Rule 5: Multi-Organization Isolation
**Priority:** Critical

Maintain complete isolation between organization contexts with no shared data storage.

**Implementation:**
- Separate repository per organization (`org-<uuid>/`)
- Explicit context switching via environment variable
- No automatic context inference
- Data sanitization for central outputs (UUID, no client names)

#### Rule 6: Zero Trust Architecture
**Priority:** Critical

Implement Zero Trust principles: assume breach and verify explicitly rather than implicitly trusting based on network location.

**Core Principles:**
1. **Verify Explicitly** — Authenticate/authorize on all data points
2. **Use Least Privilege Access** — JIT, JEA, risk-based, session-based
3. **Assume Breach** — Micro-segmentation, end-to-end encryption, monitoring

**Maturity Levels:**
- Level 0: Traditional (perimeter-based)
- Level 1: Initial (MFA for remote, basic inventory)
- Level 2: Developing (MFA all users, device checks, app segmentation)
- Level 3: Advanced (risk-based auth, micro-segmentation, JIT access)
- Level 4: Optimal (continuous auth, dynamic segmentation, AI/ML)

---

### 8. Security GRC

**File:** `.agent/skills/security-grc/SKILL.md`

**Purpose:** Enterprise security, governance, risk, and compliance combining strategic leadership, technical architecture, and offensive security testing.

**Triggers:**
- "security assessment"
- "grc management"
- "compliance"
- "security architecture"
- "risk management"
- "security testing"

**Agents:** chief-security-officer, security-architect, security-test-analyst

**Sub-Skills:**

#### GRC Management (Governance, Risk, Compliance)

**Governance:**
- Policy Management (development, standards, control frameworks)
- Program Structure (framework design, committees, escalation)
- Documentation (administrative guides, procedures, compliance matrices)

**Risk Management:**
- Risk Assessment (asset identification, threat/vulnerability analysis)
- Risk Frameworks (NIST RMF, ISO 31000, FAIR, OCTAVE)
- Risk Monitoring (KRIs, risk register, continuous assessment)

**Compliance Management:**
- Multi-Framework (HIPAA, PCI DSS, DIACAP, RMF, GDPR, ISO 27001)
- Compliance Activities (requirements mapping, control implementation)
- Audit Coordination (internal/external audit management, CAP tracking)

**Key Frameworks:**
- NIST CSF — Identify, Protect, Detect, Respond, Recover
- NIST SP800-53 — Security and privacy controls
- CIS Controls v8 — 18 critical security controls
- ISO 27001 — Information Security Management System
- PCI DSS — Payment card industry data security

#### DevSecOps (Development Security Operations)

**Integration Points:**
- Security in development lifecycle
- Secure coding practices
- Automated security testing
- Vulnerability scanning in CI/CD
- Security policy enforcement
- Incident response coordination

**Workflow: Enterprise Security Assessment (2-4 weeks)**

1. **Planning & Scoping (3-5 days)** → Assessment Plan
2. **Information Gathering (5-10 days)** → Information Gathering Report
3. **Technical Assessment (10-15 days)** → Technical Assessment Report
4. **Compliance Validation (5-7 days)** → Compliance Gap Analysis Report
5. **Risk Assessment (3-5 days)** → Risk Assessment Report
6. **Findings Analysis (5-7 days)** → Prioritized Findings List
7. **Recommendations (3-5 days)** → Remediation Roadmap
8. **Reporting (5-7 days)** → Final Assessment Report Package
9. **Out-Brief & Follow-up (2-3 days)** → Action Items

**Embedded Rules:**
- **Zero Trust Architecture** — "Never trust, always verify"
- **Multi-Organization Isolation** — Complete separation of contexts

---

### 9. CIS - Creative Intelligence Suite

**File:** `.agent/skills/cis/SKILL.md`

**Purpose:** Provides structured frameworks for creative problem-solving and innovation using proven techniques to transform challenges into innovative, user-centered solutions.

**Triggers:**
- "brainstorming"
- "design thinking"
- "innovation"
- "creative problem solving"
- "six thinking hats"

**Agents:** Analyst, Brainstorming Coach (Carson), Design Thinking Coach (Maya), Innovation Oracle (Victor), Master Storyteller (Sophia), Problem Solver (Dr. Quinn)

**Sub-Skills:**

#### Brainstorming Skill
- Structured ideation and concept refinement
- Six Thinking Hats methodology
- Role-playing exercises and lateral thinking
- Five W's questioning for project elicitation
- Assumption testing and critical analysis
- Idea clustering, prioritization, validation

**Techniques:**
- **Six Thinking Hats:** White (facts), Red (emotions), Black (critical), Yellow (positive), Green (creative), Blue (control)
- **Five W's:** Who, What, Where, When, Why
- **Role Playing:** User personas, stakeholder perspectives

#### Design Thinking Skill
- User-centered problem solving
- Empathy-driven design approach
- Human-centered research and testing
- Interaction design and user flows
- Accessibility and usability planning

**Process:**
1. **Empathize** — Understand user needs and pain points
2. **Define** — Clearly frame the problem
3. **Ideate** — Generate creative solutions
4. **Prototype** — Create interactive mockups
5. **Test** — Validate with users and iterate

#### Innovation Strategy Skill
- Strategic innovation and transformation
- Trend analysis and market positioning
- Competitive landscape analysis
- Emerging technology assessment
- Strategic roadmap development

#### Problem-Solving Skill
- Root cause analysis and problem diagnosis
- Systematic problem deconstruction
- Constraint-based solution development
- Systems thinking and optimization
- Risk-informed decision making

**Methodologies:**
- 5 Whys analysis
- Fishbone (Ishikawa) diagrams
- Constraint-based problem solving
- Systems thinking approach

**Workflows:**
- **Six Thinking Hats** — Multi-perspective analysis
- **Five W's** — Systematic questioning and clarification
- **Design Thinking** — User-centered problem solving
- **Innovation Strategy** — Strategic transformation planning
- **Problem-Solving** — Root cause analysis and solutions
- **Storytelling** — Narrative framing and communication

**Trigger Phrases:**
- "Let's explore this idea" (Brainstorming)
- "How do we design for users?" (Design Thinking)
- "Let's analyze from all angles" (Six Thinking Hats)
- "What's the real problem?" (Five W's)
- "How can we innovate?" (Innovation)
- "Why is this happening?" (Problem Solving)
- "How do we communicate this?" (Storytelling)

---

### 10. Agile

**File:** `.agent/skills/agile/SKILL.md`

**Purpose:** Complete Agile pipeline emphasizing collaboration, feedback, and continuous improvement through iterative product development.

**Triggers:**
- "agile methodology"
- "sprint planning"
- "agile ceremonies"
- "user stories"
- "agile metrics"

**Agile Pipeline - 5 Phases:**

**Phase 1: Ideation**
- **Agent:** analyst
- **Output:** Project Brief (vision, problem statement, success criteria)
- **Activities:** Brainstorm, Elicit requirements, Test assumptions, Define users

**Phase 2: Requirements & Planning**
- **Agent:** product-manager
- **Output:** Product Requirements Document (PRD) with Epics and User Stories
- **Activities:** Scale-adaptive planning, Scope control, Story creation, Prioritization

**Phase 3: Architecture**
- **Agent:** architect
- **Output:** Technical Architecture Document (TAD)
- **Activities:** System design, Tech stack selection, Infrastructure planning, Security design

**Phase 4A: Development**
- **Agent:** developer
- **Output:** Implemented code with tests
- **Activities:** Feature implementation, Unit tests (>80% coverage), Code quality, API documentation

**Phase 4B: Quality Assurance**
- **Agent:** test-architect
- **Output:** Test results and quality validation
- **Activities:** Test case creation, Manual/automated testing, Defect reporting, Quality metrics

**Phase 5: Process Facilitation**
- **Agent:** scrum-master
- **Responsibility:** Coordinate all phases, facilitate ceremonies, remove blockers
- **Activities:** Sprint planning, Daily standups, Sprint reviews, Retrospectives

**Sub-Skills:**

#### Story Development Skill
- Epic and user story creation
- Story point estimation
- Acceptance criteria definition
- Dependency identification
- Story prioritization and sequencing

**Story Structure:**
```
Epic: [Feature area]
  └─ Story 1: As a [user], I want [feature] so that [benefit]
     └─ AC1: [Specific behavior]
     └─ AC2: [Specific behavior]
```

#### Core Tasks Skill
- Task breakdown and decomposition
- Sprint task creation
- Task assignment and tracking
- Task status management
- Burndown tracking

**Workflows:**

#### Scale-Adaptive Planning Workflow
Selects appropriate planning depth based on project complexity.

**Planning Tracks:**
| Track | For | Documentation | Timeline |
|---|---|---|---|
| **Quick Flow** | Simple, well-understood projects | Minimal | Days to 1-2 weeks |
| **Agile method** | Standard moderate complexity | Full (PRD, Architecture) | Weeks to months |
| **Enterprise** | Large, complex, multi-team | Comprehensive + governance | Months to years |

**Decision Matrix:**
| Dimension | Quick Flow | Agile | Enterprise |
|---|---|---|---|
| Features | 1-3 | 4-15 | 16+ |
| Stakeholders | 1-2 | 3-7 | 8+ |
| Timeline | <2 weeks | 2-12 weeks | 12+ weeks |
| Team Size | 1-2 | 2-5 | 6+ |
| Risk | Low | Medium | High |

#### Advanced Elicitation Workflow
Uses critical questioning techniques to refine requirements and stress-test assumptions.

**Techniques:**
- Hindsight is 20/20: "What could go wrong?"
- Critical Assumption Testing
- Five Whys: Root cause analysis
- Constraint Analysis
- Stakeholder Perspectives

**Agile Ceremonies:**
- **Sprint Planning** — 2-4 hours, sprint goal + committed stories
- **Daily Standup** — 15 minutes, progress + blockers
- **Sprint Review** — 1-2 hours, demo + feedback
- **Sprint Retrospective** — 1-1.5 hours, process improvement
- **Backlog Grooming** — 1-2 hours, story refinement

**Key Metrics:**
- **Velocity:** Stories completed per sprint
- **Burndown:** Work remaining in sprint
- **Lead Time:** From story creation to completion
- **Cycle Time:** From work start to completion
- **Code Coverage:** Percentage of code tested
- **Defect Density:** Bugs per 1000 lines of code

---

## Utility & Content Skills

### start-up

**File:** `.agent/skills/start-up/SKILL.md`

**Purpose:** Manages PAI infrastructure services (voice server, python-sidecar, observability dashboard). Idempotent and safe to call multiple times.

**Triggers:**
- "startup"
- "start servers"
- "shutdown servers"
- "start voice"
- "start observability"

**Services Managed:**
1. Voice Server (localhost:8888)
2. Observability Dashboard (multi-agent activity monitoring)
3. Python Sidecar (background tasks)

**Commands:**
- `/start-up` — Start all services
- `/start-up --start-voice` — Start voice server only
- `/start-up --start-observe` — Start observability only
- `/start-up -sd` — Shutdown both services
- `/start-up --stop-voice` — Stop voice server only

**Key Features:**
- Idempotent (safe to call multiple times)
- Fine-grained control over individual services
- Health checks and verification
- Startup verification before substantive work

---

### create-cli

**File:** `.agent/skills/create-cli/SKILL.md`

**Purpose:** Generates production-quality TypeScript CLIs with full documentation, error handling, and best practices.

**Triggers:**
- "create a CLI"
- "build a command-line tool"
- "make a CLI for X"

**Features:**
- Deterministic, type-safe command-line tools
- Full documentation and help system
- Error handling and exit codes
- Argument parsing and validation
- Config file support
- Testing infrastructure

**Output:** Production-ready CLI tool with:
- `src/cli.ts` — Main CLI implementation
- `README.md` — User documentation
- `package.json` — Dependencies and scripts
- Tests with >80% coverage
- GitHub Actions CI/CD pipeline

---

### read-aloud

**File:** `.agent/skills/read-aloud/SKILL.md`

**Purpose:** Reads file contents aloud using voice system.

**Triggers:**
- "read this to me"
- "read aloud"
- "read the file"
- "speak the content"

**Features:**
- File content audio playback
- Voice-enabled delivery
- Integration with voice server

---

### read-daily-devotion

**File:** `.agent/skills/read-daily-devotion/SKILL.md`

**Purpose:** Reads today's daily devotion aloud using voice system.

**Triggers:**
- "read daily devotion"
- "read today's devotion"
- "rdd"

---

### transcribe-audio

**File:** `.agent/skills/transcribe-audio/SKILL.md`

**Purpose:** Transforms raw audio into structured, readable Markdown.

**Triggers:**
- Audio transcription requests

**Output:** Structured Markdown with:
- Section headings
- Paragraph formatting
- Timestamp references (optional)
- Speaker identification (if multi-speaker)

---

### aggregate-transcriptions

**File:** `.agent/skills/aggregate-transcriptions/SKILL.md`

**Purpose:** Aggregate audio transcriptions and summarize session notes into consolidated reports.

**Triggers:**
- "aggregate transcriptions"
- "summarize session notes"

**Extracts:**
- Key Insights ("The Wisdom")
- Actionable Items & Frameworks
- Maintains traceability to source

---

### open-file

**File:** `.agent/skills/open-file/SKILL.md`

**Purpose:** Opens files in their default viewer or editor using system open command.

**Triggers:**
- "open this file"
- "view this file"

---

### rsync-sync-missing

**File:** `.agent/skills/rsync-sync-missing/SKILL.md`

**Purpose:** Sync missing files from source to target directory using rsync --ignore-existing.

**Features:**
- Only copies files that don't exist in target
- Preserves existing files
- Dry-run mode for safety

---

### Prompting

**File:** `.agent/skills/prompting/SKILL.md`

**Purpose:** Prompt engineering standards and context engineering principles based on Anthropic best practices.

**Topics:**
- Clarity and structure
- Progressive discovery
- Signal-to-noise ratio optimization
- Effective prompting patterns

---

### Observability

**File:** `.agent/skills/observability/SKILL.md`

**Purpose:** Real-time monitoring dashboard for PAI multi-agent activity.

**Triggers:**
- "start observability"
- "stop dashboard"
- "restart observability"
- "monitor agents"
- "show agent activity"

**Features:**
- Multi-agent activity tracking
- Real-time dashboards
- Event logging
- Performance metrics

---

## Research & Analysis Skills

### Research

**File:** `.agent/skills/Research/SKILL.md`

**Purpose:** Comprehensive research, analysis, and content extraction system with multi-source parallel research.

**Capabilities:**
- Deep content analysis
- Extended thinking
- Intelligent retrieval for difficult sites
- Fabric pattern selection (242+ specialized prompts)
- Parallel researcher agents

---

### bright-data

**File:** `.agent/skills/bright-data/SKILL.md`

**Purpose:** Progressive four-tier URL content scraping with automatic fallback strategy.

**Triggers:**
- "scrape this URL"
- "fetch this page"
- "get content from"
- "can't access this site"
- "pull content from URL"

**Features:**
- Handles bot detection
- Access restriction bypass
- Multiple fallback strategies

---

## Specialized Skills

### Fabric

**File:** `.agent/skills/fabric/SKILL.md`

**Purpose:** Native Fabric pattern execution for Claude Code with 242+ specialized prompts.

**Triggers:**
- Fabric pattern names (extract_wisdom, summarize, analyze_claims, threat_modeling, etc.)

**Features:**
- Native pattern execution
- YouTube transcript support
- Pattern updates
- No CLI spawning needed

---

### Art

**File:** `.agent/skills/art/SKILL.md`

**Purpose:** Complete visual content system with Tron-meets-Excalidraw aesthetic.

**Features:**
- Dark backgrounds
- Neon accents
- Hand-drawn sketch style
- Visual design system

---

### alex-hormozi-pitch

**File:** `.agent/skills/alex-hormozi-pitch/SKILL.md`

**Purpose:** Create irresistible offers and pitches using Alex Hormozi's $100M Offers methodology.

**Triggers:**
- "$100M offers"
- "create irresistible offer"
- "pitch design"

**Covers:**
- Value equation
- Guarantee frameworks
- Pricing psychology
- Offer positioning

---

### story-explanation

**File:** `.agent/skills/story-explanation/SKILL.md`

**Purpose:** Create compelling story-format summaries using UltraThink for narrative framing.

**Triggers:**
- "create story explanation"
- "narrative summary"
- "explain as a story"

**Formats:**
- 3-part narrative
- n-length with inline links
- Abridged 5-line
- Comprehensive via Foundry MCP

---

### ffuf

**File:** `.agent/skills/ffuf/SKILL.md`

**Purpose:** Expert guidance for ffuf web fuzzing during penetration testing.

**Capabilities:**
- Directory enumeration
- Parameter testing
- Authenticated fuzzing with raw requests
- Auto-calibration
- Result analysis

---

### Investor

**File:** `.agent/skills/investor/SKILL.md`

**Purpose:** Financial market research and paper trading simulation using WeBull data.

**Triggers:**
- Stock price checks
- Option chain analysis
- Paper trading simulation

**Features:**
- Ticker snapshots
- Option greeks retrieval
- Paper order placement
- Risk-free analysis

---

### playwright-testing

**File:** `.agent/skills/playwright-testing/SKILL.md`

**Purpose:** Comprehensive Playwright E2E testing framework for web applications.

**Features:**
- E2E test setup and configuration
- Playwright debugging
- SvelteKit configuration
- API route mocking
- Visual regression testing
- Authentication flows

---

### Project Management & Development Skills

### architect

**File:** `.agent/skills/architect/SKILL.md`

**Purpose:** Analyzes `product.md` and `product-guidelines.md` to generate hierarchical structure of Epics, Stories, and master Plan.

---

### audit-committer

**File:** `.agent/skills/audit-committer/SKILL.md`

**Purpose:** Executes a git commit and attaches detailed task summary using git notes. Enforces documentation updates for new features.

---

### phase-checkpoint

**File:** `.agent/skills/phase-checkpoint/SKILL.md`

**Purpose:** Verifies all changes since last checkpoint, ensures test coverage, validates file existence against acceptance criteria, and generates manual verification plan.

---

### tdd-manager

**File:** `.agent/skills/tdd-manager/SKILL.md`

**Purpose:** Enforces Red-Green-Refactor cycle for every task and updates the Plan accordingly.

---

### stack-broker

**File:** `.agent/skills/stack-broker/SKILL.md`

**Purpose:** Brokers all data operations through shell scripts to ensure reliability and file locking.

---

### create-agent

**File:** `.agent/skills/create-agent/SKILL.md`

**Purpose:** Create custom subagents following Claude Code documentation.

**Features:**
- Subagent validation
- Task delegation setup
- Parallel execution orchestration

---

### create-skill

**File:** `.agent/skills/create-skill/SKILL.md`

**Purpose:** Create reusable skills extending Claude's capabilities following Claude Code documentation.

**Features:**
- Skill validation checklist
- YAML frontmatter configuration
- Markdown content structure
- Reference files support
- User-invocable skill creation

---

### discord-remote-control

**File:** `.agent/skills/discord-remote-control/SKILL.md`

**Purpose:** Discord-based remote interface for Sam with text, images, files, and voice note support.

**Features:**
- Discord bot integration
- Claude Code subprocess execution
- Full PAI skill access
- Persistent memory (Muninn)
- Session management

---

## Skill Invocation Reference

### Methods to Invoke Skills

#### 1. Direct Command
```
/skill-name
/skill-name --flag value
```

#### 2. Natural Language
```
"Let me use the brainstorming skill to explore this idea"
"Can you start the voice server using start-up?"
"Research this topic deeply"
```

#### 3. Automatic Invocation
Skills with matching descriptions are auto-invoked when you describe the task.

### Skill Availability

**User-Invocable Skills:** All listed skills can be directly invoked with `/skill-name`

**Auto-Invoked Skills:** Skills with matching descriptions auto-invoke when context matches

**Reference-Only Skills:** Some skills (like architecture-rules) provide context that's automatically loaded

---

## Skill Architecture

### Skill File Structure

```
.claude/skills/
├── skill-name/
│   ├── SKILL.md          # Main skill definition (required)
│   ├── reference.md      # Extended reference (optional)
│   ├── examples.md       # Usage examples (optional)
│   └── scripts/
│       └── helper.sh     # Supporting scripts (optional)
```

### SKILL.md Format

```yaml
---
name: skill-name
description: Brief description. Use WHEN [trigger condition].
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Grep, Glob
triggers:
  - "trigger phrase 1"
  - "trigger phrase 2"
---

# Skill Title

## Purpose
[Detailed purpose]

## Core Capabilities
- [Capability 1]
- [Capability 2]

## Workflows
[Workflow descriptions]

## Integration Points
[Inputs, outputs, dependencies]
```

### Skill Types

| Type | Purpose | Usage | Auto-Invoke |
|------|---------|-------|-------------|
| **Reference** | Knowledge & guidelines | `user-invocable: false` | Yes (context) |
| **Task** | Actions & procedures | `disable-model-invocation: true` | No |
| **Workflow** | Complete procedures | Default settings | Yes |

### Context Loading Protocol

Skills follow Unified File-Based Context (UFC) with Mandatory Context Loading (MCL):

1. **Layer 1:** Master context (CLAUDE.md)
2. **Layer 2:** Skill-specific context (SKILL.md)
3. **Layer 3:** Aggressive instructions (frontmatter)
4. **Layer 4:** Redundant symlinks (discoverable paths)

### Tool Access Control

Each skill declares allowed tools:

```yaml
allowed-tools: Read, Grep, Glob, Bash, WebFetch
```

Default allowed tools: All standard Claude Code tools

---

## Summary

- **Total Skills:** 38 (all validated)
- **Domain Clusters:** 10 (Agile, CIS, Security, Content, etc.)
- **Utility Skills:** 8 (start-up, create-cli, read-aloud, etc.)
- **Infrastructure:** 1 (CORE)
- **Specialized:** 8+ (Fabric, Art, ffuf, etc.)
- **Development:** 6+ (architect, audit-committer, etc.)

All skills are production-ready, well-documented, and follow PAI standards.

For detailed skill usage, see individual SKILL.md files in `.agent/skills/[skill-name]/`
