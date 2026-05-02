# Jay-Gentic Troubleshooting Guide

**Updated**: 2026-04-22  
**Status**: Comprehensive reference for common issues

---

## Quick Diagnostics

Run this script to check your jay-gentic setup:

```bash
#!/bin/bash
# save as ~/diagnose-jay-gentic.sh

echo "=== Jay-Gentic Diagnostic Report ==="
echo ""

echo "1. Jay-Gentic Binary"
if command -v jay-gentic &> /dev/null; then
  echo "✓ jay-gentic found in PATH"
  echo "  Location: $(which jay-gentic)"
  echo "  Version: $(jay-gentic --version)"
else
  echo "✗ jay-gentic NOT in PATH"
fi
echo ""

echo "2. Sam Agent Profile"
if [ -d ~/.config/jay-gentic/agents/sam ]; then
  echo "✓ Sam agent profile exists"
  echo "  Location: $(ls -d ~/.config/jay-gentic/agents/sam)"
  echo "  Files: $(ls ~/.config/jay-gentic/agents/sam/)"
else
  echo "✗ Sam agent profile NOT found at ~/.config/jay-gentic/agents/sam"
fi
echo ""

echo "3. Environment Variables"
echo "  PAI_USE_JAY_GENTIC: ${PAI_USE_JAY_GENTIC:-not set}"
echo "  ENABLE_MEMORY_HOOKS: ${ENABLE_MEMORY_HOOKS:-not set}"
echo "  MEMORY_SERVICE_URL: ${MEMORY_SERVICE_URL:-http://localhost:4242}"
echo ""

echo "4. Memory System"
if curl -s http://localhost:4242/health > /dev/null 2>&1; then
  echo "✓ Memory system running"
else
  echo "✗ Memory system NOT responding (curl to localhost:4242 failed)"
fi
echo ""

echo "5. Direct Jay-Gentic Test"
echo "  Input: 'What is 2+2?'"
echo "  Output:"
echo "What is 2+2?" | timeout 5 jay-gentic --agent sam --no-stream 2>&1 | head -5
echo ""

echo "=== Diagnostic Complete ==="
```

Run it:
```bash
bash ~/diagnose-jay-gentic.sh
```

---

## Problem: Jay-Gentic Not Found in PATH

### Symptom
- Discord responds but logs show: `spawn ENOENT` or `jay-gentic: command not found`
- Falls back to Claude Code subprocess silently

### Diagnosis

```bash
# Check if jay-gentic is in PATH
which jay-gentic

# If not found, check common install locations
ls /usr/local/bin/jay-gentic
ls /opt/homebrew/bin/jay-gentic  (macOS)
ls $HOME/.local/bin/jay-gentic
```

### Solutions

**Option 1: Add to PATH (temporary)**
```bash
# In current shell session
export PATH="/path/to/jay-gentic:$PATH"

# Verify
jay-gentic --version
```

**Option 2: Create symlink (permanent)**
```bash
# Find where jay-gentic actually is
find ~ -name jay-gentic -type f 2>/dev/null

# Create symlink to a standard location
ln -sf /actual/path/to/jay-gentic /usr/local/bin/jay-gentic

# Verify
which jay-gentic  # Should show /usr/local/bin/jay-gentic
```

**Option 3: Update .agent/.env**
```bash
# If jay-gentic is at a custom path, you could modify jg-subprocess.ts
# to use full path instead of relying on PATH

# Edit: service/claude/jg-subprocess.ts line 195
// Replace:
const proc = spawn(["jay-gentic", ...

// With:
const proc = spawn(["/full/path/to/jay-gentic", ...
```

---

## Problem: Unknown Agent 'sam'

### Symptom
- Logs show: `📋 jay-gentic stderr: Error: Unknown agent 'sam'`
- Falls back to Claude Code subprocess
- Discord still works (via fallback)

### Diagnosis

