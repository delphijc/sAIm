---
name: discord-remote-control
description: "Discord-based remote interface for Sam. Receive text, images, files, and voice notes; respond with Claude Code subprocess for full PAI skill access. Persistent memory via SQLite. USE WHEN interacting through Discord, managing the Discord bot, or troubleshooting the remote control interface."
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

Bidirectional Discord interface for Sam (PAI). Send text, images, files, and voice notes to Discord; receive intelligent responses powered by Claude Code subprocess with full PAI skill access.

## Quick Start

```bash
# Start the Discord bot (via CLI)
/discord-remote-control --start

# Check service status
/discord-remote-control --status

# Stop the service
/discord-remote-control --stop
```

Or use scripts directly:
```bash
.agent/skills/discord-remote-control/scripts/start.sh
.agent/skills/discord-remote-control/scripts/status.sh
.agent/skills/discord-remote-control/scripts/stop.sh
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

## Capabilities

- ✅ Text messages (DM or #general channel)
- ✅ Image analysis and description
- ✅ File handling and processing
- ✅ Voice note transcription (Groq Whisper)
- ✅ Voice response generation (TTS)
- ✅ Persistent memory via SQLite
- ✅ Full Claude Code subprocess access (all PAI skills)
- ✅ Smart message chunking (respects 2000-char Discord limit)
- ✅ Typing indicators for UX feedback

## Architecture

```
Discord → discord.js → Message Router → Handlers → Memory → Claude subprocess → Response Formatter → Discord
```

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
