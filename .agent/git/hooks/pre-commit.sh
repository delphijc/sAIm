#!/bin/bash
# .git/hooks/pre-commit - Local enforcement of git isolation and workflow checks

set -e

# ============================================================
# 0. Git Isolation: Repo Identity & Cross-Pollination Guard
# ============================================================
REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"

# 0a. Verify all staged files belong to THIS repo
STAGED_FILES_FULL=$(git diff --cached --name-only --diff-filter=ACMR)
while IFS= read -r file; do
    [ -z "$file" ] && continue
    ABSOLUTE_PATH="$(cd "$REPO_ROOT" && realpath "$file" 2>/dev/null || echo "$REPO_ROOT/$file")"
    if [[ "$ABSOLUTE_PATH" != "$REPO_ROOT/"* ]]; then
        echo "ABORT: Staged file '$file' resolves outside repo root ($REPO_ROOT)."
        echo "This is a cross-pollination violation. Unstage it before committing."
        exit 1
    fi
done <<< "$STAGED_FILES_FULL"

# 0b. Verify working directory is inside the repo we think we're in
if [[ "$(pwd)" != "$REPO_ROOT"* ]]; then
    echo "ABORT: Current directory ($(pwd)) is outside repo root ($REPO_ROOT)."
    echo "Change to the correct project directory before committing."
    exit 1
fi

# 0c. Log repo identity for audit trail
echo "--- Git Isolation Check ---"
echo "  Repo root: $REPO_ROOT"
echo "  Repo name: $REPO_NAME"
REMOTE_URL="$(git remote get-url origin 2>/dev/null || echo '(no remote)')"
echo "  Remote:    $REMOTE_URL"
echo "  Branch:    $(git branch --show-current)"
echo "--- Isolation OK ---"

# ============================================================
# 1. Workflow Checks
# ============================================================

# Source helper to find plan.md dynamically
source "${REPO_ROOT}/.agent/scripts/find_plan_md.sh" 2>/dev/null || true

# Get plan.md location
PLAN_FILE=$(find_plan_md 2>/dev/null) || {
    echo "Warning: Could not find plan.md. Skipping task status check."
    PLAN_FILE=""
}

echo "--- Running Pre-Commit Workflow Checks ---"

# 1. Verify a task is marked In-Progress (only if plan.md exists)
if [[ -n "${PLAN_FILE}" ]] && [[ -f "${PLAN_FILE}" ]]; then
    if ! grep -q "\\[~\\]" "$PLAN_FILE"; then
        echo "Aborting: No task is marked as In-Progress ([~]) in $PLAN_FILE."
        echo "Please mark your current task as in-progress before committing."
        exit 1
    fi
fi

# 2. Determine which directories are being modified
echo "Analyzing staged files..."
STAGED_FILES="${STAGED_FILES_FULL}"

# Check if task_runner/ is involved in this commit
HAS_TASK_RUNNER_CHANGES=0
if echo "$STAGED_FILES" | grep -q "^\.agent/task_runner/\|^\.agent/task_runner$"; then
    HAS_TASK_RUNNER_CHANGES=1
fi

# 3. Run TDD Verification (Green Phase) - ONLY if task_runner is modified
if [ "$HAS_TASK_RUNNER_CHANGES" -eq 1 ]; then
    echo "Running automated tests (task_runner changes detected)..."
    if ! bun run test; then
        echo "Aborting: Tests are failing. Fix implementation before committing."
        exit 1
    fi
else
    echo "Skipping test verification (no task_runner changes detected)"
fi

# 4. Verify Code Coverage (Quality Gate) - ONLY if task_runner is modified
# Multiple project architecture: Coverage gate only applies to task_runner commits
if [ "$HAS_TASK_RUNNER_CHANGES" -eq 1 ]; then
    echo "Checking code coverage (task_runner changes require ≥80% coverage)..."

    # Clear previous coverage data
    rm -rf coverage

    # Ensure cleanup on exit
    trap "rm -rf coverage" EXIT

    # Run tests (outputs lcov to coverage/* folders)
    bun run test:coverage > /dev/null

    # Merge coverage reports and check threshold
    if [ -f ".agent/scripts/merge-coverage.ts" ]; then
        MERGE_OUTPUT=$(bun run .agent/scripts/merge-coverage.ts coverage)
        echo "$MERGE_OUTPUT"

        # Extract FINAL_COVERAGE=XX.XX
        FINAL_COVERAGE=$(echo "$MERGE_OUTPUT" | grep "FINAL_COVERAGE=" | cut -d= -f2)

        if [ -n "$FINAL_COVERAGE" ]; then
            # Use bc or simple logic for float comparison
            IS_PASSING=$(echo "$FINAL_COVERAGE >= 80" | bc -l 2>/dev/null || awk "BEGIN {print ($FINAL_COVERAGE >= 80)}")

            if [ "$IS_PASSING" -eq 1 ]; then
                echo "Coverage check passed: ${FINAL_COVERAGE}%"
            else
                echo "Aborting: Overall code coverage is ${FINAL_COVERAGE}%, which is below the 80% requirement."
                exit 1
            fi
        else
            echo "Error: Could not determine final coverage percentage."
            exit 1
        fi
    else
        echo "Warning: .agent/scripts/merge-coverage.ts not found. Skipping aggregation."
    fi
