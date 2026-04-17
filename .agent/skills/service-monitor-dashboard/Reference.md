# Service Monitor Dashboard Reference

> This is Tier 2 documentation for the Service Monitor Dashboard skill. Extended architecture and troubleshooting details.

---

## Architecture

The service monitor dashboard is a full-stack application for monitoring and managing PAI systemd services.

### Server (`apps/server/`)

Built with Bun + Elysia web framework:

- **API Endpoints**:
  - `GET /api/services` — List all monitored services with current status
  - `GET /api/services/:name` — Get detailed metrics for a service
  - `GET /api/services/:name/metrics` — Stream live metrics via WebSocket
  - `POST /api/services/:name/restart` — Restart a service (with rate limiting)
  - `GET /api/system` — System-wide CPU, memory, GPU stats

- **Metrics Collection**:
  - Uses `systemctl` to query service status
  - Parses `ps` and `/proc` for process metrics
  - GPU detection (NVIDIA, Apple Metal)
  - Process restart history from journalctl

### Client (`apps/client/`)

Vue 3 + Vite frontend with real-time updates:

- **Components**:
  - `ServiceCard.vue` — Individual service status and metrics
  - `ServiceGrid.vue` — Grid view of all services
  - `MetricsChart.vue` — CPU/memory/GPU trend visualization
  - `RestartButton.vue` — Safe restart with confirmation

- **WebSocket Integration**:
  - Real-time metric updates
  - Live service status changes
  - Automatic reconnection

### Styling

Uses Tailwind CSS with custom theme matching observability dashboard:
- Dark background (`bg-slate-950`)
- Neon green accents (`text-green-400`)
- Pulsing status indicators
- Responsive grid layout

## Service Configuration

Add/remove services by editing `serviceConfig.ts`:

```typescript
export const SERVICES = [
  {
    name: 'voice-server',
    port: 8888,
    description: 'Text-to-speech service',
    category: 'infrastructure'
  },
  // ... more services
];
```

## Security Notes

- Restart endpoint requires authentication token in `Authorization` header
- Rate limiting: Max 5 restarts per service per hour
- Only restarts services under `pai-infrastructure.target`
- Logs all restart attempts to system journal

## Troubleshooting

### Dashboard not showing data
1. Verify services are running: `systemctl --user status pai-infrastructure.target`
2. Check server logs: `journalctl --user -u service-monitor-server -n 50`
3. Ensure WebSocket connection: Check browser DevTools network tab

### Metrics showing zeros
1. Service may not be running
2. Permission issue: Run with correct user context
3. GPU detection: Ensure GPU drivers are installed

### Restart button not working
1. Check authentication token
2. Verify rate limiting hasn't been exceeded
3. Check if service is in protected state

## Development

### Run locally
```bash
cd apps/server && bun run dev
cd apps/client && bun run dev
```

### Testing
```bash
cd apps/server && bun test
cd apps/client && bun test
```
