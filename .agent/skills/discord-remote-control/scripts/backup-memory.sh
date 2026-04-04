#!/usr/bin/env bash
#
# Sam Memory Backup System
# Supports full and incremental backups of SQLite databases.
# Uses SQLite's .backup command for WAL-safe, consistent snapshots.
#
# Usage:
#   backup-memory.sh full          # Weekly full backup
#   backup-memory.sh incremental   # Hourly incremental (since last full)
#   backup-memory.sh list          # List available backups
#   backup-memory.sh export        # Create portable tarball for migration
#
# Environment:
#   SAM_BACKUP_DIR  - Override backup location (default: $PAI_DIR/backups/memory)
#   PAI_DIR         - PAI root directory

set -euo pipefail

PAI_DIR="${PAI_DIR:-$HOME/Projects/sam}"
BACKUP_DIR="${SAM_BACKUP_DIR:-$PAI_DIR/backups/memory}"
MEMORY_DB="$HOME/.claude/discord-remote-control/memory.db"
EVENTS_DB="$PAI_DIR/.agent/hook-events/events.db"

FULL_DIR="$BACKUP_DIR/full"
INCR_DIR="$BACKUP_DIR/incremental"
LATEST_LINK="$BACKUP_DIR/latest"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
err() { log "ERROR: $*" >&2; }

# Ensure sqlite3 is available, fall back to bun for .backup
backup_sqlite() {
    local src="$1" dst="$2"
    if command -v sqlite3 &>/dev/null; then
        sqlite3 "$src" ".backup '$dst'"
    else
        # Fallback: use bun:sqlite's serialize() for a consistent snapshot
        bun -e "
            import { Database } from 'bun:sqlite';
            import { writeFileSync } from 'fs';
            const db = new Database('$src', { readonly: true });
            const data = db.serialize();
            writeFileSync('$dst', Buffer.from(data));
            db.close();
        "
    fi
}

cmd_full() {
    local timestamp
    timestamp=$(date '+%Y%m%d_%H%M%S')
    local dest="$FULL_DIR/$timestamp"
    mkdir -p "$dest"

    log "Starting full backup -> $dest"

    # Backup memory database
    if [[ -f "$MEMORY_DB" ]]; then
        backup_sqlite "$MEMORY_DB" "$dest/memory.db"
        log "Backed up memory.db ($(du -h "$dest/memory.db" | cut -f1))"
    else
        err "memory.db not found at $MEMORY_DB"
    fi

    # Backup events database
    if [[ -f "$EVENTS_DB" ]]; then
        backup_sqlite "$EVENTS_DB" "$dest/events.db"
        log "Backed up events.db ($(du -h "$dest/events.db" | cut -f1))"
    else
        log "WARN: events.db not found at $EVENTS_DB (skipping)"
    fi

    # Save metadata
    cat > "$dest/manifest.json" <<MANIFEST
{
    "type": "full",
    "timestamp": "$timestamp",
    "created_at": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "databases": {
        "memory_db": {
            "source": "$MEMORY_DB",
            "size_bytes": $(stat -f%z "$dest/memory.db" 2>/dev/null || echo 0)
        },
        "events_db": {
            "source": "$EVENTS_DB",
            "size_bytes": $(stat -f%z "$dest/events.db" 2>/dev/null || echo 0)
        }
    },
    "schema_version": "1.0"
}
MANIFEST

    # Update latest symlink
    ln -sfn "$dest" "$LATEST_LINK"

    log "Full backup complete: $dest"

    # Prune old full backups (keep last 7 = ~1 week of dailies)
    local count
    count=$(ls -1d "$FULL_DIR"/[0-9]* 2>/dev/null | wc -l)
    if (( count > 7 )); then
        local to_remove=$((count - 7))
        ls -1d "$FULL_DIR"/[0-9]* | head -n "$to_remove" | while read -r old; do
            log "Pruning old full backup: $old"
            rm -rf "$old"
        done
    fi
}

