# Sam Wiki - Smart AI Manager

Welcome to the comprehensive documentation for **Sam**, your Smart AI Manager platform.

---

## What is Sam?

Sam is an open-source template for building AI-powered operating systems on top of Claude Code. It transforms Claude from a simple chatbot into a full personal AI system with:

- **Memory** - Persistent context across sessions
- **Skills** - 38 specialized capabilities across 10 domain clusters
- **Agents** - 17+ specialized AI personalities
- **Automation** - Event-driven hooks
- **Orchestration** - Multi-agent workflows
- **Voice** - Audible responses and feedback

## Quick Navigation

### Getting Started
- [Quick Start Guide](Getting-Started.md) - Installation and first run
- [Setup Scripts Reference](Setup-Scripts.md) - Detailed setup script documentation
- [Configuration Guide](Configuration.md) - API keys and settings
- [SAM Contract](SAM-Contract.md) - Understanding guarantees

### Understanding Sam
- [Architecture Overview](Architecture.md) - How Sam is built
- [Core Principles](Core-Principles.md) - The 13 founding principles
- [Progressive Disclosure](Progressive-Disclosure.md) - Context efficiency

### Systems & Components
- [Skills Catalog](Skills-Catalog.md) - Complete reference for all 38 skills
- [Domain Clusters Quick Reference](Domain-Clusters-Quick-Reference.md) - Guide to 10 domain cluster skills
- [Skills System](Skills-System.md) - Modular capabilities and architecture
- [Agents System](Agents-System.md) - Specialized personas
- [Memory System](Memory-System.md) - Muninn cognitive architecture with ACT-R activation
- [Hooks System](Hooks-System.md) - Event automation
- [Task Runner](Task-Runner.md) - Job orchestration
- [External Projects](External-Projects.md) - Multi-repository management
- [Voice Server](Voice-Server.md) - Text-to-speech
- [Crostini Networking](crostini-networking.md) - LAN access for PAI services on ChromeOS
- [Fabric Patterns](Fabric-Patterns.md) - 248 AI patterns
- [Observability](Observability.md) - Metrics, logging, and monitoring
- [Backup & Restore](Backup-Restore.md) - Memory database backup scheduling and recovery
- [MCP Management](MCP-Management.md) - Model Context Protocol configuration and profiles


### Using Sam Effectively
- [Usage Guide](Usage-Guide.md) - Day-to-day usage
- [Skills Reference](Skills-Reference.md) - All available skills
- [Skills Validation Report](Skills-Validation-Report.md) - Validation status of all 38 skills
- [Best Practices](Best-Practices.md) - Tips and patterns
- [Memory Quick Reference](Memory-Quick-Reference.md) - Common memory operations and lookup tables

### Development & Reference
- [Build History](Build-History.md) - How Sam was built
- [Epic Roadmap](Epic-Roadmap.md) - Completed milestones
- [Changelog](Changelog.md) - Version history
- [Memory System Technical Guide](Memory-System-Technical-Guide.md) - Architecture and extension guide for developers

### Future Development
- [Improvements Roadmap](Improvements-Roadmap.md) - Planned enhancements
- [Contributing](Contributing.md) - How to contribute

---

## Key Features

| Feature | Description |
|---------|-------------|
| **38 Skills** | 10 domain clusters + utilities (research, coding, analysis, content creation) |
| **17+ Agents** | Engineer, Architect, Researcher, Pentester, Brainstorming Coach, etc. |
| **251 Patterns** | Fabric AI patterns for content processing |
| **Voice Output** | Audible responses via ElevenLabs |
| **Task Queue** | JSONL-based job orchestration |
| **Dashboard** | React UI for monitoring and control |
| **Git Isolation** | Worktree-based sandboxing |
| **Multi-LLM** | Claude, Gemini, Ollama, Qwen backends |

---

## Philosophy

Sam follows three core principles:

1. **CLI First** - Build deterministic CLI tools, wrap with AI
2. **Scaffolding > Model** - Architecture beats raw intelligence
3. **Progressive Disclosure** - Load context only when needed

---

## Origins

Sam is a fork of the original [PAI 1.0 platform](https://github.com/danielmiessler/PAI) created by Daniel Miessler, now maintained under [delphijc/sam](https://github.com/delphijc/sam). It builds upon:

- [Fabric](https://github.com/danielmiessler/fabric) - AI patterns project (patterns maintained locally with manual refreshes for LTS stability)
- [Human 3.0](https://danielmiessler.com/blog/human-3-0-evolution-artificial-intelligence/) - Philosophy of AI augmentation

---

## Status

**Version:** 0.9.1
**Platform:** macOS, Linux, Windows
**Runtime:** Bun (TypeScript)
**AI Model:** Claude Code v2.0+

---

*Last Updated: 2026-03-07*