else
    echo "Skipping coverage verification (no task_runner changes - multi-project architecture)"
fi

# 5. Path Resolution Validation (Prevent Regressions) - ONLY for task_runner commits
# Multi-project architecture: Path validation only applies to task_runner changes
if [ "$HAS_TASK_RUNNER_CHANGES" -eq 1 ]; then
    echo "Validating path resolution architecture (task_runner changes)..."

    # Check 5a: No orphaned sandboxes directory in task_runner
    if [[ -d "${REPO_ROOT}/.agent/task_runner/sandboxes" ]]; then
        echo "Error: Orphaned directory found: .agent/task_runner/sandboxes/"
        echo "Sandboxes must be at project root (sam/sandboxes/), not in task_runner."
        exit 1
    fi

    # Check 5b: Shell scripts that use PROJECT_DIR or manage paths source lib_path_resolution.sh
    echo "Checking shell scripts for proper path resolution sourcing..."
    SCRIPTS_TO_CHECK=(
        ".agent/task_runner/jobs_queue_monitor.sh"
        ".agent/task_runner/manage_jobs.sh"
        ".agent/task_runner/manage_workflows.sh"
    )

    for script_path in "${SCRIPTS_TO_CHECK[@]}"; do
        if [[ -f "${REPO_ROOT}/${script_path}" ]]; then
            # If script references resolve_project_paths, it must source lib_path_resolution.sh
            if grep -q "resolve_project_paths\|resolve_log_paths\|PROJECT_DIR" "${REPO_ROOT}/${script_path}"; then
                if ! grep -q "source.*lib_path_resolution.sh" "${REPO_ROOT}/${script_path}"; then
                    echo "Error: ${script_path} uses path functions but doesn't source lib_path_resolution.sh"
                    exit 1
                fi
            fi
        fi
    done

    # Check 5c: manage_jobs.sh validates PROJECT_ID requirement
    if [[ -f "${REPO_ROOT}/.agent/task_runner/manage_jobs.sh" ]]; then
        if ! grep -q 'PROJECT_ID.*required\|if.*PROJECT_ID.*then' "${REPO_ROOT}/.agent/task_runner/manage_jobs.sh"; then
            # Optionally warn if no validation found (not a hard error)
            echo "Warning: manage_jobs.sh should validate PROJECT_ID requirement"
        fi
    fi
else
    echo "Skipping path resolution validation (no task_runner changes)"
fi

# ============================================================
# 6. File Size Guard (GitHub Push Protection)
# ============================================================
# GitHub hard limit: 100MB per file. Warning threshold: 50MB.
# Catches oversized files BEFORE commit to prevent failed pushes.

echo "Checking staged file sizes against GitHub limits..."

MAX_FILE_SIZE_BYTES=$((100 * 1024 * 1024))  # 100MB hard limit
WARN_FILE_SIZE_BYTES=$((50 * 1024 * 1024))  # 50MB warning threshold
HAS_SIZE_ERROR=0

while IFS= read -r file; do
    [ -z "$file" ] && continue
    [ ! -f "$REPO_ROOT/$file" ] && continue

    FILE_SIZE=$(stat -f%z "$REPO_ROOT/$file" 2>/dev/null || stat -c%s "$REPO_ROOT/$file" 2>/dev/null || echo 0)

    if [ "$FILE_SIZE" -ge "$MAX_FILE_SIZE_BYTES" ]; then
        FILE_SIZE_MB=$(echo "scale=1; $FILE_SIZE / 1048576" | bc)
        echo "ABORT: '$file' is ${FILE_SIZE_MB}MB — exceeds GitHub's 100MB limit."
        echo "  Consider: git lfs, .gitignore, or splitting the file."
        HAS_SIZE_ERROR=1
    elif [ "$FILE_SIZE" -ge "$WARN_FILE_SIZE_BYTES" ]; then
        FILE_SIZE_MB=$(echo "scale=1; $FILE_SIZE / 1048576" | bc)
        echo "WARNING: '$file' is ${FILE_SIZE_MB}MB — approaching GitHub's 100MB limit."
    fi
done <<< "$STAGED_FILES_FULL"

if [ "$HAS_SIZE_ERROR" -eq 1 ]; then
    echo "One or more staged files exceed GitHub's file size limit."
    echo "Remove or shrink them before committing."
    exit 1
fi

echo "--- Local Workflow Verification Passed ---"
