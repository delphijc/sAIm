# Jay-Gentic Integration Setup Guide

**Updated**: 2026-04-22  
**Status**: Ready for production (memory unified with claude subprocess)

---

## Overview

Sam's **discord-remote-control** service can optionally use **jay-gentic** (a local Bash+Go LLM CLI) as its backend instead of spawning Claude Code subprocesses. This enables:

- 🚀 **Local inference** via Ollama, llama.cpp, LM Studio, or local Anthropic deployments
- 🔄 **Multi-backend support** (OpenAI, Groq, Together AI, Claude, Ollama, vLLM)
- 💾 **Unified memory system** (same semantic + episodic memory as subprocess.ts)
- 🎭 **Shared Sam agent profile** (same `.agent/agents/sam/` directory)
- ⚡ **Fast fallback** if jay-gentic unavailable → automatic Claude Code subprocess

---

## Architecture: Shared Directory Design

The key innovation is that **sam and jay-gentic share the same agent directory**:

```
~/.claude/                          (symlink from ~/.claude or direct copy)
├── agents/
│   ├── sam/                        ← SHARED between Claude Code and jay-gentic
│   │   ├── instructions.md
│   │   ├── personality.yaml
│   │   └── ...
│   ├── engineer/
│   ├── researcher/
│   └── ...
```

When you run Discord-remote-control with `PAI_USE_JAY_GENTIC=true`:

1. **Claude Code subprocess** calls `callClaude()` router
2. Router checks `PAI_USE_JAY_GENTIC=true` → routes to `callJayGenticSubprocess()`
3. `callJayGenticSubprocess()` spawns: `jay-gentic --agent sam --no-stream`
4. Jay-gentic reads **the same sam agent profile** from `~/.config/jay-gentic/agents/` (or symlinked location)
5. Response is parsed, file attachments extracted, observability events sent
6. **Memory system** (both episodic + semantic) works identically to Claude Code subprocess

**Result**: Sam's personality, instructions, and memory context are **identical** whether you use Claude Code subprocess or jay-gentic.

---

## Quick Start (5 minutes)

### Prerequisites

1. **Sam project** is installed: `~/Projects/sam/`
2. **Jay-gentic** is installed and in PATH:
   ```bash
   jay-gentic --version  # Should work
   ```
3. **Memory-system** is running (optional but recommended):
   ```bash
   ps aux | grep memory-system  # Should see process
   ```

### Step 1: Create Jay-Gentic Sam Agent Profile

Jay-gentic expects agent configs in `~/.config/jay-gentic/agents/`. The simplest approach is **symlink** sam's agent profile:

```bash
# Ensure jay-gentic config dir exists
mkdir -p ~/.config/jay-gentic/agents/

# OPTION A: Symlink sam agent from sam project
ln -sf ~/Projects/sam/.agent/agents/sam ~/.config/jay-gentic/agents/sam

# OPTION B: Copy sam agent (if symlink not suitable)
cp -r ~/Projects/sam/.agent/agents/sam ~/.config/jay-gentic/agents/
```

Verify:
```bash
ls -la ~/.config/jay-gentic/agents/sam/
cat ~/.config/jay-gentic/agents/sam/instructions.md
```

### Step 2: Enable Jay-Gentic Backend

In `.agent/.env` (or set in shell):

```bash
# Enable jay-gentic backend for Discord remote control
PAI_USE_JAY_GENTIC=true

# Optional: Enable memory integration (recommended)
ENABLE_MEMORY_HOOKS=true
MEMORY_SERVICE_URL=http://localhost:4242
```

### Step 3: Test the Integration

Start a Discord conversation with Sam:

```
> @sam ping

# Expected response via jay-gentic
```

Check logs for confirmation:
```bash
# Terminal where discord-remote-control is running
tail -f <discord-service-logs>
# Look for: "🧠 Calling jay-gentic subprocess..."
```

### Step 4: Monitor (Optional)

If memory-system is running, verify memory context is injected:

```bash
# In another terminal, check memory service logs
curl http://localhost:4242/health  # Should return 200 OK
```

---

## Configuration Reference

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PAI_USE_JAY_GENTIC` | `false` | Enable jay-gentic backend (vs Claude Code subprocess) |
| `ENABLE_MEMORY_HOOKS` | `false` | Enable semantic memory extraction + episodic persistence |
| `MEMORY_SERVICE_URL` | `http://localhost:4242` | Memory system API endpoint |
| `DISCORD_TOKEN` | (required) | Discord bot token |

### Jay-Gentic Configuration

The sam agent profile is read from `~/.config/jay-gentic/agents/sam/`. It should contain:

**`instructions.md`** — Sam's system prompt and instructions
```markdown
# Sam - Personal AI Assistant

You are Sam, a helpful AI assistant... [your instructions]
```

