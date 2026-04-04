# Rule: Strict Git Isolation

## Context
This rule is **Always On** for all files in this workspace.

## Problem: Git Cross-Pollination
Each subdirectory in `~/Projects/` is an independent git repository. Claude Code sessions can accidentally stage, commit, or push files belonging to a sibling project if the working directory isn't verified.

## Instruction: Repo Identity Verification
Before ANY git operation (commit, push, add, stash, reset), verify:

1. **Working directory check**: Confirm `git rev-parse --show-toplevel` returns the expected repo root
2. **Remote identity check**: Confirm `git remote get-url origin` matches the expected remote for this project
3. **Branch sanity**: Confirm the current branch belongs to this project's workflow

**Never assume the repo context.** Always verify explicitly.

## Instruction: Cross-Pollination Prevention
1. **No cross-repo staging**: Never `git add` files whose absolute path resolves outside the current repo root
2. **Protected files validation**: Run `.claude/hooks/validate-protected.ts --staged` before commits to Sam repo
3. **Forbidden patterns enforcement**: The `.saim-protected.json` manifest defines patterns that must never appear in commits (API keys, personal emails, private paths)
4. **Exception files**: Only files explicitly listed in `exception_files` may contain otherwise-forbidden patterns

## Instruction: Multi-Project Awareness
1. **Project-scoped operations**: All git operations must be scoped to a single project
2. **No sibling contamination**: Changes to `~/Projects/projectA/` must never appear in `~/Projects/projectB/` commits
3. **Dynamic path resolution**: Use `git rev-parse --show-toplevel` for repo root — never hardcode paths
4. **Submodule caution**: If submodules exist, verify the operation targets the correct module

## Constraints
- **Never run `git add .` or `git add -A` across project boundaries**
- **Never commit without verifying repo identity first**
- **Never push to a remote without confirming the remote URL matches expectations**
- **Always use `.saim-protected.json` validation for Sam repo commits**