```bash
# List available agents in jay-gentic config
ls ~/.config/jay-gentic/agents/

# Check if sam exists
ls ~/.config/jay-gentic/agents/sam/instructions.md

# Check what jay-gentic sees
jay-gentic --list-agents  # If supported
```

### Solutions

**Option 1: Symlink Sam Agent (Recommended)**
```bash
# Ensure config directory exists
mkdir -p ~/.config/jay-gentic/agents/

# Create symlink to sam project's agent directory
ln -sf ~/Projects/sam/.agent/agents/sam ~/.config/jay-gentic/agents/sam

# Verify
ls -la ~/.config/jay-gentic/agents/sam/
cat ~/.config/jay-gentic/agents/sam/instructions.md
```

**Option 2: Copy Sam Agent (If Symlink Not Suitable)**
```bash
# Copy entire sam agent directory
cp -r ~/Projects/sam/.agent/agents/sam ~/.config/jay-gentic/agents/

# Verify
ls ~/.config/jay-gentic/agents/sam/
```

**Option 3: Check Agent Directory Format**

Jay-gentic expects this structure:
```
~/.config/jay-gentic/agents/
├── sam/
│   ├── instructions.md          (required: system prompt)
│   ├── personality.yaml         (optional: model config)
│   └── ...other files...
├── engineer/
└── ...
```

If sam agent exists but structure is wrong:
```bash
# Check current structure
tree ~/.config/jay-gentic/agents/sam/

# If missing instructions.md, add it
cat ~/Projects/sam/.agent/agents/sam/instructions.md > ~/.config/jay-gentic/agents/sam/instructions.md
```

---

## Problem: Memory Context Not Injected

### Symptom
- Responses have no memory context (each turn is isolated)
- No "Recent facts:" or "Previous conversations:" in Discord context
- Memory records show no activity

### Diagnosis

```bash
# 1. Check if memory-system is running
curl -v http://localhost:4242/health

# 2. Check environment variables
echo $ENABLE_MEMORY_HOOKS
echo $MEMORY_SERVICE_URL

# 3. Check discord-remote-control logs
systemctl --user status discord-remote-control
journalctl --user -u discord-remote-control -n 50 --no-pager
```

### Solutions

**Option 1: Enable Memory Integration**
```bash
# Edit .agent/.env
ENABLE_MEMORY_HOOKS=true
MEMORY_SERVICE_URL=http://localhost:4242

# Restart service
systemctl --user restart discord-remote-control
```

**Option 2: Start Memory System**
```bash
# If memory-system is not running
cd ~/Projects/memory-system
bun run start

# Or via systemctl
systemctl --user start memory-system

# Verify
curl http://localhost:4242/health
# Should return 200 OK
```

**Option 3: Check Memory API Connectivity**

From within discord-remote-control service:
```typescript
// Add debug logging to jg-subprocess.ts (temporary)
try {
  const context = await getMemoryContext(sessionId, userMessage);
  console.log("✓ Memory context fetched:", context.substring(0, 100));
} catch (error) {
  console.error("✗ Memory fetch failed:", error.message);
}
```

**Option 4: Manual Memory API Test**
```bash
# Test memory search endpoint directly
curl -X POST http://localhost:4242/memory/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Should return JSON with facts/associations
```

---

## Problem: Response Parsing Fails

### Symptom
- Jay-gentic responds but error: `Missing AI> prefix in output`
- Logs show raw output that doesn't match expected format
- Falls back to Claude Code subprocess

### Diagnosis

```bash
# Test jay-gentic output format directly
echo "What is 2+2?" | jay-gentic --agent sam --no-stream

# Observe the output format:
# (expected: response text)
# AI> (final response)
```

### Expected Output Format

Jay-gentic's output should end with:
```
[response text here]
AI> [actual response]
```

Sam's parser (jg-subprocess.ts:213-225) extracts text after `\nAI> `.

### Solutions

**Option 1: Check Jay-Gentic Version**
```bash
jay-gentic --version

# If outdated, update
brew upgrade jay-gentic  # macOS
apt-get upgrade jay-gentic  # Linux
# or rebuild from source
```

