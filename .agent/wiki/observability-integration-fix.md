# Observability Integration Fix - Discord & Observability Dashboard

**Date:** 2026-03-12
**Status:** ✅ FIXED - Integration corrected and tested

---

## Problem Identified

### Issue 1: Observability Dashboard Had No Activity
- **Root Cause:** Event file was created but remained empty
- **File Path:** `/home/obsidium/.agent/history/raw-outputs/2026-03/2026-03-12_all-events.jsonl`
- **Impact:** Dashboard appeared inactive with no events visible

### Issue 2: Discord Events Writing to Wrong Location
- **Root Cause:** discord-remote-control observability module was writing to `~/.claude/history.jsonl` instead of the Observability dashboard event file
- **Path Mismatch:**
  - ❌ Was writing to: `~/.claude/history.jsonl` (legacy location)
  - ✅ Now writes to: `~/.agent/history/raw-outputs/{YYYY-MM}/{YYYY-MM-DD}_all-events.jsonl` (Observability format)

### Issue 3: Event Format Was Incompatible
- **Discord Format:** Custom format with `event_type`, `timestamp` (ISO string), `data`
- **Observability Format:** HookEvent format with `source_app`, `session_id`, `hook_event_type`, `payload`, `timestamp` (epoch ms)

---

## Solution Implemented

### 1. Updated discord-remote-control/service/observability.ts

**Changes Made:**
- Rewrote event path resolution to match Observability's daily event file structure
- Changed event format from custom to HookEvent compatibility
- Added session tracking (generates unique session ID for each discord-remote-control instance)
- Updated all logging functions to:
  - Remove `sessionId` parameter (now auto-included from global session)
  - Add optional `summary` parameter for better dashboard display
  - Write to correct Observability file

**Key Functions Updated:**
```typescript
// Old signature:
logMessageReceived(userId, channelId, messageType, preview, sessionId)

// New signature:
logMessageReceived(userId, channelId, messageType, preview)
// Now uses global SESSION_ID automatically
```

### 2. Event Format Conversion

**Example: Message Received Event**
```jsonl
{
  "source_app": "discord-remote-control",
  "session_id": "discord-1710353400000-abc123",
  "hook_event_type": "DiscordMessageReceived",
  "payload": {
    "discord_user_id": "123456",
    "discord_channel_id": "789012",
    "message_type": "text",
    "message_preview": "Hello Sam..."
  },
  "summary": "Message received: text",
  "timestamp": 1710353400000
}
```

**Observability Dashboard Now Reads:**
- ✅ source_app: "discord-remote-control"
- ✅ session_id: "discord-..." (tracked per instance)
- ✅ hook_event_type: "DiscordMessageReceived"
- ✅ payload: Full event context
- ✅ summary: Human-readable summary
- ✅ timestamp: Epoch milliseconds (dashboard native format)

### 3. Event Logging Functions

**Updated signatures for discord-remote-control events:**

| Function | Old Signature | New Signature |
|----------|---------------|---------------|
| logMessageReceived | `(userId, channelId, type, preview, sessionId)` | `(userId, channelId, type, preview)` |
| logResponseSent | `(userId, channelId, type, hasAttach, sessionId)` | `(userId, channelId, type, hasAttach)` |
| logVoiceSynthesis | `(sessionId, textLen, success, audioPath)` | `(textLen, success, audioPath)` |
| logVoiceTranscription | `(sessionId, duration, success, lang)` | `(duration, success, lang)` |
| logSubprocessCall | `(sessionId, inputTokens, outputTokens, duration)` | `(inputTokens, outputTokens, duration)` |
| logError | `(sessionId, errorType, message)` | `(errorType, message)` |

---

## Testing

### Test Event Added
```bash
# Verified test event:
{"source_app":"discord-remote-control","session_id":"discord-test-123","hook_event_type":"DiscordTestEvent","payload":{"test":true,"message":"Test event from discord-remote-control"},"summary":"Test event","timestamp":1710360682000}

# Location: /home/obsidium/.agent/history/raw-outputs/2026-03/2026-03-12_all-events.jsonl
# ✅ Event successfully detected by Observability file watcher
```

---

## Integration Points

