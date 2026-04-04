#!/bin/bash

# Discord Remote Control Service - Stop Script
# Stops the Discord bot service and removes PID file

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.service.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "ℹ️  Service is not running"
  exit 0
fi

PID=$(cat "$PID_FILE")

# Check if process is still running
if ! kill -0 "$PID" 2>/dev/null; then
  echo "⚠️  Service not running (stale PID: $PID)"
  rm "$PID_FILE"
  exit 0
fi

# Kill the process
echo "🛑 Stopping Discord service (PID: $PID)..."
kill "$PID"

# Wait for graceful shutdown
for i in {1..30}; do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm "$PID_FILE"
    echo "✅ Service stopped"
    exit 0
  fi
  sleep 0.1
done

# Force kill if still running
echo "⚠️  Service didn't stop gracefully, force killing..."
kill -9 "$PID"
rm "$PID_FILE"
echo "✅ Service force stopped"
