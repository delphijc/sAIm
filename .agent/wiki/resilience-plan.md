# PAI Resilience & Crash Recovery Plan

## Objective
Ensure PAI services automatically recover from crashes with minimal manual intervention.

---

## Phase 1: Systemd Service Units (Priority: CRITICAL)

### 1. Voice Server Service
**File:** `/etc/systemd/system/pai-voice-server.service`

```ini
[Unit]
Description=PAI Voice Server (ChatterboxTTS)
After=network.target
Wants=pai-discord.service

[Service]
Type=simple
User=%i
WorkingDirectory=$HOME/Projects/voice-server
ExecStart=$HOME/Projects/voice-server/start.sh
Restart=on-failure
RestartSec=10
StartLimitInterval=300
StartLimitBurst=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Setup:**
```bash
sudo tee /etc/systemd/system/pai-voice-server.service > /dev/null <<'EOF'
[Unit]
Description=PAI Voice Server (ChatterboxTTS)
After=network.target

[Service]
Type=simple
User=%i
WorkingDirectory=$HOME/Projects/voice-server
ExecStart=$HOME/Projects/voice-server/start.sh
Restart=on-failure
RestartSec=10
StartLimitInterval=300
StartLimitBurst=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable pai-voice-server
sudo systemctl start pai-voice-server
```

### 2. Discord Remote Control Service
**File:** `/etc/systemd/system/pai-discord.service`

```ini
[Unit]
Description=PAI Discord Remote Control
After=network.target

[Service]
Type=simple
User=%i
WorkingDirectory=/.claude/skills/discord-remote-control
ExecStart=/.claude/skills/discord-remote-control/scripts/start.sh
Restart=on-failure
RestartSec=15
StartLimitInterval=300
StartLimitBurst=3

[Install]
WantedBy=multi-user.target
```

### 3. Observability Dashboard Service
**File:** `/etc/systemd/system/pai-observability.service`

```ini
[Unit]
Description=PAI Observability Dashboard
After=network.target

[Service]
Type=simple
User=%i
WorkingDirectory=/.claude/skills/observability
ExecStart=/bin/bash -c 'cd /.claude/skills/observability && bash manage.sh start'
Restart=on-failure
RestartSec=20
StartLimitInterval=300
StartLimitBurst=3

[Install]
WantedBy=multi-user.target
```

---

## Phase 2: Watchdog Script

**File:** `/.claude/services/watchdog.sh`

```bash
#!/bin/bash

# PAI Watchdog - Monitors and recovers failed services
# Run via cron: */1 * * * * /.claude/services/watchdog.sh

LOG_FILE="/tmp/pai-watchdog.log"
LOCK_FILE="/tmp/pai-watchdog.lock"
RESTART_BACKOFF="/tmp/pai-restart-backoff"

# Prevent concurrent runs
if [ -f "$LOCK_FILE" ] && [ $(($(date +%s) - $(stat -c%Y "$LOCK_FILE"))) -lt 30 ]; then
  exit 0
fi
touch "$LOCK_FILE"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_service() {
  local service=$1
  local endpoint=$2

  if systemctl is-active --quiet $service; then
    # Service running, verify endpoint
    if curl -s --max-time 5 "$endpoint" > /dev/null 2>&1; then
      return 0  # Healthy
    else
      log "⚠️  $service running but endpoint unresponsive: $endpoint"
      return 1  # Service stuck
    fi
  else
    log "❌ $service is not running"
    return 1
  fi
}

restart_service() {
  local service=$1
  log "🔄 Attempting restart of $service"

  systemctl restart "$service"
  sleep 5

  if systemctl is-active --quiet "$service"; then
    log "✅ $service restarted successfully"
    return 0
  else
    log "❌ Failed to restart $service"
    return 1
  fi
}

# Check services
check_service "pai-voice-server" "http://localhost:8888/health" || restart_service "pai-voice-server"
check_service "pai-discord" "http://localhost:4000" || restart_service "pai-discord"
check_service "pai-observability" "http://localhost:5172" || restart_service "pai-observability"