**Option 2: Check Sam Agent Profile**

The sam agent might have custom output format. Verify:
```bash
cat ~/.config/jay-gentic/agents/sam/instructions.md
# Look for: "Always prefix your response with 'AI> '"
# If missing, add this instruction
```

**Option 3: Add Format Instruction to Sam Agent**
```bash
# Edit sam agent instructions
cat >> ~/.config/jay-gentic/agents/sam/instructions.md << 'EOF'

## Output Format
Always end your response with:
AI> [your response]
EOF
```

**Option 4: Test Output Format Locally**
```bash
# Create test script
cat > /tmp/test_jg.sh << 'EOF'
#!/bin/bash
echo "Testing jay-gentic output format..."
echo "Input: What is 2+2?"
echo "---"
echo "What is 2+2?" | jay-gentic --agent sam --no-stream
echo "---"
echo "Check if output ends with 'AI> ...'"
EOF

bash /tmp/test_jg.sh
```

---

## Problem: Discord Bot Not Responding

### Symptom
- Message sent to Discord bot, no response
- Service might be running but nothing happens
- Error logs show timeouts or connection issues

### Diagnosis

```bash
# 1. Check service status
systemctl --user status discord-remote-control

# 2. Check recent logs
journalctl --user -u discord-remote-control -n 100 --no-pager

# 3. Check if service is even running
ps aux | grep discord-remote-control

# 4. Check Discord bot token
echo $DISCORD_TOKEN | wc -c  # Should be ~60+ characters
```

### Solutions

**Option 1: Restart Service**
```bash
systemctl --user restart discord-remote-control
sleep 2
systemctl --user status discord-remote-control
```

**Option 2: Check Discord Token**
```bash
# Token should be set in environment
echo $DISCORD_TOKEN

# If empty, set it
export DISCORD_TOKEN="your-bot-token-here"

# Or add to .agent/.env
echo "DISCORD_TOKEN=your-token" >> .agent/.env
```

**Option 3: Check Service Port/Logs**
```bash
# See what's actually happening
tail -f ~/.local/share/systemd/user/discord-remote-control.service.log

# Or check if port is listening (if service has port)
netstat -an | grep LISTEN
```

**Option 4: Manual Service Start (For Debugging)**
```bash
# Stop service
systemctl --user stop discord-remote-control

# Start manually with logging
cd ~/Projects/sam/.agent/skills/discord-remote-control/service
DISCORD_TOKEN="your-token" PAI_USE_JAY_GENTIC=true bun run start

# Watch logs in real-time
```

---

## Problem: File Attachments Not Working

### Symptom
- Response includes `[SAM_ATTACH:/path/to/file.txt:display_name.txt]` marker
- File isn't actually attached to Discord message
- Logs show attachment parsing errors

### Diagnosis

```bash
# 1. Check if referenced files exist
ls -la /path/to/file.txt

# 2. Check file permissions (readable by service)
stat /path/to/file.txt
# Should show "Access: (0644/-rw-r--r--)" or similar

# 3. Check Discord service permissions
# Service might not have permission to read files in home directory
```

### Solutions

**Option 1: Verify File Exists and is Readable**
```bash
# File must exist when response is sent
ls -la /path/to/file.txt

# Check it's readable
cat /path/to/file.txt > /dev/null 2>&1 && echo "✓ Readable" || echo "✗ Not readable"

# Check permissions
chmod 644 /path/to/file.txt  # Ensure world-readable
```

**Option 2: Use Absolute Paths in Attachments**
```bash
# DON'T use relative paths like: [SAM_ATTACH:./file.txt:file.txt]
# DO use absolute paths: [SAM_ATTACH:/home/user/file.txt:file.txt]
```

**Option 3: Check Discord Bot Permissions**

In Discord server settings:
- Bot must have "Attach Files" permission in the channel
- Bot must have "Send Messages" permission

