# PAI Services (Linux systemd / macOS LaunchAgents)

PAI services run as background daemons that auto-start and restart on failure. The mechanism differs by platform:

- **Linux:** systemd user services under `pai-infrastructure.target`. Requires `loginctl enable-linger` for boot-time startup without login.
- **macOS:** LaunchAgent plists in `~/Library/LaunchAgents/`. Auto-start at login; `KeepAlive` restarts on failure.

Both platforms are set up automatically by `setup.sh` Step 9.

---

## Linux: Systemd User Services

All PAI services run as **systemd user services** under the `pai-infrastructure.target`. Linger is enabled (`loginctl enable-linger $(whoami)`) so services persist after logout and auto-start at boot.

## Service Inventory

| Service | Backend Port | Frontend Port | Type | Status |
|---------|-------------|---------------|------|--------|
| **voice-server** | 8888 | — | simple | Active |
| **observability-dashboard** | 4000 | 5172 | forking | Active |
| **discord-remote-control** | — | — | simple | Active |
| **awareness-dashboard** | 4100 | 5173 | forking | Active |
| **cyber-alert-mgr** | 4200 | 5174 | forking | Active |
| **markdown-editor** | 4444 | — | simple | Active |

> **Note:** `python-sidecar` (port 8889) is **not** a standalone systemd service.
> It is spawned and managed internally by voice-server as a child process. Installing
> a separate `python-sidecar.service` causes a port conflict and crash-loop.
> See `voice-server/docs/CROSTINI_LINUX_FIXES.md` for details.

### External Services (not PAI-managed)

| Service | Port | Notes |
|---------|------|-------|
| ollama | 11434 | Homebrew-managed, inference engine |

## Port Map

```
Port    Service                      Binding    Notes
────    ───────                      ───────    ─────
4200    cyber-alert-mgr (backend)    0.0.0.0
4000    observability (backend)      0.0.0.0
4100    awareness (backend)          0.0.0.0
5172    observability (frontend)     0.0.0.0
5173    awareness (frontend)         0.0.0.0
5174    cyber-alert-mgr (frontend)   0.0.0.0
8888    voice-server                 127.0.0.1
8889    python-sidecar child         127.0.0.1  Managed by voice-server, not a separate service
4444    markdown-editor              0.0.0.0
11434   ollama                       127.0.0.1
```

## Common Commands

```bash
# Check all PAI services
systemctl --user status pai-infrastructure.target

# List all PAI services
systemctl --user list-dependencies pai-infrastructure.target

# Restart a specific service
systemctl --user restart awareness-dashboard.target

# View logs
journalctl --user -u cyber-alert-mgr-server -f
journalctl --user -u cyber-alert-mgr-frontend -f

# Reload after editing .service files
systemctl --user daemon-reload

# Enable/disable a service
systemctl --user enable cyber-alert-mgr-server cyber-alert-mgr-frontend
systemctl --user disable cyber-alert-mgr-server cyber-alert-mgr-frontend
```

## Service Files

All service files live in `~/.config/systemd/user/`:

- `voice-server.service` (manages python-sidecar internally as a child process)
- `observability-dashboard.service`
- `discord-remote-control.service`
- `awareness-dashboard.target`
- `awareness-dashboard-server.service`
- `awareness-dashboard-client.service`
- `cyber-alert-mgr-server.service`
- `cyber-alert-mgr-frontend.service`
- `markdown-editor.service`
- `pai-infrastructure.target`

Templates live in `.agent/services/` (use `__HOME__` placeholder for user home path).

## Dependency Graph

```
default.target
└── pai-infrastructure.target
    ├── voice-server.service  (spawns python-sidecar child on port 8889)
    ├── observability-dashboard.service
    ├── discord-remote-control.service
    ├── awareness-dashboard.target
    │   ├── awareness-dashboard-server.service
    │   └── awareness-dashboard-client.service
    ├── cyber-alert-mgr-server.service
    ├── cyber-alert-mgr-frontend.service
    └── markdown-editor.service
```

## Management Scripts

Each dashboard-style service uses a `manage.sh` pattern:

| Project | Script | Commands |
|---------|--------|----------|
| Observability | `~/.claude/skills/observability/manage.sh` | start, stop |
| Awareness | `~/Projects/awareness/dashboard/manage.sh` | --start, --stop, --restart, --status |
| CyberWatch | `~/Projects/cyber-alert-mgr/manage.sh` | --start, --stop, --restart, --status |

## Troubleshooting

