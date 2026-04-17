# Service Monitor Dashboard

A real-time monitoring dashboard for PAI infrastructure services. Monitor CPU/memory/GPU utilization, service status, and manage service restarts—all from a single web interface.

## Features

- **Real-time Metrics**: Live CPU, memory, and GPU utilization for each service
- **Service Control**: Safe restart buttons with rate limiting
- **Status Indicators**: Visual status with animated indicators
- **System-wide Stats**: CPU and memory usage across all services
- **Auto-refresh**: WebSocket-based real-time updates with HTTP polling fallback
- **Dark Theme**: Neon-accented dashboard matching observability aesthetic
- **Responsive Design**: Works on desktop and tablet screens

## Architecture

### Server (Bun + Elysia)
- REST API for service queries
- WebSocket endpoint for real-time metrics streaming
- systemd integration for service control
- Rate limiting on restart operations
- Metrics collection from /proc and ps commands

### Client (Vue 3 + Vite)
- Component-based dashboard UI
- Real-time updates via WebSocket
- HTTP polling fallback
- Tailwind CSS styling
- Responsive grid layout

## Quick Start

### Installation

```bash
cd $HOME/.claude/skills/service-monitor-dashboard

# Install dependencies
cd apps/server && bun install
cd ../client && bun install
```

### Development

```bash
# Terminal 1: Start server (port 6000)
cd apps/server && bun run dev

# Terminal 2: Start client (port 5175)
cd apps/client && bun run dev

# Visit http://localhost:5175
```

### Production Build

```bash
cd apps/client && bun run build
```

## Configuration

Edit `apps/server/src/config.ts` to add/remove services:

```typescript
export const SERVICES: ServiceConfig[] = [
  {
    name: 'voice-server',
    description: 'Text-to-speech service',
    category: 'infrastructure',
    port: 8888,
    unit: 'voice-server.service'
  },
  // Add more services...
];
```

## API Endpoints

- `GET /api/services` — List all services with current metrics
- `GET /api/services/:name` — Get detailed metrics for one service
- `GET /api/system` — Get system-wide CPU/memory stats
- `POST /api/services/:name/restart` — Restart a service
- `WS /api/metrics/stream` — WebSocket for real-time metrics
- `GET /health` — Health check

## Metrics Explained

| Metric | Description | Source |
|--------|-------------|--------|
| Status | Running/Stopped state | systemctl |
| PID | Process ID | systemctl |
| CPU | CPU usage percentage | ps/proc |
| Memory | Memory usage in MB | ps/proc |
| Uptime | Time since service started | ps etime |
| Last Restart | Timestamp of last restart | journalctl |
| Port | Service listening port | config |

## Security

- Restart endpoint limited to 5 attempts per service per hour
- Only restarts services under `pai-infrastructure.target`
- All restart attempts logged to system journal
- Optional authentication token support (ready for implementation)

## Troubleshooting

### WebSocket connection fails
- Ensure server is running: `curl http://localhost:6000/health`
- Check browser console for connection errors
- Dashboard falls back to HTTP polling automatically

### Metrics showing zeros
- Verify service is actually running: `systemctl --user status service-name`
- Check permissions: daemon user needs to read /proc files
- Some metrics require root/elevated privileges

### Services not appearing
- Add service to `apps/server/src/config.ts`
- Restart server for config changes
- Verify systemd unit name in config

## Performance

- Metrics update every 2 seconds via WebSocket
- HTTP polling every 5 seconds as fallback
- Low overhead: minimal process iteration
- Scales to 50+ services on typical hardware

## Future Enhancements

- [ ] GPU metrics (NVIDIA CUDA, Apple Metal)
- [ ] Service dependency visualization
- [ ] Custom alerting rules
- [ ] Historical metrics graphs
- [ ] Service auto-restart on failure
- [ ] Multi-user authentication
- [ ] Service log streaming

## Contributing

The skill uses a standard Bun project structure. Run `bun test` in either directory for testing.

## License

Part of the Sam PAI (Personal AI Infrastructure) system.
