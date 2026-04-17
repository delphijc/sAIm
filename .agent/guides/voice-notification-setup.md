# Voice Notification System Setup Guide

## Overview

Your PAI infrastructure has a complete voice notification system ready to use. This guide shows how to properly integrate audible responses for batch task completion and other operations.

---

## System Architecture

### Core Components

1. **Voice Server** (localhost:8888)
   - Receives HTTP POST requests with messages
   - Converts text to speech using configured voice provider
   - Supports rate control and voice toggling

2. **VoiceNotify Script** (`~/.claude/Tools/VoiceNotify`)
   - Simple bash wrapper for voice notifications
   - Fires requests in background (non-blocking)
   - Returns immediately to avoid hanging operations

3. **Health Check Hook** (`~/.claude/Hooks/voice-server-health-check.ts`)
   - Runs at session start
   - Verifies voice server is running on port 8888
   - Falls back to system notifications if unavailable

4. **Configuration** (`~/.claude/settings.json`)
   - Environment: `DA=Sam` (your assistant name)
   - Voice ID: `Jessica` (from CLAUDE.md)
   - Port: `8888`

---

## How to Trigger Voice Notifications

### Method 1: Direct VoiceNotify Script (Recommended for Quick Use)

```bash
~/.claude/Tools/VoiceNotify "Your message here"
```

**Parameters:**
- `$1` (required): Message text
- `$2` (optional): Speech rate in words per minute (default: 240)
- `$3` (optional): true/false for voice_enabled (default: true)

**Examples:**
```bash
# Simple notification
~/.claude/Tools/VoiceNotify "Transcription batch completed successfully"

# Custom speech rate
~/.claude/Tools/VoiceNotify "All files processed" 180

# Disable voice (system notification only)
~/.claude/Tools/VoiceNotify "Warning: low disk space" 240 false
```

### Method 2: Direct curl Command (For Integration into Scripts)

```bash
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"Your message","rate":240,"voice_enabled":true}' &
```

**Payload Format:**
```json
{
  "message": "Batch transcription complete: 6 files processed",
  "rate": 240,
  "voice_enabled": true
}
```

### Method 3: Background Helper Script

```bash
~/.claude/Tools/voice-notification-background.sh "Your message"
```

Similar to VoiceNotify but explicitly designed for background execution.

---

## Integration Patterns for Batch Task Completion

### Pattern 1: Simple Bash Function (Recommended)

Add this to a script that runs after batch operations:

```bash
#!/bin/bash

batch_notify() {
  local message="$1"
  local rate="${2:-240}"
  ~/.claude/Tools/VoiceNotify "$message" "$rate"
}

# Your batch transcription logic here...
# ... process files ...

# After completion:
batch_notify "Transcription batch completed: 6 files processed"
```

### Pattern 2: Integration with Task Completion

For use in your own monitoring script:

```bash
#!/bin/bash
# monitor-batch-jobs.sh

TASK_COUNT=6
COMPLETED=0
OUTPUT_DIR="$HOME/Projects/sam/.agent/history/TranscribedAudio"

while [ $COMPLETED -lt $TASK_COUNT ]; do
  COMPLETED=$(ls -1 "$OUTPUT_DIR"/202602*.md 2>/dev/null | wc -l)
  echo "Progress: $COMPLETED/$TASK_COUNT"
  sleep 2
done

# All done - notify with voice
~/.claude/Tools/VoiceNotify "All $TASK_COUNT files have been transcribed and organized"
```

### Pattern 3: Hook-Based Notification (Advanced)

Create a custom hook that triggers after batch operations. Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${PAI_DIR}/Hooks/batch-completion-notifier.ts"
          }
        ]
      }
    ]
  }
}
```

Then create `~/.claude/Hooks/batch-completion-notifier.ts`:

```typescript
#!/usr/bin/env bun
/**
 * Batch Completion Notifier
 * Triggers voice notifications when batch operations complete
 */

const BATCH_PATTERNS = [
  /Transcribe.*audio file/i,
  /completed.*files/i,
  /batch.*complete/i
];

async function notifyCompletion(message: string) {
  const payload = {
    message: message,
    rate: 240,
    voice_enabled: true
  };

  try {
    const response = await fetch('http://localhost:8888/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`Voice notification failed: ${response.status}`);
    }
  } catch (error) {
    // Silently fail - voice server might be down
    console.debug(`Voice notification unavailable: ${error}`);
  }
}

async function main() {
  const bashCommand = process.argv[2];

  // Check if command matches batch patterns
  for (const pattern of BATCH_PATTERNS) {
    if (pattern.test(bashCommand)) {
      await notifyCompletion(`Batch task completed: ${bashCommand}`);
      break;
    }
  }
}

