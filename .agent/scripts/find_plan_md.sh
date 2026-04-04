#!/usr/bin/env bash
# find_plan_md.sh - Dynamically resolve plan.md location
#
# Usage:
#   source find_plan_md.sh
#   PLAN_FILE=$(find_plan_md) || exit 1
#
# Resolution order:
#   1. projects/${PROJECT_ID}/docs/plan.md (if PROJECT_ID is set)
#   2. projects/default_project/docs/plan.md (fallback)
#   3. .agent/docs/plan.md (legacy, deprecated)

find_plan_md() {
    local repo_root="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
    local plan_file=""
    
    # Try PROJECT_ID-specific plan first
    if [[ -n "${PROJECT_ID}" ]]; then
        local project_plan="${repo_root}/projects/${PROJECT_ID}/docs/plan.md"
        if [[ -f "${project_plan}" ]]; then
            echo "${project_plan}"
            return 0
        fi
    fi
    
    # Fall back to default project
    local default_plan="${repo_root}/projects/default_project/docs/plan.md"
    if [[ -f "${default_plan}" ]]; then
        echo "${default_plan}"
        return 0
    fi
    
    # Legacy fallback (for migration period)
    local legacy_plan="${repo_root}/.agent/docs/plan.md"
    if [[ -f "${legacy_plan}" ]]; then
        echo "[DEPRECATED] Using legacy plan.md location: ${legacy_plan}" >&2
        echo "${legacy_plan}"
        return 0
    fi
    
    # No plan.md found
    echo "Error: No plan.md found. Searched:" >&2
    [[ -n "${PROJECT_ID}" ]] && echo "  - projects/${PROJECT_ID}/docs/plan.md" >&2
    echo "  - projects/default_project/docs/plan.md" >&2
    echo "  - .agent/docs/plan.md (legacy)" >&2
    return 1
}

# Export for use in other scripts
export -f find_plan_md 2>/dev/null || true