```bash
# Discord admin panel:
# Server Settings → Roles → @sam-bot → Permissions → "Attach Files" ✓
```

**Option 4: File Size Limit**

Discord has file upload limits (~25 MB for most bots):
```bash
# Check file size
du -h /path/to/file.txt
# If > 25 MB, file won't upload
```

---

## Problem: Fallback Happening Too Often

### Symptom
- Logs show: `callJayGenticSubprocess() failed, falling back to Claude Code`
- Jay-gentic is working locally but always fails in service
- Service heavily favors Claude Code subprocess

### Diagnosis

```bash
# 1. Test jay-gentic locally
echo "Hello" | jay-gentic --agent sam --no-stream

# 2. Test with exact same environment as service
systemctl --user show-environment discord-remote-control

# 3. Compare environments
# Service env vs shell env might differ
```

### Solutions

**Option 1: Add Debug Logging**

Temporarily modify `jg-subprocess.ts` (service/claude/jg-subprocess.ts:195-210):
```typescript
console.log("🔍 Spawning jay-gentic with:");
console.log("  Command:", "jay-gentic", "--agent", "sam", "--no-stream");
console.log("  Env PATH:", env.PATH);
console.log("  Cwd:", process.cwd());

const proc = spawn(["jay-gentic", "--agent", "sam", "--no-stream"], {
  stdin: Buffer.from(prompt),
  stdout: "pipe",
  stderr: "pipe",
  env,
});

proc.on("error", (error) => {
  console.error("🔴 Spawn error:", error);
});
```

Restart service and check logs.

**Option 2: Verify Service Environment**

Service might not have correct PATH:
```bash
# Check service environment
systemctl --user show-environment | grep PATH

# Add debug to service unit file:
# ExecStart=/usr/bin/env bash -c "echo PATH=$PATH && bun run start"
```

**Option 3: Use Full Path to Jay-Gentic**

If PATH issues persist, modify `jg-subprocess.ts`:
```typescript
// Instead of relying on PATH:
const proc = spawn(["jay-gentic", ...

// Use absolute path:
const proc = spawn(["/usr/local/bin/jay-gentic", ...
// or
const proc = spawn(["/opt/homebrew/bin/jay-gentic", ...
```

**Option 4: Check Agent Profile from Service Context**

Service might have different HOME directory:
```bash
# Check service's view of HOME
systemctl --user show-environment | grep HOME

# Verify ~/.config/jay-gentic/agents/sam accessible from service home
ls -la $HOME/.config/jay-gentic/agents/sam/
```

---

## Problem: Memory System Integration Issues

### Symptom
- Memory context API calls failing
- Service logs: `POST http://localhost:4242/memory/search returned 500`
- Memory hooks enabled but not working

### Diagnosis

```bash
# 1. Memory system running?
curl http://localhost:4242/health

# 2. Try search endpoint
curl -X POST http://localhost:4242/memory/search \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","query":"test"}'

# 3. Check memory service logs
systemctl --user status memory-system
journalctl --user -u memory-system -n 50 --no-pager
```

### Solutions

**Option 1: Restart Memory System**
```bash
systemctl --user restart memory-system
sleep 2
curl http://localhost:4242/health
```

**Option 2: Check MEMORY_SERVICE_URL**
```bash
# Verify env var
echo $MEMORY_SERVICE_URL

# Should be: http://localhost:4242
# If different, update in .agent/.env
```

**Option 3: Disable Memory Gracefully**
```bash
# If memory-system is problematic, disable it
ENABLE_MEMORY_HOOKS=false

# Service will continue without memory context
# Responses won't have prior conversation context
```

**Option 4: Check Memory Database Health**
```bash
# In memory-system project
bun run health-check

# Or manually check database
ls -la ~/.claude/memory/db.sqlite
```

---

## Problem: High Latency / Timeouts

### Symptom
- Responses take 10+ seconds
- Sometimes timeout (no response)
- Discord shows "Bot is thinking..." for long periods

### Diagnosis

