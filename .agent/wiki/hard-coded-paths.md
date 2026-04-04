# Hardcoded Paths Reference

This page documents all locations in the PAI codebase where hardcoded absolute paths exist, and how the setup scripts handle path replacement at install time.

## Overview

PAI uses `$HOME`-relative paths wherever possible. However, some files require absolute paths (e.g., systemd service units, Claude Code `settings.json` hook commands). The `setup.sh` script includes a `fix_hardcoded_paths()` function that replaces any previous user's home directory with the current `$HOME` when run.

## Path Replacement Strategy

| Method | Used In | How It Works |
|--------|---------|--------------|
| `$HOME` variable | Shell scripts | Resolved at runtime |
| `fix_hardcoded_paths()` in `setup.sh` | settings.json, systemd scripts, service files | `sed` replacement of old paths with current `$HOME` |
| `__HOME__` placeholder | settings.json template | Replaced during initial setup |

## Files Containing Absolute Paths

### Configuration (replaced by setup.sh)

| File | Paths | Notes |
|------|-------|-------|
| `.agent/settings.json` | `$HOME/.claude/bin/run-hook.sh` (14 hook commands), `PAI_DIR`, `statusLine` | All hook commands use absolute paths because Claude Code resolves them outside the project directory |
| `.agent/scripts/setup-pai-systemd-services.sh` | `$HOME/.bun/bin/bun` in Discord service ExecStart | Uses `$HOME_DIR` for all other paths; this one is in a heredoc |

### Service Management (replaced by setup.sh)

| File | Paths | Notes |
|------|-------|-------|
| `.agent/services/install-systemd.sh` | `SERVICE_DIR` variable, usage hint | Legacy systemd installer (root-level services) |
| `.agent/services/watchdog.sh` | Cron example in comment | Comment-only; actual paths use variables |

### Documentation (informational, not functional)

| File | Paths | Notes |
|------|-------|-------|
| `.agent/RESILIENCE_PLAN.md` | Multiple service paths | Architecture document with example systemd units |
| `.agent/PHASE1_SETUP_GUIDE.md` | Service file paths | Setup guide examples |
| `.agent/scripts/README-SYSTEMD-SETUP.md` | Service start paths | Documentation |
| `.agent/OBSERVABILITY_INTEGRATION_FIX.md` | Event file paths | Fix documentation |
| `.agent/PAI_ECOSYSTEM_REVIEW_2026-03-12.md` | Various paths including legacy `/` | Ecosystem review |

### Source Code (uses generic examples)

| File | Paths | Notes |
|------|-------|-------|
| `.agent/skills/open-file/tools/OpenFile.ts` | Example paths in help text | Uses `~/` for generic examples |

## Upstream References

These references point to legitimate upstream projects and should be preserved:

| File | Reference | Reason to Keep |
|------|-----------|----------------|
| `README.md` | `github.com/danielmiessler/PAI` | Attribution to original PAI 1.0 creator |
| `README.md` | `github.com/danielmiessler/fabric` | Attribution to Fabric project |
| `README.md` | `danielmiessler.com/blog/human-3-0-*` | Attribution to Human 3.0 manifesto |
| `.agent/skills/fabric/tools/update-patterns.sh` | `github.com/danielmiessler/fabric@latest` | Upstream Fabric CLI install command |
| `.agent/skills/research/workflows/Fabric.md` | `github.com/danielmiessler/fabric` | Upstream Fabric repo clone |
| `.agent/skills/ffuf/Reference.md` | `github.com/danielmiessler/SecLists` | Upstream SecLists wordlist repo |
| `.agent/skills/ffuf/resources/WORDLISTS.md` | `github.com/danielmiessler/SecLists` | Upstream SecLists wordlist repo |

## Running Path Fixes

To update all hardcoded paths after migrating to a new system or user account:

```bash
# From the PAI project root
bash .agent/setup.sh --fix-paths
```

This will:
1. Detect the current `$HOME`
2. Find any previous home directory paths in configuration files
3. Replace them with the current `$HOME` path
4. Report what was changed

## Adding New Files

When adding new files that require absolute paths:

1. **Shell scripts**: Use `$HOME` or `${HOME}` - these resolve at runtime
2. **JSON config**: Use the `__HOME__` placeholder if the file is processed by setup.sh, otherwise document it here
3. **Systemd units**: Use the `setup-pai-systemd-services.sh` script which generates units with correct paths
4. **Documentation**: Use `$HOME` or `~/` notation, not literal paths
