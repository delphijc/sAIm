# PAI Dependencies Guide

Complete reference for all mandatory and optional dependencies required by PAI (Personal AI Infrastructure).

## Quick Start

```bash
# Run the setup script (handles everything interactively)
bash .agent/setup.sh

# Or just check what's installed
bash .agent/setup.sh --check
```

---

## System Requirements

| Requirement | Minimum | Recommended | Notes |
|-------------|---------|-------------|-------|
| **OS** | Ubuntu 22.04 / macOS 13+ | Ubuntu 24.04 / macOS 14+ | Linux Mint, Debian also supported |
| **RAM** | 4 GB | 8 GB+ | More needed for local LLM inference |
| **Disk** | 2 GB | 10 GB+ | Whisper models + musicgen use significant space |
| **Architecture** | x86_64 / arm64 | x86_64 | arm64 (Apple Silicon) supported on macOS |

---

## Mandatory Dependencies

These are required for core PAI functionality.

### Runtime

| Dependency | Version | Install | Purpose |
|------------|---------|---------|---------|
| **Bun** | >= 1.0.0 | `curl -fsSL https://bun.sh/install \| bash` | Primary JavaScript/TypeScript runtime |
| **Git** | >= 2.30 | `apt install git` / `brew install git` | Version control, repo management |
| **curl** | any | Pre-installed on most systems | HTTP requests in scripts and voice notifications |
| **bash** | >= 4.0 | Pre-installed | Shell scripts throughout the project |

### Node.js Packages (installed via `bun install`)

| Package | Used By | Purpose |
|---------|---------|---------|
| `@anthropic-ai/sdk` | Discord Remote Control | Claude API client |
| `discord.js` | Discord Remote Control | Discord bot framework |
| `docx` | Discord Remote Control | DOCX document generation |
| `pptxgenjs` | Discord Remote Control | PowerPoint generation |
| `vue`, `vite`, `tailwindcss` | Observability Dashboard | Frontend UI framework |

### Claude Code

PAI is built as a Claude Code extension system. Install from: https://claude.ai/code

---

## Optional Dependencies

### Speech-to-Text: whisper.cpp

**Required for:** Audio transcription (`transcribe-audio` skill, Discord voice notes)

| Dependency | Version | Install | Purpose |
|------------|---------|---------|---------|
| **CMake** | >= 3.5 | `apt install cmake` / `brew install cmake` | Build system for whisper.cpp |
| **gcc/g++** | >= 11 | `apt install build-essential` / Xcode CLI Tools | C/C++ compiler |
| **make** | any | Pre-installed | Build orchestration |

**Setup:**
```bash
cd .agent/tools/whisper.cpp
cmake -B build
cmake --build build --config Release -j$(nproc)

# Download a model (base recommended for balance of speed/accuracy)
bash models/download-ggml-model.sh base
```

**Models** (downloaded to `.agent/tools/whisper.cpp/models/`):

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| `tiny` | 75 MB | Fastest | Low | Quick drafts, testing |
| `base` | 142 MB | Fast | Good | **Default — recommended** |
| `small` | 466 MB | Medium | Better | Important recordings |
| `medium` | 1.5 GB | Slow | High | Professional transcription |
| `large` | 3.1 GB | Slowest | Best | Maximum accuracy |

Set model via `WHISPER_MODEL` in `.env`.

### Text-to-Speech: Voice Server

**Required for:** Audible responses, voice notifications

Lives in a separate repository: `~/Projects/voice-server`

| Dependency | Install | Purpose |
|------------|---------|---------|
| **Bun** | (see above) | Voice server runtime |
| **Python 3.9-3.11** | `apt install python3` | Chatterbox TTS model (python-sidecar) |
| **python3-venv** | `apt install python3-venv` | Virtual environment for sidecar |
| **ffmpeg** | `apt install ffmpeg` / `brew install ffmpeg` | Audio format conversion |

**Providers** (set via `VOICE_PROVIDER` in `.env`):

| Provider | Type | Cost | Quality | Requirements |
|----------|------|------|---------|-------------|
| `chatterbox` | Local | Free | High | python-sidecar running on port 8889 |
| `elevenlabs` | Cloud | Paid | Premium | `ELEVENLABS_API_KEY` in `.env` |
| `none` | — | — | — | Disables voice output |

### Music Generation: musicgen

**Required for:** AI music generation

| Dependency | Install | Purpose |
|------------|---------|---------|
| **Python 3.12** | System python | ML runtime |
| **python3-venv** | `apt install python3-venv` | Virtual environment |

**Setup:**
```bash
cd .agent/tools/musicgen
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt  # if exists, otherwise install deps manually
```

### Local LLM Inference: Ollama

**Required for:** Task runner local backends, offline LLM inference

