#!/usr/bin/env bash
#
# Sam Memory Restore System
# Restores SQLite databases from full + incremental backups.
#
# Usage:
#   restore-memory.sh <export-tarball>              # Restore from portable export
#   restore-memory.sh --from-backup <backup-dir>    # Restore from a specific full backup dir
#   restore-memory.sh --dry-run <export-tarball>     # Preview what would be restored
#
# Environment:
#   PAI_DIR         - Target PAI root directory (default: ~/Projects/sam)

set -euo pipefail

PAI_DIR="${PAI_DIR:-$HOME/Projects/sam}"
MEMORY_DB="$HOME/.claude/discord-remote-control/memory.db"
EVENTS_DB="$PAI_DIR/.agent/hook-events/events.db"
DRY_RUN=false

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
err() { log "ERROR: $*" >&2; }

restore_full() {
    local src_dir="$1"

    if [[ ! -f "$src_dir/manifest.json" ]]; then
        err "No manifest.json found in $src_dir"
        return 1
    fi

    log "Manifest:"
    cat "$src_dir/manifest.json"
    echo ""

    # Restore memory.db
    if [[ -f "$src_dir/memory.db" ]]; then
        if $DRY_RUN; then
            log "[DRY RUN] Would restore memory.db ($(du -h "$src_dir/memory.db" | cut -f1)) -> $MEMORY_DB"
        else
            mkdir -p "$(dirname "$MEMORY_DB")"

            # Safety: backup current DB before overwriting
            if [[ -f "$MEMORY_DB" ]]; then
                local backup_name="${MEMORY_DB}.pre-restore.$(date '+%Y%m%d_%H%M%S')"
                cp "$MEMORY_DB" "$backup_name"
                # Also checkpoint WAL into main db before backup
                if command -v sqlite3 &>/dev/null; then
                    sqlite3 "$MEMORY_DB" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
                fi
                log "Current DB backed up to: $backup_name"
            fi

            cp "$src_dir/memory.db" "$MEMORY_DB"
            # Remove stale WAL/SHM files (they belong to the old DB)
            rm -f "${MEMORY_DB}-wal" "${MEMORY_DB}-shm"
            chmod 0600 "$MEMORY_DB"
            log "Restored memory.db ($(du -h "$MEMORY_DB" | cut -f1))"
        fi
    fi

    # Restore events.db
    if [[ -f "$src_dir/events.db" ]]; then
        if $DRY_RUN; then
            log "[DRY RUN] Would restore events.db ($(du -h "$src_dir/events.db" | cut -f1)) -> $EVENTS_DB"
        else
            mkdir -p "$(dirname "$EVENTS_DB")"

            if [[ -f "$EVENTS_DB" ]]; then
                local backup_name="${EVENTS_DB}.pre-restore.$(date '+%Y%m%d_%H%M%S')"
                cp "$EVENTS_DB" "$backup_name"
                log "Current events DB backed up to: $backup_name"
            fi

            cp "$src_dir/events.db" "$EVENTS_DB"
            chmod 0600 "$EVENTS_DB"
            log "Restored events.db ($(du -h "$EVENTS_DB" | cut -f1))"
        fi
    fi
}

