# Getting Started with Sam

This guide will get you up and running with Sam in under 15 minutes.

---

## Prerequisites

Before installing Sam, ensure you have:

- **Git** — Version control (required for cloning)
- **Bun** v1.0+ — JavaScript runtime ([install](https://bun.sh)) — installed automatically by setup
- **Claude Code** — Anthropic's CLI tool ([install](https://claude.ai/code))
- **macOS or Linux** — Supported platforms

> **Note:** The setup script will check for and offer to install missing prerequisites (Bun, Node.js). Git must be available before you can clone.

---

## Installation

### Step 1: Create Projects Directory & Clone

Sam is designed to live at `~$HOME/Projects/sam`. Create the directory if it doesn't exist, then clone:

```bash
mkdir -p ~/Projects
git clone https://github.com/delphijc/sam.git ~$HOME/Projects/sam
cd ~$HOME/Projects/sam
```

### Step 2: Run the Setup Script

```bash
bash .agent/setup.sh
```

That's it — the setup script handles everything else interactively.

---

## What the Setup Script Does

`setup.sh` walks you through the following steps:

### Step 1 — System Check
Verifies OS (macOS or Linux), checks for required tools.

### Step 2 — Prerequisites
- Confirms **Git** is installed (required — exits if missing)
- Offers to install **Bun** if not found
- Offers to install **Node.js** if not found

### Step 3 — PAI Installation
Installs `.agent/` as `~/.claude/` (the Claude Code config directory):
- Copies skills, hooks, agents, tools, and services
- Substitutes your home directory path into all config files

### Step 3.5 — Companion Project Cloning
Prompts you to selectively clone optional PAI companion projects into `~$HOME/Projects/`:

| Project | Purpose |
|---------|---------|
| `awareness` | Alert monitoring dashboard |
| `voice-server` | Voice HTTP API service |
| `chatterbox` | Local TTS model inference |
| `cyber-alert-mgr` | Cyber alert management |
| `markdown-editor` | Web-based markdown editor |
| `jay-gentic` | Genetic algorithm experiments |
| `nlm` | Node language model utilities |

Each is prompted individually (`[Y/n]`). Already-cloned repos are skipped automatically — safe to re-run.

### Step 4 — Node Dependencies
Installs npm packages required by PAI skills and hooks.

### Step 5 — Bun Dependencies
Installs Bun packages for TypeScript tools.

### Step 6 — Systemd Services (Linux) / LaunchAgents (macOS)
Sets up optional auto-start services. The mechanism differs by platform:

- **Linux:** systemd user services under `pai-infrastructure.target`
- **macOS:** LaunchAgent plists in `~/Library/LaunchAgents/` with named wrapper scripts in `~/.claude/bin/`

| Service | Port(s) | Purpose |
|---------|---------|---------|
| `voice-server` | 8888 | Text-to-speech HTTP API (manages sidecar internally) |
| `observability-dashboard` | 4000 / 5172 | Real-time agent monitoring |
| `discord-remote-control` | — | Discord-based remote interface |
| `awareness-dashboard` | 4100 / 5173 | Situational awareness feed |
| `cyber-alert-mgr` | 4200 / 5174 | Cyber alert management |
| `markdown-editor` | 4444 | Web-based markdown viewer |
| `memory-backup` | — | Hourly + daily memory snapshots |

> **Note:** `python-sidecar` (port 8889) is spawned by voice-server internally — do **not** install it as a separate service.

See `.agent/wiki/systemd-service.md` for full per-platform documentation.

### Step 7 — Environment Variables
Runs the **per-variable `.env` wizard**:
- Reads `.agent/.env.example` line by line
- For each variable:
  - **Configured** vars: `[K]eep` (default) / `[C]hange` / `[S]kip`
  - **Unconfigured/placeholder** vars: `[A]dd` / `[S]kip` (default)
- Secret values (tokens, keys, passwords) are masked as `xxxx****`
- After configuration, `.env` is propagated to:
  - `.agent/.env.discord`
  - `~$HOME/Projects/awareness/.env` (if the project exists)

### Step 8 — Final Validation
Tests hooks, verifies service health, confirms install is complete.

---

## Environment Variables

The key variables to configure during setup:

**Required:**
```bash
ANTHROPIC_API_KEY=sk-ant-...   # Required for Claude
```

**Optional (voice):**
```bash
ELEVENLABS_API_KEY=...         # ElevenLabs TTS
ELEVENLABS_VOICE_ID=...        # Voice ID (e.g., "Jessica")
```

**Optional (research agents):**
```bash
PERPLEXITY_API_KEY=...         # Perplexity research
GOOGLE_API_KEY=...             # Gemini integration
```

**Optional (other):**
```bash
BRIGHTDATA_API_KEY=...         # Web scraping
DISCORD_BOT_TOKEN=...          # Discord remote control
```

---

## First Run

### Start Claude Code

```bash
cd ~$HOME/Projects/sam
claude
```

Sam automatically loads via the `SessionStart` hook. You'll see a greeting and context loading in the terminal.

### Verify Installation

Try these in Claude Code:
```
"What skills are available?"
"Show me my stack preferences"
"What agents do I have access to?"
```

### Check Service Status

```bash
# Linux (systemd)
systemctl --user status voice-server observability-dashboard python-sidecar discord-remote-control

# macOS (launchd)
launchctl list | grep com.pai
```

---

## Re-Running Setup

`setup.sh` is fully idempotent — safe to re-run at any time to update choices or reconfigure:

```bash
# Full re-run
bash .agent/setup.sh

# Reconfigure only .env variables
bash .agent/setup.sh --configure-env

# Re-run companion project cloning only
bash .agent/setup.sh --clone-projects

# Fix hardcoded paths after moving to a new machine
bash .agent/setup.sh --fix-paths

# Install optional security tools (naabu, httpx, nuclei, subfinder, nmap)
bash .agent/setup.sh --install-security-tools
```

---

## Optional: Security Tools

For penetration testing and security research workflows, install the security toolkit:

```bash
bash .agent/setup.sh --install-security-tools
```

This installs via Homebrew/Linuxbrew:
- `naabu` — Fast port scanner
- `httpx` — HTTP probing & tech stack detection
- `nuclei` — Vulnerability scanner
- `subfinder` — Passive subdomain discovery
- `nmap` — Comprehensive port/service scanner

See [Security Tools Reference](security-tools.md) for usage details.

---

## Directory Structure

After installation, key locations:

```
~$HOME/Projects/sam/
├── .agent/               # PAI infrastructure (also installed to ~/.claude)
│   ├── skills/           # Skill definitions
│   ├── agents/           # Specialized agents
│   ├── hooks/            # Event automation
│   ├── services/         # Systemd service files
│   ├── wiki/             # This documentation
│   ├── .env              # API keys (NEVER commit)
│   ├── .env.discord      # Discord service env (auto-propagated)
│   └── settings.json     # Claude Code configuration
└── .claude/              # Claude Code config symlink target (→ .agent)
```

---

## Troubleshooting

### Sam Not Loading

Check that hooks are configured:
```bash
cat ~/.claude/settings.json | grep SessionStart
```

Manually load CORE skill:
```
read ~/.claude/skills/CORE/SKILL.md
```

### Hooks Failing

Ensure Bun is in PATH:
```bash
which bun
bun --version
```

If paths show `__HOME__` placeholders, fix them:
```bash
bash .agent/setup.sh --fix-paths
```

### Voice Not Working

1. Check API key in `.env`
2. Verify service is running:
   ```bash
   curl http://localhost:8888/health
   ```
3. Check service logs:
   ```bash
   # Linux
   journalctl --user -u voice-server.service -n 20 --no-pager
   ```

### .env Not Propagating

Re-run env configuration:
```bash
bash .agent/setup.sh --configure-env
```

This re-runs the wizard and propagates `.env` to `.agent/.env.discord` and `~$HOME/Projects/awareness/.env`.

---

## Next Steps

1. **Read the Contract** — [SAM Contract](SAM-Contract.md) — core guarantees vs optional features
2. **Explore Skills** — [Skills Reference](Skills-Reference.md)
3. **Understand Architecture** — [Architecture Overview](Architecture.md)
4. **Setup Reference** — [Setup Scripts Reference](setup-scripts.md)
5. **Security Tools** — [Security Tools Reference](security-tools.md)

---

## Quick Reference

| Action | Command |
|--------|---------|
| Full setup | `bash .agent/setup.sh` |
| Reconfigure .env | `bash .agent/setup.sh --configure-env` |
| Clone companion projects | `bash .agent/setup.sh --clone-projects` |
| Fix paths | `bash .agent/setup.sh --fix-paths` |
| Install security tools | `bash .agent/setup.sh --install-security-tools` |
| Start Claude | `claude` |
| Check services (Linux) | `systemctl --user status voice-server` |
| Check services (macOS) | `launchctl list \| grep com.pai` |

---

*See also: [Setup Scripts Reference](setup-scripts.md) | [Security Tools](security-tools.md) | [MCP Management](mcp-management.md)*
