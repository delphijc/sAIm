# Setup Scripts Reference

Comprehensive guide to Sam's setup and installation scripts.

---

## Overview

Sam's primary setup entry point is a single bash script:

**`.agent/setup.sh`** — The main PAI installer. Handles everything from prerequisites through companion project cloning, environment configuration, service setup, and validation. Cross-platform: macOS and Linux.

> **Legacy scripts** (`Tools/setup/bootstrap.sh`, `Tools/setup/setup.ts`) described the old symlink-based install approach and are no longer used. The `setup.sh` script is the canonical installation method.

---

## setup.sh

**Location:** `.agent/setup.sh`

**Purpose:** Full PAI installation and configuration. Idempotent — safe to re-run at any time to update choices without breaking existing configuration.

**Platforms:** macOS, Linux (systemd-based)

### Quick Start

```bash
# Full setup (first-time or re-run)
bash .agent/setup.sh

# Standalone operations (see Flags section)
bash .agent/setup.sh --configure-env
bash .agent/setup.sh --clone-projects
bash .agent/setup.sh --install-security-tools
bash .agent/setup.sh --fix-paths
bash .agent/setup.sh --check
```

---

### Setup Steps

The full setup runs these steps in order:

#### Step 1 — System Check
- Detects OS (macOS vs Linux)
- Verifies bash version
- Confirms running from correct repo root

#### Step 2 — Prerequisites
- **Git** — Required; exits with install guidance if missing
- **Bun** — Offers to install via official installer if not found
- **Node.js** — Offers to install via nvm if not found

#### Step 3 — PAI Installation
- Copies `.agent/` into `~/.claude/` (Claude Code config dir)
- Runs `fix_hardcoded_paths()` to substitute `__HOME__` placeholders in:
  - `~/.claude/settings.json`
  - `~/.claude/.mcp.json`
  - Service install scripts
  - Hook scripts
- Sets `PAI_PROJECT_ROOT` environment variable

#### Step 3.5 — Companion Project Cloning

Prompts to selectively clone PAI companion repos into `~$HOME/Projects/`. Each project is prompted individually with `[Y/n]`. Already-cloned repos (`.git` dir exists) are detected and skipped automatically.

| Project | Description |
|---------|-------------|
| `awareness` | Alert monitoring dashboard |
| `voice-server` | Voice HTTP API service |
| `chatterbox` | Local TTS model inference |
| `cyber-alert-mgr` | Cyber alert management |
| `markdown-editor` | Web-based markdown editor |
| `jay-gentic` | Genetic algorithm experiments |
| `nlm` | Node language model utilities (third-party) |

> **Note:** `realms-of-tomorrow` is intentionally excluded — it is not a PAI component.

#### Step 4 — Node Dependencies
```bash
npm install
```
Installs packages required by PAI skills, hooks, and TypeScript tools.

#### Step 5 — Bun Dependencies
```bash
bun install
```
Installs Bun packages for TypeScript services.

#### Step 6 — System Services

**Linux (systemd `--user`):**
**Linux (systemd):** Installs and enables:
- `voice-server.service` (port 8888) — manages python-sidecar internally
- `observability-dashboard.service` (ports 4000/5172)
- `discord-remote-control.service`
- `awareness-dashboard-server.service` (port 4100) + `awareness-dashboard-client.service` (port 5173)
- `cyber-alert-mgr-server.service` (port 4200) + `cyber-alert-mgr-frontend.service` (port 5174)
- `markdown-editor.service` (port 4444)
- All grouped under `pai-infrastructure.target`

> **Note:** `python-sidecar` is **not** installed as a separate service. It is managed internally by voice-server. A standalone service causes a port conflict on 8889.

**macOS (launchd):** Installs LaunchAgent plists to `~/Library/LaunchAgents/` and creates named wrapper scripts in `~/.claude/bin/`. Services auto-start at login and appear by name in System Settings → Login Items.

Service management (Linux):
```bash
systemctl --user status voice-server observability-dashboard discord-remote-control
systemctl --user restart voice-server
journalctl --user -u voice-server.service -n 20 --no-pager
```

