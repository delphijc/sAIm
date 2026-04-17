---
trigger: always_on
---

# Rule: Plan Compliance & Audit Trail

## Context
This rule is **Always On** for all files in this workspace.

## Instruction: The Plan is the Source of Truth
1. **Create plan** If the `projects/default_project/docs/plan.md` (or `${projectDir}/docs/plan.md`) is missing Execute `architect` skill. DO NOT PROCEED until the plan.md if available.
2. **No Rogue Coding**: Do not modify any code files unless the change is directly linked to an active task in the plan.md.
3. **State Check**: Before starting work, verify the task is marked as `[~]` (In Progress) in the plan.md.
4. **Task ID Linking**: Every commit message must include the Task ID or Epic/Story reference from the plan.md and the git hash must be updated for the Task ID in the plan.md.

## Instruction: The Definition of Done
A task is not "Done" until:
- **TDD Requirement**: Failing tests were written first, and all tests now pass.
- **Coverage Gate**: `bun test --coverage` confirms **>80%** total coverage.
- **Audit Requirement**: The `audit-committer` skill has been used to attach a git note to the commit.
- **State Sync**: The `state.md` blackboard has been updated via `scripts/state_syncer.sh`.

## Constraints
- **Never use `--no-verify`** when committing.
- **Never bypass the Stack Broker**: Use only shell scripts for data persistence in `.jsonl` files.
