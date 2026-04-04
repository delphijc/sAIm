# discord-remote-control — Reference Guide

## Architecture Overview

```
Discord User
    │  (text / image / file / voice note)
    ▼
discord.js Gateway (WebSocket — persistent)
    │
    ▼
Message Router
    │
    ├─ Text ──────────────────────────────────────────────┐
    ├─ Image ──── download from CDN ───────────────────┐  │
    ├─ File ───── download from CDN ───────────────────┤  │
    └─ Voice note ── download → Groq Whisper ──────────┘  │
                                                           ▼
                                             Memory Injection Layer
                                             (SQLite: episodic + semantic memory)
                                                           │
                                                           ▼
                                        Anthropic Agent SDK subprocess
                                        (spawns `claude` CLI with full PAI)
                                                           │
                                                           ▼
                                             Response Formatter
                                             ├─ text chunks (≤2000 chars)
                                             ├─ mp3 via TTS
                                             ├─ image attachments
                                             └─ file attachments
                                                           │
                                                           ▼
                                             Discord (DM or #general)
```

## File Structure

```
.agent/skills/discord-remote-control/
├── SKILL.md                      # Skill metadata (you're reading SKILL.md)
├── Reference.md                  # Extended documentation (this file)
├── service/
│   ├── index.ts                  # Entry point — starts bot, handles SIGINT
│   ├── bot.ts                    # discord.js client setup, intents
│   ├── config.ts                 # Env-based config (tokens, IDs)
│   ├── router.ts                 # Routes incoming messages
│   ├── handlers/
│   │   ├── text.ts               # Text message → Agent SDK
│   │   ├── media.ts              # Image/file download → Agent SDK
│   │   └── voice.ts              # Voice note → Groq → Agent SDK
│   ├── claude/
│   │   └── subprocess.ts         # Agent SDK subprocess spawner
│   ├── memory/
│   │   ├── db.ts                 # bun:sqlite setup
│   │   ├── episodic.ts           # Message storage/retrieval
│   │   └── injection.ts          # Build context prefix
│   ├── response/
│   │   ├── text.ts               # Chunk long responses
│   │   ├── voice.ts              # TTS → mp3
│   │   └── media.ts              # Discord attachments
│   └── __tests__/
│       ├── router.test.ts
│       ├── memory.test.ts
│       └── chunker.test.ts
├── scripts/
│   ├── start.sh                  # Start service
│   ├── stop.sh                   # Stop service
│   └── status.sh                 # Check status
├── package.json                  # discord.js, @anthropic-ai/sdk, groq-sdk
└── bunfig.toml                   # Bun config
```

## Key Dependencies

- `discord.js` (v14) — Discord client library
- `@anthropic-ai/claude-code` — Agent SDK for subprocess
- `groq-sdk` — Whisper transcription API
- `bun:sqlite` — Embedded database (no separate server)

## Environment Variables

All configuration comes from `$PAI_DIR/.env`:

| Variable | Purpose | Source |
|----------|---------|--------|
| `DISCORD_BOT_TOKEN` | Bot authentication | Discord Developer Portal |
| `DISCORD_GUILD_ID` | Sam's server ID | Discord (right-click server → Copy ID) |
| `DISCORD_CHANNEL_ID` | #general channel ID | Discord (right-click channel → Copy ID) |
| `DISCORD_ALLOWED_USER_IDS` | Allowlist (comma-separated) | Your Discord user ID |
| `GROQ_API_KEY` | Whisper transcription | console.groq.com (free tier) |
| `PAI_DIR` | PAI root directory | Already set by PAI infrastructure |

## Session Management

- **Session Key Format**: `userId:channelId` (e.g., `123456789:987654321`)
- **DM Sessions**: `userId:dm`
- **Persistence**: Sessions persist in SQLite semantic database across bot restarts
- **Memory Layers**: Episodic (recent turns) + Semantic (learned topics) injected into prompts

## Message Types

### Text
- Incoming: Plain Discord text message
- Processing: Passed directly to Claude subprocess
- Outgoing: Chunked at paragraph/newline/sentence/word boundaries

### Image
- Incoming: PNG, JPG, GIF (Discord attachment)
- Processing: Downloaded to temp, passed as file path to Claude
- Outgoing: Claude can reference or generate images

### File
- Incoming: PDF, text, documents (max 25MB)
- Processing: Downloaded, passed as file path
- Outgoing: Claude can generate/reference files as attachments

### Voice
- Incoming: `.ogg` (Opus) Discord voice message
- Processing: Transcribed via Groq Whisper → text passed to Claude
- Outgoing: Claude response can include mp3 audio (TTS)
- **Phase 7 Modality Mirroring**: When user sends voice, bot responds with voice (if voice server available)

## Rate Limiting & Constraints

- **Discord Rate Limit**: 5 messages/5 seconds per channel (handled by response chunker)
- **Message Chunk Delay**: 500ms between chunks (to respect rate limits)
- **File Download**: Max 25MB (Discord Nitro-free limit)
- **Temp File Cleanup**: Auto-deleted after successful send
- **Session Timeout**: No explicit timeout (persistent memory)