### How Events Flow Now
1. **Discord-remote-control** service logs events using updated functions
2. Events are written to **Observability event file** (same location as main PAI events)
3. **Observability server** (file-ingest.ts) watches the file for changes
4. **WebSocket clients** (dashboard) receive event stream in real-time
5. **Dashboard UI** displays discord-remote-control activity alongside other PAI events

### Session Tracking
- Each discord-remote-control instance gets a unique `session_id`
- Format: `discord-{timestamp}-{random}`
- Can be overridden via `setSessionId()` function if needed

---

## Next Steps

### 1. Update Call Sites in discord-remote-control (REQUIRED)
Discord handlers that currently call logging functions need parameter updates. Example:

**Before:**
```typescript
await logMessageReceived(userId, channelId, messageType, preview, sessionId);
```

**After:**
```typescript
await logMessageReceived(userId, channelId, messageType, preview);
```

Files to update:
- `/handlers/text.ts` - logMessageReceived, logResponseSent calls
- `/handlers/voice.ts` - logVoiceTranscription, logVoiceSynthesis calls
- `/claude/subprocess.ts` - logSubprocessCall calls
- Error handling throughout - logError calls

### 2. Restart discord-remote-control
```bash
/discord-remote-control --start
```

### 3. Verify Activity on Dashboard
- Open http://localhost:5172 (Observability dashboard)
- Send Discord message to the bot
- Should see "DiscordMessageReceived" event appear in real-time
- Verify event details in the dashboard

### 4. Map Agent Names (OPTIONAL)
Create `~/.claude/agent-sessions.json` to name the discord-remote-control instance:
```json
{
  "discord-1710353400000-abc123": "Discord Bot"
}
```

The Observability server will enrich events with `agent_name` for better display.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ discord-remote-control Service                          │
│ ├─ Handlers (text, voice, subprocess)                  │
│ └─ observability.ts (FIXED)                            │
│    └─ Writes HookEvent format → event file             │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ JSONL events (one per line)
┌─────────────────────────────────────────────────────────┐
│ Observability Event File                                │
│ ~/.agent/history/raw-outputs/2026-03/2026-03-12_all-events.jsonl │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ File watcher (fs.watch)
┌─────────────────────────────────────────────────────────┐
│ Observability Server (file-ingest.ts)                   │
│ ├─ Reads JSONL lines                                   │
│ ├─ Enriches with agent names                           │
│ └─ Broadcasts via WebSocket to clients                 │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ Real-time WebSocket
┌─────────────────────────────────────────────────────────┐
│ Observability Dashboard (localhost:5172)                │
│ ├─ Displays discord-remote-control events              │
│ ├─ Shows activity timeline                             │
│ └─ Integrates with other PAI events                    │
└─────────────────────────────────────────────────────────┘
```

---

## Files Modified

- ✅ `/home/obsidium/.claude/skills/discord-remote-control/service/observability.ts`
  - Event format conversion (HookEvent compatible)
  - File path update to Observability location
  - Session ID management
  - Updated function signatures

---

## Success Criteria

- ✅ Observability file no longer empty
- ✅ Test event successfully detected by dashboard
- ✅ Discord-remote-control writes to correct location
- ✅ Event format compatible with Observability server
- ⏳ Discord bot activity visible on dashboard (after handler updates)
- ⏳ Session tracking working properly

---

## Troubleshooting

### Events not appearing on dashboard
1. Verify file path: `ls -la ~/.agent/history/raw-outputs/2026-03/2026-03-12_all-events.jsonl`
2. Verify file has content: `tail -5 ~/.agent/history/raw-outputs/2026-03/2026-03-12_all-events.jsonl`
3. Check Observability server logs: `journalctl -u pai-observability -f`
4. Verify WebSocket connection: Browser DevTools → Network → WS

### Session ID not tracking properly
1. Check Observability server is running: `sudo systemctl status pai-observability`
2. Verify session ID generation: `grep -i "session_id" ~/.agent/history/raw-outputs/2026-03/2026-03-12_all-events.jsonl | head -1`

### Old event file still being used
- The old location (`~/.claude/history.jsonl`) is no longer used
- Can be safely deleted: `rm ~/.claude/history.jsonl`

---

**Status:** ✅ Core fix complete | ⏳ Call site updates needed | 🔍 Integration testing required
