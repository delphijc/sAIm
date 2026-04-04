---
name: agile
description: "Agile development pipeline knowledge - phases, ceremonies, metrics, and best practices for iterative delivery. USE WHEN planning sprints, running ceremonies, estimating stories, or applying Agile/Scrum methodology to a project."
triggers:
  - "agile methodology"
  - "sprint planning"
  - "agile ceremonies"
  - "user stories"
  - "agile metrics"
---

# Agile

## Purpose

Agile is a framework for iterative product development emphasizing collaboration, feedback, and continuous improvement. This skill provides the knowledge and practices for executing Agile methodology effectively.

## Agile Pipeline Phases

The complete Agile lifecycle consists of five phases, each with specific outputs and agent orchestration:

### Phase 1: Ideation
**Agent:** analyst
**Input:** Raw ideas, business context
**Output:** Project Brief (vision, problem statement, success criteria)
**Key Activities:**
- Brainstorm using Six Thinking Hats
- Elicit requirements via Five W's questioning
- Test assumptions and validate feasibility
- Define target users and problem domain

### Phase 2: Requirements & Planning
**Agent:** product-manager
**Input:** Project Brief
**Output:** Product Requirements Document (PRD) with Epics and User Stories
**Key Activities:**
- Scale-adaptive planning (select complexity level)
- Scope control and MVP definition
- Break requirements into Epics
- Create detailed User Stories with acceptance criteria
- Prioritize features

### Phase 3: Architecture
**Agent:** architect
**Input:** PRD and User Stories
**Output:** Technical Architecture Document (TAD)
**Key Activities:**
- Design system architecture and components
- Select technology stack
- Plan infrastructure and deployment
- Create architecture diagrams
- Define security and scalability approach

### Phase 4A: Development
**Agent:** developer
**Input:** User Stories and Technical Specification
**Output:** Implemented code with tests
**Key Activities:**
- Implement features from user stories
- Write unit tests (target: >80% coverage)
- Maintain code quality and standards
- Document code and APIs
- Integrate with CI/CD pipeline

### Phase 4B: Quality Assurance
**Agent:** test-architect
**Input:** Completed code and acceptance criteria
**Output:** Test results and quality validation
**Key Activities:**
- Create comprehensive test cases
- Execute manual and automated testing
- Report defects with clear reproduction steps
- Track quality metrics (coverage, defect density)
- Validate quality gates before release

### Phase 5: Process Facilitation
**Agent:** scrum-master
**Responsibility:** Coordinate all phases, facilitate ceremonies, remove blockers
**Key Activities:**
- Plan and execute sprints
- Facilitate daily standups
- Conduct sprint reviews and retrospectives
- Track metrics and team health
- Manage impediments and escalations

---

## Sub-Skills

### Story Development Skill

**Core Capabilities:**
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
  └─ Story 2: ...
```

**Output Deliverables:**
- Product Requirements Document
- Epic breakdown
- User stories with acceptance criteria
- Story point estimates
- Dependency graphs

---

### Core Tasks Skill

**Core Capabilities:**
- Task breakdown and decomposition
- Sprint task creation
- Task assignment and tracking
- Task status management
- Burndown tracking

**Task Management:**
- Create tasks from user stories
- Assign to developers
- Track progress in sprints
- Manage dependencies
- Report on completion

---

## Workflows

### Scale-Adaptive Planning Workflow

Selects appropriate planning depth based on project complexity.

**Planning Tracks:**

| Track | For | Documentation | Timeline |
|---|---|---|---|
| **Quick Flow** | Simple, well-understood projects | Minimal | Days to 1-2 weeks |
| **Agile method** | Standard moderate complexity | Full (PRD, Architecture) | Weeks to months |
| **Enterprise** | Large, complex, multi-team | Comprehensive + governance | Months to years |

**Workflow Steps:**

1. **Project Assessment (5-7 min):**
   - Scope complexity (features, integrations, challenges)
   - Stakeholder complexity (count, structure, approvals)
   - Timeline constraints (urgency, deadlines, iteration)
   - Team characteristics (size, experience, patterns)
   - Risk profile (technical, business, regulatory)

2. **Track Selection (2-3 min):**
   - Decision matrix analysis
   - Complexity assessment
   - Select Quick Flow, Agile, or Enterprise

3. **Documentation Planning (3-5 min):**
   - Identify required artifacts
   - Define document scope
   - Plan creation activities

**Decision Matrix:**

| Dimension | Quick Flow | Agile | Enterprise |
|---|---|---|---|
| Features | 1-3 | 4-15 | 16+ |
| Stakeholders | 1-2 | 3-7 | 8+ |
| Timeline | <2 weeks | 2-12 weeks | 12+ weeks |
| Team Size | 1-2 | 2-5 | 6+ |
| Risk | Low | Medium | High |

---

### Advanced Elicitation Workflow

Uses critical questioning techniques to refine requirements and stress-test assumptions.

**Techniques:**
- **Hindsight is 20/20:** "What could go wrong?"
- **Critical Assumption Testing:** Validate key assumptions
- **Five Whys:** Root cause analysis
- **Constraint Analysis:** What are the real limits?
- **Stakeholder Perspectives:** Different viewpoints

**Output:** Refined requirements, validated assumptions, risk identification

---

## Full Agile Pipeline

```
Raw Idea
  ↓
