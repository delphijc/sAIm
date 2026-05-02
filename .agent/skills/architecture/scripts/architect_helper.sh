#!/bin/bash
# architect_helper.sh - Initializes project structure, validates inputs, and scaffolds planning files
# Used by the architect skill to set up the epic/story/plan hierarchy

set -e

PROJECT_ID="${PROJECT_ID:-default_project}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../../../projects/${PROJECT_ID}" && pwd 2>/dev/null || echo "${SCRIPT_DIR}/../../../projects/${PROJECT_ID}")"
DOCS_DIR="${PROJECT_DIR}/docs"
STORIES_DIR="${DOCS_DIR}/stories"
PLAN_FILE="${DOCS_DIR}/plan.md"

# Input documents from wizard output
PRD_FILE="${DOCS_DIR}/prd.md"
BRIEF_FILE="${DOCS_DIR}/product-brief.md"
ARCH_FILE="${DOCS_DIR}/architecture.md"
TECHSPEC_FILE="${DOCS_DIR}/tech-spec.md"
BDD_FILE="${DOCS_DIR}/BDD.md"

# Legacy fallbacks
PRODUCT_FILE="${DOCS_DIR}/product.md"
GUIDELINES_FILE="${DOCS_DIR}/product-guidelines.md"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[architect]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[architect]${NC} $1"; }
log_error() { echo -e "${RED}[architect]${NC} $1"; }

# --- Validation ---

validate_inputs() {
    log_info "Validating input documents for project: ${PROJECT_ID}"
    local has_requirements=false
    local has_technical=false
    local warnings=0

    # Check requirement documents (need at least one)
    if [ -f "$PRD_FILE" ]; then
        log_info "✓ Found prd.md"
        has_requirements=true
    elif [ -f "$PRODUCT_FILE" ]; then
        log_warn "⚠ Using legacy product.md (prefer prd.md)"
        has_requirements=true
        warnings=$((warnings + 1))
    fi

    if [ -f "$BRIEF_FILE" ]; then
        log_info "✓ Found product-brief.md"
    else
        log_warn "⚠ Missing product-brief.md — epic prioritization will be limited"
        warnings=$((warnings + 1))
    fi

    # Check technical documents
    if [ -f "$ARCH_FILE" ]; then
        log_info "✓ Found architecture.md"
        has_technical=true
    else
        log_warn "⚠ Missing architecture.md — stories will lack technical grounding"
        warnings=$((warnings + 1))
    fi

    if [ -f "$TECHSPEC_FILE" ]; then
        log_info "✓ Found tech-spec.md"
    else
        log_warn "⚠ Missing tech-spec.md — stories will lack implementation detail"
        warnings=$((warnings + 1))
    fi

    if [ -f "$BDD_FILE" ]; then
        log_info "✓ Found BDD.md"
    else
        log_warn "⚠ Missing BDD.md — acceptance criteria will be generated (not traced)"
        warnings=$((warnings + 1))
    fi

    # Gate: must have at least requirements
    if [ "$has_requirements" = false ]; then
        log_error "✗ No requirement document found (need prd.md or product.md)"
        log_error "  Run the standalone wizard first to generate planning artifacts."
        exit 1
    fi

    if [ "$warnings" -gt 0 ]; then
        log_warn "${warnings} warning(s) — architect will proceed with available documents"
    else
        log_info "All input documents present ✓"
    fi
}

# --- Initialization ---

init_project() {
    log_info "Initializing project structure..."
    mkdir -p "$STORIES_DIR"

    if [ ! -f "$PLAN_FILE" ]; then
        cat > "$PLAN_FILE" << 'PLAN_EOF'
---
project: "{{project_name}}"
generated: "{{date}}"
total_epics: 0
total_stories: 0
---

# Project Plan
> The Plan is the Source of Truth.

## Progress Overview

| Epic | Stories | Complete | Status |
|------|---------|----------|--------|

<!-- Epics and stories will be populated by the architect skill -->

## Retrospective Schedule

| Milestone | Trigger | Status |
|-----------|---------|--------|
| Project Complete | All epics [x] | ⏳ Pending |
PLAN_EOF
        log_info "Created plan.md scaffold"
    else
        log_warn "plan.md already exists — skipping scaffold"
    fi
}

# --- Status Check ---

check_status() {
    log_info "Project status for: ${PROJECT_ID}"
    echo ""

    # Count existing epics and stories
    local epic_count=0
    local story_count=0
    local done_count=0

    if [ -d "$STORIES_DIR" ]; then
        epic_count=$(find "$STORIES_DIR" -maxdepth 1 -name "epic*.md" ! -name "epic*-story*" ! -name "*-retro*" 2>/dev/null | wc -l)
        story_count=$(find "$STORIES_DIR" -maxdepth 1 -name "epic*-story*.md" 2>/dev/null | wc -l)
        done_count=$(grep -l 'status: "\[x\]' "$STORIES_DIR"/epic*-story*.md 2>/dev/null | wc -l)
    fi

    echo "  Epics:  ${epic_count}"
    echo "  Stories: ${story_count} (${done_count} complete)"

    if [ -f "$PLAN_FILE" ]; then
        echo "  Plan:   ✓ exists"
    else
        echo "  Plan:   ✗ missing"
    fi

    echo ""

    # Check for retrospective triggers
    if [ -d "$STORIES_DIR" ] && [ "$epic_count" -gt 0 ]; then
        for epic_file in "$STORIES_DIR"/epic*.md; do
            # Skip story files and retro files
            [[ "$epic_file" == *-story* ]] && continue
            [[ "$epic_file" == *-retro* ]] && continue

            local epic_num=$(basename "$epic_file" .md | sed 's/epic//')
            local epic_stories=$(find "$STORIES_DIR" -name "epic${epic_num}-story*.md" 2>/dev/null | wc -l)
            local epic_done=$(grep -l "status: \"\[x\]" "$STORIES_DIR"/epic${epic_num}-story*.md 2>/dev/null | wc -l)

            if [ "$epic_stories" -gt 0 ] && [ "$epic_stories" -eq "$epic_done" ]; then
                local retro_file="${STORIES_DIR}/epic${epic_num}-retro.md"
                if [ ! -f "$retro_file" ]; then
                    log_warn "🔄 Epic ${epic_num} is COMPLETE — retrospective pending!"
                else
                    log_info "✓ Epic ${epic_num} complete + retrospective done"
                fi
            fi
        done
    fi
}

# --- Main ---

case "${1:-}" in
    "--init")
        validate_inputs
        init_project
        log_info "Ready for epic/story generation. Run the architect skill to populate."
        ;;
    "--validate")
        validate_inputs
        ;;
    "--status")
        check_status
        ;;
    *)
        echo "Usage: $0 [--init|--validate|--status]"
        echo ""
        echo "  --init      Validate inputs and create project scaffold"
        echo "  --validate  Check input documents exist"
        echo "  --status    Show epic/story progress and retro triggers"
        exit 1
        ;;
esac
