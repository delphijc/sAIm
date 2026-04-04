#!/bin/bash
#
# Batch Completion Notifier
# Provides audible voice notification when batch tasks complete
#
# Usage:
#   notify-batch-complete "Task description" [file_count] [rate]
#
# Examples:
#   notify-batch-complete "Transcription batch" 6
#   notify-batch-complete "File sync" 1200 180
#   notify-batch-complete "Test suite" 98
#

DESCRIPTION="${1:?Task description required. Usage: notify-batch-complete \"description\" [count] [rate]}"
COUNT="${2:-}"
RATE="${3:-240}"

# Build message
if [ -n "$COUNT" ]; then
  MESSAGE="$DESCRIPTION complete: $COUNT items processed"
else
  MESSAGE="$DESCRIPTION complete"
fi

# Send voice notification
~/.claude/Tools/VoiceNotify "$MESSAGE" "$RATE"

# Exit with success
exit 0
