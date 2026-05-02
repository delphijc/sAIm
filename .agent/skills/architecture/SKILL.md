---
name: architecture
description: Analyzes wizard outputs (prd.md, product-brief.md, architecture.md, tech-spec.md, BDD.md) to generate epics, stories, and a master plan with retrospective triggers.
---

# Skill: Workflow Architect

## Description
Consumes the standalone wizard's output documents to generate a complete hierarchical planning structure: Epics derived from product requirements, Stories informed by technical architecture, and a master Plan that tracks implementation and triggers retrospectives.

## Context
Use this after the standalone wizard has produced its planning artifacts, or when a new major feature requires epic/story decomposition.

## Input Documents (Required)

The architect reads from `${PROJECT_DIR}/docs/`:

| Document | Purpose | Drives |
|----------|---------|--------|
| `prd.md` | Product requirements, features, user needs | Epic identification |
| `product-brief.md` | Business goals, target users, success criteria | Epic prioritization |
| `architecture.md` | System design, component boundaries, data flow | Story technical scope |
| `tech-spec.md` | Implementation details, API contracts, stack choices | Story acceptance criteria |
| `BDD.md` | Behavior-driven scenarios (Given/When/Then) | Story test requirements |

**Optional:** `product-guidelines.md`, `product.md` (legacy format — falls back if prd.md missing)

## Output Structure

```
${PROJECT_DIR}/docs/
├── stories/
│   ├── epic1.md                    # Epic 1 overview + goal
│   ├── epic1-story1.md             # Story 1.1 with AC + tests
│   ├── epic1-story2.md             # Story 1.2 with AC + tests
│   ├── epic2.md                    # Epic 2 overview + goal
│   ├── epic2-story1.md             # Story 2.1 with AC + tests
│   └── ...
└── plan.md                         # Master plan tracking all stories
```

## Actions

### Phase 1: Analyze & Decompose

1. **Read Input Documents**: Load prd.md and product-brief.md to identify major feature areas
2. **Identify Epics**: Each major feature area or user capability becomes an Epic
3. **Prioritize Epics**: Use product-brief.md business goals to order epics by value delivery

### Phase 2: Generate Epics

For each epic, create `stories/epicN.md` with:

```markdown
---
epic: N
title: "Epic Title"
status: "[ ] Not Started"  # [ ] | [~] In Progress | [x] Complete
priority: high | medium | low
source_requirements: ["PRD-FR-1", "PRD-FR-3"]  # Traceability to prd.md
---

# Epic N: {{title}}

## Goal
{{What this epic achieves for the user, derived from prd.md}}

## Business Context
{{Why this matters, from product-brief.md success criteria}}

## Stories
- [ ] Story N.1: {{title}} → `epicN-story1.md`
- [ ] Story N.2: {{title}} → `epicN-story2.md`
...

## Retrospective Trigger
When all stories in this epic reach [x], trigger `/retrospective` to analyze:
- What worked well during this epic
- What blocked progress
- Improvements for the next epic
```

### Phase 3: Generate Stories

For each story, create `stories/epicN-storyM.md` with:

```markdown
---
epic: N
story: M
title: "Story Title"
status: "[ ] Not Started"
estimation: S | M | L | XL
source_requirements: ["PRD-FR-1.a"]
architecture_refs: ["architecture.md#component-name"]
---

# Story N.M: {{title}}

## User Story
As a {{user_type from prd.md}},
I want {{capability from prd.md}},
So that {{value from product-brief.md}}.

## Technical Context
{{Implementation notes derived from architecture.md and tech-spec.md:
  - Which components are affected
  - API contracts involved
  - Data model changes needed
  - Integration points}}

## Acceptance Criteria
{{Derived from BDD.md scenarios where available, otherwise generated:}}

**AC-1:** Given {{precondition}} When {{action}} Then {{expected outcome}}
**AC-2:** Given {{precondition}} When {{action}} Then {{expected outcome}}

## Test Requirements
- **Unit Tests**: {{specific functions/methods to test, from tech-spec.md}}
- **Integration Tests**: {{API endpoints or component interactions to validate}}
- **BDD Scenarios**: {{link to specific BDD.md scenarios if available}}
- **Coverage Target**: ≥80%

## Dependencies
- Requires: {{other stories that must complete first}}
- Blocks: {{stories waiting on this one}}
```

### Phase 4: Generate Master Plan

Create `docs/plan.md`:

```markdown
---
project: "{{project_name}}"
generated: "{{date}}"
total_epics: N
total_stories: M
---

# Project Plan
> The Plan is the Source of Truth.

## Progress Overview

| Epic | Stories | Complete | Status |
|------|---------|----------|--------|
| Epic 1: {{title}} | N | 0 | [ ] Not Started |
| Epic 2: {{title}} | N | 0 | [ ] Not Started |
...

## Epic 1: {{title}}

- [ ] **Story 1.1**: {{title}} (S) → `stories/epic1-story1.md`
  - Git Hash: —
  - Task ID: E1-S1
- [ ] **Story 1.2**: {{title}} (M) → `stories/epic1-story2.md`
  - Git Hash: —
  - Task ID: E1-S2

### 🔄 Epic 1 Retrospective
> Triggered when all Story 1.x items are [x] complete.
> Run `/retrospective` to analyze epic delivery.
> Document findings in `stories/epic1-retro.md`.

## Epic 2: {{title}}
...

## Retrospective Schedule

| Milestone | Trigger | Status |
|-----------|---------|--------|
| Epic 1 Complete | All E1 stories [x] | ⏳ Pending |
| Epic 2 Complete | All E2 stories [x] | ⏳ Pending |
| Project Complete | All epics [x] | ⏳ Pending |
```

## Plan Update Protocol

When a story is completed:
1. Update story file status to `[x]`
2. Update epic file story checklist
3. Update plan.md: mark story `[x]`, add git hash, update epic progress count
4. **Check epic completion**: If all stories in an epic are `[x]`, trigger retrospective

## Testing Consideration

Every story MUST include:
- **Testable Acceptance Criteria** — Clear Given/When/Then conditions
- **Test Requirements** — Specific unit/integration tests for ≥80% coverage
- **BDD Traceability** — Link to BDD.md scenarios where they exist

Stories without testable criteria will fail phase checkpoint validation.

## Constraints
- "The Plan is the Source of Truth."
- Every decision must prioritize user experience
- Every story must be accompanied by a clear testing strategy
- Epics must trace back to prd.md requirements (no orphan epics)
- Stories must reference architecture.md components (no ungrounded stories)
- Retrospectives are mandatory at epic boundaries, not optional
