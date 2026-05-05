# Optional Add-ons for Sam

**Sam core is minimal and focused. Everything beyond basic agent orchestration is an optional add-on from a separate repository.**

---

## Core Sam (Included)

The base Sam installation provides:
- ✅ Agent orchestration via Claude Code
- ✅ Hook system for lifecycle events
- ✅ Skill system for capability packages (27 pre-built skills)
- ✅ 27 specialized agent personas
- ✅ Memory file system (local)
- ✅ Git isolation and protected file validation
- ✅ Progressive disclosure UI model

Everything else is optional.

---

## Optional Add-ons (Separate Repositories)

Each add-on is a **completely independent repository** with its own:
- Release cycle
- Codebase and testing
- Installation instructions
- Configuration requirements
- Optional dependencies

### 1. **voice-server** — Text-to-Speech HTTP API

**Repository:** `~/Projects/voice-server`

**What it does:**
- Provides HTTP API on port 8888 for text-to-speech
- Manages python-sidecar internally (PyTorch models)
- Enables audible responses from Sam

**Installation:**
```bash
cd ~/Projects
git clone <voice-server-repo> voice-server
cd voice-server
./setup.sh
```

**Integration:**
- Hooks call voice-server API when available
- Gracefully degrades to text-only if unavailable
- No tight coupling to Sam core

**Enable/Disable:**
```bash
# macOS
launchctl load ~/Library/LaunchAgents/com.pai.voice-server.plist
launchctl unload ~/Library/LaunchAgents/com.pai.voice-server.plist

# Linux
systemctl --user start voice-server
systemctl --user stop voice-server
```

---

### 2. **memory-system** — Semantic Memory Backend

**Repository:** `~/Projects/memory-system`

**What it does:**
- Persistent semantic knowledge extraction (12 extraction patterns)
- Fact consolidation and deduplication
- Graph-based association building (Hebbian learning)
- HTTP API on port 4242 for memory queries

**Installation:**
```bash
cd ~/Projects
git clone <memory-system-repo> memory-system
cd memory-system
bun install
bun run start
```

**Integration:**
- Enabled via `ENABLE_MEMORY_HOOKS=true` in `.agent/.env`
- Optional for Discord-remote-control semantic context
- Disabled by default

**Enable/Disable:**
```bash
# Edit .agent/.env
ENABLE_MEMORY_HOOKS=true  # enable
ENABLE_MEMORY_HOOKS=false # disable

# Then restart Claude Code session
```

---

### 3. **discord-remote-control** — Discord Interface

**Repository:** `~/Projects/sam/.agent/skills/discord-remote-control` (built-in but optional service)

**What it does:**
- Discord bot for remote Sam interaction
- Recent conversation history (episodic memory)
- Optional semantic memory context retrieval
- Remote command execution

**Installation:**
Discord bot requires:
1. Create Discord application at https://discord.com/developers
2. Set `DISCORD_BOT_TOKEN` in `.agent/.env`
3. Start the service:
```bash
launchctl load ~/Library/LaunchAgents/com.pai.discord-remote-control.plist  # macOS
```

**Integration:**
- Standalone Discord bot process
- Calls memory-system API if available
- Continues working without memory-system

---

### 4. **awareness-dashboard** — Situational Awareness Feed

**Repository:** `~/Projects/awareness`

**What it does:**
- Monitors external feeds and alerts
- Generates daily/weekly briefings
- Dashboard UI for situational awareness
- Server (port 4100) + Client (port 5173)

**Installation:**
```bash
cd ~/Projects
git clone <awareness-repo> awareness
cd awareness
./setup.sh
```

**Integration:**
- Completely optional
- Runs as independent service
- No coupling to core Sam

---

### 5. **service-monitor-dashboard** — Infrastructure Monitoring

**Repository:** `~/Projects/sam/.agent/skills/service-monitor-dashboard` (built-in but optional)

**What it does:**
- Real-time dashboard for PAI service health
- Metrics and restart controls
- Server (port 6000) + Client (port 5175)

**Installation:**
Auto-included in Sam but requires start:
```bash
launchctl load ~/Library/LaunchAgents/com.pai.service-monitor-dashboard.plist  # macOS
```

---

### 6. **observability-dashboard** — Agent Activity Monitoring

**Repository:** Separate project (not currently implemented)