[Analyst] → Six Thinking Hats, Five W's
  ↓ (Project Brief)
[Product Manager] → Scale-Adaptive Planning
  ↓ (PRD, User Stories, Epics)
[Architect] → Architecture Design
  ↓ (Technical Architecture Document)
[Developer] → Sprint Development
  ↓ (Code, Features)
[Test Architect] → QA Testing
  ↓ (Quality Reports, Sign-off)
[Scrum Master] → Sprint Ceremonies
  ↓ (Velocity, Metrics)
Shipped Feature
```

---

## Embedded Rules

### Modular Architecture Rule

**Statement:** Organize capabilities into discrete, reusable modules following UNIX philosophy.

**Application to Agile:**
- Each user story is a discrete module
- Epic = container of related modules
- Dependencies explicitly mapped
- Module boundaries enforced
- Clear integration contracts

---

### Mandatory Context Loading Rule

**Statement:** Enforce four-layer mandatory context loading protocol.

**Application to Agile:**
- Context layers: Documentation → Hooks → Instructions → Symlinks
- Agents load required context before acting
- Observable tool usage for context verification
- Targeted context hydration ("exact right amount at exact right time")

---

## Integration Points

### Input Flow
- **Analyst Input:** User aspirations, rough ideas, business context
- **PM Input:** Project Brief, business requirements, constraints
- **Architect Input:** PRD, non-functional requirements, deployment constraints
- **Developer Input:** User stories, technical specs, acceptance criteria
- **TEA Input:** Feature requirements, acceptance criteria, quality standards

### Output Flow
- **Analyst Output:** Project Brief
- **PM Output:** PRD, User Stories, Epics, Acceptance Criteria
- **Architect Output:** Technical Architecture Document, Design Specifications
- **Developer Output:** Implementation Code, Pull Requests, Documentation
- **TEA Output:** Test Plans, Quality Reports, Defect Tracking
- **Scrum Master Output:** Sprint Plans, Velocity Metrics, Health Reports

### Cross-Agent Communication
- **PM ↔ Developer:** User stories, acceptance criteria, clarifications
- **Architect ↔ Developer:** Design specs, technical decisions, constraints
- **Developer ↔ TEA:** Code completion, test readiness, defect resolution
- **Scrum Master ↔ All:** Coordination, impediment removal, metrics

---

## Agile Ceremonies

### Sprint Planning
- Duration: 2-4 hours (per 2-week sprint)
- Participants: PM, Developers, Scrum Master, Architect (as needed)
- Output: Sprint goal, committed user stories, task breakdown

### Daily Standup
- Duration: 15 minutes
- Participants: Dev team, Scrum Master
- Format: What did I do? What will I do? Blockers?

### Sprint Review
- Duration: 1-2 hours
- Participants: Development team, stakeholders, PM
- Output: Demo of completed work, feedback

### Sprint Retrospective
- Duration: 1-1.5 hours
- Participants: Development team, Scrum Master
- Focus: Process improvement, team dynamics

### Backlog Grooming
- Duration: 1-2 hours (mid-sprint)
- Participants: PM, Developers, Architect
- Activity: Story refinement, acceptance criteria clarification

---

## Key Metrics

### Development Metrics
- **Velocity:** Stories completed per sprint
- **Burndown:** Work remaining in sprint
- **Lead Time:** From story creation to completion
- **Cycle Time:** From work start to completion

### Quality Metrics
- **Code Coverage:** Percentage of code tested
- **Defect Density:** Bugs per 1000 lines of code
- **Defect Escape Rate:** Bugs found in production
- **Test Coverage:** Percentage of requirements tested

### Team Metrics
- **Team Velocity Trend:** Stability and improvement
- **Cycle Time Trend:** Speed improvements
- **Blocker Resolution Time:** Agility in problem-solving
- **Team Satisfaction:** Retrospective feedback

---

## Success Criteria

- ✅ All user stories have clear acceptance criteria
- ✅ Acceptance criteria are testable and measurable
- ✅ Dependencies between stories are identified
- ✅ Stories can be completed within a single sprint
- ✅ Team velocity is stable
- ✅ Quality metrics are met
- ✅ All ceremonies executed on schedule
- ✅ Stakeholder satisfaction is high

---

## Tools & Platforms

- **Jira:** Sprint management and story tracking
- **Confluence:** Documentation and wikis
- **GitHub/GitLab:** Code repositories and CI/CD
- **Slack:** Team communication
- **Figma:** Design and prototyping
- **Azure DevOps:** Enterprise agile management
- **Monday.com:** Project management

---

This skill provides the complete orchestration for delivering software products through structured Agile methodology while maintaining quality, stakeholder alignment, and team productivity.
