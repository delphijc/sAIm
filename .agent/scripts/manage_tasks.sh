#!/bin/bash
# manage_tasks.sh - Manages task status updates in plan.md

set -e

# Source helper to find plan.md dynamically
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/find_plan_md.sh"

# Get plan.md location
PLAN_FILE=$(find_plan_md) || {
    echo "Error: Could not find plan.md"
    exit 1
}

# Update task status in plan.md
# Usage: manage_tasks.sh update_status --task="Task Name" --status="in-progress|completed"
update_status() {
    local task_name=""
    local status=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --task=*)
                task_name="${1#*=}"
                shift
                ;;
            --status=*)
                status="${1#*=}"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    if [ -z "$task_name" ] || [ -z "$status" ]; then
        echo "Error: --task and --status are required"
        echo "Usage: $0 update_status --task=\"Task Name\" --status=\"in-progress|completed\""
        exit 1
    fi

    if [ ! -f "$PLAN_FILE" ]; then
        echo "Error: Plan file not found at $PLAN_FILE"
        exit 1
    fi

    # Determine the new status marker
    local new_marker
    case "$status" in
        "in-progress")
            new_marker="[~]"
            ;;
        "completed")
            # Get short commit SHA for completed tasks
            local sha
            sha=$(git log -1 --format='%h' 2>/dev/null || echo "")
            new_marker="[x]"
            if [ -n "$sha" ]; then
                new_marker="[x] <!-- $sha -->"
            fi
            ;;
        *)
            echo "Error: Invalid status '$status'. Use 'in-progress' or 'completed'."
            exit 1
            ;;
    esac

    # Escape special characters in task name for sed
    local escaped_task
    escaped_task=$(printf '%s\n' "$task_name" | sed 's/[[\.*^$()+?{|]/\\&/g')

    # Update the task status in plan.md
    # Matches: - [ ] Task Name or - [~] Task Name
    if grep -q "\- \[.\] $escaped_task" "$PLAN_FILE"; then
        sed -i.bak "s/\- \[.\] $escaped_task/- $new_marker $task_name/" "$PLAN_FILE"
        rm -f "$PLAN_FILE.bak"
        echo "Updated '$task_name' to status: $status"
    else
        echo "Warning: Task '$task_name' not found in $PLAN_FILE"
        exit 1
    fi
}

# List tasks by status
list_tasks() {
    local status="${1:-all}"

    if [ ! -f "$PLAN_FILE" ]; then
        echo "Error: Plan file not found at $PLAN_FILE"
        exit 1
    fi

    case "$status" in
        "todo")
            echo "=== Todo Tasks ==="
            grep -n "\- \[ \]" "$PLAN_FILE" || echo "No todo tasks found."
            ;;
        "in-progress")
            echo "=== In-Progress Tasks ==="
            grep -n "\- \[~\]" "$PLAN_FILE" || echo "No in-progress tasks found."
            ;;
        "completed")
            echo "=== Completed Tasks ==="
            grep -n "\- \[x\]" "$PLAN_FILE" || echo "No completed tasks found."
            ;;
        "all"|*)
            echo "=== All Tasks ==="
            grep -n "\- \[.\]" "$PLAN_FILE" || echo "No tasks found."
            ;;
    esac
}

# Main command dispatcher
case "$1" in
    "update_status")
        shift
        update_status "$@"
        ;;
    "list")
        shift
        list_tasks "$@"
        ;;
    *)
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  update_status --task=\"Task Name\" --status=\"in-progress|completed\""
        echo "  list [todo|in-progress|completed|all]"
        exit 1
        ;;
esac
