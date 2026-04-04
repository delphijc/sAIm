# Domain Clusters - Quick Reference Guide

**New Architecture:** 10 Domain Cluster Skills consolidate 54 original modules

---

## 1️⃣ Life Management

**Consolidates:** Task management, scheduling, vacation planning, goal tracking

**When to Use:**
- "Schedule my appointments"
- "Plan my vacation"
- "Track my goals"
- "Organize my tasks"

**Key Workflows:**
- **Schedule Showings** — Calendar management with conflict detection
- **Plan Vacation** — Comprehensive vacation planning
- **Create Task** — Task creation with prioritization
- **Goal Tracking** — Monitor personal goal progress

**Outputs:**
- Schedules with conflict detection
- Vacation plans with activities and bookings
- Task lists with prioritization
- Goal progress reports

**File:** `.agent/skills/life-management/SKILL.md`

---

## 2️⃣ Quick Flow

**Consolidates:** Fast-track development, rapid prototyping, small features

**When to Use:**
- "Quick flow: fix this button"
- "Rapid prototype for this feature"
- "Quick dev on this bug"

**Key Workflow:**
1. **Create Tech Spec** — Lightweight technical plan
2. **Quick Dev** — End-to-end implementation
3. **Code Review** — Self-review or external review

**Agent:** quick-flow-solo-dev (Barry)

**Best For:** Small scope, time-sensitive items (<2 weeks)

**File:** `.agent/skills/quick-flow/SKILL.md`

---

## 3️⃣ Party Mode

**Consolidates:** Multi-agent collaboration, complex problem-solving

**When to Use:**
- "Party mode: how do we position this?"
- "All hands on deck for this strategic decision"
- "Complex cross-functional problem"

**Available Agents (17+):**
- **Agile:** analyst, product-manager, architect, developer, test-architect, scrum-master
- **Creative:** brainstorming-coach, design-thinking-coach, innovation-oracle, master-storyteller, problem-solver
- **Security:** chief-security-officer, security-architect, security-test-analyst
- **Content:** technical-writer, ux-designer
- **Quick Dev:** quick-flow-solo-dev

**Benefits:**
- Multi-perspective analysis from 17+ specialists
- Parallel thinking accelerates decisions
- Cross-functional alignment
- Reduced handoffs

**File:** `.agent/skills/party-mode/SKILL.md`

---

## 4️⃣ Research

**Consolidates:** Deep investigation, parallel research, synthesis

**When to Use:**
- "Research quantum computing trends"
- "Deep investigation on market opportunities"
- "Parallel research across multiple sources"

**Parallel Agents:**
1. **Perplexity Researcher** — Web-based, current information
2. **Claude Researcher** — Deep reasoning, synthesis
3. **Gemini Researcher** — Multi-modal, visual analysis

**Performance:**
- **60-70% faster** than sequential research
- Multi-source, cross-validated
- Diverse perspectives

**Output Format:**
- Executive Summary
- Key Findings (numbered)
- Detailed Analysis
- Sources with citations
- Gaps & Further Research

**File:** `.agent/skills/research/SKILL.md`

---

## 5️⃣ Game Dev

**Consolidates:** Complete game development pipeline (BMGD)

**When to Use:**
- "Start game development for tower defense game"
- "BMGD workflow for my game concept"

**4-Phase Pipeline:**

| Phase | Timeline | Agents | Output |
|-------|----------|--------|--------|
| **Preproduction** | 2-4 weeks | Analyst, Product Manager | Game Brief, Concept Art |
| **Design** | 3-6 weeks | Game Designer, Technical Writer | Game Design Document, Level Plans |
| **Technical** | 1-3 weeks | Architect, Developer | Technical Design Document |
| **Production** | 4-12 weeks | PM, Developer, Test Architect | Playable Builds, Shipped Game |

**Workflow Commands:**
- `*bmgd-preproduction` — Brainstorm → Brief → Market Analysis
- `*bmgd-game-design` — GDD → Mechanics → Levels → Narrative
- `*bmgd-technical` — Engine → Architecture → Pipelines
- `*bmgd-production` — Sprint → Dev → Testing → Polish

**File:** `.agent/skills/game-dev/SKILL.md`

---

## 6️⃣ Content

**Consolidates:** Technical writing, UX design, image generation, asset management

**When to Use:**
- "Create documentation for this API"
- "Write a blog post"
- "Design user experience"
- "Generate header images"

**Sub-Skills:**

#### Content Creation & Blogging
- Blog post creation from dictated essays
- Structured essay composition
- Content formatting and style guide application
- SEO optimization and readability

