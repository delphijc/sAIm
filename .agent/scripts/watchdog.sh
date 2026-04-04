#!/bin/bash
# PAI Infrastructure Watchdog
# Monitors health of all PAI services and auto-restarts if needed
# Run via cron: */5 * * * * ~/.claude/scripts/watchdog.sh

set -e

PAI_DIR="${PAI_DIR:-$HOME/.claude}"
LOG_FILE="$PAI_DIR/logs/watchdog.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
}

# Check if port is listening
port_healthy() {
    local port=$1
    timeout 2 bash -c "echo >/dev/tcp/localhost/$port" 2>/dev/null && return 0 || return 1
}

# Check individual services
check_voice_server() {
    if ! port_healthy 8888; then
        log "⚠️  Voice Server (8888) DOWN - restarting..."
        systemctl --user restart voice-server.service 2>/dev/null || {
            log "❌ Failed to restart voice-server via systemd"
            return 1
        }
        log "✅ Voice Server restarted"
    fi
}

check_python_sidecar() {
    if ! port_healthy 8889; then
        log "⚠️  Python Sidecar (8889) DOWN - restarting..."
        systemctl --user restart python-sidecar.service 2>/dev/null || {
            log "❌ Failed to restart python-sidecar via systemd"
            return 1
        }
        log "✅ Python Sidecar restarted"
    fi
}

check_observability_backend() {
    if ! port_healthy 4000; then
        log "⚠️  Observability Backend (4000) DOWN - restarting..."
        systemctl --user restart observability-dashboard.service 2>/dev/null || {
            log "❌ Failed to restart observability-dashboard via systemd"
            return 1
        }
        log "✅ Observability Backend restarted"
    fi
}

check_observability_frontend() {
    if ! port_healthy 5172; then
        log "⚠️  Observability Frontend (5172) DOWN - restarting..."
        systemctl --user restart observability-dashboard.service 2>/dev/null || {
            log "❌ Failed to restart observability-dashboard via systemd"
            return 1
        }
        log "✅ Observability Frontend restarted"
    fi
}

check_discord_memory_server() {
    if ! port_healthy 4242; then
        log "⚠️  Discord Memory Server (4242) DOWN - restarting..."
        systemctl --user restart discord-remote-control.service 2>/dev/null || {
            log "❌ Failed to restart discord-remote-control via systemd"
            return 1
        }
        log "✅ Discord Memory Server restarted"
    fi
}

# Main watchdog loop
main() {
    log "🔍 Watchdog cycle started"

    check_voice_server
    check_python_sidecar
    check_observability_backend
    check_observability_frontend
    check_discord_memory_server

    log "✅ Watchdog cycle complete"
}

main "$@"
