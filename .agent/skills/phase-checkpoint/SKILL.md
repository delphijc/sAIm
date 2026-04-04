---
name: phase-checkpoint
description: Verifies all changes since the last checkpoint, ensures test coverage, validates file existence against acceptance criteria, and generates a manual verification plan. USE WHEN phase is complete and needs verification before checkpoint.
---

# Skill: Phase Checkpoint Verifier

## Description
Verifies that a phase is complete by validating:
1. All required files (from acceptance criteria) exist
2. All code changes have corresponding test files
3. Tests pass and coverage is ≥80%

## How to Use Phase Checkpoints

**In your plan-template.md:**
```markdown
## Phase 1: [Name] [checkpoint: ]

### Acceptance Criteria
**These files MUST exist after this phase completes:**
- [ ] `src/path/to/file.ts` - Description
- [ ] `src/path/to/__tests__/file.test.ts` - Test coverage
```

**When phase work is complete:**
```bash
/phase-checkpoint
```

## Validation Steps

The checkpoint verifier runs these checks in order:

1. **Acceptance Criteria Validation** ⭐ NEW
   - Extracts expected files from plan.md `### Acceptance Criteria` sections
   - Verifies EVERY file in acceptance criteria actually exists
   - Fails immediately if any required file is missing
   - This prevents false positives when no code was actually created

2. **File Existence Check**
   - Scope: Changes since last checkpoint (`[checkpoint: <sha>]`)
   - Verifies test file naming: `.test.ts`, `_test.go`, `.bats`
   - Fails if code file lacks corresponding test file

3. **Manual Verification Steps**
   - Suggests testing procedures
   - Requests user confirmation before creating checkpoint commit

## Testing Gates
**Phase completion is blocked if:**
- ❌ Any file listed in Acceptance Criteria doesn't exist
- ❌ Any code file lacks a corresponding test file
- ❌ Test naming doesn't follow conventions
- ❌ Coverage is below 80%
- ❌ Any tests are failing

## Output Format
The checkpoint provides:
- ✅ Pass/fail status for each acceptance criteria file
- 📝 List of changed files and their test coverage
- ✨ Manual verification checklist
- 🎯 Clear error messages explaining what's missing
