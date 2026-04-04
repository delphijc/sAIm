#!/bin/bash
# Background Voice Notification Helper
# This script demonstrates how to send voice notifications as background tasks
# Usage: Pass message as argument
# Example: ~/.claude/Tools/voice-notification-background.sh "Task completed successfully"

MESSAGE="${1:?Message required}"
RATE="${2:-240}"

# Send notification to voice server in background (non-blocking)
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"'"${MESSAGE}"'","rate":'"${RATE}"',"voice_enabled":true}' \
  >/dev/null 2>&1 &

exit 0