```bash
# 1. Test jay-gentic directly
time echo "Hello" | jay-gentic --agent sam --no-stream

# 2. Check system resources
top  # CPU, memory usage
df -h  # Disk space
free -h  # RAM available

# 3. Check network (if using remote LLM)
ping -c 3 openai.com  # Or your LLM provider
```

### Solutions

**Option 1: Use Local LLM**

If using remote LLM (OpenAI, Groq, etc.):
- **Network latency**: API requests cross internet (50-200ms)
- **Model latency**: API processing (500-2000ms)
- **Total**: 1-3 seconds typical, spikes to 10+ on congestion

**For faster responses**:
```bash
# Use Ollama with local model
# Edit sam agent profile
~/.config/jay-gentic/agents/sam/personality.yaml

model: ollama:neural-chat  # Fast local model
# Latency: <100ms typically
```

**Option 2: Reduce Model Size**

Larger models = slower:
```yaml
# Slow (but smarter)
model: ollama:neural-chat-7b
# or claude-opus-4 (API)

# Fast (but simpler)
model: ollama:tinyllama
```

**Option 3: Check Disk I/O**

If local model, check SSD:
```bash
# Monitor disk I/O
iostat -x 1 10  # Show I/O stats

# Ensure ollama model files not on slow disk
ls -lh ~/.ollama/models/
```

**Option 4: Increase Timeouts**

Modify `jg-subprocess.ts` timeout (line ~210):
```typescript
// Current: default Bun timeout
// Add explicit timeout handling:

const timeout = 30000; // 30 seconds
const timeoutHandle = setTimeout(() => {
  proc.kill();
}, timeout);

proc.on("exit", () => clearTimeout(timeoutHandle));
```

---

## Problem: Output Encoding/Character Issues

### Symptom
- Response has garbled characters: `mojibake`, unicode issues
- Emoji don't render correctly
- Non-ASCII characters show as `?` or `\u####`

### Diagnosis

```bash
# Check if jay-gentic output is valid UTF-8
echo "Hola, ¿cómo estás?" | jay-gentic --agent sam --no-stream | file -

# Check locale settings
locale
echo $LANG
```

### Solutions

**Option 1: Set UTF-8 Locale**
```bash
# Set in shell
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Add to .agent/.env
LANG=en_US.UTF-8
LC_ALL=en_US.UTF-8

# Restart service
systemctl --user restart discord-remote-control
```

**Option 2: Check Discord Encoding**

Discord expects UTF-8. Verify service sends UTF-8:
```typescript
// In jg-subprocess.ts, ensure output is UTF-8
const output = rawOutput.toString("utf-8");
```

**Option 3: Test Directly**
```bash
# Test with non-ASCII characters
echo "Test: hola, 你好, مرحبا, 🤖" | jay-gentic --agent sam --no-stream
# Output should preserve characters
```

---

## Getting Help

### Reporting Issues

When reporting bugs, include:

1. **Diagnostic output** (from script above)
2. **Exact error message** from logs
3. **Steps to reproduce**
4. **Environment info**:
   - OS: macOS / Linux
   - Jay-gentic version
   - Sam commit hash
   - Python sidecar version (if relevant)

### Support Resources

- **Jay-Gentic**: https://github.com/... (main project)
- **Sam**: https://github.com/... (this project)
- **Memory System**: ~/Projects/memory-system/README.md
- **Discord Bot**: https://discord.com/developers

### Debug Mode

To run discord-remote-control with maximum logging:

```bash
# Temporary: run service in foreground with debug output
cd ~/Projects/sam/.agent/skills/discord-remote-control/service

# Set debug env vars
export DEBUG=*
export PAI_USE_JAY_GENTIC=true
export ENABLE_MEMORY_HOOKS=true

# Run service directly
DISCORD_TOKEN="your-token" bun run start 2>&1 | tee debug.log

# Then send a message via Discord and watch output
```

---

**Last Updated**: 2026-04-22  
**Version**: 1.0  
**Status**: Comprehensive reference guide
