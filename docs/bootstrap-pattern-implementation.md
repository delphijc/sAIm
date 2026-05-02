# Bootstrap Pattern Implementation Guide

## Problem
Currently, PAI_DIR is hardcoded in multiple places, breaking when the user's home directory changes or the system environment differs (Docker, systemd, etc.).

## Solution: Defensive Bootstrap Pattern

This guide implements a four-tier PAI_DIR resolution system:

```
Tier 1: Explicit PAI_DIR env var (already set)
Tier 2: HOME/.claude/.env (recommended location)
Tier 3: Service context (USER/SUDO_USER/LOGNAME from systemd)
Tier 4: os.homedir() fallback
```

---

## Implementation Steps

### Step 1: Update Shell Configurations

#### 1a. Fix `.zshrc` (if not already sourcing .env)
Add this to `~/.zshrc` (after line 10, after PATH setup):

```bash
# ── PAI / task_runner environment ──
if [[ -f "${HOME}/.claude/.env" ]]; then
    set -a
    source "${HOME}/.claude/.env"
    set +a
fi
```

#### 1b. Verify `.bashrc` (should already have this)
Confirm `~/.bashrc` has the same pattern (it should, from git status).

---

### Step 2: Update settings.json

**File**: `/Users/delphijc/.claude/settings.json` (or `.agent/settings.json` in sam repo)

**Change this**:
```json
"env": {
  "PAI_DIR": "/Users/delphijc/.claude",
  ...
}
```

**To this**:
```json
"env": {
  "PAI_DIR": "${HOME}/.claude",
  ...
}
```

**Why**: Allows Claude Code to expand `${HOME}` at runtime, making it portable across users/machines.

---

### Step 3: Update Hook Paths (Optional but Recommended)

All hardcoded hook paths in settings.json can use placeholders:

**Before**:
```json
"command": "/Users/delphijc/.claude/bin/run-hook.sh security-validator.ts"
```

**After**:
```json
"command": "${PAI_DIR}/bin/run-hook.sh security-validator.ts"
```

This requires settings.json to resolve `${PAI_DIR}` BEFORE rendering hooks, so verify this works after the change.

---

### Step 4: Update task_runner Scripts

All scripts in `/Users/delphijc/Projects/task_runner/` should use defensive sourcing.

**Pattern**:
```bash
#!/usr/bin/env bash

# Defensive PAI_DIR sourcing: only if not already set
if [[ -z "$PAI_DIR" ]]; then
    if [[ -f "${HOME}/.claude/.env" ]]; then
        set -a
        source "${HOME}/.claude/.env"
        set +a
    else
        export PAI_DIR="${HOME}/.claude"
    fi
fi

# Rest of script
# ... use ${PAI_DIR} or ${HOME}/.claude for all paths
```

**Files to Update** (scan for hardcoded paths):
- `lib_path_resolution.sh` - Check if it references PAI_DIR or .claude
- `setup.sh` - Add defensive sourcing at top
- `job_scheduler.sh` - Add defensive sourcing
- `jobs_queue_monitor.sh` - Add defensive sourcing
- `manage_jobs.sh` - Add defensive sourcing
- All other `.sh` files that need PAI_DIR access

---

### Step 5: Create Symlink for Bootstrap Utility

The bootstrap script is now available in sam project:

```bash
# Create symlink for easy access
ln -s /Users/delphijc/Projects/sam/.agent/utils/bootstrap.sh \
      /Users/delphijc/.claude/utils/bootstrap.sh
```

Then source it in any script:
```bash
source "${HOME}/.claude/utils/bootstrap.sh"
# PAI_DIR is now guaranteed to be set
```

---

## Verification

After implementing, verify the setup:

```bash
# Test 1: PAI_DIR is set in interactive shells
zsh -ic 'echo "PAI_DIR=$PAI_DIR"'
bash -ic 'echo "PAI_DIR=$PAI_DIR"'

# Test 2: Hooks can find files
ls "${PAI_DIR}/bin/run-hook.sh"

# Test 3: Scripts source the bootstrap
source /Users/delphijc/.claude/utils/bootstrap.sh
echo "Bootstrap successful: PAI_DIR=$PAI_DIR"
```

---

## Why Each Tier Matters

| Tier | When it Applies | Example |
|------|-----------------|---------|
| 1 | Explicit override | `PAI_DIR=/custom/path bun script.ts` |
| 2 | Normal operation | Interactive shell with `~/.claude/.env` |
| 3 | systemd services | Service started as different user; reads `SUDO_USER` env var |
| 4 | Last resort | All else fails; Node.js `os.homedir()` |

---

## Troubleshooting

**"PAI_DIR not found"**
- Check `~/.claude/.env` exists: `ls -la ~/.claude/.env`
- Source it manually: `source ~/.claude/.env && echo "PAI_DIR=$PAI_DIR"`
- If it contains a relative path, make it absolute: `PAI_DIR=/Users/delphijc/.claude`

**"Hooks still using hardcoded paths"**
- Search for `/Users/delphijc` in settings.json: `grep -n "/Users/delphijc" settings.json`
- Replace with `${PAI_DIR}` or `${HOME}/.claude` placeholders

**"Cron jobs fail to find PAI_DIR"**
- Cron doesn't source shell configs. Update task_runner scripts with defensive sourcing.
- Test: `crontab -e` → `* * * * * /path/to/task_runner/script.sh`

---

## Summary

**What you've done**:
- ✅ Created bootstrap.sh utility
- ⏳ TODO: Update shell configs (.zshrc)
- ⏳ TODO: Update settings.json
- ⏳ TODO: Update task_runner scripts with defensive sourcing

**Next steps**:
1. Run the commands above to update each file
2. Test with verification commands
3. Monitor logs for any path-related failures