**What it does:**
- Real-time visualization of agent orchestration
- Activity logs and event streaming
- Server (port 5172)

**Status:** Service definitions exist but implementation is separate/not currently active.

---

### 7. **jay-gentic** — Local LLM Backend

**Repository:** `~/Projects/jay-gentic`

**What it does:**
- Local Bash+Go CLI for inference via Ollama/llama.cpp
- Alternative to Anthropic API for agent reasoning
- Uses same agent definitions as Claude Code

**Installation:**
```bash
cd ~/Projects
git clone <jay-gentic-repo> jay-gentic
cd jay-gentic
./setup.sh
```

**Integration:**
- Enabled via `PAI_USE_JAY_GENTIC=true` in `.agent/.env`
- Shares agent definitions with Sam
- Falls back to Claude Code if unavailable

**Enable/Disable:**
```bash
# Edit .agent/.env
PAI_USE_JAY_GENTIC=true  # use local LLM
PAI_USE_JAY_GENTIC=false # use Claude Code (default)
```

---

## Integration Model

All add-ons follow the same pattern:

```
Sam Core (Minimal)
    ↓
    ├── Optional Add-ons (Separate Repos)
    │   ├── voice-server
    │   ├── memory-system
    │   ├── discord-remote-control
    │   ├── awareness-dashboard
    │   └── jay-gentic
    │
    └── [Core continues to work without any add-ons]
```

### Key Principles

1. **No Hard Dependencies:** Core Sam works without any add-ons
2. **Graceful Degradation:** Sam detects missing services and continues
3. **Independent Release Cycles:** Update add-ons separately from Sam
4. **Opt-In Model:** Enable only what you need
5. **Clear Separation:** Each add-on has its own repository and lifecycle

---

## Installation via setup.sh

The Sam setup script handles optional add-on installation:

```bash
cd ~/Projects/sam
bash .agent/setup.sh
```

During setup, you'll be prompted to optionally clone:
- `voice-server`
- `awareness`
- `memory-system`
- `discord-remote-control`
- `jay-gentic`

Say `Y` to clone, `N` to skip. You can run setup again later to add them.

---

## Minimal Install (Core Only)

For the absolute minimum, skip all optional add-ons:

```bash
cd ~/Projects/sam
bash .agent/setup.sh
# Decline all optional add-on prompts
```

Then Sam runs as a text-only agent orchestration system with no external services.

---

## Full Install (All Add-ons)

To enable all optional features:

```bash
cd ~/Projects/sam
bash .agent/setup.sh
# Accept all optional add-on prompts

# Additional setup for each add-on:

# voice-server
cd ~/Projects/voice-server && ./setup.sh

# memory-system
cd ~/Projects/memory-system && bun install

# awareness
cd ~/Projects/awareness && ./setup.sh

# Then set env vars in .agent/.env:
ENABLE_MEMORY_HOOKS=true
PAI_USE_JAY_GENTIC=false  # or true if using local LLM
DISCORD_BOT_TOKEN=<your-token>
```

---

## Architecture Decision

**Why are add-ons separate?**

1. **Supply Chain Security** — Minimize core dependencies
2. **Flexibility** — Users choose what they need
3. **Independent Evolution** — Add-ons update without blocking Sam releases
4. **Clear Boundaries** — No tight coupling to optional features
5. **Testing Simplicity** — Core tests don't depend on external services

---

## Troubleshooting

### Add-on not starting?

1. Check service status:
```bash
launchctl list | grep com.pai  # macOS
systemctl --user status pai-infrastructure.target  # Linux
```

2. Review logs:
```bash
# macOS
log stream --predicate 'eventMessage contains[c] "voice-server"'

# Linux
journalctl --user -u voice-server.service -n 20 --no-pager
```

3. If a service isn't critical, you can disable it:
```bash
launchctl unload ~/Library/LaunchAgents/com.pai.<service>.plist  # macOS
```

### Missing environment variables?

Edit `.agent/.env` and restart Claude Code.

### Want to remove an add-on?

1. Stop the service
2. Unload from systemd/launchd
3. Delete the project directory if desired
4. Remove any environment variables

---

## Next Steps

- **Getting Started:** Start with core Sam in `getting-started.md`
- **Each Add-on:** Detailed setup in each project's README
- **Configuration:** Environment variables in `.agent/.env.example`
- **Troubleshooting:** Platform-specific guides in `troubleshooting.md`
