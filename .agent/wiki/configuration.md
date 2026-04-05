# Configuration Guide

Complete guide to configuring Sam for your environment.

---

## Configuration Files

### settings.json

Main configuration file at `~/.claude/settings.json`:

```json
{
  "env": {
    "PAI_DIR": "/Users/yourname/.claude",
    "DA": "Sam",
    "PAI_SIMPLE_COLORS": "0",
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "64000"
  },
  "hooks": {
    "SessionStart": [...],
    "Stop": [...],
    ...
  },
  "permissions": {
    "allow": [...],
    "deny": [...]
  }
}
```

### .env

API keys and secrets (NEVER commit):

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Voice Server (ChatterboxTTS local - default)
VOICE_PROVIDER=chatterbox
CHATTERBOX_VOICE_ID=jessica

# Research
PERPLEXITY_API_KEY=pplx-...
GOOGLE_API_KEY=AIza...

# Web Scraping
BRIGHTDATA_API_KEY=...
```

### .mcp.json

MCP server configuration:

```json
{
  "mcpServers": {
    "brightdata": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-brightdata"],
      "env": {
        "BRIGHTDATA_API_KEY": "${BRIGHTDATA_API_KEY}"
      }
    }
  }
}
```

---

## Environment Variables

### Core Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PAI_DIR` | Sam installation directory | `~/.claude` |
| `DA` | Digital Assistant name | `Sam` |
| `PAI_SIMPLE_COLORS` | Use simple terminal colors | `0` |

### API Keys

| Variable | Purpose | Required For |
|----------|---------|--------------|
| `ANTHROPIC_API_KEY` | Claude API access | Core functionality |
| `VOICE_PROVIDER` | TTS provider selection (`chatterbox`/`elevenlabs`/`none`) | Voice server |
| `CHATTERBOX_VOICE_ID` | ChatterboxTTS voice name (local, default) | Voice server |
| `ELEVENLABS_API_KEY` | ElevenLabs cloud TTS (optional alternative) | Voice server (if elevenlabs) |
| `PERPLEXITY_API_KEY` | Web research | Perplexity researcher |
| `GOOGLE_API_KEY` | Gemini access | Gemini researcher |
| `BRIGHTDATA_API_KEY` | Web scraping | bright-data skill |

---

## Hook Configuration

Hooks are configured in `settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bun ${PAI_DIR}/hooks/initialize-session.ts"
      },
      {
        "type": "command",
        "command": "bun ${PAI_DIR}/hooks/load-core-context.ts"
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "bun ${PAI_DIR}/hooks/stop-hook.ts"
      }
    ],
    "PreToolUse": [
      {
        "type": "command",
        "command": "bun ${PAI_DIR}/hooks/security-validator.ts"
      }
    ]
  }
}
```

### Available Hook Types

- `SessionStart` - Session begins
- `SessionEnd` - Session ends
- `UserPromptSubmit` - Before processing prompt
- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool execution
- `Stop` - Response complete
- `SubagentStop` - Agent completes
- `PreCompact` - Before context compression

---

## Permission Configuration

Control what Claude can do:

```json
{
  "permissions": {
    "allow": [
      "Bash",
      "Read(*)",
      "Write(*)",
      "Edit(*)",
      "Grep(*)",
      "Glob(*)",
      "WebFetch(domain:*)",
      "WebSearch",
      "TodoWrite(*)",
      "Skill(*)"
    ],
    "deny": [
      "Bash(rm -rf /)",
      "Write(/etc/*)"
    ]
  }
}
```

---

## Voice Server Configuration

### voices.json

Available voices at `~/.claude/voice-server/voices.json`:

```json
{
  "voices": {
    "main": {
      "voice_name": "Jessica",
      "rate_wpm": 228,
      "description": "Default ChatterboxTTS voice"
    },
    "engineer": {
      "voice_name": "Zoe",
      "rate_wpm": 236,
      "description": "Engineer agent voice"
    }
  }
}
```

### Server Configuration

In `.env`:
```bash
PORT=8888
VOICE_PROVIDER=chatterbox
CHATTERBOX_VOICE_ID=jessica
```

---

## Skill Configuration

### Enabling/Disabling Skills

In `settings.json`:

```json
{
  "skills": {
    "enabled": ["CORE", "Fabric", "Research"],
    "disabled": ["experimental-skill"]
  }
}
```

### Skill-Specific Configuration

Each skill may have its own requirements. Check `SKILL.md` for each skill.

Example for Research skill:
```bash
PERPLEXITY_API_KEY=pplx-...
GOOGLE_API_KEY=AIza...
```

---

## Agent Configuration

Agents are configured in `~/.claude/agents/AgentName/AGENT.md`:

```yaml
---
name: engineer
description: Software engineering specialist
model: sonnet
color: green
voiceId: Tom
permissions:
  allow:
    - Bash
    - Read
    - Write
    - Edit
---
```

### Model Selection

| Model | Use Case | Speed | Cost |
|-------|----------|-------|------|
| `haiku` | Simple tasks | Fast | Low |
| `sonnet` | Standard work | Medium | Medium |
| `opus` | Complex reasoning | Slow | High |

---

## Shell Configuration

### Shell Profile

Add to `~/.zshrc` or `~/.bashrc`:

```bash
# Sam PAI Configuration
export PAI_DIR="$HOME/.claude"
export PATH="$PAI_DIR/Tools:$PATH"

# Optional: Voice server auto-start
# ~/.claude/voice-server/start.sh &
```

### Aliases

Useful aliases:

```bash
alias sam='claude'
alias sam-voice='~/.claude/voice-server/status.sh'
alias sam-health='bun ~/.claude/hooks/self-test.ts'
```

---

## Setup Wizard

For interactive configuration:

```bash
~/.claude/Tools/setup/bootstrap.sh
```

### Non-Interactive Mode

```bash
bun ~/.claude/Tools/setup/setup.ts \
  --pai-dir ~/.claude \
  --name "Your Name" \
  --email you@example.com \
  --assistant-name "Nova" \
  --force
```

### Dry Run

Preview changes:
```bash
bun ~/.claude/Tools/setup/setup.ts --dry-run
```

---

## Troubleshooting Configuration

### PAI_DIR Issues

If hooks fail with `__HOME__` errors:

1. Re-run setup:
   ```bash
   bash ~/.claude/Tools/setup/bootstrap.sh
   ```

2. Or manually fix in `settings.json`:
   ```json
   {
     "env": {
       "PAI_DIR": "/Users/yourname/.claude"
     }
   }
   ```

### Missing API Keys

Check `.env` file:
```bash
cat ~/.claude/.env | grep -v "^#"
```

Verify no spaces around `=`:
```bash
# Correct
ANTHROPIC_API_KEY=sk-ant-...

# Wrong
ANTHROPIC_API_KEY = sk-ant-...
```

### Permission Errors

Check `settings.json` permissions:
```bash
cat ~/.claude/settings.json | jq '.permissions'
```

---

## Best Practices

1. **Never commit .env** - Add to `.gitignore`
2. **Use PAI_DIR** - Don't hardcode paths
3. **Backup settings** - Before major changes
4. **Test changes** - Run health check after modifications
5. **Document customizations** - In your private setup

---

*See also: [Getting Started](Getting-Started.md) | [SAM Contract](SAM-Contract.md)*
