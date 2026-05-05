# Agent-Skill Ecosystem Map

This document provides a comprehensive reference for how 27 agents leverage 35+ skills across the 5-phase Agile delivery pipeline.

## System Architecture

```
Agile Pipeline: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
Agents:         Ideation  Requirements  Architecture  Implementation  Testing
                (4 agents) (1 agent)     (2 agents)    (3 agents)     (2 agents)
                + Cross-cutting roles (12 agents): research, security, design, documentation
```

---

## Phase-Based Agent-Skill Mappings

### Phase 1: Ideation (Divergent Thinking)

Generate options, explore possibilities, identify opportunities.

| Agent | Skills | Purpose |
|-------|--------|---------|
| **analyst** | cis, research, prompting, party-mode | Structure rough ideas into project briefs |
| **brainstorming-coach** | cis, party-mode, prompting | Generate divergent ideas, explore options |
| **innovation-oracle** | research, party-mode, prompting, cis | Identify strategic opportunities & whitespace |
| **design-thinking-coach** | cis, research, prompting | Validate problem definitions with users |

**Phase 1 Skills in Use:**
- `cis` — Creative Intelligence Suite for ideation frameworks
- `research` — Gather insights and data for ideation
- `party-mode` — Multi-perspective exploration of options
- `prompting` — Effective ideation facilitation

---

### Phase 2: Requirements (Convergent Planning)

Define requirements, scope products, plan delivery.

| Agent | Skills | Purpose |
|-------|--------|---------|
| **product-manager** | agile, research, cis, architecture | Transform briefs into PRDs and epics |

**Phase 2 Skills in Use:**
- `agile` — Sprint planning, story estimation
- `research` — Market analysis, competitive assessment
- `cis` — Refinement workshops with stakeholders
- `architecture` — Decompose requirements into stories

---

### Phase 3: Architecture (Technical Strategy)

Design systems, select tech stacks, define specifications.

| Agent | Skills | Purpose |
|-------|--------|---------|
| **architect** | architecture, architecture-rules, prompting, party-mode | Design scalable, secure systems |
| **security-architect** | architecture-rules, security-grc, prompting, party-mode | Design secure systems & threat modeling |

**Phase 3 Skills in Use:**
- `architecture` — System design, component boundaries, data flow
- `architecture-rules` — Apply design constraints and principles
- `security-grc` — Security controls and compliance architecture
- `party-mode` — Multi-perspective design validation
- `prompting` — Communicate architecture decisions

---

### Phase 4: Implementation (Code Delivery)

Write code, build systems, integrate with CI/CD.

| Agent | Skills | Purpose |
|-------|--------|---------|
| **developer** | fabric, tdd-manager, audit-committer, prompting, quick-flow | Implement features from stories |
| **engineer** | fabric, tdd-manager, prompting, security-grc | Complex debugging, performance, security hardening |
| **quick-flow-solo-dev** | quick-flow, tdd-manager, fabric | Rapid bug fixes and prototypes (sub-1-hour) |

**Phase 4 Skills in Use:**
- `fabric` — Apply 245+ AI patterns for code (extract_wisdom, review_code, etc.)
- `tdd-manager` — Red-Green-Refactor cycle enforcement
- `audit-committer` — Commit auditing with git notes
- `quick-flow` — Fast-track development without full ceremony
- `security-grc` — Security hardening patterns (engineer only)
- `prompting` — Effective code generation and review

---

### Phase 5: Testing (Quality Assurance)

Write tests, validate features, sign off quality gates.

| Agent | Skills | Purpose |
|-------|--------|---------|
| **test-architect** | playwright-testing, tdd-manager, phase-checkpoint | Define test strategies, write test cases |
| **security-test-analyst** | security-grc, tdd-manager, phase-checkpoint, prompting | Validate security controls, compliance testing |

**Phase 5 Skills in Use:**
- `playwright-testing` — E2E testing, browser automation
- `tdd-manager` — Unit test verification, TDD compliance
- `phase-checkpoint` — Quality gate validation before checkpoint
- `security-grc` — Compliance audit, OWASP verification
- `prompting` — Test case documentation

---

## Cross-Cutting Roles (Research, Security, Design, Documentation)

These agents operate across phases, supporting specific domains.

### Research & Analysis Cluster

| Agent | Skills | Use Case |
|-------|--------|----------|
| **researcher** | research, fabric, prompting, party-mode | Deep multi-source synthesis, expert analysis |
| **claude-researcher** | research, fabric, prompting | Fast factual lookups, cost-efficient web search |
| **perplexity-researcher** | research, fabric, prompting | Real-time web indexing, current events |
| **gemini-researcher** | research, fabric, prompting | Non-Claude perspectives, multi-angle synthesis |
| **problem-solver** | research, cis, prompting | Root-cause analysis, systems thinking |

**Skill Pattern:** All researchers have core (research, fabric, prompting) with specialized depth.

### Security Cluster

