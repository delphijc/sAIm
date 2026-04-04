#!/bin/bash
# Start Memory Service
# Launches the Muninn cognitive memory HTTP server on port 4242

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && git rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR")"

# Configuration
PORT=4242
LOG_FILE="/tmp/pai-memory-service.log"
TIMEOUT=30

# Ensure PAI_DIR is set (load from .env if needed)
if [ -z "$PAI_DIR" ]; then
  ENV_FILE="$PROJECT_ROOT/.env"
  if [ -f "$ENV_FILE" ]; then
    export PAI_DIR=$(grep '^PAI_DIR=' "$ENV_FILE" | cut -d= -f2)
  fi
fi

if [ -z "$PAI_DIR" ]; then
  echo "❌ PAI_DIR not set and not found in .env"
  exit 1
fi

echo "🧠 Starting SAM Memory Service..."
echo "  Location: $SCRIPT_DIR"
echo "  PAI_DIR: $PAI_DIR"
echo "  Port: $PORT"
echo "  Log: $LOG_FILE"

# Start the memory service in background
cd "$SCRIPT_DIR"
PAI_DIR="$PAI_DIR" nohup bun run index.ts --memory-only > "$LOG_FILE" 2>&1 &
MEMORY_PID=$!

echo "  PID: $MEMORY_PID"

# Wait for service to be ready (max TIMEOUT seconds)
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if timeout 0.5 curl -s http://localhost:$PORT/memory/health > /dev/null 2>&1; then
    echo "✅ Memory service started successfully on port $PORT"
    exit 0
  fi

  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

# Timeout - check if process is still alive
if ! kill -0 $MEMORY_PID 2>/dev/null; then
  echo "❌ Memory service failed to start. Check log:"
  tail -20 "$LOG_FILE"
  exit 1
fi

echo "⚠️  Memory service started (PID $MEMORY_PID) but health check timed out"
echo "    This may be normal on slow systems. Check: curl http://localhost:$PORT/memory/health"
exit 0
