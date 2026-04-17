# discord-remote-control — Implementation Plan

## Context

This plan implements a Discord-based remote interface for Sam (PAI). Inspired by the architecture described in this YouTube video: https://www.youtube.com/watch?v=9Svv-n11Ysk — the system uses Anthropic's Agent SDK to bridge Discord messages to a Claude Code subprocess running on the local machine.

**Why Discord instead of Telegram:** User prefers Discord; already has Sam's server with a #general channel and a bot account. The system must support bidirectional text, image, file, and voice note communication over both DMs and the #general channel.

**Goal outcome:** From Discord, the user can send text, images, files, or voice notes to Sam. Sam responds via text messages and/or mp3 audio attachments. Sam can also attach files and images in replies. All of this goes through the full PAI infrastructure — existing skills, memory, tools, and hooks — because we spawn a real Claude Code subprocess rather than hitting the raw API.

---

## Architecture Overview

```
Discord User
    │  (text / image / file / voice note)
    ▼
discord.js Gateway (WebSocket — persistent)
    │
    ▼
Message Router  ←──────────────────────────────────────────┐
    │                                                       │
    ├─ Text ──────────────────────────────────────────────▶ │
    ├─ Image ──── download from CDN ─────────────────────▶ │
    ├─ File ───── download from CDN ─────────────────────▶ │
    └─ Voice note ── download → Groq Whisper transcript ─▶ │
                                                            │
                                                            ▼
                                              Memory Injection Layer
                                              (SQLite: recent session history)
                                                            │
                                                            ▼
                                        Anthropic Agent SDK subprocess
                                        (spawns `claude` CLI with full PAI config)
                                        — has access to all existing skills, MCP, tools
                                                            │
                                                            ▼
                                              Response Formatter
                                              ├─ text chunks (≤2000 chars)
                                              ├─ mp3 via PAI voice server/TTS API
                                              ├─ image attachments
                                              └─ file attachments
                                                            │
                                                            ▼
                                              Discord (DM or #general)
```

---

## Skill Directory Structure

```
.agent/skills/discord-remote-control/
├── SKILL.md                      # Skill metadata and routing
├── Reference.md                  # Extended usage documentation
├── service/
│   ├── index.ts                  # Entry point — starts bot and handles SIGINT
│   ├── bot.ts                    # discord.js client setup, intent registration
│   ├── config.ts                 # Env-based config (tokens, allowed guild/channel IDs)
│   ├── router.ts                 # Routes incoming messages to appropriate handlers
│   ├── handlers/
│   │   ├── text.ts               # Text message → Agent SDK
│   │   ├── media.ts              # Image/file download → temp file → Agent SDK
│   │   └── voice.ts              # Voice note download → Groq transcription → Agent SDK
│   ├── claude/
│   │   └── subprocess.ts         # Anthropic Agent SDK subprocess spawner
│   ├── memory/
│   │   ├── db.ts                 # bun:sqlite setup (WAL mode)
│   │   ├── episodic.ts           # Store/retrieve conversation turns with decay
│   │   └── injection.ts          # Build context prefix from recent memories
│   ├── response/
│   │   ├── text.ts               # Chunk long responses at paragraph breaks (≤2000 chars)
│   │   ├── voice.ts              # TTS → mp3 file via voice server or TTS API
│   │   └── media.ts              # Upload files/images as Discord attachments
│   └── __tests__/
│       ├── router.test.ts
│       ├── memory.test.ts
│       └── chunker.test.ts
├── scripts/
│   ├── start.sh                  # Start service in background, write PID
│   ├── stop.sh                   # Kill PID and cleanup
│   └── status.sh                 # Check if service is running
├── package.json                  # discord.js, @anthropic-ai/sdk, groq-sdk deps
└── bunfig.toml                   # Bun-specific test/runtime config
```

---

## Critical File References (Existing Code to Reuse)

| Purpose | File |
|---|---|
| Path resolution | `.agent/hooks/lib/pai-paths.ts` |
| Voice notifications (desktop) | `.agent/Tools/VoiceNotify` |
| Notification handler pattern | `.agent/hooks/lib/notification-handler.ts` |
| SQLite pattern | `.agent/skills/observability/apps/server/src/db/` |
| Event JSONL format | `.agent/hooks/capture-all-events.ts` |
| start-up lifecycle pattern | `.agent/skills/start-up/SKILL.md` |
| Agent SDK subprocess | Anthropic `@anthropic-ai/claude-code` npm package |