main().catch(console.error);
```

---

## Current Implementation in Your Project

### Voice Configuration (CLAUDE.md)
```
voiceId: Jessica
model: sonnet
DA: Sam
```

### Voice Protocol
- **Rule**: Provide audible feedback after EVERY response
- **Endpoint**: `http://localhost:8888/notify`
- **Format**: JSON payload with message, rate, voice_enabled

### Session Startup
The voice server health check runs automatically at session start:
```bash
~/.claude/Hooks/voice-server-health-check.ts
```

---

## For Your Transcription Workflow

### Quick Implementation

After running transcribe-audio on multiple files, add:

```bash
# After all transcriptions complete:
~/.claude/Tools/VoiceNotify "Batch transcription complete. 6 files processed and organized in History"
```

### Enhanced Implementation

Create `~/.claude/scripts/batch-transcribe-notify.sh`:

```bash
#!/bin/bash
# Batch transcribe with voice notification

set -e

RECORDINGS_DIR="$1"
AUDIO_FILES=("$RECORDINGS_DIR"/202602*.m4a)

echo "Starting batch transcription of ${#AUDIO_FILES[@]} files..."

for file in "${AUDIO_FILES[@]}"; do
  echo "Transcribing: $(basename "$file")"
  /usr/bin/python3 ~/.claude/skills/transcribe-audio/tools/Transcribe.py "$file"
done

# Notify completion
~/.claude/Tools/VoiceNotify "Batch transcription complete. ${#AUDIO_FILES[@]} files processed and organized"

echo "All done!"
```

Usage:
```bash
chmod +x ~/.claude/scripts/batch-transcribe-notify.sh
~/.claude/scripts/batch-transcribe-notify.sh $HOME/Projects/sam/.agent/history/Recordings
```

---

## Troubleshooting

### Voice Notifications Not Working

**Check 1: Voice Server Running**
```bash
curl http://localhost:8888/health
```

Expected response:
```json
{"status":"healthy","primary_provider":"chatterbox"}
```

**Check 2: Start Services**
```
/start-up
```

**Check 3: Verify VoiceNotify Script**
```bash
~/.claude/Tools/VoiceNotify "Test message"
# Should hear audio within 2 seconds
```

### Message Not Heard But No Errors

- Check speaker volume
- Check speech rate is reasonable (180-300 WPM)
- Verify `voice_enabled: true` in payload
- Check system notification permissions (macOS)

### Integration with Async Bash Tasks

For background bash tasks, wrap notification in another background task:

```bash
# Start long-running task in background
(
  /usr/bin/python3 /path/to/script.py &
  TASK_PID=$!

  # Wait for completion
  wait $TASK_PID

  # Notify when done
  ~/.claude/Tools/VoiceNotify "Background task completed successfully"
) &
```

---

## Best Practices

1. **Keep Messages Concise** - Under 20 words for best TTS quality
2. **Use Unique Messages** - Makes it easier to distinguish different operations
3. **Set Appropriate Rates** - 180-240 WPM is standard; use 150 for clarity
4. **Non-Blocking Execution** - All notifications run in background (VoiceNotify handles this)
5. **Graceful Fallback** - If voice server is down, system notifications still work
6. **Meaningful Context** - Include operation type and count (e.g., "6 files transcribed")

---

## Example Messages for Common Tasks

```bash
# Batch transcription
~/.claude/Tools/VoiceNotify "Batch transcription complete: 6 files processed"

# Deployment
~/.claude/Tools/VoiceNotify "Deployment finished: all services healthy"

# Testing suite
~/.claude/Tools/VoiceNotify "Test suite passed: 98 tests, 2.3 seconds"

# Data sync
~/.claude/Tools/VoiceNotify "Data synchronization complete: 1,200 records synced"

# Build complete
~/.claude/Tools/VoiceNotify "Build successful: bundled 450 kilobytes"
```

---

## Next Steps

1. **Test the System**
   ```bash
   ~/.claude/Tools/VoiceNotify "Testing voice notification system"
   ```

2. **Verify It Works**
   - You should hear "Testing voice notification system" spoken
   - Check both speaker output and system notification

3. **Integrate into Your Workflow**
   - Add notifications to your batch processing scripts
   - Create aliases for common operations

4. **Customize as Needed**
   - Adjust speech rate for preference
   - Create wrapper functions for your domain

---

**Status**: ✅ Ready to use | Voice server configured on localhost:8888 | All utilities available