Service management (macOS):
```bash
launchctl list | grep -E "com\.(pai|sam)\."
launchctl bootout "gui/$(id -u)/com.pai.voice-server"   # stop
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.pai.voice-server.plist  # start
tail -f ~/Library/Logs/pai-voice-server.log
```

#### Step 7 — Environment Variables (`configure_env`)

Runs the per-variable `.env` wizard. Reads `.agent/.env.example` line by line:

- **Already configured vars** (have real values): prompted with `[K]eep (default) / [C]hange / [S]kip`
- **Unconfigured/placeholder vars** (empty or `your_*` / `*_here` values): prompted with `[A]dd / [S]kip (default)`
- **Secret values** (matching `TOKEN|KEY|SECRET|PASSWORD|PASS`): displayed as `xxxx****`

After the wizard completes, `propagate_env()` automatically copies `.env` to:
- `.agent/.env.discord` — for the Discord remote control service
- `~$HOME/Projects/awareness/.env` — if the awareness project exists

#### Step 8 — Final Validation
- Verifies hooks are executable
- Tests service health endpoints
- Confirms Claude Code integration

---

### Standalone Flags

All flags are idempotent and can be combined with re-runs of the full setup.

| Flag | What it does |
|------|-------------|
| `--configure-env` | Re-run the per-variable `.env` wizard only (also propagates) |
| `--clone-projects` | Re-run companion project cloning only |
| `--install-security-tools` | Install security CLI tools via Homebrew/Linuxbrew |
| `--fix-paths` | Replace `__HOME__` placeholders in config files |
| `--check` | Run health check without making changes |
| `--install-services` | Re-install systemd/launchd services only |
| `--help` | Show usage |

```bash
# Example: user moved home dir or switched machines
bash .agent/setup.sh --fix-paths

# Example: add new API keys without touching anything else
bash .agent/setup.sh --configure-env

# Example: fresh machine, want to clone companion repos
bash .agent/setup.sh --clone-projects
```

---

### Internal Functions

These functions are called by the setup steps but can also be invoked via the standalone flags:

