---
name: rsync-sync-missing
description: "Sync missing files from source to target directory using rsync --ignore-existing. Only copies files that don't exist in target, preserving existing files. Supports dry-run mode for safety. USE WHEN syncing directories where you only want to add missing files without overwriting existing ones."
---

# rsync-sync-missing Skill

Intelligently synchronize missing files between directories without overwriting existing content.

## Quick Usage

```bash
/rsync-sync-missing source=/path/to/source target=/path/to/target
```

## What It Does

- **Safe by default:** Runs in dry-run mode first (shows what would be synced)
- **Preserve existing:** Only copies files that don't exist in target
- **Recursive:** Handles nested directory structures
- **Preserves metadata:** Maintains permissions, timestamps, ownership
- **Verbose output:** Shows exactly what's being transferred

## Examples

**Preview sync from workspace to external project:**
```bash
/rsync-sync-missing source=~/Projects/sam/projects target=~/Projects/realms-of-tomorrow/projects
```

**Execute the actual sync:**
```bash
/rsync-sync-missing source=/path/source target=/path/target execute=true
```

**Remote sync via SSH:**
```bash
/rsync-sync-missing source=user@host:/remote/path target=/local/path
```

## Parameters

- `source` - Source directory path (required)
- `target` - Target directory path (required)
- `execute` - Set to `true` to perform sync (default: false = dry-run only)
- `verbose` - Show file-by-file details (default: true)

## Extended Context

For detailed information, see `Reference.md`
