---
name: service-monitor-dashboard
description: Real-time monitoring dashboard for PAI services with CPU/memory/GPU utilization, restart times, and service control. USE WHEN user says 'start service monitor', 'monitor services', 'show service status', 'service dashboard', or needs to monitor and manage PAI infrastructure services.
---

## Service Monitor Dashboard

Monitor PAI infrastructure services with real-time metrics and control.

### Quick Start

```bash
/service-monitor-dashboard --start
/service-monitor-dashboard --stop
/service-monitor-dashboard --restart
```

### Features

- **Real-time Metrics**: CPU, memory, and GPU utilization for each service
- **Service Status**: Running/stopped status and last restart timestamp
- **Safe Restart**: Restart individual services with a single click
- **Service Grouping**: Organized by service function (infrastructure, skills, etc.)
- **Auto-refresh**: Live updates via WebSocket
- **Dark Theme**: Matches observability dashboard aesthetic

## Extended Context

For detailed information, see `Reference.md`
