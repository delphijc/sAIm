# sAIm Deployment & Operations Runbook

**Document Version:** 1.0  
**Last Updated:** 2026-05-01  
**Audience:** DevOps Engineers, System Administrators, Operations Team  

---

## Quick Reference

| Action | Command |
|--------|---------|
| Check all services | `systemctl --user status pai-infrastructure.target` |
| Start all services | `systemctl --user start pai-infrastructure.target` |
| Stop all services | `systemctl --user stop pai-infrastructure.target` |
| Restart one service | `systemctl --user restart voice-server` |
| View service logs | `journalctl --user -u voice-server.service -n 50` |
| Monitor real-time | `journalctl --user -f -u pai-infrastructure.target` |

---

## Infrastructure Overview

### Service Topology

**macOS:**
```
LaunchAgent Pool (~/Library/LaunchAgents/)
├── com.pai.voice-server
├── com.pai.memory-system
├── com.pai.awareness-backend
├── com.pai.awareness-frontend
├── com.pai.observability-dashboard
├── com.pai.service-monitor-server
├── com.pai.service-monitor-client
├── com.pai.discord-remote-control
└── com.pai.markdown-editor
```

**Linux:**
```
systemd User Services (~/.config/systemd/user/)
├── voice-server.service
├── memory-system.service
├── awareness-dashboard-backend.service
├── awareness-dashboard-frontend.service
├── observability-dashboard.service
├── service-monitor-server.service
├── service-monitor-client.service
├── discord-remote-control.service
├── markdown-editor.service
└── pai-infrastructure.target (groups all above)
```

### Port Allocations

| Service | Port | Type | Status |
|---------|------|------|--------|
| Voice Server | 8888 | HTTP | Optional |
| Memory System | 4242 | HTTP | Optional |
| Awareness Backend | 4100 | HTTP | Optional |
| Awareness Frontend | 5173 | HTTP | Optional |
| Observability Dashboard | 5172 | HTTP | Optional |
| Service Monitor Server | 6000 | HTTP | Optional |
| Service Monitor Client | 5175 | HTTP | Optional |
| Discord Remote Control | — | Discord API | Optional |
| Markdown Editor | 4444 | HTTP | Optional |

**Important:** Port 6000 is blocked by Chromium. Ensure you're accessing Service Monitor via correct port.

---

## Installation & Setup

### macOS Installation

1. **Install launchd service definitions:**
```bash
mkdir -p ~/Library/LaunchAgents/
cd ~/Projects/sam/.agent/services
for service in */; do
  cp "$service/launchd/com.pai.${service%/}.plist" ~/Library/LaunchAgents/
done
```

2. **Load services:**
```bash
launchctl load ~/Library/LaunchAgents/com.pai.*.plist
```

3. **Verify installation:**
```bash
launchctl list | grep pai
```

### Linux Installation

1. **Create systemd user service directory:**
```bash
mkdir -p ~/.config/systemd/user
```

2. **Copy service files:**
```bash
cd ~/Projects/sam/.agent/services
for service in */; do
  cp "$service/systemd/${service%/}.service" ~/.config/systemd/user/
done
```

3. **Create target (groups all services):**
```bash
cat > ~/.config/systemd/user/pai-infrastructure.target << 'EOF'
[Unit]
Description=PAI Infrastructure Services
Documentation=https://github.com/delphijc/sam
PartOf=graphical-session.target
After=graphical-session-pre.target
Wants=default.target

[Install]
WantedBy=default.target
EOF
```

4. **Reload and enable:**
```bash
systemctl --user daemon-reload
systemctl --user enable pai-infrastructure.target
systemctl --user enable voice-server.service
systemctl --user enable memory-system.service
# ... enable remaining services
```

5. **Start services:**
```bash
systemctl --user start pai-infrastructure.target
```

### Configuration

1. **Create .env files:**
```bash
# .agent/services/voice-server/.env
PORT=8888
VOICE_API_KEY=sk_voice_optional
LOG_LEVEL=info

# .agent/services/memory-system/.env
PORT=4242
DATABASE_PATH=~/Projects/memory-system/data/memory.db
WEBHOOK_ENDPOINTS='{"extraction-complete": "http://localhost:5172/webhooks/extraction-complete"}'

# .agent/.env (main)
PAI_DIR=~/.claude
ENABLE_MEMORY_HOOKS=false
MEMORY_SERVICE_URL=http://localhost:4242
```

2. **Validate configuration:**
```bash
# Check PAI_DIR resolution
echo $PAI_DIR  # Should be ~/.claude or empty (will use default)

# Test memory service connectivity
curl http://localhost:4242/health
# { "status": "ok", "db": "healthy", ... }
```

