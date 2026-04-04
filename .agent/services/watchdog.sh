#!/bin/bash

# PAI Watchdog - Monitors and recovers failed services
# Run via cron: */5 * * * * $HOME/.claude/services/watchdog.sh

LOG_FILE="/tmp/pai-watchdog.log"
LOCK_FILE="/tmp/pai-watchdog.lock"

# Prevent concurrent runs
if [ -f "$LOCK_FILE" ] && [ $(($(date +%s) - $(stat -c%Y "$LOCK_FILE"))) -lt 30 ]; then
  exit 0
fi
touch "$LOCK_FILE"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_service() {
  local service=$1
  local endpoint=$2

  if systemctl is-active --quiet $service; then
    # Service running, verify endpoint
    if curl -s --max-time 5 "$endpoint" > /dev/null 2>&1; then
      return 0  # Healthy
    else
      log "⚠️  $service running but endpoint unresponsive: $endpoint"
      return 1  # Service stuck
    fi
  else
    log "❌ $service is not running"
    return 1
  fi
}

restart_service() {
  local service=$1
  log "🔄 Attempting restart of $service"

  systemctl restart "$service"
  sleep 5

  if systemctl is-active --quiet "$service"; then
    log "✅ $service restarted successfully"
    return 0
  else
    log "❌ Failed to restart $service"
    return 1
  fi
}

# Check services
check_service "pai-voice-server" "http://localhost:8888/health" || restart_service "pai-voice-server"
check_service "pai-discord" "http://localhost:4000" || restart_service "pai-discord"
check_service "pai-observability" "http://localhost:5172" || restart_service "pai-observability"

# Cleanup old logs (keep last 7 days)
find /tmp/pai-*.log -mtime +7 -delete 2>/dev/null

rm -f "$LOCK_FILE"