**`personality.yaml`** — Optional metadata (jay-gentic specific)
```yaml
name: sam
description: Personal AI assistant
model: claude-opus-4  # or your configured backend
temperature: 0.7
max_tokens: 2000
```

---

## Memory Integration (Unified Architecture)

### How It Works

With `ENABLE_MEMORY_HOOKS=true`, both Claude Code subprocess AND jay-gentic subprocess follow the same memory flow:

```
Discord Message → Router → callJayGenticSubprocess()
                            ├─ 1. Fetch memory context (episodic + semantic)
                            │      POST http://localhost:4242/memory/search
                            │      Response: context_prefix = "Recent facts: ..."
                            │
                            ├─ 2. Inject context into prompt
                            │      prompt = context_prefix + discord_context + user_message
                            │
                            ├─ 3. Spawn jay-gentic with unified prompt
                            │      jay-gentic --agent sam --no-stream < prompt
                            │
                            ├─ 4. Parse response + extract attachments
                            │
                            └─ 5. Record turn to memory (episodic + semantic extraction)
                                   POST http://localhost:4242/memory/record
                                   Payload: { sessionId, userId, response, ... }
```

### Why Memory Works Now

Previously, the code had a comment: `"Memory context injection disabled for jg-subprocess. Jay-gentic backend uses a different architecture..."`

**This is now resolved**: The memory-system is a **standalone API** (port 4242), so both subprocess types can call it identically:
- Same HTTP endpoints for context retrieval
- Same format for episodic + semantic memory
- Same integration pattern as `subprocess.ts`

**Result**: Jay-gentic and Claude Code subprocess are **functionally equivalent** from a memory perspective.

---

## Operational Behaviors

### Fallback on Failure

If jay-gentic is unavailable, the router **automatically falls back** to Claude Code subprocess:

```typescript
// service/claude/router.ts:38-43
if (isJayGenticEnabled()) {
  const jayGenticResult = await callJayGenticSubprocess(request);
  if (jayGenticResult.success) return jayGenticResult;
  // Falls back to Claude Code subprocess silently
  return callClaudeSubprocess(request);
}
```

**Example failure scenarios**:
- `jay-gentic` not in PATH → fallback to Claude ✓
- `sam` agent not found → fallback to Claude ✓
- `sam` agent misconfigured → fallback to Claude ✓
- Memory-system unavailable → graceful degradation (continues without context)

### Observability

All jay-gentic invocations are tracked in the observability dashboard:

- Task start: `callJayGenticSubprocess()`
- Task complete: Response parsed + attachments extracted
- Task fail: Error logged + fallback triggered
- Duration: Time from spawn to response

Check dashboard:
```bash
# Service monitor dashboard
http://localhost:5175  # Real-time service metrics

# Observability dashboard (if running)
http://localhost:5172  # Agent activity + call logs
```

---

## Troubleshooting

### Issue: "jay-gentic: command not found"

**Symptom**: Logs show `spawn ENOENT` or "command not found"

**Solution**:
```bash
# Verify jay-gentic is installed
which jay-gentic
jay-gentic --version

# If not in PATH, add to PATH or create symlink
ln -sf /path/to/jay-gentic /usr/local/bin/jay-gentic
```

---

### Issue: "Unknown agent 'sam'"

**Symptom**: Logs show `Error: Unknown agent 'sam'` then fallback to Claude

**Solution**:
```bash
# Verify sam agent profile exists
ls ~/.config/jay-gentic/agents/sam/

# If missing, create symlink
mkdir -p ~/.config/jay-gentic/agents/
ln -sf ~/Projects/sam/.agent/agents/sam ~/.config/jay-gentic/agents/sam

# Test jay-gentic directly
echo "Hello" | jay-gentic --agent sam --no-stream
```

---

### Issue: Memory context not injected

**Symptom**: Responses have no memory context (isolated conversations)

**Solution**:
```bash
# 1. Verify memory-system is running
curl http://localhost:4242/health

# 2. Enable in .agent/.env
ENABLE_MEMORY_HOOKS=true
MEMORY_SERVICE_URL=http://localhost:4242

# 3. Restart discord-remote-control service
systemctl --user restart discord-remote-control
# or
launchctl restart com.pai.discord-remote-control

# 4. Check logs for memory API calls
grep "memory-system" <service-logs>
```

---

### Issue: Fallback happening unexpectedly

**Symptom**: Logs show jay-gentic calls failing, always using Claude fallback

**Solution**:
1. **Test jay-gentic directly**:
   ```bash
   echo "What is 2+2?" | jay-gentic --agent sam --no-stream
   ```
   
2. **Check stderr from spawn**:
   ```bash
   # Add debug logging to jg-subprocess.ts temporarily
   console.error("🔍 Jay-gentic env:", env);
   console.error("🔍 Jay-gentic stderr:", errorOutput);
   ```

