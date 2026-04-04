#!/usr/bin/env bash
#
# Install systemd user timers for Sam memory backups.
# Hourly incremental + weekly full backups.
#
# Usage:
#   install-backup-timers.sh          # Install and enable timers
#   install-backup-timers.sh remove   # Remove timers
#   install-backup-timers.sh status   # Show timer status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"

install_timers() {
    mkdir -p "$UNIT_DIR"

    # --- Full backup (weekly, Sunday 3am) ---
    cat > "$UNIT_DIR/sam-memory-backup-full.service" <<EOF
[Unit]
Description=Sam Memory Full Backup

[Service]
Type=oneshot
ExecStart=$SCRIPT_DIR/backup-memory.sh full
Environment=PAI_DIR=$HOME/Projects/sam
EOF

    cat > "$UNIT_DIR/sam-memory-backup-full.timer" <<EOF
[Unit]
Description=Weekly full backup of Sam memory databases

[Timer]
OnCalendar=Sun *-*-* 03:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
EOF

    # --- Incremental backup (hourly) ---
    cat > "$UNIT_DIR/sam-memory-backup-incr.service" <<EOF
[Unit]
Description=Sam Memory Incremental Backup

[Service]
Type=oneshot
ExecStart=$SCRIPT_DIR/backup-memory.sh incremental
Environment=PAI_DIR=$HOME/Projects/sam
EOF

    cat > "$UNIT_DIR/sam-memory-backup-incr.timer" <<EOF
[Unit]
Description=Hourly incremental backup of Sam memory databases

[Timer]
OnCalendar=*-*-* *:15:00
Persistent=true
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
EOF

    # Enable and start
    systemctl --user daemon-reload
    systemctl --user enable --now sam-memory-backup-full.timer
    systemctl --user enable --now sam-memory-backup-incr.timer

    echo "Timers installed and enabled."
    echo ""
    systemctl --user list-timers 'sam-memory-*'
}

remove_timers() {
    systemctl --user disable --now sam-memory-backup-full.timer 2>/dev/null || true
    systemctl --user disable --now sam-memory-backup-incr.timer 2>/dev/null || true
    rm -f "$UNIT_DIR"/sam-memory-backup-*.{service,timer}
    systemctl --user daemon-reload
    echo "Timers removed."
}

show_status() {
    echo "=== Timer Status ==="
    systemctl --user list-timers 'sam-memory-*' 2>/dev/null || echo "No timers found"
    echo ""
    echo "=== Recent Runs ==="
    journalctl --user -u sam-memory-backup-full.service --no-pager -n 5 2>/dev/null || true
    journalctl --user -u sam-memory-backup-incr.service --no-pager -n 5 2>/dev/null || true
}

case "${1:-install}" in
    install)  install_timers ;;
    remove)   remove_timers ;;
    status)   show_status ;;
    *)
        echo "Usage: $(basename "$0") {install|remove|status}"
        ;;
esac