| Agent | Skills | Use Case |
|-------|--------|----------|
| **chief-security-officer** | security-grc, prompting, retrospective | GRC strategy, risk acceptance, governance |
| **security-architect** | architecture-rules, security-grc, prompting, party-mode | Secure system design, zero-trust, threat modeling |
| **security-test-analyst** | security-grc, tdd-manager, phase-checkpoint, prompting | Control validation, compliance auditing |
| **pentester** | ffuf, prompting, security-grc | Offensive security testing, vulnerability discovery |

**Skill Pattern:** security-grc (domain) + phase-specific (tdd-manager, prompting) + specialized (ffuf for pentester).

### Design & Content Cluster

| Agent | Skills | Use Case |
|-------|--------|----------|
| **designer** | art, content, prompting | High-fidelity visual design, design systems |
| **ux-designer** | content, prompting, art | User flows, wireframes, interaction patterns |
| **technical-writer** | content, fabric, story-explanation, prompting | Architecture documentation, guides |
| **master-storyteller** | story-explanation, content, prompting | Strategic narratives, compelling messaging |

**Skill Pattern:** Blend of content (writing), art (visual), and story-explanation (narrative).

### Special Roles

| Agent | Skills | Use Case |
|-------|--------|----------|
| **scrum-master** | agile, retrospective, phase-checkpoint | Sprint ceremonies, blocker removal |
| **investor** | research, prompting | Financial analysis, market research |
| **personal-health-coach** | life-management, prompting | Wellness planning, nutrition advice |
| **sam** (Orchestrator) | party-mode, research, prompting, architecture, agile, phase-checkpoint, retrospective, story-explanation | Cross-phase coordination, team orchestration |

---

## Skill Utilization Patterns

### Universal Skills (All Technical Agents)

- **`prompting`** — Applied by all agents doing code, planning, or communication work. Ensures effective interaction with LLMs and structured output.

### Phase-Specific Patterns

| Phase | Core Skill Cluster | Optional Depth |
|-------|-------------------|-----------------|
| **Phase 1** | cis, research, party-mode | (varies by agent) |
| **Phase 2** | agile, research, architecture | (varies by PM) |
| **Phase 3** | architecture, architecture-rules | security-grc (architect only) |
| **Phase 4** | fabric, tdd-manager, audit-committer | quick-flow (for fast fixes) |
| **Phase 5** | playwright-testing, tdd-manager, phase-checkpoint | security-grc (compliance) |

### Cross-Cutting Patterns

- **`research`** — Phase 1 (ideation), Phase 2 (requirements), Problem-solving, Specialists
- **`prompting`** — All phases (fundamental for LLM communication)
- **`party-mode`** — Complex decisions requiring multiple perspectives (Phase 1, 3, orchestration)
- **`security-grc`** — Phase 3 (architecture), Phase 4 (engineer), Phase 5 (test analyst), Leadership

---

## Skill Boundary Clarity (NOT WHEN)

Each skill has explicit NOT WHEN boundaries to prevent delegation confusion:

- **`research` vs individual researchers** → NOT WHEN delegating to specific researcher agent
- **`create-cli` vs `create-skill` vs `create-agent`** → NOT WHEN task requires different artifact type
- **`fabric` vs `content` vs `story-explanation`** → NOT WHEN output type differs
- **`architecture` vs `architect` agent** → NOT WHEN designing new systems (use agent)
- **`playwright-testing` vs `tdd-manager`** → NOT WHEN writing unit tests (use tdd-manager)

See individual skill definitions for complete NOT WHEN boundaries.

---

## Recommended Agent Selection by Task Type

| Task Type | Recommended Agent | Why |
|-----------|-------------------|-----|
| "Generate ideas for feature X" | brainstorming-coach | Divergent thinking, option exploration |
| "Convert brief to PRD" | product-manager | Requirements synthesis, epic breakdown |
| "Design system for scalability" | architect | Phase 3 architecture specialist |
| "Implement user story" | developer | Phase 4 feature implementation |
| "Debug performance issue" | engineer | Complex debugging, optimization |
| "Write E2E tests" | test-architect | Phase 5 testing strategy |
| "Validate compliance" | security-test-analyst | Control effectiveness validation |
| "Research market trends" | innovator-oracle or researcher | Phase 1/strategic perspective or deep synthesis |
| "Coordinate team decision" | sam (via party-mode) | Multi-agent orchestration |
| "Refactor codebase" | engineer | Complex refactoring with performance impact |

---

## Phase Transitions & Quality Gates

- **Phase 1 → 2:** analyst→product-manager; quality gate: Project Brief approved
- **Phase 2 → 3:** product-manager→architect; quality gate: PRD and stories defined
- **Phase 3 → 4:** architect→developer; quality gate: TAD reviewed and signed off
- **Phase 4 → 5:** developer→test-architect; quality gate: Code reviewed, unit tests passing
- **Phase 5 Complete:** test-architect via `phase-checkpoint`; quality gate: >80% coverage, all tests passing

---

## Future Extensions

When adding new agents or skills:
1. Assign Phase 1-5 marker if phase-specific
2. Define NOT WHEN boundaries for similar skills/agents
3. List contextual skills in agent `.skills:` frontmatter
4. Update this ecosystem map
5. Consider cross-cutting skill patterns (prompting, research, etc.)
