---
name: discord-remote-control
description: "Discord-based remote interface for Sam. Receive text, images, files, and voice notes; respond with Claude Code subprocess for full PAI skill access. Stores episodic memory (recent conversation history) in SQLite. Optional semantic memory retrieval from memory-system. USE WHEN interacting through Discord, managing the Discord bot, or troubleshooting the remote control interface."
triggers:
  - "start discord"
  - "start discord remote"
  - "discord bot"
  - "launch discord service"
  - "/discord-remote-control --start"
  - "/discord-remote-control --stop"
  - "/discord-remote-control --status"
tags:
  - discord
  - remote-control
  - voice
  - multimodal
  - agent-sdk
  - cli
---

# discord-remote-control

Bidirectional Discord interface for Sam (PAI). Send text, images, files, and voice notes from Discord; receive intelligent responses powered by Claude Code subprocess with full PAI skill access.

**Status:** Standalone Discord bot interface. Does NOT own semantic memory logic (memory-system is the authoritative backend). Stores only episodic memory (recent conversation history) in local SQLite.

## Quick Start

```bash
# Start the Discord bot service
.agent/skills/discord-remote-control/scripts/start.sh

# Check service status
.agent/skills/discord-remote-control/scripts/status.sh

# Stop the service
.agent/skills/discord-remote-control/scripts/stop.sh
```

macOS launchd integration:
```bash
# Install service (optional)
launchctl load ~/.claude/services/com.pai.discord-remote-control.plist

# Start/stop
launchctl start com.pai.discord-remote-control
launchctl stop com.pai.discord-remote-control

# Check status
launchctl list | grep discord-remote-control
```

## Configuration

Set these environment variables in `$PAI_DIR/.env`:

```bash
DISCORD_BOT_TOKEN=          # From Discord Developer Portal > Bot > Token
DISCORD_GUILD_ID=           # Sam's server ID (right-click server → Copy ID)
DISCORD_CHANNEL_ID=         # #general channel ID (right-click channel → Copy ID)
DISCORD_ALLOWED_USER_IDS=   # Comma-separated Discord user IDs (your account)
GROQ_API_KEY=               # From console.groq.com (free tier is sufficient)
```

## Network & Port Architecture

Discord-remote-control **does NOT use a local HTTP port**. It communicates via:

- **Discord WebSocket API** — discord.js maintains persistent connection to Discord servers
- **Local SQLite database** — stores conversation history at `$PAI_DIR/discord-remote-control/memory.db`
- **Claude Code subprocess** — spawns local claude CLI with full PAI skill access (no network required)

The service is fully independent and requires no additional ports or services running.

## Capabilities

- ✅ Text messages (DM or #general channel)
- ✅ Image analysis and description
- ✅ File handling and processing
- ✅ Voice note transcription (Groq Whisper)
- ✅ Voice response generation (TTS via voice-server on :8888)
- ✅ Persistent SQLite memory
- ✅ Full Claude Code subprocess access (all PAI skills)
- ✅ Smart message chunking (respects 2000-char Discord limit)
- ✅ Typing indicators for UX feedback

## Architecture

```
Discord WebSocket
    ↓
discord.js Client
    ↓
Message Router (access control, media routing)
    ↓
Handlers (text, image, voice transcription)
    ↓
Claude Code subprocess (Anthropic Agent SDK)
    ↓
Response formatters (chunking, media upload)
    ↓
Discord API (send reply)
```

**Independent Components:**
- SQLite memory database (standalone, no external service needed)
- All message processing happens locally
- Claude subprocess has access to full PAI infrastructure

See `Reference.md` for detailed architecture and implementation details.

## Status

- Phase 1: ✅ Skill Scaffold & Discord Bot Connection
- Phase 2: ✅ Message Router & Access Control
- Phase 3: ✅ Memory System (SQLite Semantic Database)
- Phase 4: ✅ Anthropic Agent SDK Subprocess
- Phase 5: ✅ Media Handlers (Image & File)
- Phase 6: ✅ Voice Note Transcription (Inbound)
- Phase 7: ✅ Voice Response (Outbound TTS with Modality Mirroring)
- Phase 8: ✅ Observability & start-up Integration (Event logging + Health checks)
- Phase 9: ✅ Chunking, Polish & Error Handling (Response chunking + Rate limiting)