---

## Day-to-Day Operations

### Health Checks

**Daily Automated Check:**
```bash
#!/bin/bash
# ~/.local/bin/pai-health-check

SERVICES=(
  "voice-server:8888"
  "memory-system:4242"
  "awareness-backend:4100"
  "observability-dashboard:5172"
)

for service in "${SERVICES[@]}"; do
  IFS=':' read -r name port <<< "$service"
  response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health)
  
  if [ "$response" = "200" ]; then
    echo "✓ $name (port $port) is healthy"
  else
    echo "✗ $name (port $port) is unhealthy (HTTP $response)"
  fi
done
```

**Manual Check:**
```bash
# macOS
launchctl list | grep pai

# Linux
systemctl --user status pai-infrastructure.target
```

### Log Monitoring

**Tail all service logs:**
```bash
# Linux
journalctl --user -f -u pai-infrastructure.target

# macOS (one service at a time)
log stream --level debug --predicate 'process contains "voice-server"'
```

**Search logs for errors:**
```bash
# Find all errors in past 24 hours
journalctl --user --since "1 day ago" | grep -i error

# Find specific service errors
journalctl --user -u memory-system.service | grep -i "extraction\|error"
```

### Service Restart Procedures

**Graceful Restart (recommended):**
```bash
# Stop service gracefully (wait up to 30s)
systemctl --user stop voice-server.service --timeout=30

# Wait for dependent services
sleep 2

# Start service
systemctl --user start voice-server.service

# Verify
systemctl --user status voice-server.service
```

**Force Restart (when service is hung):**
```bash
# Kill service immediately
systemctl --user kill -9 voice-server.service

# Wait a moment
sleep 1

# Start fresh
systemctl --user start voice-server.service
```

**Restart All Services:**
```bash
systemctl --user restart pai-infrastructure.target
```

### Memory & Resource Management

**Monitor resource usage:**
```bash
# Linux
systemctl --user status pai-infrastructure.target --full

# Detailed metrics
systemd-cgtop -n 1  # Shows CPU, memory per cgroup

# macOS
ps aux | grep -E "[v]oice-server|[m]emory-system|[a]wareness"
```

**Database Maintenance:**

Memory system can grow large. Weekly maintenance:

```bash
#!/bin/bash
# ~/.local/bin/maintain-memory-db

DB="~/Projects/memory-system/data/memory.db"

# Backup before maintenance
cp "$DB" "$DB.backup.$(date +%Y%m%d)"

# Connect and maintain
sqlite3 "$DB" << 'SQL'
-- Analyze query plans
ANALYZE;

-- Vacuum to reclaim space
VACUUM;

-- Reindex for performance
REINDEX;

-- Check database integrity
PRAGMA integrity_check;
SQL

echo "Memory system database maintenance complete"
```

---

## Troubleshooting Guide

### Problem: Service fails to start

**Diagnostic steps:**

1. **Check error message:**
```bash
# Linux: detailed error
systemctl --user status voice-server.service

# macOS: check log
log stream --level error --predicate 'process contains "voice-server"'
```

2. **Check port availability:**
```bash
# Is port already in use?
lsof -i :8888

# If yes, kill the process
kill -9 <PID>
```

3. **Check working directory:**
```bash
# Verify service can access startup script
ls -la ~/.claude/services/voice-server/start.sh

# Verify permissions
chmod +x ~/.claude/services/voice-server/start.sh
```

4. **Check environment:**
```bash
# Source .env files manually
set -a
source ~/.claude/.env
source ~/.claude/services/voice-server/.env
set +a

# Try running service startup manually
cd ~/.claude/services/voice-server && bash start.sh
```

5. **Check dependencies:**
```bash
# Is Bun installed?
bun --version

# Is database accessible?
sqlite3 ~/Projects/memory-system/data/memory.db "SELECT COUNT(*) FROM facts;"

# Network connectivity
curl -v http://localhost:8888/health
```

### Problem: High memory usage

**Investigation:**

```bash
# Which service is consuming memory?
ps aux --sort=-%mem | grep -E "[v]oice-server|[m]emory-system" | head -5

# Monitor in real-time
watch 'ps aux | grep -E "[v]oice-server|[m]emory-system"'

# Check database size
du -sh ~/Projects/memory-system/data/memory.db

# Check if there are memory leaks
systemctl --user show-environment | grep PAI
```

**Solutions:**

