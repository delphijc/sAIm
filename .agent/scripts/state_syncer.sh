#!/bin/bash
# state_syncer.sh - Synchronizes plan.md and resource logs with state.md

set -e

# Source helper to find plan.md dynamically
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/find_plan_md.sh"

STATE_FILE=".agent/state.md"
# Get plan.md location
PLAN_FILE=$(find_plan_md) || {
    echo "Error: Could not find plan.md"
    exit 1
}
RESOURCE_LOG=".agent/resources/ports.jsonl"

sync_state() {
    echo "Updating Workflow State Blackboard..."

    # 1. Calculate System Status
    ACTIVE_AGENTS=$(pgrep -c -f "antigravity-agent" || echo "0")
    CURRENT_PHASE=$(grep "## Phase" "$PLAN_FILE" | tail -n 1)
    
    # 2. Extract Task States from plan.md
    # Counts tasks by status: [ ], [~], [x]
    TODO_COUNT=$(grep -c "\[ \]" "$PLAN_FILE" || echo "0")
    PROGRESS_COUNT=$(grep -c "\[~\]" "$PLAN_FILE" || echo "0")
    DONE_COUNT=$(grep -c "\[x\]" "$PLAN_FILE" || echo "0")

    # 3. Update Quality Gates (Coverage)
    # Reads the last recorded coverage from the most recent test log
    LAST_COV=$(grep "All files" logs/stdout.jsonl | tail -n 1 | awk '{print $4}' || echo "N/A")

    # 4. Atomically update the Blackboard
    # We use a heredoc to overwrite the state.md with fresh data
    cat <<EOF > "$STATE_FILE"
# Workflow State Blackboard

## System Status
- **Current Phase**: $CURRENT_PHASE
- **Active Agents**: $ACTIVE_AGENTS
- **Global Status**: $DONE_COUNT Completed / $PROGRESS_COUNT Active / $TODO_COUNT Todo

## Quality Gates
- **Last Coverage**: $LAST_COV
- **Last Sync**: $(date '+%Y-%m-%d %H:%M:%S')
EOF

    echo "Sync complete."
}

sync_state
