---
name: launchd-service
description: Create macOS launchd services following the PAI pattern. USE WHEN adding a new background service, creating a plist, registering a launchd agent, setting up a scheduled job, or wrapping any process as a PAI service on macOS.
user-invocable: true
allowed-tools: Read, Write, Bash, Glob
triggers:
  - "create a launchd service"
  - "add a background service"
  - "create a plist"
  - "register a launchd agent"
  - "set up a scheduled job"
  - "wrap as a PAI service"
  - "new plist"
  - "com.pai."
---

# launchd-service

Create macOS launchd services following the PAI pattern. Always produces three artifacts:
1. **Wrapper script** — `~/.claude/bin/pai-{service-name}` — this filename is **what macOS displays** in System Settings > Login Items > Allow in Background
2. **Plist** — `~/Library/LaunchAgents/com.pai.{service-name}.plist`
3. **Load** — `launchctl bootstrap` to register immediately

> **Critical:** macOS derives the display name in System Settings from the **executable** being launched, not the plist label. Always use a `pai-{service-name}` wrapper — never point `ProgramArguments` directly at `python3`, `bun`, `node`, or any shell script. Doing so will show "python3" or "bash" instead of your service name.

---

## Naming Convention

| Component | Pattern | Example |
|-----------|---------|---------|
| Wrapper script | `~/.claude/bin/pai-{service-name}` | `pai-python-sidecar` |
| Plist filename | `com.pai.{service-name}.plist` | `com.pai.python-sidecar.plist` |
| Label | `com.pai.{service-name}` | `com.pai.python-sidecar` |
| Log (stdout) | `~/Library/Logs/pai-{service-name}.log` | `pai-python-sidecar.log` |
| Log (stderr) | `~/Library/Logs/pai-{service-name}-error.log` | `pai-python-sidecar-error.log` |

---

## Step 1: Wrapper Script

Create `~/.claude/bin/pai-{service-name}` and make it executable. The wrapper always uses `exec` (replaces the shell process — no zombie parent):

**Bun / TypeScript:**
```sh
#!/bin/sh
exec $HOME/.bun/bin/bun run $HOME/Projects/{project}/src/index.ts "$@"
```

**Python (venv):**
```sh
#!/bin/sh
exec $HOME/Projects/{project}/venv/bin/python3 $HOME/Projects/{project}/server.py "$@"
```

**Node.js:**
```sh
#!/bin/sh
exec /opt/homebrew/bin/node $HOME/Projects/{project}/index.js "$@"
```

```bash
chmod +x ~/.claude/bin/pai-{service-name}
```

---

## Step 2: Plist — Long-Running Service

For persistent background processes (servers, daemons). Uses `RunAtLoad` + `KeepAlive`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pai.{service-name}</string>

    <key>ProgramArguments</key>
    <array>
        <string>$HOME/.claude/bin/pai-{service-name}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$HOME/Projects/{project-dir}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>

    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/pai-{service-name}.log</string>

    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/pai-{service-name}-error.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>$HOME</string>
        <key>PATH</key>
        <string>$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <!-- Add service-specific vars here, e.g. PORT -->
    </dict>

    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
```

---

## Step 3: Plist — Scheduled One-Shot Job

For jobs that run on a schedule (daily pipelines, backups). Uses `StartCalendarInterval`. **No `RunAtLoad`, no `KeepAlive`.**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pai.{service-name}</string>

    <key>ProgramArguments</key>
    <array>
        <string>$HOME/.claude/bin/pai-{service-name}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$HOME/Projects/{project-dir}</string>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/pai-{service-name}.log</string>

    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/pai-{service-name}-error.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>$HOME</string>
        <key>PATH</key>
        <string>$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
```

For multiple schedule times, use an array of dicts in `StartCalendarInterval`.

---

## Step 4: Load and Verify

Use `bootstrap`/`bootout` (not the deprecated `load`/`unload`):

```bash
# Load for the first time
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.pai.{service-name}.plist

# Verify running (shows PID when active, "-" when stopped)
launchctl list | grep {service-name}

# Reload after editing plist (full cycle required)
launchctl bootout gui/$(id -u)/com.pai.{service-name}
sleep 2
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.pai.{service-name}.plist

# Start/stop without unregistering
launchctl stop com.pai.{service-name}
launchctl start com.pai.{service-name}
```

> **Note:** `launchctl load/unload` is deprecated on modern macOS and may silently fail. Always use `bootstrap`/`bootout`.

---

## Step 5: Add to Service Monitor

Add an entry to `.agent/skills/service-monitor-dashboard/apps/server/src/config.ts`:

```typescript
{
  name: '{service-name}',
  description: 'Short description of what this service does',
  category: 'infrastructure',
  port: 8889,          // undefined if no HTTP port
  unit: 'com.pai.{service-name}'
},
```

---

## Formatting Rules

- Use **4-space indentation** (not tabs)
- Separate stdout and stderr into distinct log files (`*.log` and `*-error.log`)
- PATH must always start with `$HOME/.bun/bin` so bun is found
- `HOME` must always be set explicitly (launchd does not inherit shell env)
- Always include `ThrottleInterval: 10` on long-running services to prevent restart storms
- Always include `KeepAlive.Crashed: true` on long-running services for crash recovery
- `WorkingDirectory` is critical for services that use relative file paths

---

## Runtime-Specific Notes

### Python (venv)
- Point the wrapper `exec` at the **venv python3**, not system python: `{project}/venv/bin/python3`
- Add `PYTHONUNBUFFERED=1` to `EnvironmentVariables` so logs appear in real time
- Set `WorkingDirectory` to the directory containing the script if it uses relative paths (e.g. `Path("voices")`)
- Do **not** source `activate` — calling the venv python3 directly is equivalent and cleaner

### Bun / TypeScript
- Use `exec $HOME/.bun/bin/bun run {entrypoint}` — not `bun x` or `npx`
- PATH must include `$HOME/.bun/bin` in the plist `EnvironmentVariables`

### Service Ownership
- Each service should manage its **own lifecycle**. Do not have one service spawn another as a subprocess — give each process its own plist so launchd controls restarts, logs, and visibility independently.

---

## Common Environment Variables

| Key | Value | When to include |
|-----|-------|-----------------|
| `HOME` | `$HOME` | Always |
| `PATH` | bun + homebrew + system | Always |
| `PORT` | port number string | HTTP servers |
| `PYTHONUNBUFFERED` | `1` | Python services |
| `AWARENESS_DB` | path to `awareness.db` | Awareness services |

---

## Real Examples

### python-sidecar (long-running Python venv service)
- Wrapper: `~/.claude/bin/pai-python-sidecar` → `exec venv/bin/python3 server.py`
- Plist: `com.pai.python-sidecar.plist` with `RunAtLoad + KeepAlive + ThrottleInterval`
- Env: `PORT=8889`, `PYTHONUNBUFFERED=1`
- WorkingDirectory: `$HOME/Projects/voice-server/python-sidecar`

### awareness-pipeline (scheduled job, 06:00 daily)
- Wrapper: `~/.claude/bin/pai-awareness-pipeline` → `exec bun run src/cli/index.ts run`
- Plist: `com.pai.awareness-pipeline.plist` with `StartCalendarInterval Hour=6`

### awareness-server (long-running Bun service)
- Wrapper: `~/.claude/bin/pai-awareness-server` → `exec bun run src/index.ts`
- Plist: `com.pai.awareness-server.plist` with `RunAtLoad + KeepAlive`
