---
name: quick-flow
description: "Fast-track development for bugs, small features, and prototypes with rapid spec-dev-review cycle. USE WHEN delivering small changes quickly without full Agile ceremony — bug fixes, hotfixes, or rapid prototypes."
triggers:
  - "quick flow"
  - "fast development"
  - "quick dev"
  - "rapid prototype"
  - "quick feature"
---

# Quick Flow

## Purpose

A fast-track development workflow for bugs, small features, or prototypes where the full Agile pipeline overhead is unnecessary. Executes the complete development lifecycle (Spec → Dev → Review) rapidly without multiple handoffs.

**Agent:** quick-flow-solo-dev (Barry)

## Workflow: Quick Flow

A three-step fast-track development process.

### Steps

1. **Create Tech Spec** (`*create-tech-spec`)
   - Barry analyzes the request and creates a lightweight technical specification
   - Provides implementation-ready guidance

2. **Quick Dev** (`*quick-dev`)
   - Barry implements the specification end-to-end
   - Follows the tech spec for completeness and quality

3. **Code Review** (`*code-review`)
   - Barry performs self-review or requests external review
   - Ensures code quality and standards compliance

## Capabilities

- **`*create-tech-spec`:** Architect technical spec with implementation-ready stories
- **`*quick-dev`:** Implement tech spec end-to-end solo
- **`*code-review`:** Review and improve code

## Output Deliverables

| Deliverable | Description |
|---|---|
| **Tech Spec** | Lightweight technical plan |
| **Implemented Code** | Production-ready code changes |

## Integration Points

- **Input:** Feature request or bug report
- **Output:** Completed and reviewed code
- **Collaborates With:** Architect (optional for complex queries)
- **Best For:** Small scope, time-sensitive items

## Trigger

- Command: `*quick-flow`
- Context: Small scope items requiring rapid delivery
