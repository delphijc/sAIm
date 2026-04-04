#!/bin/bash
# enforce_workflow.sh - CI script to validate process compliance

set -e

# Source helper to find plan.md dynamically
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/find_plan_md.sh"

# Get plan.md location
PLAN_FILE=$(find_plan_md) || {
    echo "Error: Could not find plan.md"
    exit 1
}

# 1. Verify plan.md usage
check_plan_updates() {
    echo "Checking plan.md for status updates..."
    # Ensure there are no tasks stuck in [~] in the master branch
    if grep -q "\[~\]" "$PLAN_FILE"; then
        echo "Error: Tasks marked as [~] (In Progress) found in the Plan. Complete them before merging."
        exit 1
    fi
}

# 2. Verify Git Notes for the latest commit
check_git_notes() {
    echo "Verifying audit trail (git notes)..."
    LATEST_COMMIT=$(git rev-parse HEAD)
    NOTE=$(git notes show "$LATEST_COMMIT" 2>/dev/null || echo "")
    
    if [ -z "$NOTE" ]; then
        echo "Error: No git note found for commit $LATEST_COMMIT. Every commit must use the audit-committer skill."
        exit 1
    fi
    echo "Audit note verified."
}

case "$1" in
    "--verify")
        check_plan_updates
        check_git_notes
        ;;
    *)
        echo "Usage: $0 --verify"
        exit 1
        ;;
esac