replay_incrementals() {
    local incr_dir="$1"

    if [[ ! -d "$incr_dir" ]] || [[ -z "$(ls -A "$incr_dir" 2>/dev/null)" ]]; then
        log "No incremental backups to replay"
        return 0
    fi

    local count=0
    for inc in "$incr_dir"/*/; do
        [[ -d "$inc" ]] || continue
        local json_file="$inc/memory_incremental.json"

        if [[ ! -f "$json_file" ]]; then
            continue
        fi

        if $DRY_RUN; then
            log "[DRY RUN] Would replay: $(basename "$inc")"
            bun -e "
                const data = JSON.parse(require('fs').readFileSync('$json_file', 'utf8'));
                console.log('  Conversations: ' + data.conversations.length);
                console.log('  Semantic: ' + data.semantic.length);
            "
        else
            log "Replaying incremental: $(basename "$inc")"
            bun -e "
                import { Database } from 'bun:sqlite';
                import { readFileSync } from 'fs';

                const db = new Database('$MEMORY_DB');
                const data = JSON.parse(readFileSync('$json_file', 'utf8'));

                // Replay conversations with INSERT OR IGNORE (idempotent by id)
                const convStmt = db.prepare(
                    'INSERT OR IGNORE INTO conversations (id, session_id, discord_user_id, discord_channel_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                );

                for (const c of data.conversations) {
                    convStmt.run(
                        c.id, c.session_id, c.discord_user_id, c.discord_channel_id,
                        c.role, c.content, c.timestamp, c.metadata || '{}'
                    );
                }

                // Replay semantic memories
                const semStmt = db.prepare(
                    'INSERT OR IGNORE INTO semantic (id, session_id, topic, summary, relevance_score, created_at, source_message_ids) VALUES (?, ?, ?, ?, ?, ?, ?)'
                );

                for (const s of data.semantic) {
                    semStmt.run(
                        s.id, s.session_id, s.topic, s.summary,
                        s.relevance_score, s.created_at, s.source_message_ids || '[]'
                    );
                }

                console.log('  Replayed ' + data.conversations.length + ' conversations, ' + data.semantic.length + ' semantic');
                db.close();
            "
        fi
        count=$((count + 1))
    done

    log "Replayed $count incremental backup(s)"
}

cmd_from_tarball() {
    local tarball="$1"

    if [[ ! -f "$tarball" ]]; then
        err "File not found: $tarball"
        exit 1
    fi

    log "Restoring from export: $tarball"

    local tmpdir
    tmpdir=$(mktemp -d)
    trap 'rm -rf "$tmpdir"' EXIT

    tar -xzf "$tarball" -C "$tmpdir"

    # Restore full backup
    if [[ -d "$tmpdir/full" ]]; then
        restore_full "$tmpdir/full"
    else
        err "No full backup found in tarball"
        exit 1
    fi

    # Replay incrementals
    if [[ -d "$tmpdir/incremental" ]]; then
        replay_incrementals "$tmpdir/incremental"
    fi

    if ! $DRY_RUN; then
        # Verify restored databases
        log ""
        log "=== Verification ==="
        bun -e "
            import { Database } from 'bun:sqlite';

            const memDb = new Database('$MEMORY_DB', { readonly: true });
            const convCount = memDb.query('SELECT COUNT(*) as n FROM conversations').get();
            const semCount = memDb.query('SELECT COUNT(*) as n FROM semantic').get();
            console.log('memory.db:');
            console.log('  Conversations: ' + convCount.n);
            console.log('  Semantic memories: ' + semCount.n);
            memDb.close();
        " 2>/dev/null || log "WARN: Could not verify memory.db"

        if [[ -f "$EVENTS_DB" ]]; then
            log "events.db: $(du -h "$EVENTS_DB" | cut -f1)"
        fi
    fi

    log ""
    log "Restore complete!"
}

cmd_from_backup() {
    local backup_dir="$1"

    if [[ ! -d "$backup_dir" ]]; then
        err "Directory not found: $backup_dir"
        exit 1
    fi

    restore_full "$backup_dir"
    log "Restore complete!"
}

# Main
case "${1:-help}" in
    --dry-run)
        DRY_RUN=true
        shift
        cmd_from_tarball "$1"
        ;;
    --from-backup)
        shift
        cmd_from_backup "$1"
        ;;
    help|-h|--help)
        echo "Usage:"
        echo "  $(basename "$0") <export-tarball>              Restore from portable export"
        echo "  $(basename "$0") --from-backup <backup-dir>    Restore from a specific full backup"
        echo "  $(basename "$0") --dry-run <export-tarball>     Preview what would be restored"
        echo ""
        echo "Environment:"
        echo "  PAI_DIR  - Target PAI root (default: ~/Projects/sam)"
        ;;
    *)
        cmd_from_tarball "$1"
        ;;
esac
