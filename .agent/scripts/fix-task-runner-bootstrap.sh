#!/usr/bin/env bash
# .agent/scripts/fix-task-runner-bootstrap.sh
# Automatically adds defensive PAI_DIR sourcing to all task_runner scripts

set -euo pipefail

TASK_RUNNER_ROOT="/Users/delphijc/Projects/task_runner"
BOOTSTRAP_SNIPPET='# Defensive PAI_DIR sourcing: only if not already set
if [[ -z "$PAI_DIR" ]]; then
    if [[ -f "${HOME}/.claude/.env" ]]; then
        set -a
        source "${HOME}/.claude/.env"
        set +a
    else
        export PAI_DIR="${HOME}/.claude"
    fi
fi
'

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# Validate task_runner exists
if [[ ! -d "$TASK_RUNNER_ROOT" ]]; then
    error "task_runner directory not found: $TASK_RUNNER_ROOT"
    exit 1
fi

info "Scanning $TASK_RUNNER_ROOT for shell scripts..."
echo ""

# Find all shell scripts (excluding sandboxes for now)
SCRIPTS=$(find "$TASK_RUNNER_ROOT" -maxdepth 1 -name "*.sh" -type f | sort)

MODIFIED=0
SKIPPED=0
TOTAL=0

for script in $SCRIPTS; do
    TOTAL=$((TOTAL + 1))
    filename=$(basename "$script")

    # Skip if already has PAI_DIR bootstrap
    if grep -q "Defensive PAI_DIR sourcing" "$script" 2>/dev/null; then
        warn "SKIP: $filename (already has bootstrap)"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    # Skip files that don't have shebang (not shell scripts)
    if ! head -1 "$script" | grep -q "^#!.*bash"; then
        warn "SKIP: $filename (not a bash script)"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    info "Updating: $filename"

    # Create backup
    cp "$script" "${script}.bak"

    # Extract shebang and set -e lines
    shebang=$(head -1 "$script")
    rest=$(tail -n +2 "$script")

    # Reconstruct with bootstrap after shebang
    {
        echo "$shebang"
        echo ""
        echo "$BOOTSTRAP_SNIPPET"
        echo "$rest"
    } > "$script.tmp"

    mv "$script.tmp" "$script"
    chmod +x "$script"

    ok "Updated $filename"
    MODIFIED=$((MODIFIED + 1))
done

echo ""
echo "═══════════════════════════════════════════════════"
echo -e "${GREEN}Summary${NC}"
echo "═══════════════════════════════════════════════════"
echo "Total scripts:     $TOTAL"
echo "Modified:         $MODIFIED"
echo "Skipped:          $SKIPPED"
echo ""
echo "Backups created with .bak extension"
echo ""
info "Bootstrap pattern added to task_runner scripts!"
info "Verify with: grep -l 'Defensive PAI_DIR' $TASK_RUNNER_ROOT/*.sh"
