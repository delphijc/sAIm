# Backup & Restore System

Sam's memory databases (SQLite) are protected by an automated backup system using systemd user timers. This covers the backup strategy, scheduling, scripts, and restore procedures.

---

## Overview

| Component | Description |
|-----------|-------------|
| **Backup target** | `memory.db` (conversations + semantic memories) and `events.db` (hook event log) |
| **Strategy** | Full weekly snapshots + hourly incremental exports |
| **Mechanism** | SQLite `.backup` command (WAL-safe, consistent) with `bun:sqlite` fallback |
| **Scheduling** | systemd user timers (no cron dependency) |
| **Retention** | 4 full backups (~1 month), 168 incrementals (~1 week) |
| **Storage** | `$PAI_DIR/backups/memory/` |

## Directory Layout

```
$PAI_DIR/backups/memory/
  full/
    20260302_030012/        # Weekly full snapshot
      memory.db
      events.db
      manifest.json
    20260309_030045/
      ...
  incremental/
    20260302_030012_incr_20260302_041500/
      memory_incremental.json
      events.db
      manifest.json
    ...
  latest -> full/20260309_030045   # Symlink to most recent full
  sam-memory-export-*.tar.gz       # Portable migration tarballs
```

---

## Scripts

All scripts live in `.agent/skills/discord-remote-control/scripts/`.

### backup-memory.sh

WAL-safe backup of SQLite databases with automatic pruning.

```bash
# Full backup (weekly) - complete database snapshot
backup-memory.sh full

# Incremental backup (hourly) - new rows since last full, as JSON
backup-memory.sh incremental

# List all available backups
backup-memory.sh list

# Create portable tarball for migration to another machine
backup-memory.sh export
```

**How it works:**

- **Full backups** use SQLite's `.backup` command (or `bun:sqlite` `serialize()` as fallback) to create a consistent point-in-time snapshot while the database is in use. Each full backup includes a `manifest.json` with metadata (timestamp, hostname, file sizes, schema version).
- **Incremental backups** query rows added since the last full backup timestamp and export them as JSON (`memory_incremental.json`). The events database gets a full snapshot since it's append-only and small.
- **Pruning** runs automatically: keeps the last 4 full backups and last 168 incrementals.
- **Export** creates a fresh full backup, bundles it with all related incrementals, and produces a portable `.tar.gz` tarball.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `PAI_DIR` | `~/Projects/sam` | PAI root directory |
| `SAM_BACKUP_DIR` | `$PAI_DIR/backups/memory` | Override backup storage location |

### restore-memory.sh

Restores databases from a backup, with safety checks and verification.

```bash
# Restore from a portable export tarball
restore-memory.sh sam-memory-export-20260309_120000.tar.gz

# Preview what would be restored (no changes made)
restore-memory.sh --dry-run sam-memory-export-20260309_120000.tar.gz

# Restore from a specific full backup directory
restore-memory.sh --from-backup /path/to/full/20260309_030045
```

**Safety features:**

- Before overwriting, the current database is copied to `memory.db.pre-restore.<timestamp>` as a safety net
- WAL checkpoint is run on the current DB before backup to ensure consistency
- Stale WAL/SHM files are removed after restore (they belong to the old DB)
- Restored files get `0600` permissions (owner read/write only)
- Incremental replays use `INSERT OR IGNORE` for idempotent application
- Post-restore verification reports row counts for conversations and semantic memories

**Restore order:**

1. Extract tarball to temp directory
2. Restore full backup (memory.db + events.db)
3. Replay all incremental backups in chronological order
4. Verify restored data integrity

### install-backup-timers.sh

Installs systemd user timers to automate the backup schedule.

```bash
# Install and enable timers
install-backup-timers.sh

# Check timer status and recent runs
install-backup-timers.sh status

# Remove all backup timers
install-backup-timers.sh remove
```

---

## Scheduling Details

The installer creates two systemd user timer units:

### Full Backup Timer

| Property | Value |
|----------|-------|
| **Unit** | `sam-memory-backup-full.timer` |
| **Schedule** | `Sun *-*-* 03:00:00` (every Sunday at 3:00 AM) |
| **Persistent** | `true` (runs missed backups after sleep/shutdown) |
| **Jitter** | Up to 5 minutes (`RandomizedDelaySec=300`) |

### Incremental Backup Timer

| Property | Value |
|----------|-------|
| **Unit** | `sam-memory-backup-incr.timer` |
| **Schedule** | `*-*-* *:15:00` (every hour at :15 past) |
| **Persistent** | `true` |
| **Jitter** | Up to 1 minute (`RandomizedDelaySec=60`) |

### Verifying Timers Are Active

```bash
# List all Sam backup timers and their next trigger time
systemctl --user list-timers 'sam-memory-*'

# View recent backup logs
journalctl --user -u sam-memory-backup-full.service --no-pager -n 10
journalctl --user -u sam-memory-backup-incr.service --no-pager -n 10
```

The systemd unit files are installed to `~/.config/systemd/user/`:
- `sam-memory-backup-full.service` / `sam-memory-backup-full.timer`
- `sam-memory-backup-incr.service` / `sam-memory-backup-incr.timer`

---

## Retention Policy

| Backup Type | Retention | Approximate Coverage |
|-------------|-----------|---------------------|
| Full | Last 4 | ~1 month (weekly) |
| Incremental | Last 168 | ~1 week (hourly) |

Older backups are pruned automatically after each new backup. In the worst case (total DB corruption discovered after 1 week), you can restore the most recent full backup and replay up to 168 hours of incremental data.

---

## Migration / System Transfer

To move Sam's memory to a new machine:

```bash
# On the source machine: create portable export
backup-memory.sh export
# Output: $PAI_DIR/backups/memory/sam-memory-export-<timestamp>.tar.gz

# Copy the tarball to the new machine
scp sam-memory-export-*.tar.gz newhost:~/

# On the target machine: restore
PAI_DIR=~/Projects/sam restore-memory.sh ~/sam-memory-export-*.tar.gz
```

The export tarball is self-contained: it includes the full backup, all related incrementals, and a copy of the restore script.

---

## Databases Backed Up

### memory.db

Located at `$PAI_DIR/discord-remote-control/memory.db`. Contains:

- **conversations** - Episodic memory (all Discord message exchanges with session IDs, timestamps, token counts)
- **semantic** - Knowledge base entries (topics, summaries, relevance scores) with FTS5 full-text search index
- Uses WAL mode for concurrent read/write safety

### events.db

Located at `$PAI_DIR/.agent/hook-events/events.db`. Contains:

- Hook event log from `capture-all-events.ts`
- Append-only, used for observability and audit trail

---

## Troubleshooting

**Timers not firing:**
```bash
# Check if user linger is enabled (required for timers when logged out)
loginctl show-user $USER | grep Linger
# Enable if needed:
sudo loginctl enable-linger $USER
```

**Backup fails with "database is locked":**
The `.backup` command should handle WAL locks, but if the database is under heavy write load, retry after a moment. The incremental backup uses `readonly: true` mode to avoid conflicts.

**Restore verification shows 0 rows:**
Check that the backup manifest matches the expected schema version. If restoring from an older backup, the table schema may have changed. Inspect the manifest:
```bash
cat /path/to/backup/manifest.json
```

---

*Last Updated: 2026-03-06*
