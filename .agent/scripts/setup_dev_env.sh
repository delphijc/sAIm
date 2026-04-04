#!/bin/bash
# setup_dev_env.sh - Initializes the local development environment for Bash Kanban

set -e

echo "--- Initializing Development Environment ---"

# 1. Create directory structures for logs and resources
mkdir -p logs/backend logs/frontend logs/monitor resources
echo "Created structured logging and resource directories."

# 2. Verify Toolchain
echo "Verifying dependencies..."
command -v bun >/dev/null 2>&1 || { echo "Error: Bun is not installed."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Error: Git is not installed."; exit 1; }
command -v shellcheck >/dev/null 2>&1 || { echo "Warning: shellcheck not found. Bash linting will fail."; }
command -v bats >/dev/null 2>&1 || { echo "Warning: bats not found. Bash tests will fail."; }

# 3. Install Git Hooks
echo "Installing git hooks..."
HOOK_SRC=".agent/git/hooks/pre-commit.sh"
HOOK_DEST=".git/hooks/pre-commit"

if [ -f "$HOOK_SRC" ]; then
    cp "$HOOK_SRC" "$HOOK_DEST"
    chmod +x "$HOOK_DEST"
    echo "Successfully installed pre-commit hook."
elif [ -f "$HOOK_DEST" ]; then
    chmod +x "$HOOK_DEST"
    echo "Pre-commit hook already exists at $HOOK_DEST."
else
    echo "Warning: No pre-commit hook source found. Create $HOOK_SRC or $HOOK_DEST manually."
fi

# 4. Initialize Local Git Notes
git config core.notesRef refs/notes/commits
echo "Git notes configured for audit trail."

echo "--- Setup Complete. You are ready to follow the workflow. ---"
