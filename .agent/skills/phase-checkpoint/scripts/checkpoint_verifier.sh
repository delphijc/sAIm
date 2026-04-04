#!/bin/bash
# checkpoint_verifier.sh - Enforces Phase Completion Protocol

set -e

# Find the git repository root and source find_plan_md.sh from there
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
source "${REPO_ROOT}/.agent/scripts/find_plan_md.sh"
PLAN_FILE=$(find_plan_md) || exit 1

verify_phase() {
    echo "Starting Phase Completion Verification Protocol..."
    local all_valid=true

    # 1. Determine Phase Scope: Find previous checkpoint
    PREV_SHA=$(grep -o "\[checkpoint: [a-f0-9]*\]" "$PLAN_FILE" | tail -n 1 | cut -d' ' -f2 | tr -d ']')

    if [ -z "$PREV_SHA" ]; then
        echo "No previous checkpoint found. Analyzing all changes since first commit."
        PREV_SHA=$(git rev-list --max-parents=0 HEAD)
    fi

    # 1.5. Extract Acceptance Criteria files from plan.md
    echo -e "\n🔍 Validating Acceptance Criteria (Required Files)..."
    local required_files=()

    # Extract files from "Acceptance Criteria" sections (lines between "### Acceptance Criteria" and next "###" or empty line)
    local in_criteria=false
    while IFS= read -r line; do
        if [[ "$line" =~ ^"### Acceptance Criteria" ]]; then
            in_criteria=true
            continue
        elif [[ "$in_criteria" == true && "$line" =~ ^"###" || "$in_criteria" == true && -z "$line" ]]; then
            in_criteria=false
            continue
        fi

        # Extract path from "- [ ] `src/path/to/file.ts` - Description" format
        # Also ignore lines with "Additional deliverables" which aren't actual files
        if [ "$in_criteria" = true ] && [[ "$line" =~ ^\-\ \[[\ x]\]\ \`\([^\`]+\)\` ]]; then
            local filepath="${BASH_REMATCH[1]}"
            # Skip test command lines like "bun test"
            if [[ ! "$filepath" =~ ^(bun|npm|yarn|docker) ]]; then
                required_files+=("$filepath")
            fi
        fi
    done < "$PLAN_FILE"

    # Verify all required files exist
    if [ ${#required_files[@]} -gt 0 ]; then
        for file in "${required_files[@]}"; do
            if [ -f "$file" ]; then
                echo "  ✓ $file"
            else
                echo "  ✗ MISSING: $file"
                all_valid=false
            fi
        done
    else
        echo "  ℹ️  No specific files required (integration/documentation phase)"
    fi

    if [ "$all_valid" = false ]; then
        echo -e "\n❌ CHECKPOINT FAILED: Required files do not exist"
        echo "Please complete all tasks specified in the Acceptance Criteria before running checkpoint."
        exit 1
    fi

    # 2. List Changed Files (excluding non-code files)
    echo -e "\n📝 Validating Test Coverage..."
    CHANGED_FILES=$(git diff --name-only "$PREV_SHA" HEAD | grep -E '\.(ts|go|sh)$' || true)

    if [ -z "$CHANGED_FILES" ]; then
        echo "  ℹ️  No code changes detected (documentation/cleanup phase)"
    else
        echo "Files changed in this phase:"
        for FILE in $CHANGED_FILES; do
            # Skip if file is already a test file
            if [[ "$FILE" == *.test.* ]] || [[ "$FILE" == *_test.* ]] || [[ "$FILE" == *.bats ]]; then
                echo "  [OK] $FILE (test file)"
                continue
            fi

            # 3. Verify corresponding test file exists based on file type
            local test_found=false
            local base_name="${FILE%.*}"
            local dir_name
            dir_name=$(dirname "$FILE")

            case "$FILE" in
                *.ts)
                    # TypeScript: check for .test.ts
                    if [ -f "${base_name}.test.ts" ]; then
                        test_found=true
                    fi
                    ;;
                *.go)
                    # Go: check for _test.go
                    if [ -f "${base_name}_test.go" ]; then
                        test_found=true
                    fi
                    ;;
                *.sh)
                    # Bash: check for .bats in test/ directory
                    local script_name
                    script_name=$(basename "$base_name")
                    if [ -f ".agent/test/${script_name}.bats" ] || [ -f "${dir_name}/${script_name}.bats" ]; then
                        test_found=true
                    fi
                    ;;
            esac

            if [ "$test_found" = false ]; then
                echo "CRITICAL: Missing test file for $FILE"
                all_valid=false
            else
                echo "  [OK] $FILE"
            fi
        done
    fi

    if [ "$all_valid" = false ]; then
        echo -e "\n❌ CHECKPOINT FAILED: Missing test files"
        exit 1
    fi

    # 4. Propose Manual Verification Plan
    echo -e "\n✅ All validations passed!"
    echo -e "\nManual Verification Steps:"
    echo "1. Run current test suite: CI=true bun test"
    echo "2. Verify coverage ≥80%: bun test --coverage"
    echo "3. Confirm type checking: bun typecheck"
    echo "4. Run linter: bun lint"
    echo "5. Confirm UI displays new components correctly."
    echo -e "\nDoes this meet expectations? Confirm with 'yes'."
}

case "$1" in
    "--check-tests")
        verify_phase
        ;;
    *)
        echo "Usage: $0 --check-tests"
        exit 1
        ;;
esac
