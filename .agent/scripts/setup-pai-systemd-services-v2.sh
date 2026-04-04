#!/bin/bash
# Setup PAI Infrastructure Systemd Services (Updated)
# This script (re)creates systemd service files for PAI components
# Updated to include discord-remote-control fix + awareness + markdown-editor services

set -e

echo "🔧 Setting up PAI Infrastructure Systemd Services (v2)..."
echo ""

# Detect home directory and project paths
HOME_DIR="${HOME:-$(eval echo ~$USER)}"
PAI_DIR="$HOME_DIR/.claude"
VOICE_SERVER_DIR="$HOME_DIR/Projects/voice-server"
OBSERVABILITY_DIR="$PAI_DIR/skills/observability"
DISCORD_SERVICE_DIR="$PAI_DIR/skills/discord-remote-control/service"
AWARENESS_DIR="$HOME_DIR/Projects/awareness"
MARKDOWN_EDITOR_DIR="$HOME_DIR/Projects/markdown-editor"
SYSTEMD_USER_DIR="$HOME_DIR/.config/systemd/user"

# Ensure systemd user directory exists
mkdir -p "$SYSTEMD_USER_DIR"

echo "📍 Using paths:"
echo "   HOME: $HOME_DIR"
echo "   PAI_DIR: $PAI_DIR"
echo "   VOICE_SERVER: $VOICE_SERVER_DIR"
echo "   OBSERVABILITY: $OBSERVABILITY_DIR"
echo "   DISCORD_SERVICE: $DISCORD_SERVICE_DIR"
echo "   AWARENESS: $AWARENESS_DIR"
echo "   MARKDOWN_EDITOR: $MARKDOWN_EDITOR_DIR"
echo "   SYSTEMD: $SYSTEMD_USER_DIR"
echo ""

# ============================================================================
# Voice Server Service
# ============================================================================
echo "▶ Creating voice-server.service..."
cat > "$SYSTEMD_USER_DIR/voice-server.service" << 'EOF'
[Unit]
Description=PAI Voice Server (TTS HTTP API)
After=network-online.target
Wants=network-online.target
PartOf=pai-infrastructure.target

[Service]
Type=simple
WorkingDirectory=VOICE_SERVER_DIR_PLACEHOLDER
ExecStart=/bin/bash VOICE_SERVER_DIR_PLACEHOLDER/run-server.sh
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="PORT=8888"

[Install]
WantedBy=pai-infrastructure.target
EOF

# Replace placeholders
sed -i "s|VOICE_SERVER_DIR_PLACEHOLDER|$VOICE_SERVER_DIR|g" "$SYSTEMD_USER_DIR/voice-server.service"

# ============================================================================
# Python Sidecar Service
# ============================================================================
echo "▶ Creating python-sidecar.service..."
cat > "$SYSTEMD_USER_DIR/python-sidecar.service" << EOF
[Unit]
Description=PAI Python Sidecar (TTS Model Server)
After=network-online.target
Wants=network-online.target
PartOf=pai-infrastructure.target

[Service]
Type=simple
WorkingDirectory=$VOICE_SERVER_DIR/python-sidecar
ExecStart=$VOICE_SERVER_DIR/python-sidecar/venv/bin/python $VOICE_SERVER_DIR/python-sidecar/server.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="PYTHONUNBUFFERED=1"
Environment="CHATTERBOX_PORT=8889"

[Install]
WantedBy=pai-infrastructure.target
EOF

# ============================================================================
# Observability Dashboard Service
# ============================================================================
echo "▶ Creating observability-dashboard.service..."
cat > "$SYSTEMD_USER_DIR/observability-dashboard.service" << EOF
[Unit]
Description=PAI Observability Dashboard (Monitoring & Visualization)
After=network-online.target voice-server.service
Wants=network-online.target
PartOf=pai-infrastructure.target

[Service]
Type=forking
WorkingDirectory=$OBSERVABILITY_DIR
ExecStart=/bin/bash $OBSERVABILITY_DIR/manage.sh start
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="VITE_API_URL=http://localhost:4000"
PIDFile=$OBSERVABILITY_DIR/server.pid

[Install]
WantedBy=pai-infrastructure.target
EOF