## Discord Bot Setup (One-Time)

1. Go to https://discord.com/developers/applications → New Application → "sam-discord-remote"
2. **Bot tab** → Add Bot → copy token → set `DISCORD_BOT_TOKEN`
3. **Privileged Intents** → Enable:
   - Message Content Intent
   - Server Members Intent
4. **OAuth2** → URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Permissions: Send Messages, Read Message History, Embed Links, Attach Files, Read Messages/View Channels
5. Copy generated URL → open in browser → invite to Sam's server
6. Copy server ID and #general channel ID (enable Developer Mode in Discord settings)

## Testing Checklist

- [ ] Bot appears online in Sam's server
- [ ] Text message in #general → Sam responds with text
- [ ] DM to bot → Sam responds with text
- [ ] Send image → Sam describes the image
- [ ] Send a file → Sam acknowledges and processes it
- [ ] Send a voice note → Sam transcribes and responds
- [ ] Ask Sam to "respond with voice" → mp3 attachment arrives
- [ ] Bot ignores messages from unauthorized users
- [ ] Restart bot → memory persists
- [ ] Discord events appear in observability dashboard

## Advanced Features (Enhancements)

See `DISCORD_REMOTE_CONTROL_PLAN.md` (parent directory) for 12 enhancement phases:

1. Video interpretation (multimodal)
2. Image generation & visual responses
3. Web search from Discord
4. Enhanced memory (semantic + episodic layers)
5. Slash commands & CLI interface
6. Proactive notifications & background jobs
7. MCP server integration & custom skills
8. Context window optimization
9. Task management & workflow integration
10. Custom alerts & status monitoring
11. Conversation export & analysis
12. Multi-session & team mode (future)

## Troubleshooting

### Bot doesn't appear online
- Check `DISCORD_BOT_TOKEN` is valid (try re-generating in Discord Dev Portal)
- Check `DISCORD_GUILD_ID` and `DISCORD_CHANNEL_ID` are correct

### Messages not being received
- Ensure Message Content Intent is enabled in Discord Developer Portal (privileged)
- Check bot has "Read Messages/View Channels" permission in #general
- Verify `DISCORD_ALLOWED_USER_IDS` includes your user ID

### Claude subprocess not responding
- Check `ANTHROPIC_API_KEY` is set in PAI environment
- Verify Claude Code is installed (`bun install` in service/)
- Check subprocess logs: `tail -f .agent/logs/discord-service.log`

### Memory not persisting
- Check memory database directory exists: `ls -la $PAI_DIR/discord-remote-control/`
- Check memory.db file: SQLite stores episodic and semantic memories in a single database file

### Voice transcription fails
- Check `GROQ_API_KEY` is set and valid
- Verify Groq API access: `curl https://api.groq.com/health`
- Check audio file format (must be .ogg Opus or compatible)

## Observability Integration (Phase 8)

Discord events are logged to `.agent/history.jsonl` for centralized monitoring:

### Event Types

**Message Events**
```json
{
  "event_type": "DiscordMessageReceived",
  "timestamp": "2026-03-04T20:00:00Z",
  "data": {
    "discord_user_id": "123456789",
    "discord_channel_id": "987654321",
    "message_type": "text|image|file|voice",
    "message_preview": "first 100 chars...",
    "session_id": "123456789:987654321"
  }
}
```

**Response Events**
```json
{
  "event_type": "DiscordResponseSent",
  "data": {
    "discord_user_id": "123456789",
    "response_type": "text|voice",
    "has_attachments": true,
    "session_id": "123456789:987654321"
  }
}
```

**Voice Events**
```json
{
  "event_type": "DiscordVoiceTranscription",
  "data": {
    "audio_duration": 5.2,
    "language": "en",
    "success": true
  }
}
```

**Subprocess Events**
```json
{
  "event_type": "DiscordSubprocessCall",
  "data": {
    "input_tokens": 150,
    "output_tokens": 200,
    "duration_ms": 2500
  }
}
```

### Health Checks

At startup, the bot performs health checks for:
- **Voice Server** (localhost:8888) - TTS synthesis
- **Groq API** - Voice transcription
- **Memory Database** - SQLite-based memory storage

Health check results are logged as `HealthCheck` events.

### Querying Events

```bash
# Count message events
jq 'select(.event_type == "DiscordMessageReceived")' .agent/history.jsonl | jq -s 'length'

# Get average subprocess duration
jq 'select(.event_type == "DiscordSubprocessCall") | .data.duration_ms' .agent/history.jsonl | jq -s 'add/length'

# List all errors
jq 'select(.event_type == "DiscordError")' .agent/history.jsonl
```

## Contributing

Before contributing, ensure:

- [ ] Unit tests pass: `bun test`
- [ ] Coverage >80%: `bun test --coverage`
- [ ] Code follows PAI patterns (see `.agent/skills/CORE/SKILL.md`)
- [ ] Changes link to a task in the plan
- [ ] Commit includes task ID in message
