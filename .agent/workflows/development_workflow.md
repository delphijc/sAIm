---
description: Defines how the Agent should work within this project when making changes or adding new files.
---

# Workflow: Bash Kanban Flow

## ⚡ CRITICAL: Plan-First Prerequisite

**Before ANY task work begins, the plan.md must exist with tasks defined.**

### Initial Setup (One-Time or Per-Epic)
1. **Check if `projects/default_project/docs/plan.md` exists**
   - If missing: Run `architect` skill to generate from product.md
   - If exists: Review and update with new tasks
2. **Add tasks for the work** with `[ ]` (TODO) status
   - Each task should have clear acceptance criteria
   - Group related changes into logical tasks
   - Link to affected files and components
3. **Stage files** that are ready for work
4. **THEN begin the workflow** (state transitions below)

**Violation**: Do NOT modify code files without a corresponding task in plan.md. This ensures traceability and audit compliance.

---

## States
- **TODO**: Initial state.
- **IN_PROGRESS**: Agent has marked `[~]` in `plan.md`.
- **TESTING**: Code implemented; awaiting `bun test --coverage`.
- **VERIFYING**: Automated tests passed; awaiting manual approval.
- **COMPLETED**: Task marked `[x]`; git note attached.

## Transitions & Triggers
1. **TODO -> IN_PROGRESS**: 
   - **Trigger**: `@agent start <task_id>`
   - **Action**: Execute `tdd-manager` skill `start task`.
2. **IN_PROGRESS -> TESTING**:
   - **Condition**: Failing test (Red Phase) documented in logs.
   - **Action**: Execute `tdd-manager` skill.
3. **TESTING -> VERIFYING**:
   - **Condition**: Coverage >= 80% AND all tests pass.
   - **Action**: Execute `phase-checkpoint` skill
   - **Action**: Invoke `checkpoint_verifier.sh`.
4. **VERIFYING -> COMPLETED**:
   - **Condition**: User approval "yes" AND `audit-committer` skill success.
