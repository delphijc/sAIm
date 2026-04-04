#!/usr/bin/env bash
#
# Install launchd agents for Sam memory backups (macOS).
# Hourly incremental + daily full backups at 3am.
#
# Usage:
#   install-backup-launchd.sh install   # Install and load agents (default)
#   install-backup-launchd.sh remove    # Unload and remove plists
#   install-backup-launchd.sh status    # Show agent status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_FILE="$HOME/Library/Logs/sam-backup.log"

HOURLY_LABEL="com.sam.memory-backup-hourly"
DAILY_LABEL="com.sam.memory-backup-daily"

HOURLY_PLIST="$LAUNCH_AGENTS_DIR/${HOURLY_LABEL}.plist"
DAILY_PLIST="$LAUNCH_AGENTS_DIR/${DAILY_LABEL}.plist"

install_agents() {
    mkdir -p "$LAUNCH_AGENTS_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"

    # --- Hourly incremental backup ---
    cat > "$HOURLY_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${HOURLY_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${SCRIPT_DIR}/backup-memory.sh</string>
        <string>incremental</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${LOG_FILE}</string>
    <key>StandardErrorPath</key>
    <string>${LOG_FILE}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF

    # --- Daily full backup at 3am ---
    cat > "$DAILY_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${DAILY_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${SCRIPT_DIR}/backup-memory.sh</string>
        <string>full</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>3</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${LOG_FILE}</string>
    <key>StandardErrorPath</key>
    <string>${LOG_FILE}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF

    # Load agents (unload first in case they were already loaded)
    launchctl unload "$HOURLY_PLIST" 2>/dev/null || true
    launchctl unload "$DAILY_PLIST" 2>/dev/null || true

    launchctl load "$HOURLY_PLIST"
    launchctl load "$DAILY_PLIST"

    echo "Installed and loaded launchd agents:"
    echo "  ${HOURLY_LABEL}  (every hour)"
    echo "  ${DAILY_LABEL}   (daily at 3am)"
    echo ""
    echo "Logs: $LOG_FILE"
}

remove_agents() {
    launchctl unload "$HOURLY_PLIST" 2>/dev/null || true
    launchctl unload "$DAILY_PLIST" 2>/dev/null || true
    rm -f "$HOURLY_PLIST" "$DAILY_PLIST"
    echo "Removed launchd agents."
}

show_status() {
    echo "=== Launchd Agent Status ==="
    echo ""
    for label in "$HOURLY_LABEL" "$DAILY_LABEL"; do
        echo "--- $label ---"
        launchctl list "$label" 2>/dev/null || echo "  (not loaded)"
        echo ""
    done

    echo "=== Plist Files ==="
    for plist in "$HOURLY_PLIST" "$DAILY_PLIST"; do
        if [[ -f "$plist" ]]; then
            echo "  EXISTS: $plist"
        else
            echo "  MISSING: $plist"
        fi
    done

    echo ""
    echo "=== Recent Log Entries ==="
    if [[ -f "$LOG_FILE" ]]; then
        tail -20 "$LOG_FILE"
    else
        echo "  (no log file yet at $LOG_FILE)"
    fi
}

case "${1:-install}" in
    install)  install_agents ;;
    remove)   remove_agents ;;
    status)   show_status ;;
    *)
        echo "Usage: $(basename "$0") {install|remove|status}"
        ;;
esac
