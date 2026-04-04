#!/bin/bash

# PAI Systemd User Service Installation Script
# Installs services to ~/.config/systemd/user/ (no sudo required)
# Services auto-restart on failure and start at boot via lingering

set -e

echo "======================================"
echo "PAI Systemd User Service Installation"
echo "======================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
TARGET_HOME="$HOME"

mkdir -p "$SYSTEMD_USER_DIR"

# Service template files in this directory
SERVICE_TEMPLATES=("pai-voice-server.service" "pai-discord.service" "pai-observability.service")

# Map template names to installed unit names
declare -A SVC_MAP=(
    ["pai-voice-server.service"]="voice-server.service"
    ["pai-discord.service"]="discord-remote-control.service"
    ["pai-observability.service"]="observability-dashboard.service"
)

# Install service files with path substitution
echo "📋 Installing systemd user service units..."
for template in "${SERVICE_TEMPLATES[@]}"; do
    if [ -f "$SCRIPT_DIR/$template" ]; then
        installed_name="${SVC_MAP[$template]}"
        sed "s|__HOME__|$TARGET_HOME|g" \
            "$SCRIPT_DIR/$template" > "$SYSTEMD_USER_DIR/$installed_name"
        echo "  ✅ Installed $installed_name (from $template)"
    else
        echo "  ❌ Missing $SCRIPT_DIR/$template"
    fi
done

# Install python-sidecar if voice-server exists
if [ -d "$TARGET_HOME/Projects/voice-server/python-sidecar" ]; then
    echo "  📝 Generating python-sidecar.service..."
    cat > "$SYSTEMD_USER_DIR/python-sidecar.service" << EOF
[Unit]
Description=PAI Python Sidecar (TTS Model Server)
After=network-online.target
Wants=network-online.target
PartOf=pai-infrastructure.target

[Service]
Type=simple
WorkingDirectory=$TARGET_HOME/Projects/voice-server/python-sidecar
ExecStart=$TARGET_HOME/Projects/voice-server/python-sidecar/venv/bin/python $TARGET_HOME/Projects/voice-server/python-sidecar/server.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="PYTHONUNBUFFERED=1"
Environment="CHATTERBOX_PORT=8889"

[Install]
WantedBy=pai-infrastructure.target
EOF
    echo "  ✅ Installed python-sidecar.service"
fi

# Install group target
cat > "$SYSTEMD_USER_DIR/pai-infrastructure.target" << EOF
[Unit]
Description=PAI Infrastructure Services
Documentation=man:systemd.target(5)

[Install]
WantedBy=default.target
EOF
echo "  ✅ Installed pai-infrastructure.target"

# Reload systemd user daemon
echo ""
echo "🔄 Reloading systemd user daemon..."
systemctl --user daemon-reload

# Enable services
echo "📌 Enabling services for auto-start..."
systemctl --user enable pai-infrastructure.target 2>/dev/null || true
for template in "${SERVICE_TEMPLATES[@]}"; do
    svc="${SVC_MAP[$template]}"
    svc_name="${svc%.service}"
    if [ -f "$SYSTEMD_USER_DIR/$svc" ]; then
        systemctl --user enable "$svc_name" 2>/dev/null || true
        echo "  ✅ Enabled $svc_name"
    fi
done
if [ -f "$SYSTEMD_USER_DIR/python-sidecar.service" ]; then
    systemctl --user enable python-sidecar 2>/dev/null || true
    echo "  ✅ Enabled python-sidecar"
fi

# Enable lingering for boot-time startup without login
echo ""
echo "🔐 Enabling user lingering (services start at boot)..."
loginctl enable-linger "$(whoami)" 2>/dev/null || echo "  ⚠️  Could not enable lingering (may need admin)"

# Start services
echo ""
echo "🚀 Starting services..."
systemctl --user start pai-infrastructure.target 2>/dev/null || true
sleep 2

for svc_name in voice-server python-sidecar observability-dashboard discord-remote-control; do
    if systemctl --user is-active --quiet "$svc_name" 2>/dev/null; then
        echo "  ✅ $svc_name — running"
    else
        echo "  ⚠️  $svc_name — not running (check: journalctl --user -u $svc_name -n 10)"
    fi
done

# Install watchdog and health-check
echo ""
echo "⏰ Setting up watchdog..."
chmod +x "$SCRIPT_DIR/watchdog.sh" "$SCRIPT_DIR/health-check.sh" 2>/dev/null || true

# Add watchdog to crontab
echo "📅 Adding watchdog to crontab (runs every 5 minutes)..."
(crontab -l 2>/dev/null | grep -v "/watchdog.sh" || true; echo "*/5 * * * * $SCRIPT_DIR/watchdog.sh") | crontab -
echo "  ✅ Watchdog cron job installed"

# Summary
echo ""
echo "======================================"
echo "✅ Installation Complete!"
echo "======================================"
echo ""
echo "📝 Useful Commands:"
echo "  • Status:    systemctl --user status voice-server python-sidecar observability-dashboard discord-remote-control"
echo "  • Logs:      journalctl --user -u voice-server -f"
echo "  • Restart:   systemctl --user restart voice-server"
echo "  • Stop all:  systemctl --user stop pai-infrastructure.target"
echo "  • Start all: systemctl --user start pai-infrastructure.target"
echo "  • Health:    $SCRIPT_DIR/health-check.sh"
echo ""
