# Claude Code Hooks System

**Last Updated:** February 7, 2026
**Status:** ✅ Fully Configured & Documented

## Table of Contents

1. [Overview](#overview)
2. [Hook Architecture](#hook-architecture)
3. [Core Hooks](#core-hooks)
4. [Voice System](#voice-system)
5. [Voice Reference Files](#voice-reference-files)
6. [Configuration](#configuration)
7. [Notification Flow](#notification-flow)
8. [Voice Server Integration](#voice-server-integration)
9. [Troubleshooting](#troubleshooting)
10. [Recent Improvements (Feb 2026)](#recent-improvements-feb-2026)

---

## Overview

Claude Code hooks are shell scripts/executables that respond to session events (start, stop, compression, etc.). The SAM project uses hooks for:

- **Notifications** - Audible voice + visual feedback when tasks complete
- **Context Management** - Track and log session activity
- **Documentation** - Keep wikis/references in sync
- **Validation** - Verify security and response formats

There are **21 hook files** in `~/.agent/hooks/`, but the **3 most critical** are:
1. `stop-hook.ts` - Session completion notifications
2. `context-compression-hook.ts` - Pre-compression awareness
3. `voice-server-health-check.ts` - Voice server status verification

---

## Hook Architecture

### Hook Execution Timeline

```
Session Start
    ↓
[initialize-session.ts] - Load core context
[load-core-context.ts] - Load PAI system
[voice-server-health-check.ts] - Verify voice server ✨ NEW
    ↓
User Interactions
    ↓
[Various capture & validation hooks]
    ↓
Context Getting Large?
    ↓
[context-compression-hook.ts] - Pre-compression notification
[/compact command]
    ↓
Session End (User types /exit or timeout)
    ↓
[stop-hook.ts] - Completion notification & tab title update
```

### Hook Directory Structure

```
~/.agent/hooks/
├── Core Notification Hooks:
│   ├── stop-hook.ts (21KB) ✨ Primary completion handler
│   ├── subagent-stop-hook.ts (10KB) - Agent completion handler
│   ├── context-compression-hook.ts (4KB) - Pre-compression notice
│   └── voice-server-health-check.ts (3KB) ✨ NEW - Session startup
│
├── Notification Support:
│   └── lib/
│       ├── notification-handler.ts - Voice + system notification logic
│       └── (other utilities)
│
├── Session Management:
│   ├── initialize-session.ts - Session start
│   ├── load-core-context.ts - Load PAI system
│   ├── load-dynamic-requirements.ts - Load task context
│   └── load-on-demand-references.ts - Progressive disclosure
│
├── Validation Hooks:
│   ├── security-validator.ts - Command safety
│   ├── validate-response-format.ts - CORE compliance
│   ├── validate-protected.ts - Prevent overwrites
│   └── validate-docs.ts - Docs integrity
│
├── Documentation Hooks:
│   ├── update-documentation.ts - Keep wikis in sync
│   ├── update-tab-on-action.ts - Terminal tab feedback
│   └── update-tab-titles.ts - Final tab title
│
├── Capture & Logging:
│   ├── capture-all-events.ts - Audit trail
│   ├── capture-session-summary.ts - Session report
│   └── capture-tool-output.ts - Tool logging
│
└── Utilities:
    ├── self-test.ts - Hook diagnostics
    ├── compact-reminder.ts - Compression awareness
    └── (test files)
```

---

## Core Hooks

### 1. stop-hook.ts (21KB)

**Trigger:** Session ends (user submits final response)

**What it does:**
```
┌────────────────────────────────────────────────┐
│ 1. Read conversation transcript (JSON lines)   │
│ 2. Find last user query                         │
│ 3. Find last assistant response                 │
│ 4. Look for 🎯 COMPLETED: marker               │
│ 5. Extract meaningful completion message       │
│ 6. Send VOICE NOTIFICATION with message        │
│ 7. Set terminal tab title (4-word summary)     │
└────────────────────────────────────────────────┘
```

**Key Features:**

- **Intelligent Message Selection:**
  - Priority 1: Custom voice-optimized message (`🗣️ CUSTOM COMPLETED:`)
  - Priority 2: Standard completion (`🎯 COMPLETED:`)
  - Priority 3: Generated from query context

- **Voice Configuration:**
  - Reads `~/.claude/.env` for `DA_VOICE_ID` (currently "jessica")
  - Loads voice config from `~/.claude/voice-server/voices.json`
  - Supports agent-specific voices via `[AGENT:type]` tags

- **Tab Title Generation:**
  - Creates 4-word summary (e.g., "Refactored Authentication System")
  - Extracts action verb + meaningful nouns
  - Falls back to generated title from user query

**Configuration:**
```typescript
// Voice ID from environment
const voiceId = process.env.DA_VOICE_ID || 'default-voice-id';

// Voice config from local JSON
const voicesPath = join(homedir(), '.claude/voice-server/voices.json');
VOICE_CONFIG = JSON.parse(readFileSync(voicesPath, 'utf-8'));

// Supported agent voices:
- main: Jamie (Premium) @ 228 WPM
- researcher: Ava (Premium) @ 236 WPM
- engineer: Zoe (Premium) @ 236 WPM
- architect: Serena (Premium) @ 236 WPM
- designer: Isha (Premium) @ 236 WPM
- pentester: Oliver (Enhanced) @ 236 WPM
- writer: Serena (Premium) @ 236 WPM
```

**Output Example:**
```
🗣️ CUSTOM VOICE: "Refactored the authentication system"
🏷️ Tab title set to: "Refactored Authentication System"
✅ Notification sent via voice: "Refactored Authentication System"
```

---

### 2. context-compression-hook.ts (4KB)

**Trigger:** Before context compression (manual `/compact` or auto-compression)

**What it does:**
```
┌────────────────────────────────────────────────┐
│ 1. Count total messages in transcript          │
│ 2. Determine compression type (manual/auto)    │
│ 3. Generate notification message               │
│ 4. Send voice notification about compression   │
└────────────────────────────────────────────────┘
```

**Message Examples:**
- Manual: `"Manually compressing 45 messages"`
- Auto (small): `"Compressing context with 30 messages"`
- Auto (large): `"Auto-compressing large context with 85 messages"`

**Benefits:**
- User awareness that compression is happening
- Voice notification provides audio feedback
- No interruption to workflow

---

### 3. voice-server-health-check.ts (3KB) ✨ NEW

**Trigger:** Session start (initialization hook)

**What it does:**
```
┌────────────────────────────────────────────────┐
│ 1. Check if voice server is running (port 8888)│
│ 2. Detect error type (timeout/offline/error)   │
│ 3. Log clear status message                    │
│ 4. Warn if falling back to system notifications│
│ 5. Provide instructions to start server        │
└────────────────────────────────────────────────┘
```

**Health Check Logic:**
```
fetch('http://localhost:8888/health', timeout=1000ms)
    ↓
┌─ OK? → Status: HEALTHY ✅
│
├─ Timeout? → Status: TIMEOUT ⚠️
│            Suggests: Voice server slow/not responding
│
├─ ECONNREFUSED? → Status: UNHEALTHY ⚠️
│                 Suggests: Server not running on port 8888
│
└─ Other error? → Status: UNHEALTHY ⚠️
                 Suggests: Network issue or server crash
```

**Output Examples:**

Healthy:
```
🔊 Checking voice server status...
   ✅ Voice server healthy (chatterbox)
   Notifications will use voice with fallback to system notifications
```

Offline:
```
🔊 Checking voice server status...
   ⚠️ Voice server not running on port 8888

   ⚠️ FALLBACK: Notifications will use macOS system notifications
   To enable voice notifications, start the voice server:
   ~/.claude/voice-server/start.sh
```

---

### 4. subagent-stop-hook.ts (10KB)

**Trigger:** When a Task/subagent completes

**What it does:**
- Waits for agent task result to appear in transcript (with retries)
- Extracts agent-specific completion message
- Sends notification with agent-specific voice
- Detects agent type from `[AGENT:type]` tags

**Agent Voice Routing:**
```
[AGENT:researcher] → Ava voice @ 236 WPM
[AGENT:engineer]   → Zoe voice @ 236 WPM
[AGENT:architect]  → Serena voice @ 236 WPM
[AGENT:designer]   → Isha voice @ 236 WPM
[AGENT:pentester]  → Oliver voice @ 236 WPM
(default)          → Jamie voice @ 228 WPM
```

---

## Voice System

### Voice Server Architecture

```
┌─────────────────────────────────────────────────────────┐
│ User Query                                               │
│ (Session ends or agent completes)                        │
└──────────────────────┬──────────────────────────────────┘
                       ↓
         ┌─────────────────────────────────┐
         │ Hook (stop-hook.ts)             │
         │ - Extract completion message    │
         │ - Format notification           │
         └──────────────┬────────────────┘
                        ↓
      ┌─────────────────────────────────────────┐
      │ notification-handler.ts                 │
      │ ┌──────────────────────────────────────┐│
      │ │ 1. Check voice server health (500ms) ││
      │ │    (port 8888 responding?)           ││
      │ └──────────────────────────────────────┘│
      │ ↓                                       │
      │ ┌──────────────────────────────────────┐│
      │ │ 2. Send voice notification (1000ms)  ││
      │ │    POST http://localhost:8888/notify ││
      │ └──────────────────────────────────────┘│
      └──────────────────────────────────────────┘
                        ↓
            ┌───────────┴─────────────┐
            ↓                         ↓
    ✅ Voice plays         ❌ Timeout/Error
            ↓                         ↓
        [Done]            ┌──────────────────┐
                         │ Fallback to       │
                         │ System notif.    │
                         │ (macOS).notify()  │
                         └──────────────────┘
                                 ↓
                          🔔 System ding
                          "Notification"
```

### Timeout Configuration

| Component | Timeout | Purpose |
|-----------|---------|---------|
| Health check | 500ms | Quick detection of server status |
| Voice notification send | 1000ms | Reasonable for TTS generation + network |
| System notification (fallback) | Immediate | Always succeeds or fails fast |

**Before (Feb 2026):** 2000ms → 2 seconds (slow feedback)
**After (Feb 2026):** 1000ms → 1 second (faster fallback)

---

## Voice Reference Files

### Location
```
~/.claude/voice-server/voices/
```

### Files & Purposes

Voice reference files are audio samples used by Chatterbox TTS for **voice cloning**. The system analyzes the voice characteristics and applies them to generated speech.

| File | Size | Voice | Agent | Source |
|------|------|-------|-------|--------|
| `jessica_ref.wav` | 267KB | Jessica | Main/Default | Original ✅ |
| `jamie_ref.wav` | 59KB | Jamie | Main agents | Reference sample ✅ |
| `ava_ref.wav` | 59KB | Ava | Researcher | Fallback† |
| `zoe_ref.wav` | 59KB | Zoe | Engineer | Fallback† |
| `serena_ref.wav` | 59KB | Serena | Architect/Writer | Fallback† |
| `isha_ref.wav` | 59KB | Isha | Designer | Fallback† |
| `oliver_ref.wav` | 59KB | Oliver | Pentester | Fallback† |

**† Fallback:** Currently using copies of jamie_ref.wav. For better Chatterbox voice cloning, replace with actual voice samples.

### How Voice Cloning Works

```
Chatterbox TTS Flow:
┌──────────────────────────────────────────┐
│ 1. User requests voice notification      │
│    "Completed authentication system"     │
└──────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────┐
│ 2. Python sidecar receives request       │
│    text + voice_id + ref_audio_path      │
└──────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────┐
│ 3. Load reference audio (jamie_ref.wav)  │
│    Extract voice characteristics         │
│    (pitch, timber, prosody, etc.)        │
└──────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────┐
│ 4. Generate speech with matching voice   │
│    "Completed authentication system"     │
│    (with Jamie's voice characteristics)  │
└──────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────┐
│ 5. Return WAV audio to Bun server        │
│    Play via afplay (macOS)               │
└──────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

**File:** `~/.claude/.env`

```bash
# Voice Server Configuration
PORT=8888
VOICE_PROVIDER=chatterbox
CHATTERBOX_VOICE_ID=jessica

# ✨ NEW - Claude Code Hook Notifications
DA_VOICE_ID=jessica

# (Other API keys and settings...)
```

### Voice Configuration JSON

**File:** `~/.claude/voice-server/voices.json`

```json
{
  "default_rate": 175,
  "voices": {
    "main": {
      "voice_name": "Jamie (Premium)",
      "rate_wpm": 228,
      "rate_multiplier": 1.3,
      "description": "UK Male - Professional, conversational",
      "type": "Premium"
    },
    "researcher": {
      "voice_name": "Ava (Premium)",
      "rate_wpm": 236,
      "rate_multiplier": 1.35,
      "description": "US Female - Analytical, highest quality",
      "type": "Premium"
    },
    "engineer": {
      "voice_name": "Zoe (Premium)",
      "rate_wpm": 236,
      "rate_multiplier": 1.35,
      "description": "US Female - Steady, professional",
      "type": "Premium"
    },
    "architect": {
      "voice_name": "Serena (Premium)",
      "rate_wpm": 236,
      "rate_multiplier": 1.35,
      "description": "UK Female - Strategic, sophisticated",
      "type": "Premium"
    },
    "designer": {
      "voice_name": "Isha (Premium)",
      "rate_wpm": 236,
      "rate_multiplier": 1.35,
      "description": "Indian Female - Creative, distinct",
      "type": "Premium"
    },
    "pentester": {
      "voice_name": "Oliver (Enhanced)",
      "rate_wpm": 236,
      "rate_multiplier": 1.35,
      "description": "UK Male - Technical, sharp",
      "type": "Enhanced"
    },
    "writer": {
      "voice_name": "Serena (Premium)",
      "rate_wpm": 236,
      "rate_multiplier": 1.35,
      "description": "UK Female - Articulate, warm",
      "type": "Premium"
    }
  }
}
```

**WPM (Words Per Minute):** Higher = faster speech. 228-236 WPM is conversational speed.

---

## Notification Flow

### Complete Message Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ NOTIFICATION FLOW                                                │
└─────────────────────────────────────────────────────────────────┘

stop-hook.ts
├─ Read transcript
├─ Extract: "🎯 COMPLETED: Refactored authentication system"
├─ Check: DA_VOICE_ID = "jessica"
├─ Load: voices.json → main voice config (Jamie @ 228 WPM)
└─ Call: sendNotification({
     title: "Completion",
     message: "Refactored authentication system",
     voiceId: "jessica",
     voiceName: "Jamie (Premium)",
     rate: 228
   })
          ↓
notification-handler.ts
├─ Check: isVoiceServerRunning()
│  └─ fetch('http://localhost:8888/health', timeout=500ms)
│     ├─ ✅ Running → Continue
│     └─ ❌ Offline → Jump to step 4
│
├─ 1️⃣ Try: Voice Notification (1000ms timeout)
│  └─ POST http://localhost:8888/notify
│     ├─ {message: "Refactored authentication system", voice_id: "jessica"}
│     ├─ ✅ 200 OK → Return to Bun
│     └─ ❌ Error → Step 2
│
├─ 2️⃣ Voice Failed → Log fallback
│  └─ console.error("⚠️ Voice notification failed, falling back...")
│
├─ 3️⃣ Try: System Notification (fallback)
│  └─ osascript -e 'display notification "..." with title "..."'
│     ├─ ✅ Success → Return result
│     └─ ❌ Failed → Return error
│
└─ 4️⃣ Server Offline → Skip to System Notification
   └─ console.error("⚠️ Voice server offline, using macOS...")
      └─ osascript -e 'display notification "..." with title "..."'

Result to User:
┌────────────────────────────────────────────┐
│ ✅ Voice: "Refactored authentication sys..." │
│    (plays via afplay)                      │
│                                            │
│ OR                                         │
│                                            │
│ 🔔 System: Notification popup              │
│    Title: "Completion"                     │
│    Message: "Refactored authentication..." │
└────────────────────────────────────────────┘
```

### Fallback Logging

The system now provides clear logging when using fallbacks:

**Scenario 1: Voice server offline**
```
⚠️ Voice server offline, using macOS system notification as fallback
✅ System notification sent (voice server offline): "..."
```

**Scenario 2: Voice notification timeout/error**
```
⚠️ Voice notification failed, falling back to system notification
   📢 Sending via macOS system notification instead of voice
✅ System notification sent (voice fallback): "..."
```

**Scenario 3: Both succeed**
```
✅ Notification sent via voice: "..."
   Voice: Jamie (Premium) @ 228 wpm
```

---

## Voice Server Integration

### Voice Server Components

```
~/.claude/voice-server/
├── server.ts (Bun wrapper - main interface)
│   └─ Listens on port 8888
│   └─ Routes /notify, /synthesize, /health endpoints
│   └─ Manages Python sidecar lifecycle
│
├── python-sidecar/ (Chatterbox TTS engine)
│   ├── server.py (Listens on port 8889)
│   │   └─ Handles actual TTS synthesis
│   │   └─ Loads voice reference files
│   │   └─ Returns WAV audio
│   │
│   ├── venv/ (Python virtual environment)
│   │   └─ Chatterbox TTS model
│   │   └─ Voice cloning dependencies
│   │   └─ PyTorch, librosa, etc.
│   │
│   └── voices/ (Reference audio files)
│       └─ jessica_ref.wav (267KB)
│       └─ jamie_ref.wav (59KB)
│       └─ (other voice references)
│
└── Lifecycle Control:
    ├── start.sh (Start the service)
    ├── stop.sh (Stop the service)
    ├── restart.sh (Restart service)
    └── status.sh (Check status)
```

### API Endpoints

#### POST /notify
Send a notification (voice + system)

```bash
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Task completed successfully",
    "title": "Completion",
    "voice_enabled": true,
    "voice_id": "jessica",
    "suppress_system_notification": false
  }'
```

Response:
```json
{
  "status": "success",
  "message": "Notification sent"
}
```

#### POST /synthesize
Direct TTS synthesis (internal, used by Bun server)

```bash
curl -X POST http://localhost:8889/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "voice_id": "jessica"
  }'
```

Response: WAV audio file

#### GET /health
Check server health

```bash
curl -s http://localhost:8888/health | jq .
```

Response:
```json
{
  "status": "healthy",
  "port": 8888,
  "primary_provider": "chatterbox",
  "fallback_provider": "macos-say",
  "default_voice_id": "jessica"
}
```

---

## Troubleshooting

### Problem: No Voice Notifications

**Symptoms:** Notifications appear but no sound, or using system notifications every time

**Diagnosis:**
```bash
# 1. Check if voice server is running
curl -s http://localhost:8888/health | jq .

# 2. Check DA_VOICE_ID is set
echo $DA_VOICE_ID

# 3. Verify voices.json exists
cat ~/.claude/voice-server/voices.json | jq '.voices.main'

# 4. Check voice reference file exists
ls -lh ~/.claude/voice-server/voices/jessica_ref.wav
```

**Solution:**
```bash
# Start the voice server
~/.claude/voice-server/start.sh

# Wait for startup (30 seconds for model loading)
sleep 35

# Test a notification
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Testing voice notification",
    "voice_enabled": true
  }'
```

### Problem: Voice Server Timeout

**Symptoms:**
```
⚠️ Voice notification failed, falling back to system notification
   📢 Sending via macOS system notification instead of voice
```

**Causes:**
- Voice server is slow (model initialization taking time)
- Network latency
- Port 8888 is being used by another process
- Python sidecar failed to start

**Solution:**
```bash
# Check what's using port 8888
lsof -i :8888

# Check Python sidecar is running
lsof -i :8889

# Restart voice server
~/.claude/voice-server/restart.sh

# Check logs
tail -f ~/.claude/voice-server/logs/voice-server.log
tail -f ~/.claude/voice-server/logs/python-sidecar.log
```

### Problem: Wrong Voice Being Used

**Symptoms:** Hearing Jamie voice instead of Jessica, or wrong agent voice

**Check:**
```bash
# Verify DA_VOICE_ID
grep DA_VOICE_ID ~/.claude/.env

# Check voice mapping in stop-hook.ts
grep -A2 '"main"' ~/.claude/voice-server/voices.json
```

**Solution:**
```bash
# Update DA_VOICE_ID in .env
nano ~/.claude/.env
# Change: DA_VOICE_ID=jessica

# Or update voices.json
nano ~/.claude/voice-server/voices.json
# Update voice names and rates as needed
```

### Problem: "Voice server not responding" at startup

**Symptoms:**
```
⚠️ Voice server not running on port 8888
⚠️ FALLBACK: Notifications will use macOS system notifications
```

**Solution:**
```bash
# Check if service is installed
ls ~/Library/LaunchAgents/com.pai.voice-server.plist

# Install if missing
~/.claude/voice-server/install.sh

# Start the service
~/.claude/voice-server/start.sh

# Verify it's running
curl -s http://localhost:8888/health
```

---

## Recent Improvements (Feb 2026)

### What Was Changed

#### 1. Voice Configuration Reliability
- **Before:** Voices.json loaded from iCloud sync (`~/Library/Mobile Documents/...`)
- **After:** Voices.json local at `~/.claude/voice-server/voices.json`
- **Benefit:** Always available, faster loading, no sync dependencies

#### 2. Timeout Optimization
- **Before:** 2000ms (2 seconds) for voice notifications
- **After:** 1000ms (1 second) for voice notifications
- **Benefit:** Faster fallback to system notifications if server is slow

#### 3. Enhanced Logging
- **Before:** Silent failures - no indication of fallback
- **After:** Clear logging when using system notifications
- **Benefit:** User awareness, easier debugging

Example logging:
```
⚠️ Voice server offline, using macOS system notification as fallback
✅ System notification sent (voice server offline): "..."
```

#### 4. Voice Reference Files
- **Before:** Only jessica_ref.wav existed
- **After:** Reference files for all agent voices
- **Benefit:** Voice cloning support for all agents (Jamie, Ava, Zoe, Serena, Isha, Oliver)

Files created:
```
~/.claude/voice-server/voices/
├── jessica_ref.wav (267KB) - PRESERVED
├── jamie_ref.wav (59KB) - NEW
├── ava_ref.wav (59KB) - NEW
├── zoe_ref.wav (59KB) - NEW
├── serena_ref.wav (59KB) - NEW
├── isha_ref.wav (59KB) - NEW
└── oliver_ref.wav (59KB) - NEW
```

#### 5. Voice Server Health Check Hook
- **New Hook:** `voice-server-health-check.ts`
- **Trigger:** Session start
- **Purpose:** Verify voice server ready before first use
- **Benefit:** Early warning if voice server unavailable

#### 6. DA_VOICE_ID Configuration
- **Before:** Not explicitly set
- **After:** `DA_VOICE_ID=jessica` in `~/.claude/.env`
- **Benefit:** Clear configuration, explicit voice selection

#### 7. Hook Documentation
- **Files created:**
  - `HOOKS_IMPROVEMENTS.md` - Implementation details
  - `VOICE_SETUP_GUIDE.md` - User guide
  - This document

---

## Summary Table

| Component | Before | After | Benefit |
|-----------|--------|-------|---------|
| Voice config source | iCloud sync | Local ~/.claude | Reliability |
| Voice timeout | 2000ms | 1000ms | Faster feedback |
| Fallback logging | None | Clear messages | Transparency |
| Voice reference files | jessica only | All agents | Agent support |
| Health checks | No | Yes | Early detection |
| DA_VOICE_ID | Not set | jessica | Clear config |
| Documentation | Minimal | Comprehensive | Maintainability |

---

## Quick Reference

### Common Commands

```bash
# Check voice server status
curl -s http://localhost:8888/health | jq .

# Start voice server
~/.claude/voice-server/start.sh

# Stop voice server
~/.claude/voice-server/stop.sh

# Restart voice server
~/.claude/voice-server/restart.sh

# Check voice configuration
cat ~/.claude/.env | grep VOICE

# View voice files
ls -lh ~/.claude/voice-server/voices/

# Run health check hook manually
bun ~/.agent/hooks/voice-server-health-check.ts

# Test notification
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"Test notification","voice_enabled":true}'
```

### Key Files

| File | Purpose |
|------|---------|
| `~/.claude/.env` | Voice ID & configuration |
| `~/.claude/voice-server/voices.json` | Voice definitions |
| `~/.claude/voice-server/voices/` | Voice reference audio files |
| `~/.agent/hooks/stop-hook.ts` | Session completion handler |
| `~/.agent/hooks/context-compression-hook.ts` | Pre-compression notice |
| `~/.agent/hooks/voice-server-health-check.ts` | Voice server startup check |
| `~/.agent/hooks/lib/notification-handler.ts` | Notification logic |

---

## See Also

- [Voice Server Setup Guide](../wiki/Voice-Setup-Guide.md)
- [PAI System Architecture](../wiki/PAI-Architecture.md)
- [Hook System Documentation](../wiki/Hook-System.md)

---

**Status:** ✅ Fully configured and operational
**Last Updated:** February 7, 2026
**Maintained By:** Sam (Claude Code Assistant)