#### `fix_hardcoded_paths()`
Replaces `__HOME__` (or the previous user's hardcoded home path) with `$HOME` in all config files. Runs automatically during Step 3.

Files it processes:
- `.agent/settings.json`
- `.agent/.mcp.json`
- `.agent/services/install-systemd.sh`
- Hook scripts referencing absolute paths

#### `configure_env(env_file, env_example)`
The per-variable `.env` wizard (Step 7). Reads `.env.example` as the template, checks current `.env` state, and prompts interactively for each variable. Calls `propagate_env()` on completion.

#### `propagate_env(env_file)`
Copies the configured `.env` to linked locations:
- `.agent/.env.discord` — always (chmod 600)
- `~$HOME/Projects/awareness/.env` — if `~$HOME/Projects/awareness/` exists (chmod 600)

Called automatically at the end of `configure_env()` and via `--configure-env`.

#### `clone_companion_projects(projects_dir)`
Prompts per-project `[Y/n]` to git clone PAI companion repos. Checks for `.git` directory before prompting — already-cloned repos print a skip message. Prints a summary of cloned vs skipped at the end.

---

### Security Tools Installation

The `--install-security-tools` flag installs the ProjectDiscovery toolkit and nmap via Homebrew/Linuxbrew:

```bash
bash .agent/setup.sh --install-security-tools
```

**Requires Homebrew (macOS) or Linuxbrew (Linux).** The flag first checks if brew is available:
- If brew is found: installs `naabu httpx nuclei subfinder nmap`
- If brew is missing: warns and provides install instructions

For full security tool documentation, see [Security Tools Reference](security-tools.md).

---

### Idempotency

`setup.sh` is designed to be safely re-run:

| Concern | How it's handled |
|---------|-----------------|
| Existing `.env` | `configure_env()` prompts Keep/Change/Skip per var — never overwrites silently |
| Already-cloned repos | `.git` dir check before prompting — skips with success message |
| Path substitution | `sed` replacements are idempotent; won't double-substitute |
| Services already installed | Detects existing service files; offers to reinstall or skip |
| Shell profile exports | Checks for existing PAI block before appending |

---

### Environment Variables

Variables set by setup in shell profile (`~/.bashrc` / `~/.zshrc`):

| Variable | Purpose |
|----------|---------|
| `PAI_DIR` | Path to `~/.claude` (Claude Code config dir) |
| `PAI_PROJECT_ROOT` | Path to `~$HOME/Projects/sam` |

Variables configured interactively in `.env` (see `.agent/.env.example` for full list):

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Required for Claude |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS |
| `ELEVENLABS_VOICE_ID` | Voice ID (e.g. Jessica) |
| `PERPLEXITY_API_KEY` | Perplexity research agent |
| `GOOGLE_API_KEY` | Gemini research agent |
| `BRIGHTDATA_API_KEY` | Web scraping |
| `DISCORD_BOT_TOKEN` | Discord remote control |
| `DISCORD_CHANNEL_ID` | Discord channel for Sam |

---

## Setup Script Comparison

| Script | Status | Platform | Use Case |
|--------|--------|----------|----------|
| `.agent/setup.sh` | ✅ Current | macOS + Linux | All installation scenarios |
| `Tools/setup/bootstrap.sh` | ⚠️ Legacy | macOS | Obsolete — old symlink approach |
| `Tools/setup/setup.ts` | ⚠️ Legacy | Cross-platform | Obsolete — TypeScript wizard |
| `voice-server/install.sh` | ✅ Current | macOS | Voice server standalone install |
| `scripts/setup_dev_env.sh` | ✅ Current | macOS/Linux | Development environment |

---

## Common Setup Workflows

### First-Time Installation

```bash
# 1. Clone
mkdir -p ~/Projects
git clone https://github.com/delphijc/sam.git ~$HOME/Projects/sam
cd ~$HOME/Projects/sam

# 2. Run full setup
bash .agent/setup.sh

# 3. Reload shell
source ~/.bashrc   # or ~/.zshrc

# 4. Start Claude Code
claude
```

### Migrate to a New Machine

```bash
# 1. Clone to new machine
mkdir -p ~/Projects
git clone https://github.com/delphijc/sam.git ~$HOME/Projects/sam
cd ~$HOME/Projects/sam

# 2. Run setup (will fix all paths, configure env, clone companions)
bash .agent/setup.sh

# 3. Re-enter API keys during env wizard (or copy .env from old machine first)
```

### Update API Keys or Add New Ones

```bash
bash .agent/setup.sh --configure-env
```

### Add Companion Projects After Initial Setup

```bash
bash .agent/setup.sh --clone-projects
```

### Install Security Testing Tools

```bash
bash .agent/setup.sh --install-security-tools
```

### Developer Setup

```bash
# 1. Full setup first
bash .agent/setup.sh

# 2. Install dev toolchain
cd ~$HOME/Projects/sam/.agent
./scripts/setup_dev_env.sh

# 3. Run tests
bun test
```

---

## Troubleshooting

### Setup Script Exits Early

```bash
# Check prerequisites
git --version
bun --version
node --version

# Run with verbose output
bash -x .agent/setup.sh 2>&1 | tee /tmp/pai-setup.log
```

### Paths Show `__HOME__` After Install

```bash
bash .agent/setup.sh --fix-paths
```

### `.env` Not Propagating to Discord or Awareness

```bash
bash .agent/setup.sh --configure-env
# This re-runs the wizard AND propagates at the end
```

### Companion Repos Not Cloning

Verify git is in PATH and you have network access:
```bash
git --version
git ls-remote https://github.com/delphijc/sam.git HEAD
```

### Services Not Starting

```bash
# Linux
journalctl --user -u voice-server.service -n 30 --no-pager
systemctl --user status voice-server

# macOS
tail -f ~/Library/Logs/pai-voice-server.log
launchctl list | grep com.pai
```

---

## See Also

- [Getting Started](getting-started.md) — Installation walkthrough
- [Security Tools](security-tools.md) — Security toolkit reference
- [MCP Management](mcp-management.md) — MCP server configuration
