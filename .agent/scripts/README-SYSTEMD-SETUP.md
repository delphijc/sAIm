# PAI Infrastructure Systemd Services Setup

This script automates the creation and configuration of systemd user services for the PAI (Personal AI Infrastructure) system.

## What It Does

The `setup-pai-systemd-services.sh` script:

1. **Creates service files** for all PAI components:
   - `voice-server.service` — Text-to-speech HTTP API (port 8888)
   - `python-sidecar.service` — TTS model server (port 8889)
   - `observability-dashboard.service` — Monitoring dashboard (ports 4000/5172)
   - `discord-remote-control.service` — Discord bot interface

2. **Creates the target unit** — `pai-infrastructure.target` that manages all services together

3. **Configures paths** — Automatically detects and uses correct project paths based on `$HOME`

4. **Ensures dependencies** — Services start in the correct order with proper dependencies

5. **Fixes observability** — Updates `manage.sh` to use the correct bun binary path for systemd context

## Usage

### Initial Setup

Run the script to create all systemd service files:

```bash
bash .agent/scripts/setup-pai-systemd-services.sh
```

### Start Services

After setup, start all services:

```bash
systemctl --user start pai-infrastructure.target
```

Or start individual services:

```bash
systemctl --user start voice-server.service
systemctl --user start python-sidecar.service
systemctl --user start observability-dashboard.service
systemctl --user start discord-remote-control.service
```

### Check Status

View overall status:

```bash
systemctl --user status pai-infrastructure.target
```

View individual service status:

```bash
systemctl --user status voice-server.service
```

### View Logs

View logs for a service:

```bash
journalctl --user -u voice-server.service -f
```

View all PAI service logs:

```bash
journalctl --user -u pai-infrastructure.target -f
```

### Stop Services

Stop all services:

```bash
systemctl --user stop pai-infrastructure.target
```

Stop individual services:

```bash
systemctl --user stop voice-server.service
```

## Service Details

### voice-server.service
- **Starts**: `/Projects/voice-server/run-server.sh`
- **Port**: 8888
- **Health Check**: `curl http://localhost:8888/health`
- **Purpose**: HTTP API for text-to-speech synthesis

### python-sidecar.service
- **Starts**: `/Projects/voice-server/python-sidecar/venv/bin/python server.py`
- **Port**: 8889
- **Health Check**: `curl http://localhost:8889/health`
- **Purpose**: PyTorch-based TTS model server
- **Key**: Uses virtualenv Python to ensure dependencies are available

### observability-dashboard.service
- **Starts**: `~/.claude/skills/observability/manage.sh start`
- **Ports**: 4000 (backend), 5172 (frontend)
- **Health Check**: `curl http://localhost:5172/`
- **Purpose**: Real-time monitoring of multi-agent activity
- **Type**: `forking` (launches background processes)

### discord-remote-control.service
- **Starts**: Discord bot integration
- **Purpose**: Remote interface for Sam via Discord messages

## Autostart Configuration

Services are configured to start automatically on login. To verify:

```bash
systemctl --user is-enabled pai-infrastructure.target
# Should output: enabled
```

To disable autostart:

```bash
systemctl --user disable pai-infrastructure.target
```

## Troubleshooting

### Services fail to start after system update

Rerun this script to ensure paths are still correct:

```bash
bash .agent/scripts/setup-pai-systemd-services.sh
```

### Port already in use

If you see "Address already in use" errors, kill existing processes:

```bash
# Kill voice server
lsof -i :8888 | grep -v COMMAND | awk '{print $2}' | xargs kill -9

# Kill python sidecar
lsof -i :8889 | grep -v COMMAND | awk '{print $2}' | xargs kill -9

# Kill observability
lsof -i :4000 -i :5172 | grep -v COMMAND | awk '{print $2}' | xargs kill -9
```

Then restart services:

```bash
systemctl --user daemon-reload
systemctl --user start pai-infrastructure.target
```

### Service fails with "ModuleNotFoundError: No module named 'torch'"

The python-sidecar virtualenv may not be initialized. Rebuild it:

```bash
cd ~/Projects/voice-server/python-sidecar
bash rebuild-venv.sh
systemctl --user restart python-sidecar.service
```

### Observability dashboard not starting

Check if the manage.sh script has correct bun path:

```bash
grep 'BUN_BIN=' ~/.claude/skills/observability/manage.sh
```

If not found, rerun the setup script:

```bash
bash .agent/scripts/setup-pai-systemd-services.sh
```

## Configuration Files

Service files are stored in:
- **User level**: `~/.config/systemd/user/`

View a service configuration:

```bash
cat ~/.config/systemd/user/voice-server.service
```

## Integration with CLAUDE.md

This setup integrates with the PAI infrastructure requirements in `CLAUDE.md`. Services are automatically enabled and will start on user login.

## Manual Service File Creation

If you need to create a service file manually (not recommended), the format is:

```ini
[Unit]
Description=Service Description
After=network-online.target
PartOf=pai-infrastructure.target

[Service]
Type=simple
WorkingDirectory=/path/to/service
ExecStart=/path/to/command
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=pai-infrastructure.target
```

## Version History

- **2026-03-13**: Initial release with support for voice-server, python-sidecar, observability, and discord-remote-control
