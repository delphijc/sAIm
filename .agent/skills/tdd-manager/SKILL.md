---
name: tdd-manager
description: "Enforces the Red-Green-Refactor cycle for every task and updates the Plan accordingly. USE WHEN starting a new implementation task that requires test-driven development, or when verifying TDD compliance during code review."
---

# Skill: TDD Lifecycle Manager

## Description
Enforces the Red-Green-Refactor cycle for every task and updates the project plan (`projects/${PROJECT_ID}/docs/plan.md`) accordingly.

## Actions
1. **Start Task**: Change task status from `[ ]` to `[~]` in `projects/${PROJECT_ID}/docs/plan.md`.
2. **Red Phase**: Write a test file and verify failure using `CI=true bun test` (or appropriate runner).
3. **Green Phase**: Implement code until tests pass.
4. **Coverage Check**: Run `bun test --coverage` and verify >80% coverage.
5. **Complete Task**: Update status to `[x]` and append the short commit SHA.

## Guardrails

**Testing is a hard gate:**
- Coverage <80% blocks task completion
- Pre-commit hook enforces: tests passing + coverage check before any commit
- Phase checkpoint verifies 1:1 mapping between code files and test files
- No shortcuts—tasks cannot be marked `[x]` without verified coverage

## Error Handling
- If coverage is <80%, the agent must refactor or add tests before proceeding.
- If tests fail, remain in RED/GREEN phase and fix tests before refactoring.
