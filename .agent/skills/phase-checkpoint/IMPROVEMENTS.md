# Phase Checkpoint Improvements - False Positive Prevention

## Problem Statement

The previous phase checkpoint implementation had a critical gap:
- ✗ It validated *changed* files had tests
- ✗ It checked test coverage percentages
- ✓ **BUT** it didn't verify that expected files actually *exist*

This created false positives where phases could be marked "complete" even when no code was created (as seen in the "Create Users: schema" example).

## Solution: File Existence Validation

### What Changed

#### 1. Enhanced Plan Template (`plan-template.md`)

Added **"Acceptance Criteria"** section to every phase:

```markdown
### Acceptance Criteria
**These files MUST exist after this phase completes:**
- [ ] `src/path/to/file.ts` - Description
- [ ] `src/path/to/__tests__/file.test.ts` - Test coverage
```

**Benefits:**
- Explicit requirement for what must be created
- Checkboxes for tracking completion
- Self-documenting deliverables

#### 2. Enhanced Checkpoint Verifier Script

Updated `checkpoint_verifier.sh` with three-stage validation:

**Stage 1: Acceptance Criteria Validation** ⭐ NEW
- Parses `### Acceptance Criteria` sections from plan.md
- Extracts file paths from `- [ ] \`src/path/to/file.ts\`` format
- Verifies EVERY required file exists
- **Fails immediately if any file is missing**

**Stage 2: Test Coverage Validation** (Existing)
- Analyzes `git diff` to find changed files
- Verifies each code file has a corresponding test file
- Checks test naming conventions

**Stage 3: Manual Verification Steps** (Existing)
- Suggests testing procedures
- Requests user confirmation

### How It Works

When you run `/phase-checkpoint`:

```
🔍 Validating Acceptance Criteria (Required Files)...
  ✓ src/path/to/file1.ts
  ✓ src/path/to/__tests__/file1.test.ts
  ✗ MISSING: src/path/to/file2.ts

❌ CHECKPOINT FAILED: Required files do not exist
Please complete all tasks specified in the Acceptance Criteria before running checkpoint.
```

### For Integration/Documentation Phases

Phases without new files (like "Integration Testing" or "Documentation") work as expected:

```markdown
### Acceptance Criteria
**No new files required. Verify existing implementation:**
- [ ] All tests pass: `bun test`
- [ ] Coverage ≥80%: `bun test --coverage`
```

These phases skip file existence checks and proceed directly to coverage validation.

## Updated Workflow

### Before Starting a Phase
1. Review the **Acceptance Criteria** section
2. Understand what files must be created
3. Link to specific file paths

### During Phase Work
1. Implement files listed in Acceptance Criteria
2. Create corresponding tests (auto-validated)
3. Ensure >80% coverage

### When Phase is Complete
```bash
/phase-checkpoint
```

The checkpoint will:
1. ✓ Verify all required files exist
2. ✓ Verify all changed files have tests
3. ✓ Suggest manual verification steps
4. ✓ Create checkpoint commit when confirmed

## File Changes

### Modified
- `projects/example_project/docs/plan-template.md` - Added Acceptance Criteria structure
- `.agent/skills/phase-checkpoint/scripts/checkpoint_verifier.sh` - Added file existence validation
- `.agent/skills/phase-checkpoint/SKILL.md` - Updated documentation

### Testing

The new validation can be tested by:

1. Creating a plan with acceptance criteria
2. Running `/phase-checkpoint` without creating files
3. Observing it fails with "MISSING: file.ts"
4. Creating the required files
5. Running `/phase-checkpoint` again
6. Observing it passes

## Benefits

| Before | After |
|--------|-------|
| ❌ Phase marked complete with no code created | ✅ Phase fails if required files missing |
| ❌ No clear deliverables documented | ✅ Explicit file list in plan |
| ❌ False positives possible | ✅ Fail-fast validation prevents surprises |
| ⚠️ Manual review needed | ✅ Automated verification |
