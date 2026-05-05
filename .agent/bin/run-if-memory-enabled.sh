#!/bin/bash
# run-if-memory-enabled.sh — Guard wrapper for memory-system hooks.
# Reads ENABLE_MEMORY_HOOKS from .env (or environment) and skips execution
# when disabled, so missing memory-system files don't break Claude Code hooks.
#
# Usage: run-if-memory-enabled.sh <command> [args...]

set -e

# Locate .env: prefer PAI_PROJECT_ROOT, fall back to common path
ENV_FILE=""
if [ -n "$PAI_PROJECT_ROOT" ] && [ -f "$PAI_PROJECT_ROOT/.agent/.env" ]; then
    ENV_FILE="$PAI_PROJECT_ROOT/.agent/.env"
elif [ -f "$HOME/Projects/sam/.agent/.env" ]; then
    ENV_FILE="$HOME/Projects/sam/.agent/.env"
fi

# Source .env to pick up ENABLE_MEMORY_HOOKS (skip unknown lines safely)
if [ -n "$ENV_FILE" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        # Strip comments and blank lines
        line="${line%%#*}"
        line="${line//[$'\t\r\n']}"
        [ -z "$line" ] && continue
        # Only export valid KEY=VALUE pairs
        if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
            export "$line" 2>/dev/null || true
        fi
    done < "$ENV_FILE"
fi

# Skip when disabled (default: disabled)
if [ "${ENABLE_MEMORY_HOOKS:-false}" != "true" ]; then
    exit 0
fi

# Verify the target script exists before running
TARGET="$2"
if [ "$1" = "bun" ] && [ -n "$TARGET" ] && [ ! -f "$TARGET" ]; then
    echo "⚠️  Memory hook not found (memory-system not installed): $TARGET" >&2
    exit 0
fi

# Resolve bun — not on PATH in Claude Code's hook environment
resolve_bun() {
    for candidate in \
        "$HOME/.bun/bin/bun" \
        "/usr/local/bin/bun" \
        "/opt/homebrew/bin/bun" \
        "$(command -v bun 2>/dev/null)"
    do
        [ -x "$candidate" ] && echo "$candidate" && return
    done
    echo ""
}

# Replace 'bun' token in args with the resolved absolute path
if [ "$1" = "bun" ]; then
    BUN=$(resolve_bun)
    if [ -z "$BUN" ]; then
        echo "❌ Error: bun not found" >&2
        exit 1
    fi
    shift
    exec "$BUN" "$@"
fi

exec "$@"
