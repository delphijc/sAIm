# Observability Dashboard

A real-time monitoring system for Sam (Personal AI Infrastructure) multi-agent workflows. Visualizes agent activity, tracks events, monitors performance, and manages custom themes.

## 🎯 What It Does

The Observability Dashboard provides:
- **Real-time Event Stream**: Watch Sam agents work as events happen
- **Live Activity Charts**: See event frequency and activity patterns
- **Agent Swim Lanes**: Visualize multiple agents working in parallel
- **Event Timeline**: Detailed log of every action with expandable details
- **Smart Filtering**: Filter by agent, session, event type, or app
- **Theme Management**: Create and share custom color themes
- **Performance Metrics**: Monitor event throughput and agent counts

## 📡 Quick Start

### Start the Dashboard
```bash
cd ~/.claude/skills/observability
./manage.sh start
```

The dashboard will be available at: `http://localhost:5172`

### Stop the Dashboard
```bash
./manage.sh stop
```

### Check Status
```bash
./manage.sh status
```

### Restart the Dashboard
```bash
./manage.sh restart
```

## 🏗️ Architecture

**Backend Server** (port 4000)
- Bun HTTP/WebSocket server
- Real-time event broadcasting
- Theme management API
- Activity tracking
- Database: SQLite (themes only)

**Frontend Dashboard** (port 5172)
- Vue 3 + Vite
- WebSocket connection with auto-reconnect
- Glass-morphism UI with Tailwind CSS
- Interactive charts and filters
- Theme customization

## 📊 Main Features

### Event Timeline
The central view showing all monitored events with:
- Event type badges (color-coded)
- Agent name identification
- Source application tracking
- Expandable event details
- Chat transcript display
- Tool usage summaries
- Todo tracking (pending/in-progress/completed)
- "Stick to bottom" auto-scroll

### Live Pulse Chart
Real-time activity visualization:
- Bar chart showing events per minute
- Adjustable time window (1M, 2M, 4M, 8M, 16M minutes)
- Heat level indicator (activity intensity)
- Agent count statistics
- Animated sparklines with glow effects

### Agent Swim Lanes
View multiple agents working in parallel:
- Separate timeline tracks for each agent
- Synchronized across time
- Visual event markers
- Helps identify concurrent activity patterns

### Filter Panel
Fine-grained event filtering:
- **Source Apps**: Filter by application (which service generated the event)
- **Session IDs**: Group events by session
- **Event Types**: Filter by event category (hook types)
- Multi-select support
- Real-time filtering without page reload

### Theme Manager
Create and manage custom color themes:
- 24 customizable color properties
- Live preview of your theme
- Save themes for reuse
- Export/import themes as JSON
- Public theme sharing
- Community ratings and downloads

## 🔧 Configuration

### Environment Variables
```bash
# Optional: Set PAI_DIR if not in standard location
export PAI_DIR="$HOME/.claude"

# Optional: Max events to display in memory (default: 100)
export VITE_MAX_EVENTS_TO_DISPLAY=100
```

### Database
- **Location**: `~/.claude/skills/observability/apps/server/themes.db`
- **Type**: SQLite
- **Content**: Theme definitions, ratings, sharing metadata
- **Automatic cleanup**: WAL files deleted on graceful shutdown

## 📡 Data Sources

The dashboard monitors:
- **Event Files**: `~/.claude/History/raw-outputs/{YYYY-MM}/{YYYY-MM-DD}_all-events.jsonl`
- **Agent Sessions**: `~/.claude/agent-sessions.json` (for agent name enrichment)
- **Real-time WebSocket**: Receives events as they're generated

## 🌐 API Reference

### Event APIs
```bash
# Get available filter options
curl http://localhost:4000/events/filter-options

# Get recent events (max 100)
curl http://localhost:4000/events/recent?limit=50

# Filter events by agent
curl "http://localhost:4000/events/by-agent/sam?limit=50"
```

### Theme APIs
```bash
# List all themes
curl "http://localhost:4000/api/themes?query=dark&sort=downloads"

# Get specific theme
curl http://localhost:4000/api/themes/{theme-id}

# Create new theme
curl -X POST http://localhost:4000/api/themes \
  -H "Content-Type: application/json" \
  -d @theme.json

# Export theme
curl http://localhost:4000/api/themes/{theme-id}/export > my-theme.json

# Import theme
curl -X POST http://localhost:4000/api/themes/import \
  -H "Content-Type: application/json" \
  -d @my-theme.json
```

