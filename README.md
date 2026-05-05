

# sAIm - Smart AI Manager.

### Smart AI manager and operating system

**Current Version: v0.2.0.0** — Distributed agent execution, semantic memory integration, enhanced skill ecosystem

[sAIm Avatar](./blue-team-defender.png)

</br>

[![Version](https://img.shields.io/badge/version-0.2.0.0-blue?style=for-the-badge)](CHANGELOG.md) [![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

[**Quick Start**](#-quick-start) · [**Documentation**](#-documentation) · [**Components**](#-components) · [**Origins**](#-origins)

> [!NOTE]
> **Citation:** sAIm is a fork of the original [PAI 1.0 platform](https://github.com/danielmiessler/PAI) created by Daniel Miessler. It builds upon the core philosophies of his [Fabric](https://github.com/danielmiessler/fabric) project and the [Human 3.0](https://danielmiessler.com/blog/human-3-0-evolution-artificial-intelligence/) manifesto.

---

# AI that works for *you*

sAIm is an open-source template for building your own AI-powered operating system. It provides the heavy lifting—infrastructure, skills, memory, and orchestration—so you can focus on building an AI that truly represents you.

Unlike commercial assistants that serve their creators, sAIm is designed to serve **you**. It runs on your infrastructure, keeps your data local where possible, and grows with you.

<br/>

## v0.2.0.0 Release Highlights

**What's new in this version:**

- **Agent-Skill Ecosystem Reorganization**: All 27 agents now mapped across 5 Agile phases (Ideation → Implementation → Testing) with contextual skill routing
- **Phase-Aligned Skills**: 35+ skills reorganized with clear Phase 1-5 boundaries and NOT WHEN clauses to prevent delegation confusion
- **Enhanced Agent Reference System**: Complete [agent-skill-ecosystem.md](wiki/agent-skill-ecosystem.md) documentation for skill discovery and agent routing
- **Improved Documentation**: Updated CLAUDE.md files across both global and project levels with phase alignment and optional add-on separation
- **Public Release**: sAIm announced as open-source framework with clear separation between core system and optional add-ons

<br/>

## What is sAIm?

sAIm (formerly PAI) is a platform-independent AI infrastructure system. It orchestrates agents, manages long-term memory, and executes complex workflows using "skills". While currently optimized for prompt-based coding and agentic workflows, it is designed to be model-agnostic.

### Key Capabilities

| Component | Description |
|-----------|-------------|
| **Agent Dashboard** | Full-featured React/Bun kanban UI for orchestrating AI agents with real-time SSE updates |
| **35+ Skills** | Phase-aligned modular capabilities for research, coding, security, content analysis, and more |
| **27 Agents** | Specialized personas across 5 Agile phases (Ideation, Requirements, Architecture, Implementation, Testing) |
| **248 Patterns** | Fabric AI patterns for content processing and extraction |
| **Voice Output** | Audible responses via ChatterboxTTS (local) |
| **Discord Remote Control** | Remote access to sAIm via Discord with persistent memory |
| **Task Runner** | JSONL-based job queue with multi-LLM backend support |
| **Git Isolation** | Worktree-based sandboxing for safe experimentation |
| **Memory System** | Persistent semantic memory with SQLite and association tracking |

<br/>

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) (v1.0+)
- [Git](https://git-scm.com)
- [Claude Code](https://docs.anthropic.com/claude-code) - Anthropic's CLI tool
- macOS or Linux

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/yourusername/sAIm.git ~/sAIm
    cd ~/sAIm
    ```

2.  **Create Symlink**
    sAIm expects to be at `~/.claude`. Create a symlink:
    ```bash
    # Backup existing .claude if present
    [ -d ~/.claude ] && mv ~/.claude ~/.claude.backup

    # Create symlink
    ln -s ~/saim/.agent ~/.claude
    ```

3.  **Run Setup Wizard**
    ```bash
    bash .agent/setup.sh
    ```

4.  **Configure API Keys**
    ```bash
    cp ~/.claude/.env.example ~/.claude/.env
    # Edit with your API keys (ANTHROPIC_API_KEY required)
    ```

5.  **Start Claude Code**
    ```bash
    claude
    ```
    sAIm automatically loads via the SessionStart hook.

<br/>

## Architecture

sAIm follows a **Skills-as-Containers** architecture with event-driven automation:

1.  **Skills System**: Self-contained capability packages with domain expertise, routing logic, workflows, and CLI tools. Skills auto-activate based on user intent via `USE WHEN` triggers.
2.  **Agents System**: 26+ specialized AI personas (Engineer, Architect, Researcher, Security Architect, Designer, etc.) with specific permissions and capabilities for delegation.
3.  **Hooks System**: TypeScript scripts triggered by lifecycle events (SessionStart, PreToolUse, Stop) for automation.
4.  **Task Runner**: JSONL-based job queue with multi-LLM backends (Claude, Gemini, Ollama, Qwen) and worktree isolation.
5.  **Memory System**: Persistent semantic memory using SQLite with fact extraction, association tracking, and session briefings.

<br/>

## Components

### Skills (`~/.claude/skills/`)
Self-contained capability packages. Key skills include:
- **CORE**: System identity, configuration, and mandatory response format (auto-loads at session start)
- **fabric**: 248 AI patterns for content processing
- **discord-remote-control**: Remote access to sAIm via Discord with image, file, and voice note support
- **Research**: Multi-source parallel research with Perplexity and Gemini agents
- **create-agent/create-skill**: Framework creation tools
- **Observability**: Real-time agent monitoring dashboard
- **party-mode**: Multi-agent collaboration with 17+ specialized agents
- **security-grc**: Enterprise security, governance, risk, and compliance
- **investor**: Financial market research and paper trading simulation
- **architect**: Epic/story generation from wizard outputs

### Agents (`~/.claude/agents/`)
26+ specialized AI personas for delegation, including:
- **Engineer / Developer**: Software implementation specialists
- **Architect**: System design and planning
- **Researcher / Perplexity / Gemini / Claude Researcher**: Information gathering and synthesis
- **Pentester / Security Architect / Security Test Analyst**: Security testing and analysis
- **Designer / UX Designer**: User experience and interface design
- **Product Manager / Scrum Master**: Project planning and agile facilitation
- **Technical Writer**: Documentation specialist
- **Innovation Oracle / Brainstorming Coach**: Ideation and creative problem solving

### Agent Dashboard (`frontmatter.studio`)
The control plane for human-in-the-loop AI orchestration:
- **Kanban Board**: Visual job management with submit, approve, reject, retry, and delete
- **Real-Time SSE**: Zero-latency status updates streamed to the browser
- **Live Log Streaming**: Follow job output with ANSI color support
- **Git Integration**: View unified diffs and create GitHub PRs directly from the UI
- **Story Tracking**: Monitor high-level workflows as they progress
- **Multi-LLM Support**: Backend support for Claude, Gemini, Ollama, and Qwen

### Infrastructure Services
Services managed via systemd (auto-start on boot):

| Service | Port | Role |
|---------|------|------|
| **Voice Server** | 8888 | Text-to-speech via ChatterboxTTS (local) |
| **Observability Dashboard** | 5172 | Real-time agent monitoring UI |
| **Discord Remote Control** | — | Discord-based remote interface |
| **Python Sidecar** | 8889 | TTS model inference server |

### Configuration
- `~/.claude/.env`: API keys (never commit)
- `~/.claude/settings.json`: Global configuration
- `~/.claude/hooks/`: Event-driven automation scripts

<br/>

## Documentation

Comprehensive documentation is available in the [**Wiki**](.agent/wiki/):

- [**Getting Started**](.agent/wiki/getting-started.md) - Installation and first run
- [**Architecture Overview**](.agent/wiki/architecture.md) - How sAIm is built
- [**Skills System**](.agent/wiki/skills-system.md) - Modular capabilities guide
- [**Hooks System**](.agent/wiki/hooks-system.md) - Event automation
- [**SAM Contract**](.agent/wiki/SAIM_CONTRACT.md) - Core guarantees

Additional resources:
- [**Core Constitution**](.agent/skills/CORE/constitution.md) - Complete philosophy
- [**Reference Guide**](claude-reference.md) - Project reference

<br/>

## Origins

sAIm is a fork of the original [PAI 1.0 platform](https://github.com/danielmiessler/PAI) created by Daniel Miessler. It builds upon:

- [**Fabric**](https://github.com/danielmiessler/fabric) - AI patterns project (248 patterns maintained locally)
- [**Human 3.0**](https://danielmiessler.com/blog/human-3-0-evolution-artificial-intelligence/) - Philosophy of AI augmentation

<br/>

## License

MIT License — see [`LICENSE`](LICENSE) for details.

---

<div align="center">
  <strong>Build the AI infrastructure you need.</strong>
</div>
