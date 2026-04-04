#!/bin/bash

# Discord Remote Control Service - Status Script
# Checks if service is running and shows basic health info

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.service.pid"
LOG_FILE="$SCRIPT_DIR/../service.log"

echo "📊 Discord Remote Control Service Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f "$PID_FILE" ]; then
  echo "Status: ❌ NOT RUNNING (no PID file)"
  exit 1
fi

PID=$(cat "$PID_FILE")

if kill -0 "$PID" 2>/dev/null; then
  echo "Status: ✅ RUNNING"
  echo "PID:    $PID"

  # Show process info
  if command -v ps &>/dev/null; then
    echo ""
    ps -o pid,vsz,rss,etime,comm= -p "$PID"
  fi

  # Show recent log entries
  if [ -f "$LOG_FILE" ]; then
    echo ""
    echo "Recent logs (last 10 lines):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    tail -10 "$LOG_FILE"
  fi
else
  echo "Status: ⚠️  NOT RUNNING (stale PID: $PID)"
  echo ""
  echo "To clean up, run: rm $PID_FILE"
  exit 1
fi
