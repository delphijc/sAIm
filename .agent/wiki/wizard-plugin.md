# Wizard Plugin (`!wizard`)

Conversational project planning wizard that guides users through 4 expert interviews to generate planning documents. Accessible via Discord using the `!wizard` command prefix.

## Overview

The wizard walks through four interview phases, each conducted by a distinct AI persona. After each interview, the conversation is synthesized into a planning document.

| Phase | Persona | Output |
|-------|---------|--------|
| 1 | Carson (Analyst) | `product-brief.md` |
| 2 | Maya (Product Manager) | `PRD.md` |
| 3 | Quinn (Architect) | `tech-spec.md` |
| 4 | Victor (Security) | `BDD.md` |

## Commands

| Command | Description |
|---------|-------------|
| `!wizard` / `!wizard start` | Start a new wizard session |
| `!wizard status` | Show current progress through phases |
| `!wizard done` / `!wizard next` | Complete current interview, generate doc, advance |
| `!wizard skip` | Skip current phase entirely |
| `!wizard cancel` | Cancel the session |
| `!wizard backend <claude\|ollama\|gemini>` | Switch LLM backend |
| `!wizard output <path>` | Set output directory for generated docs |
| `!wizard help` | Show help text |

During an active interview, just chat naturally. Say "done" or "next" when ready to move on.

## Workflow

1. User starts with `!wizard`
2. **Setup phase**: provide project name, description, goals
3. **Interview phases** (x4): chat with each persona, guided Q&A
4. **Generation phases** (x4): each interview is summarized and fed to an LLM to produce the document
5. **Completion**: all 4 docs are saved to the output directory

## Session Management

- One session per user (enforced by user ID)
- Session state tracks: phase, project brief, backend, output dir, generated content
- Messages during an active session are automatically routed to the current persona
- Sessions persist in memory (not disk) — lost on service restart

## Files

| File | Purpose |
|------|---------|
| `plugins/wizard/index.ts` | Plugin entry point, command routing, phase advancement |
| `plugins/wizard/session.ts` | Session state management, phase transitions |
| `plugins/wizard/llm.ts` | LLM integration, system prompts, document generation prompts |

## LLM Backend Support

The wizard supports multiple LLM backends:
- **claude** (default) — Anthropic Claude API
- **ollama** — Local Ollama instance
- **gemini** — Google Gemini API

Switch during a session with `!wizard backend <name>`.