```bash
# If memory-system is consuming >500MB:
1. Run consolidation cycle: curl -X POST http://localhost:4242/memory/consolidation/run
2. Archive old facts: see "Database Maintenance" above
3. Restart service: systemctl --user restart memory-system

# If voice-server is consuming >300MB:
1. Clear TTS cache (usually in /tmp)
2. Check Python sidecar process count: ps aux | grep python
3. Restart service: systemctl --user restart voice-server
```

### Problem: Webhook delivery failing

**Investigation:**

```bash
# Is webhook endpoint accessible?
curl -v -X POST http://localhost:5172/webhooks/extraction-complete \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check firewall rules
ufw status | grep 5172  # Linux

# Check service logs for retry attempts
journalctl --user -u memory-system.service | grep webhook
```

**Solutions:**

```bash
# 1. Verify webhook URL in memory-system config
cat ~/.claude/services/memory-system/.env | grep WEBHOOK

# 2. Test connectivity
nc -zv localhost 5172

# 3. If receiving service is down, restart it
systemctl --user restart observability-dashboard

# 4. If issue persists, disable webhooks temporarily
# Edit .env: WEBHOOK_ENABLED=false
# Restart memory system
systemctl --user restart memory-system
```

### Problem: Discord bot not responding

**Investigation:**

```bash
# Is bot running?
systemctl --user status discord-remote-control

# Check bot logs for errors
journalctl --user -u discord-remote-control.service -n 100

# Check Discord token is valid
echo $DISCORD_TOKEN | head -c 20  # Should show partial token

# Verify bot has permissions in Discord server
# Check Discord server settings > roles > Bot Role
```

**Solutions:**

```bash
# 1. Restart bot
systemctl --user restart discord-remote-control

# 2. If token is invalid, update .env
# Edit: ~/.claude/services/discord-remote-control/.env
DISCORD_TOKEN=your_new_token_here

# 3. Reload systemd and restart
systemctl --user daemon-reload
systemctl --user restart discord-remote-control

# 4. Verify bot is online
# Check Discord → Bot should show online status
```

---

## Scheduled Maintenance

### Daily Tasks (5 min)

```bash
#!/bin/bash
# ~/.local/bin/dai-maintenance-daily

# Health check
pai-health-check

# Check for errors in past 24 hours
journalctl --user --since "1 day ago" | grep -i error && \
  echo "⚠️ Errors found in logs - review recommended"
```

### Weekly Tasks (30 min)

```bash
#!/bin/bash
# ~/.local/bin/pai-maintenance-weekly

# Database maintenance
~/local/bin/maintain-memory-db

# Consolidation cycle
curl -X POST http://localhost:4242/memory/consolidation/run \
  -H "Content-Type: application/json" \
  -d '{"mode": "aggressive"}'

# Archive old observability data
echo "Archiving observability data older than 90 days..."
# Implementation: see "Observability Dashboard Archival" in API guide

# Backup critical data
cp ~/Projects/memory-system/data/memory.db ~/backups/memory-$(date +%Y%m%d).db
cp ~/.claude/settings.json ~/backups/settings-$(date +%Y%m%d).json
```

### Monthly Tasks (1-2 hours)

```bash
#!/bin/bash
# ~/.local/bin/pai-maintenance-monthly

# Full backup
tar -czf ~/backups/pai-full-$(date +%Y%m).tar.gz \
  ~/Projects/sam/.agent/data \
  ~/Projects/memory-system/data \
  ~/.claude/History

# Disk usage report
echo "=== Disk Usage Report ==="
du -sh ~/Projects/sam/.agent/data/*
du -sh ~/Projects/memory-system/data/*
du -sh ~/.claude/History/*

# Service uptime analysis
systemctl --user show voice-server.service | grep "^Active="
systemctl --user show memory-system.service | grep "^Active="

# Generate monthly briefing
curl http://localhost:4100/api/briefing?period=monthly&format=markdown > \
  ~/reports/operations-$(date +%Y%m).md
```

---

## Disaster Recovery

### Service Recovery

**If all services go down:**

1. **Check system resources:**
```bash
# Is disk full?
df -h /

# Is memory exhausted?
free -h

# Are there system errors?
dmesg | tail -20
```

2. **Restart infrastructure target:**
```bash
systemctl --user restart pai-infrastructure.target
```

3. **Verify services come back online:**
```bash
systemctl --user status pai-infrastructure.target
```

4. **Monitor recovery:**
```bash
journalctl --user -f -u pai-infrastructure.target
```

### Database Corruption Recovery

**If memory-system database is corrupted:**