# ============================================================================
# Discord Remote Control Service (FIXED)
# ============================================================================
echo "▶ Creating discord-remote-control.service..."
cat > "$SYSTEMD_USER_DIR/discord-remote-control.service" << EOF
[Unit]
Description=PAI Discord Remote Control (Memory Server)
After=network-online.target
Wants=network-online.target
PartOf=pai-infrastructure.target

[Service]
Type=simple
WorkingDirectory=$DISCORD_SERVICE_DIR
ExecStart=$HOME_DIR/.bun/bin/bun index.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"

[Install]
WantedBy=pai-infrastructure.target
EOF

# ============================================================================
# Awareness Service
# ============================================================================
if [ -d "$AWARENESS_DIR" ]; then
  echo "▶ Creating awareness.service..."
  cat > "$SYSTEMD_USER_DIR/awareness.service" << EOF
[Unit]
Description=PAI Awareness (CLI Intelligence Curation)
After=network-online.target
Wants=network-online.target
PartOf=pai-infrastructure.target

[Service]
Type=simple
WorkingDirectory=$AWARENESS_DIR
ExecStart=$HOME_DIR/.bun/bin/bun run src/cli/index.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"

[Install]
WantedBy=pai-infrastructure.target
EOF
else
  echo "⚠ Awareness not found at $AWARENESS_DIR, skipping..."
fi

# ============================================================================
# Markdown Editor Service
# ============================================================================
if [ -d "$MARKDOWN_EDITOR_DIR" ]; then
  echo "▶ Creating markdown-editor.service..."
  cat > "$SYSTEMD_USER_DIR/markdown-editor.service" << EOF
[Unit]
Description=PAI Markdown Editor (Web-based Viewer)
After=network-online.target
Wants=network-online.target
PartOf=pai-infrastructure.target

[Service]
Type=simple
WorkingDirectory=$MARKDOWN_EDITOR_DIR
ExecStart=$HOME_DIR/.bun/bin/bun run server.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="PORT=3000"

[Install]
WantedBy=pai-infrastructure.target
EOF
else
  echo "⚠ Markdown Editor not found at $MARKDOWN_EDITOR_DIR, skipping..."
fi

# ============================================================================
# PAI Infrastructure Target
# ============================================================================
echo "▶ Creating pai-infrastructure.target..."
cat > "$SYSTEMD_USER_DIR/pai-infrastructure.target" << 'EOF'
[Unit]
Description=PAI Infrastructure Services
Documentation=man:systemd.target(5)
Wants=voice-server.service python-sidecar.service observability-dashboard.service discord-remote-control.service awareness.service markdown-editor.service

[Install]
WantedBy=default.target
EOF

# ============================================================================
# Ensure observability manage.sh has bun path configured
# ============================================================================
if [ -f "$OBSERVABILITY_DIR/manage.sh" ]; then
  echo "▶ Verifying observability manage.sh configuration..."
  if ! grep -q "BUN_BIN=" "$OBSERVABILITY_DIR/manage.sh"; then
    echo "⚠ Adding BUN_BIN configuration to manage.sh..."
    sed -i "1i\\
export BUN_BIN=\"$HOME_DIR/.bun/bin/bun\"" "$OBSERVABILITY_DIR/manage.sh"
  fi
fi

# ============================================================================
# Reload systemd and enable services
# ============================================================================
echo ""
echo "🔄 Reloading systemd user daemon..."
systemctl --user daemon-reload

echo "✓ Enabling pai-infrastructure.target..."
systemctl --user enable pai-infrastructure.target

echo ""
echo "✅ All PAI Infrastructure services have been configured!"
echo ""
echo "📌 Next steps:"
echo "   1. Start all services:   systemctl --user start pai-infrastructure.target"
echo "   2. Check status:         systemctl --user status pai-infrastructure.target"
echo "   3. View logs:            journalctl --user -u voice-server.service -f"
echo ""
echo "🔗 Service Endpoints (when running):"
echo "   • Voice Server:     http://localhost:8888"
echo "   • Python Sidecar:   http://localhost:8889"
echo "   • Observability:    http://localhost:5172"
echo "   • Markdown Editor:  http://localhost:3000"
echo "   • Discord Control:  Configured via environment"