#### Image Creation
- Context-aware custom image generation
- Blog post header images and article banners
- Alt text and caption generation
- Brand-aligned visual creation

#### Download Images
- Download images from URLs
- Extract and download images from Markdown/HTML files
- Make pages self-contained with local image references

#### Rename Files to Title
- Extract H1 titles from Markdown files
- Auto-generate URL-friendly slugs
- Enforce filename length limits

**Agents:** technical-writer (Paige), ux-designer

**File:** `.agent/skills/content/SKILL.md`

---

## 7️⃣ Architecture Rules

**Consolidates:** Cross-cutting principles and constraints

**When to Use:**
- "What are the architecture principles?"
- "How should we structure the repository?"
- "Explain zero trust architecture"

**6 Core Rules:**

1. **Cloud Storage & Synchronization** — GitHub repos, 30-min setup
2. **Platform Portability** — Markdown, YAML, JSON standards
3. **Modular & Extensible** — UNIX philosophy, discrete modules
4. **Mandatory Context Loading** — 4-layer enforcement protocol
5. **Multi-Organization Isolation** — Complete separation between contexts
6. **Zero Trust Architecture** — "Never trust, always verify"

**Key Concepts:**
- Cloud-based with 30-minute setup target
- Platform-agnostic file formats
- Modular design patterns
- Observable context loading
- Complete organization isolation
- Zero Trust maturity levels (0-4)

**File:** `.agent/skills/architecture-rules/SKILL.md`

---

## 8️⃣ Security GRC

**Consolidates:** Enterprise security, governance, risk, compliance

**When to Use:**
- "Conduct security assessment"
- "GRC management for compliance"
- "Risk management framework"
- "Security architecture design"

**Sub-Skills:**

#### GRC Management
- **Governance:** Policy management, standards, control frameworks
- **Risk Management:** Risk assessment, frameworks (NIST RMF, ISO 31000, FAIR)
- **Compliance Management:** HIPAA, PCI DSS, DIACAP, GDPR, ISO 27001

#### DevSecOps
- Security in development lifecycle
- Secure coding practices
- Automated security testing
- Vulnerability scanning in CI/CD

**Enterprise Security Assessment Workflow (2-4 weeks):**
1. Planning & Scoping (3-5 days)
2. Information Gathering (5-10 days)
3. Technical Assessment (10-15 days)
4. Compliance Validation (5-7 days)
5. Risk Assessment (3-5 days)
6. Findings Analysis (5-7 days)
7. Recommendations (3-5 days)
8. Reporting (5-7 days)
9. Out-Brief & Follow-up (2-3 days)

**Agents:** chief-security-officer, security-architect, security-test-analyst

**Key Frameworks:**
- NIST CSF, NIST SP800-53, NIST RMF
- CIS Controls v8
- ISO 27001
- PCI DSS

**Embedded Rules:**
- Zero Trust Architecture
- Multi-Organization Isolation

**File:** `.agent/skills/security-grc/SKILL.md`

---

## 9️⃣ CIS (Creative Intelligence Suite)

**Consolidates:** Brainstorming, design thinking, innovation, problem-solving

**When to Use:**
- "Brainstorm ideas for this product"
- "Apply design thinking to this problem"
- "How can we innovate in this space?"
- "What's the root cause of this issue?"

**6 Agent Team:**
- **Analyst** — Reflective coach, idea articulation
- **Brainstorming Coach (Carson)** — Ideation, lateral thinking
- **Design Thinking Coach (Maya)** — User-centered design
- **Innovation Oracle (Victor)** — Trend analysis, transformation
- **Master Storyteller (Sophia)** — Narrative framing
- **Problem Solver (Dr. Quinn)** — Root cause analysis

**4 Sub-Skills:**

#### Brainstorming Skill
- Six Thinking Hats methodology
- Five W's questioning
- Role-playing exercises
- Assumption testing

#### Design Thinking Skill
- User-centered problem solving
- Empathy-driven design
- Interaction design
- Accessibility planning

#### Innovation Strategy Skill
- Trend analysis
- Competitive landscape
- Strategic positioning
- Innovation roadmap

#### Problem-Solving Skill
- Root cause analysis (5 Whys)
- Fishbone diagrams
- Constraint-based problem solving
- Systems thinking

**Workflows:**
- **Six Thinking Hats** — Multi-perspective analysis
- **Five W's** — Systematic questioning
- **Design Thinking** — User-centered solution
- **Innovation Strategy** — Transformative planning
- **Problem-Solving** — Root cause & solutions
- **Storytelling** — Narrative framing