---

## Implementation Phases

### Phase 1 — Skill Scaffold & Discord Bot Connection

**Goal:** Get a running Discord bot that connects, authenticates, and receives messages without yet doing anything intelligent.

1. Create `.agent/skills/discord-remote-control/` directory with `SKILL.md` (frontmatter: name, description, triggers)
2. Create `service/package.json` with dependencies:
   - `discord.js` v14
   - `@anthropic-ai/claude-code` (Agent SDK)
   - `groq-sdk` (for Whisper transcription)
   - `bun-types`
3. Create `service/config.ts` — reads from environment:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID` (Sam's server ID)
   - `DISCORD_CHANNEL_ID` (the #general channel ID)
   - `DISCORD_ALLOWED_USER_IDS` (allowlist — only the user's account)
   - `GROQ_API_KEY` (for transcription)
   - `PAI_DIR` (reuse existing)
4. Create `service/bot.ts` — discord.js Client with required intents:
   - `GatewayIntentBits.Guilds`
   - `GatewayIntentBits.GuildMessages`
   - `GatewayIntentBits.MessageContent` (privileged — must be enabled in bot dev portal)
   - `GatewayIntentBits.DirectMessages`
   - `Partials.Channel` (required for DMs)
5. Create `service/index.ts` — connects bot, registers `messageCreate` event, handles SIGINT gracefully
6. Create `scripts/start.sh` and `scripts/stop.sh` for service lifecycle
7. **Verification:** Bot appears online in Discord, logs received messages to stdout

---

### Phase 2 — Message Router & Access Control

**Goal:** Route messages to the right handler, block unauthorized users and channels.

1. Create `service/router.ts`:
   - Allow DMs only from `DISCORD_ALLOWED_USER_IDS`
   - Allow guild messages only from `DISCORD_GUILD_ID` + `DISCORD_CHANNEL_ID` (#general)
   - Reject all other messages silently (or with a polite "not authorized" reply)
   - Detect message type: text-only, has-image, has-file, has-audio
   - Route to appropriate handler (text, media, voice)
2. Handle Discord's 15-second interaction acknowledgment window for slash commands (if added later)
3. Add typing indicator (`channel.sendTyping()`) while processing — provides UX feedback
4. **Verification:** Bot correctly ignores messages from unauthorized channels/users; shows typing indicator

---

### Phase 3 — Memory System (SQLite)

**Goal:** Persist conversation context across sessions with episodic decay.

1. Create `service/memory/db.ts`:
   - `bun:sqlite` database at `$PAI_DIR/discord-remote-control/memory.db`
   - WAL mode for concurrent reads
   - Tables:
     - `sessions(id, discord_user_id, discord_channel_id, session_id, created_at, last_active_at)`
     - `messages(id, session_id, role, content, timestamp, weight)`
2. Create `service/memory/episodic.ts`:
   - `saveMessage(sessionId, role, content)` — stores with timestamp
   - `getRecentMessages(sessionId, limit)` — returns last N messages, sorted by recency
   - `decayOldMessages()` — reduces weight on messages older than 24h (run on startup)
3. Create `service/memory/injection.ts`:
   - Builds a context prefix from the last 10 messages of the session
   - Deduplicates any repeated content
   - Returns formatted string to prepend to the user's new message
4. **Verification:** Messages persist between bot restarts; memory tests pass

---

### Phase 4 — Anthropic Agent SDK Subprocess

**Goal:** Pass messages to a real Claude Code subprocess (with full PAI skills access).

1. Create `service/claude/subprocess.ts`:
   - Uses `@anthropic-ai/claude-code` SDK's `query()` function
   - Constructs a prompt that includes:
     - Memory context (injected from Phase 3)
     - The user's message
     - Any transcribed audio text
     - References to downloaded file paths (for images/files)
   - Streams the response back
   - Session ID is mapped to Discord `userId:channelId` (persistent across messages)
2. Handle long-running responses gracefully:
   - Send a "thinking…" placeholder message immediately
   - Edit the placeholder as chunks arrive (streaming updates)
   - Final edit with complete response
3. Configure subprocess to use existing `PAI_DIR` config — it inherits all skills, CLAUDE.md, MCPs
4. **Verification:** Simple text message through Discord gets a real Claude Code response back

---

### Phase 5 — Media Handlers (Image & File)

**Goal:** Receive images and files from Discord and pass them to Claude.

1. Create `service/handlers/media.ts`:
   - Downloads attachments from Discord CDN to a temp directory (`$PAI_DIR/discord-remote-control/tmp/`)
   - Supports: PNG, JPG, GIF, PDF, text files, and common document types
   - Max download size: 25MB (Discord's Nitro-free limit)
   - Passes local file path(s) to subprocess.ts as `--attachment` args
2. Create `service/response/media.ts`:
   - Upload local files back to Discord as `AttachmentBuilder`
   - Supports multiple files per message
3. Cleanup: Delete temp files after successful send
4. **Verification:** Send an image to bot → Claude describes it; Claude generates a file → it arrives as Discord attachment

---

### Phase 6 — Voice Note Transcription (Inbound)

**Goal:** Transcribe voice notes sent to Discord and pass the text to Claude.

1. Create `service/handlers/voice.ts`:
   - Discord sends voice messages as `.ogg` files (Opus encoded)
   - Download the `.ogg` to temp directory
   - Transcribe via Groq Whisper API (`groq.audio.transcriptions.create`)
   - Pass transcript text to subprocess.ts (same as text handler)
   - Include `[Voice note transcribed: "..."]` prefix so Claude knows the origin
2. Handle transcription errors gracefully (reply with "Sorry, I couldn't transcribe that audio")
3. **Verification:** Record a voice message in Discord → bot replies with text response based on spoken content

---

### Phase 7 — Voice Response (Outbound TTS)

**Goal:** Optionally send responses as mp3 audio attachments.

1. Create `service/response/voice.ts`:
   - Check if PAI voice server (port 8888) has a `/synthesize` endpoint that returns audio bytes
   - If yes: POST message text → receive mp3 bytes → write to temp file → attach to Discord reply
   - If no: Use OpenAI TTS API (`openai.audio.speech.create`) as fallback
   - Only generate audio when user explicitly asks (e.g., "respond with voice" or bot detects the user sent a voice note — mirror the modality)
2. TTS voice: Default to the configured `DA_VOICE_ID` from PAI environment
3. **Verification:** Reply from bot includes both text and an mp3 attachment

---

### Phase 8 — Observability & start-up Integration

**Goal:** Wire the Discord service into PAI's existing infrastructure.

1. Add observability event emission:
   - Emit `DiscordMessageReceived` and `DiscordResponseSent` events to the JSONL history file
   - Follow the `HookEvent` schema from `capture-all-events.ts`
2. Add desktop notifications via `VoiceNotify` when a Discord message arrives while working locally
3. Update start-up skill (`SKILL.md`) to include `discord-remote-control` as an optional managed service:
   - `start.sh` added to startup sequence (optional, user-toggled)
   - `stop.sh` added to shutdown sequence
4. Store `DISCORD_BOT_TOKEN` and `GROQ_API_KEY` in `$PAI_DIR/.env` alongside `ANTHROPIC_API_KEY`
5. **Verification:** Discord messages appear in the observability dashboard; start-up starts/stops the bot

---

### Phase 9 — Chunking, Polish & Error Handling

**Goal:** Production-quality message formatting and resilience.

1. Create `service/response/text.ts`:
   - Smart chunking respecting Discord's 2000-character limit
   - Break at paragraph → newline → sentence → word (never mid-word)
   - Never split code blocks mid-fence
   - Rate-limit: 1 message per 500ms to avoid Discord rate limits
2. Add global error handler: unhandled rejections → log + notify via `VoiceNotify`
3. Handle bot reconnection: exponential backoff on WebSocket disconnect
4. Add `scripts/status.sh` health check that reports:
   - Bot online/offline
   - Memory DB record count
   - Last message timestamp
5. Write tests for chunker, router access control, and memory decay

---

## Environment Variables Required

```bash
# Add to $PAI_DIR/.env
DISCORD_BOT_TOKEN=          # From Discord Developer Portal > Bot > Token
DISCORD_GUILD_ID=           # Sam's server ID (right-click server → Copy ID)
DISCORD_CHANNEL_ID=         # #general channel ID (right-click channel → Copy ID)
DISCORD_ALLOWED_USER_IDS=   # Comma-separated Discord user IDs (your account)
GROQ_API_KEY=               # From console.groq.com (free tier is sufficient)
```

---

## Discord Bot Setup (One-Time Manual Steps)

1. Go to https://discord.com/developers/applications → New Application → "sam-discord-remote"
2. Bot tab → Add Bot → copy token → set `DISCORD_BOT_TOKEN`
3. Enable privileged intents: **Message Content Intent** + **Server Members Intent**
4. OAuth2 → URL Generator → scopes: `bot`, `applications.commands`
5. Bot permissions: `Send Messages`, `Read Message History`, `Embed Links`, `Attach Files`, `Read Messages/View Channels`
6. Copy generated URL → open in browser → invite to Sam's server
7. Copy server ID and #general channel ID (enable Developer Mode in Discord settings first)

---

## Testing Strategy

- **Unit tests**: memory decay logic, text chunker, router access control (`bun test`)
- **Integration test**: Send a text message → verify Claude response returned
- **Manual verification checklist**:
  - [ ] Bot appears online in Sam's server
  - [ ] Text message in #general → Sam responds with text
  - [ ] DM to bot → Sam responds with text
  - [ ] Send image → Sam describes the image
  - [ ] Send a file → Sam acknowledges and processes it
  - [ ] Send a voice note → Sam transcribes and responds
  - [ ] Ask Sam to "respond with voice" → mp3 attachment arrives
  - [ ] Verify bot ignores messages from unauthorized users
  - [ ] Restart bot → memory persists from previous session
  - [ ] Discord events appear in observability dashboard

---

## Key Constraints & Notes

- **Agent SDK subprocess** means Claude has access to ALL existing PAI skills, not just the API — this is the core architectural advantage
- **Session mapping**: `userId:channelId` → unique session key; DMs use `userId:dm`
- **No open access**: only `DISCORD_ALLOWED_USER_IDS` can interact with the bot
- **Voice modality mirroring**: if user sends a voice note, bot defaults to sending voice back (can be overridden)
- **Discord rate limits**: Max 5 messages/5 seconds per channel; handled by the response chunker delay
- **Temp file cleanup**: All downloaded/generated media is deleted after send
- **Claude Pro subscription compatible**: The Agent SDK subprocess uses the LOCAL Claude Code instance (which the user already has via Claude Pro), not the Anthropic API. Zero additional cost for Claude reasoning.

---

## Enhancements — Advanced Features from Claude Claw Video

Beyond the core messaging system, the following enhancements extend discord-remote-control into a full personal AI operating system:

### Enhancement 1: Video Interpretation (Multimodal Analysis)

**Capability:** Users can send MP4/WebM videos to Discord; Claude describes, transcribes, or analyzes video content.

**Implementation:**
- Extract first frame + metadata from video as preview
- Pass video file to Claude Code subprocess (via Agent SDK)
- Claude's multimodal capability interprets video context
- Return summary, transcript, or analysis as Discord message
- Optionally generate a key-frame image attachment

**Free/Claude Pro compatible:** Yes — Claude Sonnet multimodal processing is included in Claude Pro

---

### Enhancement 2: Image Generation & Visual Responses

**Capability:** When Claude wants to create a visual (diagram, chart, mockup), generate it and send as Discord attachment.

**Implementation:**
- Detect when Claude responds with "I'll create a diagram..." type requests
- Route through image generation provider (local or free tier):
  - Option A: Replicate API free tier (text-to-image)
  - Option B: Local model (Stable Diffusion via ComfyUI)
  - Option C: ASCII art generation for quick diagrams
- Save generated image to temp directory
- Attach to Discord reply
- Log generation event to observability

**Notes:** Free tier APIs available (Replicate, stability.ai community). Not required for Claude Pro compatibility.

---

### Enhancement 3: Web Search from Discord

**Capability:** User asks "What's the latest on X?" → Claude performs web search and synthesizes findings.

**Implementation:**
- Detect search queries in user message (e.g., "search for", "what's new", "latest")
- Invoke existing PAI web search functionality (already integrated in Claude Code)
- Claude processes search results in full context
- Return curated summary with sources and links
- Discord embeds sources as Discord embed reactions

**Free/Claude Pro compatible:** Yes — PAI already has web search via Anthropic API, which Claude Pro users have access to

---

### Enhancement 4: Enhanced Memory — Semantic + Episodic Layers

**Capability:** Smarter memory beyond conversation history; remember topics, preferences, and patterns across conversations.

**Implementation (builds on Phase 3):**

Layer 1: **Episodic Memory** (existing)
- Timestamped conversation turns with decay weights
- Last 10-20 messages injected before each new message

Layer 2: **Semantic Memory** (new)
- Vector embeddings of important facts, preferences, summaries
- Use Claude to extract key points from long conversations
- Store: `(topic, summary_text, embedding_vector, created_at, relevance_score)`
- On new message: find similar topics via cosine similarity
- Inject top 3-5 semantic memories as "context: you previously learned..."

Layer 3: **Context Injection** (refined)
- Deduplicate between episodic + semantic
- Build final prefix: "Previous context: [semantic] | Recent messages: [episodic]"
- Total injected context: ≤20% of available context window (Claude Pro: 200k tokens available)

**Database updates:**
- `bun:sqlite` add table: `semantic_memories(id, session_id, topic, summary, embedding_vector, created_at, relevance_score)`
- Background job: runs daily, summarizes old episodic turns → semantic memories

---

### Enhancement 5: Slash Commands & CLI Interface in Discord

**Capability:** Users can invoke commands from Discord like a terminal, e.g., `/ask`, `/search`, `/schedule`, `/status`.

**Implementation:**
- Discord slash commands (registered via Discord API)
- Slash command options: `/ask question`, `/search topic`, `/schedule time command`
- Commands mapped to Claude Code skills/tools
- Each command gets its own isolated session (vs. shared DM context)
- Autocomplete suggestions for available commands

**Example commands:**
- `/ask What is X?` → Claude answers
- `/search latest crypto news` → web search + summary
- `/schedule 10:00 remind me to check emails` → creates cron job via start-up skill
- `/status` → returns bot uptime, memory DB size, last N conversations
- `/skill list` → lists available PAI skills from Discord

---

### Enhancement 6: Proactive Notifications & Background Jobs

**Capability:** Schedule tasks, set reminders, or configure the bot to periodically check on things without user prompting.

**Implementation:**
- Add `background_jobs` table to SQLite:
  - `(id, session_id, cron_expression, task_description, last_run, next_run, enabled)`
- Integrates with existing PAI start-up skill's cron/scheduler
- Example: "Remind me of my daily standup at 9am" → creates cron job
- Background job spawns a new Claude subprocess (like a webhook)
- Results (if any) sent as Discord message to user
- All events logged to observability dashboard

**Example jobs:**
- "Every morning at 9am, summarize my unread emails"
- "Every Sunday, check my habit tracker and send a report"
- "Proactively ping me if my API rate limits get above 80%"

---

### Enhancement 7: MCP Server Integration & Custom Skills

**Capability:** Connect discord-remote-control to any of the existing PAI skills + future MCPs without code changes.

**Implementation:**
- Discord subprocess inherits all configured MCPs from PAI's environment
- User's custom skills in `.agent/skills/` are automatically available
- Discord "skill menu" slash command shows available skills
- `/skill use <skillName> <input>` routes to that skill's workflow
- Observability dashboard tracks which skills are called from Discord

**Example:**
- User created a custom `research-companies` skill
- From Discord: `/skill use research-companies Apple Inc`
- Claude uses that skill to research, returns findings to Discord

---

### Enhancement 8: Context Window Optimization

**Capability:** Leverage the full 200k token context available in Claude Pro's Sonnet model for richer conversations.

**Implementation:**
- Phase 4 subprocess.ts already opens a session with full context
- Intelligent context management:
  - Always preserve last 5 messages (recent context)
  - Inject semantic memories (5-10k tokens worth)
  - Include relevant file/code snippets if user references them (up to 50k tokens)
  - Reserve 20k tokens for response
  - Use remaining space for conversation history (potentially 100+ turns)
- Configuration: `CONTEXT_RESERVE_TOKENS` env var (default: 40k)

**Benefit:** Can have truly long-form conversations without losing context, unlike traditional chatbots

---

### Enhancement 9: Task Management & Workflow Integration

**Capability:** Convert Discord conversations into tasks, track completion, and integrate with existing `.agent/plans/` system.

**Implementation:**
- Add `tasks` table to SQLite: `(id, session_id, title, description, status, priority, due_date, linked_plan_id)`
- Detect when Claude suggests a task: "You should [do X]"
- Offer quick reaction buttons: "✅ Create Task", "❌ Dismiss", "⏱️ Snooze"
- If user clicks ✅, create entry in tasks table and in `.agent/state.md` (via state_syncer.sh)
- `/tasks` command shows pending tasks
- `/tasks complete <taskId>` marks as done

**Integration with PAI plan system:**
- Tasks can be linked to plan phases
- Completing a Discord task updates plan progress
- Plan checkpoints can reference Discord tasks

---

### Enhancement 10: Custom Alerts & Status Monitoring

**Capability:** Set up Discord alerts for specific events (errors, thresholds, status changes).

**Implementation:**
- Add `alerts` table: `(id, session_id, trigger_type, threshold, enabled, created_at)`
- Trigger types: `log_error`, `api_rate_limit`, `token_usage`, `skill_failure`, `custom_webhook`
- When trigger fires, send Discord notification to user's DM with:
  - Alert title + severity
  - Relevant data (error message, usage %age, etc.)
  - Quick action buttons ("Investigate", "Ignore", "Configure")
- Example alerts:
  - "Observability server crashed" → auto-restart and notify
  - "Claude Code process using >80% memory" → notify
  - "Failed to transcribe voice note (Groq API down)" → fallback + notify

---

### Enhancement 11: Conversation Export & Analysis

**Capability:** Export Discord conversation history for analysis, training, or archival.

**Implementation:**
- `/export format:json|markdown|html range:last-7-days` command
- Exports session history with metadata:
  - Timestamps, turn IDs, token usage per message
  - Attached files/images (as links)
  - Memory context injected at each turn
- Optionally analyze conversation:
  - Topics discussed (auto-tag via Claude)
  - Sentiment over time
  - Most helpful responses (user reactions)
  - Token efficiency metrics

---

### Enhancement 12: Multi-Session & Team Mode (Future)

**Capability:** Support multiple Discord users sharing the same Sam instance (future-proof, not Phase 1).

**Notes for future consideration:**
- Current design: one PAI instance → one Discord bot → one user (isolation by `DISCORD_ALLOWED_USER_IDS`)
- Future enhancement: could add per-user session isolation with role-based access:
  - Admin user: can manage skills, configure bot, view all logs
  - Member user: can interact but can't access other members' conversations
  - This would require: per-user memory isolation, ACL system, audit logging

---

## Summary of Enhancements

| Enhancement | Phase | Effort | Free/Pro | Benefit |
|---|---|---|---|---|
| Video Interpretation | 10 | Medium | Pro | Multimodal analysis of video content |
| Image Generation | 11 | Medium | Low-cost | Visual responses and diagram generation |
| Web Search | 12 | Low | Pro | Contextualized research from Discord |
| Semantic Memory | 13 | Medium | Pro | Smarter long-term memory, topic retention |
| Slash Commands | 14 | Medium | Pro | CLI-like interface from Discord |
| Proactive Jobs | 15 | High | Pro | Scheduled tasks and reminders |
| MCP Integration | 16 | Low | Pro | Access existing skills from Discord |
| Context Optimization | 17 | Low | Pro | Leverage full 200k context window |
| Task Management | 18 | Medium | Pro | Convert Discord to actionable tasks |
| Custom Alerts | 19 | Medium | Pro | Proactive monitoring and notifications |
| Conversation Export | 20 | Low | Pro | Archive and analyze conversations |
| Multi-user Mode | Future | High | Pro | Team collaboration (future phase) |

**All enhancements work with Claude Pro subscription (no additional API keys needed for Claude reasoning). Free/low-cost for supporting services (Groq transcription, Discord bot, optional image generation).**
