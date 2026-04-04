---
name: launchd-service
description: Create macOS launchd services following the PAI pattern. USE WHEN adding a new background service, scheduled job, or timer to the PAI infrastructure on macOS.
user-invocable: true
allowed-tools: Read, Write, Bash, Glob
---

# launchd-service

Create macOS launchd services following the PAI pattern. Always produces three artifacts:
1. **Wrapper script** — `~/.claude/bin/pai-{service-name}` (this filename is what macOS shows in System Settings > Background Applications)
2. **Plist** — `~/Library/LaunchAgents/com.pai.{service-name}.plist`
3. **Load** — `launchctl load` to register immediately

---

## Naming Convention

| Component | Pattern | Example |
|-----------|---------|---------|
| Wrapper script | `~/.claude/bin/pai-{service-name}` | `pai-awareness-pipeline` |
| Plist filename | `com.pai.{service-name}.plist` | `com.pai.awareness-pipeline.plist` |
| Label | `com.pai.{service-name}` | `com.pai.awareness-pipeline` |
| Log file | `~/Library/Logs/pai-{service-name}.log` | `pai-awareness-pipeline.log` |

The wrapper script name (`pai-{service-name}`) is the display name shown in **System Settings > General > Login Items & Extensions > Allow in Background**.

---

## Step 1: Wrapper Script

Create `~/.claude/bin/pai-{service-name}` and make it executable:

```sh
#!/bin/sh
exec /.bun/bin/bun run {entrypoint} "$@"
```

Common entrypoints:
- Server (TypeScript source): `src/index.ts`
- CLI run command: `src/cli/index.ts run`
- Dev/vite frontend: `dev` (uses package.json script)
- Compiled JS: `index.js`

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
        <string>/.claude/bin/pai-{service-name}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Projects/{project-dir}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>StandardOutPath</key>
    <string>/Library/Logs/pai-{service-name}.log</string>

    <key>StandardErrorPath</key>
    <string>/Library/Logs/pai-{service-name}.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string></string>
        <key>PATH</key>
        <string>/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <!-- Add service-specific vars here, e.g. PORT, DATABASE_URL -->
    </dict>
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
        <string>/.claude/bin/pai-{service-name}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Projects/{project-dir}</string>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>/Library/Logs/pai-{service-name}.log</string>

    <key>StandardErrorPath</key>
    <string>/Library/Logs/pai-{service-name}.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string></string>
        <key>PATH</key>
        <string>/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <!-- Add service-specific vars here -->
    </dict>
</dict>
</plist>
```

For multiple schedule times, use an array of dicts in `StartCalendarInterval`.

---

## Step 4: Load and Verify

```bash
# Load the service
launchctl load ~/Library/LaunchAgents/com.pai.{service-name}.plist

# Verify it registered (shows as "-" PID when idle, or a PID when running)
launchctl list | grep {service-name}

# To unload
launchctl unload ~/Library/LaunchAgents/com.pai.{service-name}.plist

# To reload after editing the plist
launchctl unload ~/Library/LaunchAgents/com.pai.{service-name}.plist
launchctl load ~/Library/LaunchAgents/com.pai.{service-name}.plist
```

---

## Formatting Rules

- Use **4-space indentation** (not tabs)
- Stdout and stderr go to the **same log file**
- PATH must always start with `/.bun/bin` so bun is found
- `HOME` must always be set explicitly (launchd does not inherit shell env)

---

## Common Environment Variables

| Key | Value | When to include |
|-----|-------|-----------------|
| `HOME` | `` | Always |
| `PATH` | bun + homebrew + system | Always |
| `PORT` | port number string | HTTP servers |
| `AWARENESS_DB` | path to `awareness.db` | Awareness services |
| `DASHBOARD_PORT` | port number string | Dashboard servers |

---

## Real Examples

### awareness-pipeline (scheduled job, 06:00 daily)
- Wrapper: `~/.claude/bin/pai-awareness-pipeline` → `exec bun run src/cli/index.ts run`
- Plist: `com.pai.awareness-pipeline.plist` with `StartCalendarInterval Hour=6`

### awareness-server (long-running)
- Wrapper: `~/.claude/bin/pai-awareness-server` → `exec bun run src/index.ts`
- Plist: `com.pai.awareness-server.plist` with `RunAtLoad + KeepAlive`

### memory-backup-daily (scheduled, 03:00 daily)
- Label: `com.sam.memory-backup-daily` (SAM-specific services use `com.sam.*`)
- Wrapper: `~/.claude/bin/pai-memory-backup-daily`