cmd_incremental() {
    local timestamp
    timestamp=$(date '+%Y%m%d_%H%M%S')

    # Find latest full backup as base
    if [[ ! -L "$LATEST_LINK" ]] && [[ ! -d "$LATEST_LINK" ]]; then
        log "No full backup found. Running full backup first..."
        cmd_full
    fi

    local base_dir
    base_dir=$(cd -P "$LATEST_LINK" && pwd)
    local base_timestamp
    base_timestamp=$(basename "$base_dir")

    local dest="$INCR_DIR/${base_timestamp}_incr_${timestamp}"
    mkdir -p "$dest"

    log "Starting incremental backup (base: $base_timestamp) -> $dest"

    # For SQLite, "incremental" means: dump only rows newer than the base backup timestamp.
    # We extract the base timestamp and export new rows as SQL.
    local base_epoch
    local base_date_str
    base_date_str=$(echo "$base_timestamp" | sed 's/_/ /;s/\(....\)\(..\)\(..\)/\1-\2-\3/')
    base_epoch=$(date -j -f "%Y-%m-%d %H%M%S" "$base_date_str" '+%s' 2>/dev/null || echo 0)
    # Convert to milliseconds (JS timestamps)
    local base_epoch_ms=$((base_epoch * 1000))

    if [[ -f "$MEMORY_DB" ]]; then
        bun -e "
            import { Database } from 'bun:sqlite';
            import { writeFileSync } from 'fs';

            const db = new Database('$MEMORY_DB', { readonly: true });
            const baseMs = $base_epoch_ms;

            // Export new conversations since base
            const newConvos = db.query(
                'SELECT * FROM conversations WHERE timestamp > ?'
            ).all(baseMs);

            // Export new semantic memories since base
            const newSemantic = db.query(
                'SELECT * FROM semantic WHERE created_at > ?'
            ).all(baseMs);

            const dump = {
                base_backup: '$base_timestamp',
                incremental_timestamp: '$timestamp',
                base_epoch_ms: baseMs,
                conversations: newConvos,
                semantic: newSemantic,
            };

            writeFileSync('$dest/memory_incremental.json', JSON.stringify(dump, null, 2));
            console.log('Exported ' + newConvos.length + ' new conversations, ' + newSemantic.length + ' new semantic memories');
            db.close();
        "
        log "Incremental memory export complete"
    fi

    if [[ -f "$EVENTS_DB" ]]; then
        # Events DB: just do a full snapshot since it's append-only and small
        backup_sqlite "$EVENTS_DB" "$dest/events.db"
        log "Snapshotted events.db ($(du -h "$dest/events.db" | cut -f1))"
    fi

    # Metadata
    cat > "$dest/manifest.json" <<MANIFEST
{
    "type": "incremental",
    "timestamp": "$timestamp",
    "base_backup": "$base_timestamp",
    "created_at": "$(date -Iseconds)",
    "hostname": "$(hostname)"
}
MANIFEST

    log "Incremental backup complete: $dest"

    # Prune old incrementals (keep last 168 = ~1 week of hourlies)
    local count
    count=$(ls -1d "$INCR_DIR"/*_incr_* 2>/dev/null | wc -l)
    if (( count > 168 )); then
        local to_remove=$((count - 168))
        ls -1d "$INCR_DIR"/*_incr_* | head -n "$to_remove" | while read -r old; do
            log "Pruning old incremental: $old"
            rm -rf "$old"
        done
    fi
}

cmd_list() {
    echo "=== Full Backups ==="
    if [[ -d "$FULL_DIR" ]]; then
        for d in "$FULL_DIR"/[0-9]*/; do
            [[ -d "$d" ]] || continue
            local ts
            ts=$(basename "$d")
            local size
            size=$(du -sh "$d" 2>/dev/null | cut -f1)
            echo "  $ts  ($size)"
        done
    else
        echo "  (none)"
    fi

    echo ""
    echo "=== Incremental Backups ==="
    if [[ -d "$INCR_DIR" ]]; then
        local count
        count=$(ls -1d "$INCR_DIR"/*_incr_* 2>/dev/null | wc -l)
        echo "  $count incremental backups"
        if (( count > 0 )); then
            echo "  Latest: $(ls -1d "$INCR_DIR"/*_incr_* 2>/dev/null | tail -1 | xargs basename)"
            echo "  Oldest: $(ls -1d "$INCR_DIR"/*_incr_* 2>/dev/null | head -1 | xargs basename)"
        fi
    else
        echo "  (none)"
    fi

    echo ""
    if [[ -L "$LATEST_LINK" ]]; then
        echo "Latest full: $(cd -P "$LATEST_LINK" && pwd | xargs basename)"
    fi
}

cmd_export() {
    local timestamp
    timestamp=$(date '+%Y%m%d_%H%M%S')
    local export_file="$BACKUP_DIR/sam-memory-export-${timestamp}.tar.gz"

    log "Creating portable export..."

    # First ensure we have a fresh full backup
    cmd_full

    # Create tarball with full + all incrementals since that full
    local latest_full
    latest_full=$(cd -P "$LATEST_LINK" && pwd)

    # Gather the export contents
    local tmpdir
    tmpdir=$(mktemp -d)
    cp -r "$latest_full" "$tmpdir/full"

    # Include incrementals based on the latest full
    local base_ts
    base_ts=$(basename "$latest_full")
    mkdir -p "$tmpdir/incremental"
    for inc in "$INCR_DIR"/${base_ts}_incr_*; do
        [[ -d "$inc" ]] && cp -r "$inc" "$tmpdir/incremental/"
    done

    # Include restore script
    cp "$(dirname "$0")/restore-memory.sh" "$tmpdir/" 2>/dev/null || true

    # Create tarball
    tar -czf "$export_file" -C "$tmpdir" .
    rm -rf "$tmpdir"

    log "Export ready: $export_file ($(du -h "$export_file" | cut -f1))"
    echo ""
    echo "To restore on a new system:"
    echo "  1. Copy $export_file to the new machine"
    echo "  2. Run: ./restore-memory.sh $export_file"
}

# Main
case "${1:-help}" in
    full)        cmd_full ;;
    incremental) cmd_incremental ;;
    list)        cmd_list ;;
    export)      cmd_export ;;
    help|*)
        echo "Usage: $(basename "$0") {full|incremental|list|export}"
        echo ""
        echo "  full          Create a full backup of all databases"
        echo "  incremental   Create incremental backup (new rows since last full)"
        echo "  list          List available backups"
        echo "  export        Create portable tarball for system migration"
        ;;
esac