### Service won't start
```bash
# Check logs
journalctl --user -u <service-name> --no-pager -n 50

# Verify service file syntax
systemd-analyze verify ~/.config/systemd/user/<service-name>.service
```

### Port already in use
```bash
# Find process on port
lsof -i:<port>

# Kill it
kill $(lsof -ti:<port>)
```

### Linger verification
```bash
loginctl show-user $(whoami) -p Linger
# Should output: Linger=yes
```

---

## macOS: LaunchAgent Services

Services are installed as LaunchAgent plist files in `~/Library/LaunchAgents/`. Named wrapper scripts in `~/.claude/bin/` ensure meaningful display names in System Settings → General → Login Items & Extensions.

### Service Inventory

| Label | Wrapper Script | Port(s) | Working Directory |
|-------|---------------|---------|-------------------|
| `com.pai.voice-server` | `pai-voice-server` | 8888 | `~/Projects/voice-server` |
| `com.pai.observability-server` | `pai-observability-server` | 4000 | `~/.claude/skills/observability/apps/server` |
| `com.pai.observability-client` | `pai-observability-client` | 5172 | `~/.claude/skills/observability/apps/client` |
| `com.pai.discord-remote-control` | `pai-discord-bot` | — | `~/.claude/skills/discord-remote-control/service` |
| `com.pai.awareness-server` | `pai-awareness-server` | 4100 | `~/Projects/awareness/dashboard/apps/server` |
| `com.pai.awareness-client` | `pai-awareness-client` | 5173 | `~/Projects/awareness/dashboard/apps/client` |
| `com.pai.cyber-alert-server` | `pai-cyber-alert-server` | 4200 | `~/Projects/cyber-alert-mgr/server` |
| `com.pai.cyber-alert-client` | `pai-cyber-alert-client` | 5174 | `~/Projects/cyber-alert-mgr` |
| `com.pai.markdown-editor` | `pai-markdown-editor` | 4444 | `~/Projects/markdown-editor` |
| `com.sam.memory-backup-hourly` | `pai-memory-backup-hourly` | — | `~/.claude` (runs every hour) |
| `com.sam.memory-backup-daily` | `pai-memory-backup-daily` | — | `~/.claude` (runs at 3am) |

> **Note:** `python-sidecar` (port 8889) is **not** a standalone LaunchAgent.
> It is spawned and managed internally by voice-server. Installing a separate plist causes a port conflict and crash-loop.

### Common Commands

```bash
# List all PAI LaunchAgents
launchctl list | grep -E "com\.(pai|sam)\."

# Check service status
launchctl list com.pai.voice-server

# Stop a service
launchctl bootout "gui/$(id -u)/com.pai.voice-server"

# Start a service manually
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.pai.voice-server.plist

# View logs
tail -f ~/Library/Logs/pai-voice-server.log
tail -f ~/Library/Logs/pai-discord-bot.log
```

### Code Signing

Wrapper scripts are signed with a self-signed "yourusername" certificate to improve the display name in System Settings. To re-sign after modifying a wrapper:

```bash
# List available signing identities
security find-identity -v -p codesigning

# Sign a wrapper script
codesign -f -s "yourusername" ~/.claude/bin/pai-voice-server
```

To create the certificate the first time:
```bash
# Generate cert + key
openssl req -x509 -newkey rsa:2048 -keyout /tmp/cs.key -out /tmp/cs.cer \
  -days 3650 -nodes -subj "/CN=yourusername" \
  -extensions codesign_ext \
  -config <(cat /etc/ssl/openssl.cnf; echo "[codesign_ext]
basicConstraints=CA:FALSE
keyUsage=digitalSignature
extendedKeyUsage=codeSigning")

# Import key and cert
security import /tmp/cs.key -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign
security add-trusted-cert -r trustRoot -p codeSign -k ~/Library/Keychains/login.keychain-db /tmp/cs.cer
```

### Troubleshooting (macOS)

**Service won't start:**
```bash
# Check exit code and last run time
launchctl list com.pai.<name>

# View logs
tail -50 ~/Library/Logs/pai-<name>.log
```

**Port already in use:**
```bash
lsof -i:<port>
kill $(lsof -ti:<port>)
```

**`bun: command not found` in service:**
Ensure PATH in the plist includes `$HOME/.bun/bin`. The wrapper scripts set this automatically when installed via `setup.sh`.

**discord-remote-control missing env vars:**
The `pai-discord-bot` wrapper sources `~/.claude/.env` using `set -a && . ~/.claude/.env && set +a` to export bare-assignment variables. If the bot fails to start, verify `DISCORD_BOT_TOKEN` is set in `~/.claude/.env`.
