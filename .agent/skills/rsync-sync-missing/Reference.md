# rsync-sync-missing Reference Guide

Complete documentation for intelligent directory synchronization using rsync.

## Overview

The rsync-sync-missing skill wraps rsync with safe, intentional defaults optimized for merging files from a source directory into a target without destroying existing content. Perfect for consolidating project files, merging data directories, or syncing across systems.

## Core Philosophy

**Append-Only Safety:** Files move in one direction (source → target). Existing files are never touched, deleted, or overwritten. Think of it as a one-way mirror that only fills in missing pieces.

## How It Works

### Internal Command

```bash
rsync -av --ignore-existing source/ target/
```

**Flags Explained:**
- `-a` (archive) — Preserves permissions, timestamps, ownership
- `-v` (verbose) — Shows each file being transferred
- `--ignore-existing` — The safety gate: skip files already in target

### Flow

```
1. User provides source and target paths
2. Skill expands ~ to $HOME if needed
3. Validates both paths exist
4. Runs rsync in --dry-run mode by default
5. Shows user what WOULD be copied
6. User reviews output
7. User sets execute=true to actually sync
8. Sync completes with audit trail
```

## Parameters Reference

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `source` | path | required | Directory to copy FROM (ends with /) |
| `target` | path | required | Directory to copy TO (ends with /) |
| `execute` | bool | false | Perform actual sync (false = dry-run only) |
| `verbose` | bool | true | Show file-by-file transfer details |
| `remote` | bool | false | Enable remote SSH sync (host:/path) |

## Usage Patterns

### Pattern 1: Safe Preview (Default)

```bash
/rsync-sync-missing source=/path/source target=/path/target
```

**Output:**
```
DRY RUN MODE (no files actually copied)

Would copy:
  file1.txt
  subdir/file2.json
  subdir/nested/file3.md

Total: 3 files to sync
```

### Pattern 2: Actual Sync After Preview

```bash
/rsync-sync-missing source=/path/source target=/path/target execute=true
```

**Output:**
```
EXECUTING SYNC...

Copied:
  ✓ file1.txt
  ✓ subdir/file2.json
  ✓ subdir/nested/file3.md

Summary: 3 files synced, 0 files skipped (already exist)
```

### Pattern 3: Remote Sync Over SSH

```bash
/rsync-sync-missing source=user@host:/remote/source target=/local/target remote=true
```

### Pattern 4: Quiet Execution

```bash
/rsync-sync-missing source=/path/source target=/path/target execute=true verbose=false
```

## Common Scenarios

### Merge Project Directories

```bash
/rsync-sync-missing source=~/Projects/sam/projects target=~/Projects/realms-of-tomorrow/projects execute=true
```

**Use Case:** Consolidate shared project files without overwriting local customizations.

### Backup Missing Files to Archive

```bash
/rsync-sync-missing source=/active/data target=/archive/backup execute=true
```

**Use Case:** Add new files to archive while preserving existing backup versions.

### Sync Configuration Files Across Servers

```bash
/rsync-sync-missing source=/etc/config target=admin@backup-server:/etc/config remote=true execute=true
```

**Use Case:** Distribute new configs without overwriting server-specific settings.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Source doesn't exist | Error, no sync performed |
| Target doesn't exist | Target created automatically |
| Target file older than source | File NOT copied (respects existing) |
| Permission denied on target | Error with diagnostic info |
| SSH connection fails | Error with connection details |
| rsync not installed | Error with installation instructions |

## Performance Notes

- **First sync:** Slower (rsync reads entire target to compare)
- **Subsequent syncs:** Much faster (only compares new/modified files)
- **Large directories:** Safe to run repeatedly; overhead minimal
- **Network:** SSH syncs use compression by default

## Advanced: Custom rsync Flags

To use additional rsync flags beyond the standard set, modify the command manually:

```bash
# Standard (from skill)
rsync -av --ignore-existing source/ target/

# With compression for slow networks
rsync -avz --ignore-existing source/ target/

# With deletion (keep target = source exactly)
rsync -av --delete source/ target/
```

## Related Tools

- `rsync` — Underlying synchronization engine
- `ssh` — Remote access protocol for network syncs
- `tar` — Alternative for single-shot backups
- `git` — For version-controlled file sync

## Troubleshooting

**Q: Files aren't being copied**
A: Run without execute=true first to see the dry-run. If still empty, check that source/ has a trailing slash.

**Q: I want to REPLACE all files, not just fill gaps**
A: Remove `--ignore-existing` and use plain `rsync -av source/ target/` instead.

**Q: Remote sync is slow**
A: Add compression: add `z` flag to rsync (-avz instead of -av).

**Q: How do I delete old files in target?**
A: Use `--delete` flag: `rsync -av --delete source/ target/` (dangerous - removes files!)

## API Integration

Skills are CLI-first, but can be called from scripts:

```bash
#!/bin/bash
/rsync-sync-missing \
  source=/data/source \
  target=/data/target \
  execute=true
```