```bash
# 1. Stop memory service
systemctl --user stop memory-system

# 2. Restore from backup
cp ~/backups/memory-20260501.db ~/Projects/memory-system/data/memory.db

# 3. Verify integrity
sqlite3 ~/Projects/memory-system/data/memory.db "PRAGMA integrity_check;"

# 4. Restart service
systemctl --user start memory-system

# 5. Run consolidation to clean up
curl -X POST http://localhost:4242/memory/consolidation/run
```

### Data Recovery

**Restore from backup:**

```bash
# List available backups
ls -lh ~/backups/

# Restore full system backup
cd ~
tar -xzf ~/backups/pai-full-202605.tar.gz

# Restore specific database
cp ~/backups/memory-20260501.db ~/Projects/memory-system/data/memory.db
```

---

## Monitoring & Alerting

### Prometheus Metrics (Optional)

If you have Prometheus, scrape service metrics:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'pai-voice-server'
    static_configs:
      - targets: ['localhost:8888']
    metrics_path: '/metrics'

  - job_name: 'pai-memory-system'
    static_configs:
      - targets: ['localhost:4242']
    metrics_path: '/metrics'
```

### Alert Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: pai
    rules:
      - alert: ServiceDown
        expr: up{job=~"pai-.*"} == 0
        for: 5m
        annotations:
          summary: "{{ $labels.job }} is down"

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes{job=~"pai-.*"} > 500000000  # 500MB
        for: 10m
        annotations:
          summary: "{{ $labels.job }} memory usage is high"

      - alert: DatabaseGrowing
        expr: increase(facts_count[1d]) > 1000
        annotations:
          summary: "Memory database is growing rapidly"
```

---

## Performance Optimization

### Tuning Voice Server

```bash
# Increase Python worker pool
export VOICE_WORKERS=4  # Default 1

# Enable audio caching
export VOICE_CACHE_SIZE=100  # MB

# Adjust TTS timeout
export VOICE_TIMEOUT_SECONDS=30
```

### Tuning Memory System

```bash
# Increase database connection pool
export MEMORY_POOL_SIZE=10

# Adjust consolidation frequency (hours)
export CONSOLIDATION_INTERVAL=24

# Tune extraction batch size
export EXTRACTION_BATCH_SIZE=100
```

### Tuning Observability Dashboard

```bash
# Reduce WebSocket message frequency
export METRICS_INTERVAL_SECONDS=5

# Archive logs older than (days)
export LOG_RETENTION_DAYS=90

# Connection pool size
export DASHBOARD_POOL_SIZE=50
```

---

## Security Hardening

### File Permissions

```bash
# Restrict .env files (contains secrets)
chmod 600 ~/.claude/services/*/.env
chmod 600 ~/.claude/.env

# Restrict database files
chmod 600 ~/Projects/memory-system/data/*.db

# Restrict history files
chmod 700 ~/.claude/History/
```

### Firewall Configuration

**Linux (ufw):**
```bash
# Allow only local connections
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (if remote)
ufw allow ssh

# Allow only local HTTP ports
ufw allow from 127.0.0.1 to any port 4242
ufw allow from 127.0.0.1 to any port 8888
# ... for each service port
```

### API Key Rotation

```bash
# Monthly: rotate API keys
# 1. Generate new keys
# 2. Update .env files
# 3. Restart affected services

systemctl --user restart voice-server memory-system
```

---

## Backup Strategy

### Daily Backup

```bash
#!/bin/bash
# ~/.local/bin/pai-backup-daily

BACKUP_DIR=~/backups/daily
mkdir -p $BACKUP_DIR

# Back up databases
cp ~/Projects/memory-system/data/memory.db \
   $BACKUP_DIR/memory-$(date +%Y%m%d).db

# Back up configs
cp ~/.claude/settings.json \
   $BACKUP_DIR/settings-$(date +%Y%m%d).json

# Clean up old backups (keep 30 days)
find $BACKUP_DIR -mtime +30 -delete
```

### Weekly Full Backup

```bash
#!/bin/bash
# ~/.local/bin/pai-backup-weekly

BACKUP_DIR=~/backups/weekly
mkdir -p $BACKUP_DIR

tar -czf $BACKUP_DIR/pai-$(date +%Y%m%d).tar.gz \
  ~/Projects/sam/.agent/data \
  ~/Projects/memory-system/data \
  ~/.claude/History \
  ~/.claude/settings.json \
  ~/.claude/settings.local.json
```

---

**For emergency support or escalation, contact the sAIm operations team or create an issue at https://github.com/delphijc/sam/issues**
