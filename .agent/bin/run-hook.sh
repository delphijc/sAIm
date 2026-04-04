#!/bin/bash

###############################################################################
# run-hook.sh - PAI Hook Execution Wrapper
#
# Purpose: Resolve PAI_DIR and execute hooks for Claude Code integration
#
# This wrapper handles environment variable substitution and hook execution,
# making it work reliably on both macOS and Linux.
#
# Usage: run-hook.sh <hook-name> [args...]
# Example: run-hook.sh security-validator.ts
###############################################################################

set -e

# Resolve PAI_DIR with fallback chain
resolve_pai_dir() {
    # Priority 1: Check environment variable
    if [ -n "$PAI_DIR" ] && [ -d "$PAI_DIR" ]; then
        echo "$PAI_DIR"
        return
    fi

    # Priority 2: Check ~/.claude (user home - most common)
    if [ -d "$HOME/.claude" ]; then
        echo "$HOME/.claude"
        return
    fi

    # Priority 3: Check current git repo's .claude (less common, for special setups)
    if command -v git &> /dev/null; then
        if git_root=$(git rev-parse --show-toplevel 2>/dev/null); then
            git_pai_dir="$git_root/.claude"
            # Only use git .claude if it looks valid (has hooks dir)
            if [ -d "$git_pai_dir/hooks" ]; then
                echo "$git_pai_dir"
                return
            fi
        fi
    fi

    # Fallback
    echo "$HOME/.claude"
}

# Get the hook name from argument
HOOK_NAME="$1"
shift || true

if [ -z "$HOOK_NAME" ]; then
    echo "❌ Error: Hook name required"
    echo "Usage: run-hook.sh <hook-name> [args...]"
    exit 1
fi

# Resolve PAI_DIR
PAI_DIR=$(resolve_pai_dir)

# Validate PAI_DIR exists
if [ ! -d "$PAI_DIR" ]; then
    echo "❌ Error: PAI_DIR not found: $PAI_DIR"
    echo "   Please set PAI_DIR environment variable or create ~/.claude"
    exit 1
fi

# Resolve full hook path
HOOK_PATH="$PAI_DIR/hooks/$HOOK_NAME"

# Validate hook exists
if [ ! -f "$HOOK_PATH" ]; then
    echo "❌ Error: Hook not found: $HOOK_PATH"
    echo "   Expected file: $HOOK_PATH"
    exit 1
fi

# Make hook executable if needed
if [ ! -x "$HOOK_PATH" ]; then
    chmod +x "$HOOK_PATH"
fi

# Execute hook with all arguments
exec "$HOOK_PATH" "$@"