**Trigger Phrases:**
- "Let's explore this idea" → Brainstorming
- "How do we design for users?" → Design Thinking
- "Let's analyze from all angles" → Six Thinking Hats
- "What's the real problem?" → Five W's
- "How can we innovate?" → Innovation Strategy
- "Why is this happening?" → Problem Solving
- "How do we communicate this?" → Storytelling

**File:** `.agent/skills/cis/SKILL.md`

---

## 🔟 Agile

**Consolidates:** Complete Agile pipeline and ceremonies

**When to Use:**
- "Let's use Agile to build this feature"
- "Sprint planning for next iteration"
- "Create user stories for this requirement"

**5-Phase Pipeline:**

| Phase | Agent | Output |
|-------|-------|--------|
| **Ideation** | analyst | Project Brief |
| **Requirements & Planning** | product-manager | PRD, Epics, User Stories |
| **Architecture** | architect | Technical Architecture Document |
| **Development** | developer | Implemented code, tests |
| **QA** | test-architect | Quality reports, validation |
| **Facilitation** | scrum-master | Sprint coordination, metrics |

**Sub-Skills:**

#### Story Development
- Epic and user story creation
- Story point estimation
- Acceptance criteria definition
- Story prioritization

#### Core Tasks
- Task breakdown and decomposition
- Sprint task creation
- Burndown tracking

**Workflows:**

#### Scale-Adaptive Planning
Selects planning depth based on complexity:
- **Quick Flow** (1-3 features, 1-2 people, <2 weeks)
- **Agile method** (4-15 features, 2-5 people, weeks to months)
- **Enterprise** (16+ features, 6+ people, months to years)

#### Advanced Elicitation
- Hindsight is 20/20 questioning
- Critical assumption testing
- Five Whys
- Constraint analysis
- Stakeholder perspectives

**Agile Ceremonies:**
- **Sprint Planning** — 2-4 hours
- **Daily Standup** — 15 minutes
- **Sprint Review** — 1-2 hours
- **Sprint Retrospective** — 1-1.5 hours
- **Backlog Grooming** — 1-2 hours

**Key Metrics:**
- Velocity (stories per sprint)
- Burndown
- Lead time
- Cycle time
- Code coverage
- Defect density

**File:** `.agent/skills/agile/SKILL.md`

---

## Quick Comparison Table

| Cluster | Best For | Timeline | Complexity | Agents |
|---------|----------|----------|------------|--------|
| **Life Management** | Personal organization | Ongoing | Low | Self-service |
| **Quick Flow** | Small features, bugs | <2 weeks | Low | 1 (Barry) |
| **Party Mode** | Strategic decisions | 1-3 days | High | All 17+ |
| **Research** | Deep investigation | 5-15 min | Variable | 3 parallel |
| **Game Dev** | Games (BMGD) | 10-25 weeks | Very High | 6+ |
| **Content** | Writing, docs, UX | 1-4 weeks | Medium | 2 (Paige, UX) |
| **Architecture Rules** | Design decisions | Reference | N/A | N/A |
| **Security GRC** | Security posture | 2-4 weeks | High | 3 (CSO, Arch, STA) |
| **cis** | Creative problems | 3-7 days | Medium-High | 6 agents |
| **Agile** | Product development | 2-12+ weeks | Medium-High | 5 agents |

---

## Choosing the Right Domain Cluster

**Problem:** Small feature with deadline
→ **Quick Flow**

**Problem:** Need multiple perspectives on strategy
→ **Party Mode**

**Problem:** Deep understanding of a topic
→ **Research**

**Problem:** Building a game
→ **Game Dev**

**Problem:** Technical documentation needed
→ **Content**

**Problem:** Creative brainstorming
→ **cis** (Brainstorming + Design Thinking)

**Problem:** Security assessment required
→ **Security GRC**

**Problem:** Full product development
→ **Agile** (complete pipeline)

**Problem:** Need to understand architecture principles
→ **Architecture Rules**

**Problem:** Personal task organization
→ **Life Management**

---

## Summary

The 10 domain clusters represent a significant architectural upgrade to Sam's skill system:

✅ **Organized by intent** — Each cluster solves a specific class of problems
✅ **Well-resourced** — Access to 17+ specialized agents
✅ **Comprehensive** — 54 original modules consolidated with no loss of capability
✅ **Composable** — Clusters can work together (e.g., Party Mode + CIS for innovation)
✅ **Production-ready** — All skills validated and documented

---

**For complete documentation on each skill, see [Skills-Catalog.md](Skills-Catalog.md)**

**For general Skills System info, see [Skills-System.md](Skills-System.md)**