| Dependency | Install | Purpose |
|------------|---------|---------|
| **Ollama** | https://ollama.ai | Local LLM server |

```bash
# Install
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull qwen2.5:latest
```

### AI Prompt Framework: Fabric

**Required for:** `fabric` skill — pattern-based AI prompting (extract_wisdom, summarize, etc.)

```bash
# Install Fabric CLI
curl -sSL https://raw.githubusercontent.com/danielmiessler/fabric/main/install.sh | bash

# Download patterns
fabric -U
```

### Web Scraping: Bright Data

**Required for:** `bright-data` skill — scraping pages with bot detection

No local dependencies — requires `BRIGHTDATA_API_KEY` in `.env`.

---

## External Repository Dependencies

| Repository | Location | Purpose | Required |
|------------|----------|---------|----------|
| **whisper.cpp** | `.agent/tools/whisper.cpp/` | Speech-to-text engine | Optional (for transcription) |
| **voice-server** | `~/Projects/voice-server/` | TTS HTTP API server | Optional (for voice output) |

### whisper.cpp

- **Source:** https://github.com/ggerganov/whisper.cpp
- **Version:** v1.8.3
- **Included as:** Cloned repository (not a git submodule)
- **Build output:** `.agent/tools/whisper.cpp/build/bin/whisper-cli`
- **Models:** `.agent/tools/whisper.cpp/models/ggml-*.bin`

### voice-server

- **Source:** Separate project repository
- **Location:** `~/Projects/voice-server/`
- **Manages:** TTS via Bun (port 8888) + Python sidecar for Chatterbox (port 8889)

---

## Systemd Services

PAI uses **systemd user services** for persistent background processes. All services are optional and independently manageable.

### Service Overview

| Service | Unit File | Port | Depends On |
|---------|-----------|------|------------|
| **voice-server** | `voice-server.service` | 8888 | voice-server repo |
| **python-sidecar** | `python-sidecar.service` | 8889 | voice-server repo, Python venv |
| **observability-dashboard** | `observability-dashboard.service` | 5172 | Bun, Vue/Vite |
| **discord-remote-control** | `discord-remote-control.service` | — | Bun, Discord bot token |

### Group Target

All services belong to `pai-infrastructure.target` for coordinated management:

```bash
# Start all PAI services
systemctl --user start pai-infrastructure.target

# Stop all PAI services
systemctl --user stop pai-infrastructure.target

# Check status
systemctl --user status voice-server python-sidecar observability-dashboard discord-remote-control
```

### Installation

Service unit files are installed to `~/.config/systemd/user/`:

```bash
# The setup script handles this, or manually:
bash .agent/setup.sh --install-services
```

---

## Environment Variables Reference

See `.env.example` for the complete list with descriptions. Key categories:

| Category | Variables | Required |
|----------|-----------|----------|
| **Voice Server** | `PORT`, `VOICE_PROVIDER`, `CHATTERBOX_VOICE_ID` | For voice output |
| **Research Agents** | `PERPLEXITY_API_KEY`, `GOOGLE_API_KEY` | For research skills |
| **Image/Video Gen** | `OPENAI_API_KEY`, `REPLICATE_API_TOKEN` | For art/content skills |
| **Transcription** | `WHISPER_MODEL` | For transcribe-audio |
| **Discord Bot** | `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CHANNEL_ID`, `DISCORD_ALLOWED_USER_IDS` | For Discord remote control |
| **Web Scraping** | `BRIGHTDATA_API_KEY` | For bright-data skill |
| **Voice Synthesis (alt)** | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL` | Optional: ElevenLabs cloud TTS (if `VOICE_PROVIDER=elevenlabs`) |
| **Task Runner** | `OLLAMA_URL`, `OLLAMA_MODEL`, `GEMINI_MODEL`, `CLAUDE_MODEL`, `QWEN_MODEL` | For task runner backends |
| **Shell Config** | `PAI_DIR`, `PAI_HOME` | Set in shell profile |

---

## Troubleshooting

### whisper.cpp build fails
```bash
# Ensure build tools are installed
sudo apt install build-essential cmake   # Linux
xcode-select --install                    # macOS

# Clean and rebuild
cd .agent/tools/whisper.cpp
rm -rf build
cmake -B build
cmake --build build --config Release -j$(nproc)
```

### Python sidecar won't start
```bash
# Check Python version (needs 3.9-3.11 for Chatterbox)
python3 --version

# Recreate venv if corrupted
cd ~/Projects/voice-server/python-sidecar
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Systemd services not starting
```bash
# Check logs
journalctl --user -u voice-server -n 20 --no-pager

# Reload after editing unit files
systemctl --user daemon-reload

# Enable for auto-start
systemctl --user enable pai-infrastructure.target
```

### Missing whisper model
```bash
cd .agent/tools/whisper.cpp
bash models/download-ggml-model.sh base
```
