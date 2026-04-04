#!/bin/bash

# Discord Remote Control Service - Start Script
# Starts the Discord bot service in background, writes PID to .pid file

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$SCRIPT_DIR/../service"
PID_FILE="$SCRIPT_DIR/.service.pid"
LOG_FILE="$SCRIPT_DIR/../service.log"

# Check if service is already running
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "✅ Discord service already running (PID: $OLD_PID)"
    exit 0
  else
    # Stale PID file, remove it
    rm "$PID_FILE"
  fi
fi

# Check if required environment variables are set
if [ -z "$PAI_DIR" ]; then
  echo "❌ Error: PAI_DIR environment variable not set"
  exit 1
fi

if [ ! -f "$PAI_DIR/.env" ]; then
  echo "❌ Error: $PAI_DIR/.env not found"
  echo "   Please create .env file with required Discord configuration"
  exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "$SERVICE_DIR/node_modules" ]; then
  echo "📦 Installing dependencies..."
  cd "$SERVICE_DIR"
  bun install
  cd -
fi

# Load environment variables
set -a
source "$PAI_DIR/.env"
set +a

# Start service in background
echo "🚀 Starting Discord Remote Control Service..."
cd "$SERVICE_DIR"
nohup bun index.ts > "$LOG_FILE" 2>&1 &
SERVICE_PID=$!

# Write PID file
echo "$SERVICE_PID" > "$PID_FILE"

# Give it a moment to start and check if it's still running
sleep 1
if ! kill -0 "$SERVICE_PID" 2>/dev/null; then
  echo "❌ Failed to start service"
  echo "   See log: $LOG_FILE"
  rm "$PID_FILE"
  exit 1
fi

echo "✅ Service started (PID: $SERVICE_PID)"
echo "📋 Log file: $LOG_FILE"
echo "   View logs: tail -f $LOG_FILE"