### Activity APIs
```bash
# Get activities (Kitty terminal tabs)
curl http://localhost:4000/api/activities

# Summarize event with AI
curl -X POST http://localhost:4000/api/haiku/summarize \
  -H "Content-Type: application/json" \
  -d '{"event": {...}}'
```

### WebSocket
```bash
# Connect to real-time event stream
ws://localhost:4000/stream

# Initial message: Last 50 events
{ "type": "initial", "data": [...] }

# New event broadcast
{ "type": "event", "data": {...} }
```

## 📁 Project Structure

```
Observability/
├── manage.sh                    # Lifecycle management script
├── SKILL.md                     # Skill overview
├── Reference.md                 # Extended documentation
├── logs/                        # Server and client output logs
├── apps/
│   ├── server/                  # Bun HTTP/WebSocket server (port 4000)
│   │   ├── src/
│   │   │   ├── index.ts        # Main server with all endpoints
│   │   │   ├── types.ts        # TypeScript interfaces
│   │   │   ├── db.ts           # SQLite database operations
│   │   │   ├── file-ingest.ts  # Event file streaming
│   │   │   └── theme.ts        # Theme management logic
│   │   └── package.json        # Bun dependencies
│   │
│   └── client/                  # Vue 3 + Vite frontend (port 5172)
│       ├── src/
│       │   ├── App.vue         # Root component
│       │   ├── components/     # 18 Vue single-file components
│       │   ├── composables/    # 17 Vue composables
│       │   ├── utils/          # Helper functions
│       │   └── styles/         # Tailwind CSS config
│       └── package.json        # Frontend dependencies
│
└── scripts/                     # Utility scripts
    ├── start-agent-observability-dashboard.sh
    ├── test-system.sh
    └── reset-system.sh
```

## 🚀 Startup Behavior

**Important**: The Observability Dashboard does NOT auto-start on login.

To use it during a session:
1. Run: `bun ~/.claude/skills/start-up/tools/Su.ts`
2. Or manually: `~/.claude/skills/observability/manage.sh start`
3. Visit: `http://localhost:5172`

## 🔄 Performance

- **Startup Time**: ~15 seconds (with 30-second timeout)
- **Max Events in Memory**: 1,000 (older events discarded)
- **Max Display Events**: 100 (configurable)
- **WebSocket Reconnection**: Automatic with exponential backoff
- **Theme Database**: SQLite with typical < 1ms queries
- **Real-time Latency**: < 100ms from event to display

## 🧹 Cleanup

When you stop the dashboard:
```bash
./manage.sh stop
```

This automatically:
- Kills server process (port 4000)
- Kills client process (port 5172)
- Cleans up SQLite WAL files
- Exits cleanly without orphaned processes

## 🐛 Troubleshooting

### Dashboard won't start
```bash
# Check if ports are in use
lsof -i :4000
lsof -i :5172

# Try cleaning up and restarting
./manage.sh stop
sleep 2
./manage.sh start
```

### No events appearing
1. Make sure agents are running and generating events
2. Check event files exist: `ls -la ~/.claude/History/raw-outputs/`
3. View server logs: `tail -f logs/server.log`
4. Check client logs: `tail -f logs/client.log`

### Connection drops frequently
1. Check network connectivity
2. View logs for error messages
3. Restart the dashboard: `./manage.sh restart`

### Theme operations not working
1. Ensure SQLite is installed: `which sqlite3`
2. Check database permissions: `ls -la apps/server/themes.db*`
3. Clear WAL files if corrupted:
   ```bash
   ./manage.sh stop
   rm apps/server/themes.db*
   ./manage.sh start
   ```

### Performance issues
1. Reduce max displayed events:
   ```bash
   export VITE_MAX_EVENTS_TO_DISPLAY=50
   ./manage.sh restart
   ```
2. Close other resource-intensive applications
3. Check system resources: `top` or `Activity Monitor`

## 📊 Monitoring Multi-Agent Workflows

Example workflow monitoring:
1. Start the dashboard: `./manage.sh start`
2. Run your Sam agents: `claude code` or agent scripts
3. Watch events stream in real-time
4. Use filters to focus on specific agents or sessions
5. Export data or create themed reports
6. Share themes with team via theme export

## 🔗 Related Documentation

- **Voice Server**: `~/.claude/voice-server/README.md`
- **Sam Infrastructure**: Main project README
- **start-up Skill**: `~/.claude/skills/start-up/SKILL.md`

## 📝 License

Part of the Sam system.