3. **Verify agent profile**:
   ```bash
   cat ~/.config/jay-gentic/agents/sam/instructions.md
   # Should contain valid instructions
   ```

---

### Issue: Response parsing fails (missing `AI>` prefix)

**Symptom**: Jay-gentic responds but parsing fails

**Solution**:
```bash
# Test jay-gentic output format directly
echo "Hello" | jay-gentic --agent sam --no-stream

# Output should look like:
# (response text here)
# AI> (final response here)
```

If output format is different, report to jay-gentic project. Sam's parser expects:
- Response text on lines 0..n
- Final `\nAI> prefix` on last line
- Extract everything after `\nAI> ` as the final response

---

## Comparison: Claude Code Subprocess vs Jay-Gentic

| Feature | Claude Subprocess | Jay-Gentic | Notes |
|---------|---|---|---|
| **Backend** | Claude Code API | Local CLI (Bash+Go) | Claude Code always available |
| **Inference** | Anthropic API | Local or remote (configurable) | Faster locally, network-dependent remotely |
| **Cost** | API charges | Free (local) / varies (remote) | Local inference has no marginal cost |
| **Latency** | Network + inference | Local (fast) or network | Usually <100ms locally |
| **Memory context** | ✓ Semantic + episodic | ✓ Semantic + episodic | Identical integration |
| **File attachments** | ✓ Yes | ✓ Yes | Same `[SAM_ATTACH:...]` format |
| **Observability** | ✓ Yes | ✓ Yes | Dashboard tracking works both |
| **Fallback** | N/A | → Claude Code if unavailable | Seamless automatic fallback |
| **Agent profile** | Claude Code system prompt | `.agent/agents/sam/` | Shared directory |
| **Testing** | Full test suite | Full test suite | `service/__tests__/` |

**Recommendation**: Use **jay-gentic** for local experimentation/testing, **Claude Code** for production (lower latency variance, guaranteed availability).

---

## Advanced: Custom Jay-Gentic Configuration

### Using Different LLM Backend

To use Ollama instead of Claude, modify sam's agent profile:

```bash
# Edit sam agent config
cat ~/.config/jay-gentic/agents/sam/personality.yaml
```

```yaml
name: sam
description: Personal AI assistant
model: ollama:neural-chat  # Use ollama backend
temperature: 0.7
max_tokens: 2000
```

Then restart:
```bash
systemctl --user restart discord-remote-control
```

### Running Jay-Gentic Directly

Test your configuration outside the discord service:

```bash
# Spawn jay-gentic with sam agent
echo "Explain how memory works in Sam" | \
  jay-gentic --agent sam --no-stream

# With custom backend
echo "Explain how memory works in Sam" | \
  JAY_GENTIC_MODEL=ollama:neural-chat \
  jay-gentic --agent sam --no-stream
```

---

## FAQ

**Q: Is memory required for jay-gentic to work?**  
A: No. Memory is optional (`ENABLE_MEMORY_HOOKS=false` by default). Jay-gentic works without it; responses are just isolated per-turn.

**Q: Can I use different agents (not just `sam`)?**  
A: Yes. The code uses `--agent sam` but you can modify `jg-subprocess.ts:195` to use `--agent <name>`. Each agent needs its profile in `~/.config/jay-gentic/agents/<name>/`.

**Q: What if jay-gentic and Claude give different responses?**  
A: Expected. Different backends (Ollama vs API) have different capabilities and training. Test locally before switching production traffic.

**Q: How do I monitor jay-gentic performance?**  
A: Check service metrics:
```bash
systemctl --user status discord-remote-control
# or watch observability dashboard at http://localhost:5172
```

**Q: Can I use both Claude and jay-gentic in the same session?**  
A: You can toggle `PAI_USE_JAY_GENTIC` and restart the service, but not dynamically within a session.

---

## Next Steps

1. ✅ **Install jay-gentic** and verify it's in PATH
2. ✅ **Symlink sam agent** to `~/.config/jay-gentic/agents/sam`
3. ✅ **Set `PAI_USE_JAY_GENTIC=true`** in `.agent/.env`
4. ✅ **Test via Discord** (send a message to Sam)
5. ✅ **Monitor logs** for `callJayGenticSubprocess()` calls
6. ✅ **Optional**: Enable memory with `ENABLE_MEMORY_HOOKS=true`

---

## Support & Debugging

For issues:

1. **Check logs**: `systemctl --user status discord-remote-control`
2. **Test locally**: `echo "test" | jay-gentic --agent sam --no-stream`
3. **Verify agent**: `ls ~/.config/jay-gentic/agents/sam/instructions.md`
4. **Report to**: Jay-gentic project (https://github.com/...) or Sam project

---

**Version**: 1.0  
**Last Updated**: 2026-04-22  
**Status**: Ready for production use
