# Bootstrap Pattern Implementation Checklist

## Current Status
- ✅ **DONE**: Created bootstrap utility at `.agent/utils/bootstrap.sh`
- ✅ **DONE**: Created implementation guide at `docs/bootstrap-pattern-implementation.md`
- ✅ **DONE**: Created automation script at `.agent/scripts/fix-task-runner-bootstrap.sh`
- ⏳ **TODO**: Apply changes to shell configs, settings.json, and task_runner scripts

---

## Phase 1: Remove PAI_DIR from Shell Configs

The goal is to let `.env` and the bootstrap utility handle PAI_DIR, not the shell configs.

### Task 1a: Verify/Fix `.zshrc`
**File**: `~/.zshrc`

**Check current state**:
```bash
grep -n "PAI_DIR" ~/.zshrc
```

**Expected**: No PAI_DIR lines in .zshrc (it should load from .env instead)

**If PAI_DIR is in .zshrc**: Delete it. Then add (around line 15-20, after PATH setup):
```bash
# ── PAI / task_runner environment ──
if [[ -f "${HOME}/.claude/.env" ]]; then
    set -a
    source "${HOME}/.claude/.env"
    set +a
fi
```

### Task 1b: Verify `.bashrc`
**File**: `~/.bashrc`

**Check**: Should already source `.env` (lines 13-23)
```bash
if [[ -f "${HOME}/.claude/.env" ]]; then
    set -a
    source "${HOME}/.claude/.env"
    set +a
fi
```

**Status**: ✅ Already correct

---

## Phase 2: Update settings.json

### Task 2a: Update PAI_DIR in env section
**File**: `/Users/delphijc/.claude/settings.json` or `.agent/settings.json`

**Change**:
```json
// BEFORE:
"env": {
  "PAI_DIR": "/Users/delphijc/.claude",
  ...
}

// AFTER:
"env": {
  "PAI_DIR": "${HOME}/.claude",
  ...
}
```

**Why**: Portability across users/machines

**Verify with**:
```bash
grep 'PAI_DIR' ~/.claude/settings.json
# Should show: "PAI_DIR": "${HOME}/.claude",
```

### Task 2b: (Optional) Update hook paths to use placeholders
**File**: Same settings.json

**Example change**:
```json
// BEFORE:
"command": "/Users/delphijc/.claude/bin/run-hook.sh security-validator.ts"

// AFTER:
"command": "${PAI_DIR}/bin/run-hook.sh security-validator.ts"
```

**Note**: Test this carefully after changing. Some Claude Code versions may not support `${PAI_DIR}` expansion yet.

---

## Phase 3: Fix task_runner Scripts

### Task 3a: Run the automation script (RECOMMENDED)

```bash
# Make script executable
chmod +x /Users/delphijc/Projects/sam/.agent/scripts/fix-task-runner-bootstrap.sh

# Run it (creates .bak backups automatically)
bash /Users/delphijc/Projects/sam/.agent/scripts/fix-task-runner-bootstrap.sh
```

**What it does**:
- Finds all `.sh` files in `task_runner/` root
- Adds defensive PAI_DIR sourcing after the shebang
- Creates `.bak` backups of originals
- Skips scripts that already have the pattern

**Verify**:
```bash
# Check which files were updated
grep -l "Defensive PAI_DIR sourcing" /Users/delphijc/Projects/task_runner/*.sh
```

### Task 3b: Manual approach (if preferred)

For each script in `/Users/delphijc/Projects/task_runner/*.sh`:

1. Open the file
2. After the shebang line (`#!/usr/bin/env bash`), add:

```bash
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
```

3. Replace any hardcoded `/Users/delphijc/.claude` paths with `${PAI_DIR}`
4. Replace any hardcoded `/Users/delphijc` home paths with `${HOME}`

---

## Phase 4: Verification

### Test 1: Shell Config Bootstrap
```bash
# Should output the path
zsh -ic 'echo "PAI_DIR=$PAI_DIR"'
bash -ic 'echo "PAI_DIR=$PAI_DIR"'

# Expected: PAI_DIR=/Users/delphijc/.claude
```

### Test 2: settings.json
```bash
# Should show placeholder, not hardcoded path
grep "PAI_DIR" ~/.claude/settings.json

# Expected: "PAI_DIR": "${HOME}/.claude",
```

### Test 3: Hook Access
```bash
# Hooks should be able to find files
ls "${PAI_DIR}/bin/run-hook.sh"
ls "${PAI_DIR}/hooks/security-validator.ts"

# Expected: Files exist and are readable
```

### Test 4: task_runner Bootstrap
```bash
# Each script should have the bootstrap pattern
grep "Defensive PAI_DIR sourcing" /Users/delphijc/Projects/task_runner/*.sh | head -5

# Expected: Multiple files listed
```

### Test 5: End-to-End
```bash
# Run a task_runner script and verify it can access PAI_DIR
bash /Users/delphijc/Projects/task_runner/lib_path_resolution.sh
echo $?

# Expected: Exit code 0 (no errors finding paths)
```

---

## Rollback Plan

If something breaks, backups are available:

```bash
# Restore a script from backup
cp /Users/delphijc/Projects/task_runner/script.sh.bak \
   /Users/delphijc/Projects/task_runner/script.sh

# Restore shell config
# (restore from git if tracked, or from ~/.bashrc/.zshrc backups)
```

---

## Completion Checklist

- [ ] Phase 1: Shell configs updated (.zshrc sourcing .env)
- [ ] Phase 2: settings.json PAI_DIR uses `${HOME}` placeholder
- [ ] Phase 3: task_runner scripts have defensive sourcing
- [ ] Phase 4: All verification tests pass
- [ ] Backups kept for 7 days (then delete)

---

## Next Actions

1. **Immediate**: Run automation script for task_runner
2. **Manual**: Update settings.json (requires access to `.claude/` directory)
3. **Testing**: Run verification tests
4. **Documentation**: Update this checklist with results