# Cleanup old logs (keep last 7 days)
find /tmp/pai-*.log -mtime +7 -delete 2>/dev/null

rm -f "$LOCK_FILE"
```

**Install:**
```bash
mkdir -p /.claude/services
chmod +x /.claude/services/watchdog.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /.claude/services/watchdog.sh") | crontab -
```

---

## Phase 3: Graceful Degradation

### Discord Bot Fallback (if voice-server is down)
```typescript
// In discord-remote-control/service/index.ts
async function sendNotification(message: string) {
  try {
    const response = await fetch('http://localhost:8888/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ message })
    });
    return response.ok;
  } catch (error) {
    // Voice server is down - fail gracefully
    console.warn('⚠️  Voice server unreachable, continuing without audio');
    return false;
  }
}
```

### Observability Event Validation
```typescript
// In Observability/apps/server/src/file-ingest.ts
async function startFileIngestion() {
  const eventPath = '/.agent/history/raw-outputs/2026-03/2026-03-12_all-events.jsonl';

  // Create file if missing
  if (!fs.existsSync(eventPath)) {
    const dir = path.dirname(eventPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(eventPath, ''); // Empty file
    console.log('📝 Created missing event file:', eventPath);
  }

  // Watch for changes (non-blocking)
  try {
    const watcher = fs.watch(eventPath, (eventType) => {
      if (eventType === 'change') {
        processNewEvents();
      }
    });
  } catch (error) {
    console.error('⚠️  Could not watch file:', error.message);
    // Non-critical error - continue serving API
  }
}
```

---

## Phase 4: Health Check Endpoint

**File:** `/.claude/services/health-check.sh`

```bash
#!/bin/bash

# Quick health status of all PAI services
# Usage: ./health-check.sh

echo "🔍 PAI Health Check - $(date)"
echo "================================"

# Check voice server
if curl -s --max-time 3 http://localhost:8888/health > /dev/null; then
  VOICE="✅ Running"
else
  VOICE="❌ Down"
fi

# Check discord
if curl -s --max-time 3 http://localhost:4000/health > /dev/null; then
  DISCORD="✅ Running"
else
  DISCORD="❌ Down"
fi

# Check observability
if curl -s --max-time 3 http://localhost:5172 > /dev/null; then
  OBS="✅ Running"
else
  OBS="❌ Down"
fi

echo "Voice Server:        $VOICE (http://localhost:8888)"
echo "Discord Bot:         $DISCORD (http://localhost:4000)"
echo "Observability:       $OBS (http://localhost:5172)"
echo "================================"

# Alert if any service is down
if [[ $VOICE == *"❌"* ]] || [[ $DISCORD == *"❌"* ]] || [[ $OBS == *"❌"* ]]; then
  echo "⚠️  Some services are down. Running recovery..."
  systemctl restart pai-voice-server pai-discord pai-observability
  sleep 5
  echo "Recovery initiated. Check status again in 10 seconds."
  exit 1
else
  echo "✅ All systems healthy"
  exit 0
fi
```

---

## Recovery Timeline

| Scenario | Detection | Recovery | Downtime |
|----------|-----------|----------|----------|
| Voice server crashes | 5 min (cron) | 30 sec (systemd) | < 1 min total |
| Discord bot disconnects | Immediate (systemd) | 15 sec | < 20 sec |
| Observability fails | Next web request | 20 sec (systemd) | < 30 sec |
| Multiple services crash | 5 min (cron) | Parallel restart | < 2 min total |

---

## Monitoring & Alerting (Future Enhancement)

```bash
# Send alert if watchdog detects issue
if [ -f "$ALERT_FILE" ]; then
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/HERE \
    -H 'Content-Type: application/json' \
    -d @"$ALERT_FILE"
fi
```

---

## Testing Recovery

```bash
# Test voice server recovery
sudo systemctl stop pai-voice-server
sleep 10
sudo systemctl status pai-voice-server
# Should show: active (running)

# Test watchdog
/.claude/services/watchdog.sh
tail /tmp/pai-watchdog.log
```

---

**Last Updated:** 2026-03-12
**Status:** Ready for implementation
