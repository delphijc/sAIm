---
name: game-dev
description: "Complete game development pipeline (BMGD) covering preproduction, design, technical architecture, and production. USE WHEN designing games, building game mechanics, planning game architecture, or managing game development projects."
triggers:
  - "game development"
  - "bmgd workflow"
  - "create a game"
  - "game design"
  - "game pipeline"
---

# Game Dev

## Purpose

The complete game development pipeline (BMGD) orchestrates the entire journey from concept to shipping game. Covers preproduction brainstorming, comprehensive design documentation, technical architecture, and production implementation with testing and polish.

## BMGD Pipeline: 4 Phases

### Phase 1: Preproduction (Conceptualization & Prototyping)

**Agents:** Analyst, Product Manager (or Game Designer)

**Steps:**
1. **Brainstorm Game:** Use game-specific ideation techniques
2. **Game Brief:** Define core loop, genre, platform, and target audience
3. **Market Analysis:** Compare with existing games and identify differentiation

**Outputs:**
- Game Brief (1-2 page overview)
- Concept Art Description
- Prototype Plan

**Trigger:** New game project initiation

---

### Phase 2: Game Design (Comprehensive Design Documentation)

**Agents:** Game Designer, Technical Writer (Narrative Design)

**Steps:**
1. **GDD Creation:** Write comprehensive Game Design Document
2. **Mechanics Design:** Define rules, systems, and player interactivity
3. **Level Design:** Plan world layout, progression, and player flow
4. **Narrative Design:** Write story, dialogue, character development, and lore

**Outputs:**
- Game Design Document (GDD)
- Level Plans and Flow Diagrams
- Narrative Script and Dialogue Trees

**Trigger:** Completion of Preproduction phase

---

### Phase 3: Technical Architecture (System Design)

**Agents:** Architect, Developer (Tech Lead)

**Steps:**
1. **Engine Selection:** Choose appropriate game engine (Unity, Unreal, Godot, Custom)
2. **System Architecture:** Define design patterns (ECS, OOP, etc.) and subsystems
3. **Pipeline Design:** Asset import workflow, build process, deployment pipeline
4. **Tech Spec:** Detailed technical requirements and performance targets

**Outputs:**
- Technical Design Document (TDD)
- Architecture Diagrams
- Build and Pipeline Documentation

**Trigger:** Completion of Game Design Document (GDD)

---

### Phase 4: Production (Implementation & Polish)

**Agents:** Product Manager, Developer, Test Architect (TEA)

**Steps:**
1. **Sprint Planning:** Break GDD into Epics and Stories for iterative development
2. **Development:** Implement features, assets, and gameplay systems
3. **Testing:** Playtesting, automated QA, and integration testing
4. **Polish:** UX improvements, bug fixes, performance optimization

**Outputs:**
- Playable Builds (Alpha, Beta, Release)
- Test Reports and Quality Metrics
- Release-Ready Game

**Trigger:** Completion of Technical Design Document

---

## Workflow Integration

Each phase builds on the previous:
- Preproduction → Game Design
- Game Design → Technical Architecture
- Technical Architecture → Production

## Workflow Commands

- `*bmgd-preproduction` — Begin game concept development
- `*bmgd-game-design` — Create comprehensive design documentation
- `*bmgd-technical` — Design technical architecture and systems
- `*bmgd-production` — Implement, test, and polish game

## Integration Points

- **Input:** Game concept, design requirements, technical constraints
- **Output:** Playable, shipped game with documentation
- **Context:** Game briefs, design documents, technical specifications
- **Tools:** Game engines, design tools, version control, testing frameworks
- **Parallel Execution:** Phases can overlap strategically

## Key Deliverables

| Phase | Key Documents |
|---|---|
| Preproduction | Game Brief, Concept Art, Market Analysis |
| Design | GDD, Level Plans, Narrative Script |
| Technical | TDD, Architecture Diagrams |
| Production | Playable Builds, Test Reports, Shipped Game |

## Duration Estimates

- **Preproduction:** 2-4 weeks
- **Design:** 3-6 weeks
- **Technical:** 1-3 weeks
- **Production:** 4-12 weeks (depending on game scope)
