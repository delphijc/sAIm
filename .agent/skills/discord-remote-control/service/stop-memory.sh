#!/bin/bash
# Stop Memory Service
# Gracefully shuts down the Muninn cognitive memory HTTP server

PORT=4242
LOG_FILE="/tmp/pai-memory-service.log"

echo "🛑 Stopping Memory Service..."

# Find process listening on port 4242
PID=$(lsof -i :$PORT -t 2>/dev/null | head -1)

if [ -z "$PID" ]; then
  echo "  Port $PORT is not in use"
  exit 0
fi

echo "  PID: $PID"
echo "  Sending SIGTERM..."

# Graceful shutdown
kill -TERM $PID 2>/dev/null || true

# Wait up to 5 seconds for graceful shutdown
for i in {1..5}; do
  if ! kill -0 $PID 2>/dev/null; then
    echo "✓ Memory service stopped gracefully"
    exit 0
  fi
  sleep 1
done

# Force kill if still running
echo "  Sending SIGKILL..."
kill -KILL $PID 2>/dev/null || true

if ! kill -0 $PID 2>/dev/null; then
  echo "✓ Memory service stopped"
else
  echo "⚠️  Memory service may still be running"
fi

exit 0
