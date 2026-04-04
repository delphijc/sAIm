# Observability

This guide covers the monitoring, metrics, and logging infrastructure for the Sam platform.

---

## Overview

Sam provides three observability layers:

| Layer | Purpose | Location |
|-------|---------|----------|
| **Metrics** | Prometheus-compatible metrics for monitoring | `/api/system/metrics` |
| **Structured Logging** | JSON logs with context for debugging | Server console + Pino |
| **Real-time Dashboard** | Visual agent activity monitoring | Observability Dashboard |

---

## Prometheus Metrics

### Endpoint

```
GET /api/system/metrics
```

Returns Prometheus-format metrics suitable for scraping.

### Available Metrics

#### Custom Domain Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `sam_jobs_processed_total` | Counter | `status`, `agent`, `backend` | Total jobs processed |
| `sam_job_duration_seconds` | Histogram | `agent`, `backend` | Job processing duration |
| `sam_http_requests_total` | Counter | `method`, `path`, `status` | HTTP requests received |
| `sam_http_request_duration_seconds` | Histogram | `method`, `path`, `status` | HTTP request latency |

#### Default Node.js Metrics

The endpoint also exposes default `prom-client` metrics:

- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_active_handles_total` - Active handles
- `nodejs_active_requests_total` - Active requests
- `nodejs_heap_size_*` - Heap memory metrics
- `nodejs_external_memory_bytes` - External memory
- `process_cpu_*` - CPU usage metrics
- `process_start_time_seconds` - Process start time
- `process_resident_memory_bytes` - Memory usage

### Example Response

```
curl http://localhost:8898/api/system/metrics
```

```prometheus
# HELP sam_jobs_processed_total Total number of jobs processed
# TYPE sam_jobs_processed_total counter
sam_jobs_processed_total{status="completed",agent="analyst",backend="gemini",app="sam-backend"} 42
sam_jobs_processed_total{status="failed",agent="engineer",backend="claude",app="sam-backend"} 3

# HELP sam_http_requests_total Total number of HTTP requests
# TYPE sam_http_requests_total counter
sam_http_requests_total{method="GET",path="/api/jobs",status="200",app="sam-backend"} 1523
sam_http_requests_total{method="POST",path="/api/jobs",status="201",app="sam-backend"} 89

# HELP sam_job_duration_seconds Job processing duration in seconds
# TYPE sam_job_duration_seconds histogram
sam_job_duration_seconds_bucket{agent="analyst",backend="gemini",le="1",app="sam-backend"} 5
sam_job_duration_seconds_bucket{agent="analyst",backend="gemini",le="5",app="sam-backend"} 28
sam_job_duration_seconds_bucket{agent="analyst",backend="gemini",le="15",app="sam-backend"} 35
```

---

## Prometheus Integration

### Local Prometheus Setup

1. **Install Prometheus** (macOS):
   ```bash
   brew install prometheus
   ```

2. **Configure scrape target** (`prometheus.yml`):
   ```yaml
   global:
     scrape_interval: 15s

   scrape_configs:
     - job_name: 'sam-backend'
       static_configs:
         - targets: ['localhost:8898']
       metrics_path: '/api/system/metrics'
   ```

3. **Start Prometheus**:
   ```bash
   prometheus --config.file=prometheus.yml
   ```

4. **Access UI**: http://localhost:9090

### Example Prometheus Queries

```promql
# Job success rate (last hour)
sum(rate(sam_jobs_processed_total{status="completed"}[1h])) /
sum(rate(sam_jobs_processed_total[1h])) * 100

# Average job duration by agent
histogram_quantile(0.95,
  sum(rate(sam_job_duration_seconds_bucket[5m])) by (agent, le)
)

# HTTP request rate by endpoint
sum(rate(sam_http_requests_total[5m])) by (path)

# Error rate (non-2xx responses)
sum(rate(sam_http_requests_total{status!~"2.."}[5m])) /
sum(rate(sam_http_requests_total[5m])) * 100
```

---

## Grafana Dashboards

### Setup

1. **Install Grafana** (macOS):
   ```bash
   brew install grafana
   brew services start grafana
   ```

2. **Access**: http://localhost:3000 (admin/admin)

3. **Add Prometheus data source**:
   - Configuration > Data Sources > Add > Prometheus
   - URL: `http://localhost:9090`

### Recommended Dashboard Panels

#### Job Processing Overview
```json
{
  "title": "Jobs Processed",
  "type": "stat",
  "targets": [{
    "expr": "sum(sam_jobs_processed_total)",
    "legendFormat": "Total Jobs"
  }]
}
```

#### Job Duration P95
```json
{
  "title": "Job Duration (P95)",
  "type": "gauge",
  "targets": [{
    "expr": "histogram_quantile(0.95, sum(rate(sam_job_duration_seconds_bucket[5m])) by (le))",
    "legendFormat": "P95 Duration"
  }],
  "fieldConfig": {
    "defaults": {
      "unit": "s",
      "thresholds": {
        "steps": [
          {"value": 0, "color": "green"},
          {"value": 30, "color": "yellow"},
          {"value": 60, "color": "red"}
        ]
      }
    }
  }
}
```

#### Request Rate
```json
{
  "title": "Request Rate",
  "type": "graph",
  "targets": [{
    "expr": "sum(rate(sam_http_requests_total[1m])) by (path)",
    "legendFormat": "{{path}}"
  }]
}
```

---

## Structured Logging

Sam uses [Pino](https://getpino.io/) for structured JSON logging.

### Log Format

```json
{
  "level": 30,
  "time": 1706745600000,
  "pid": 12345,
  "hostname": "macbook",
  "projectId": "default_project",
  "jobId": "abc-123",
  "msg": "Job started"
}
```

### Log Levels

| Level | Value | Usage |
|-------|-------|-------|
| `trace` | 10 | Verbose debugging |
| `debug` | 20 | Debug information |
| `info` | 30 | General information |
| `warn` | 40 | Warnings |
| `error` | 50 | Errors |
| `fatal` | 60 | Fatal errors |

### Configuration

Set log level via environment:

```bash
LOG_LEVEL=debug bun run backend/server.ts
```

### Context Fields

Logs include contextual fields for traceability:

| Field | Description |
|-------|-------------|
| `projectId` | Active project identifier |
| `jobId` | Job being processed |
| `workflowId` | Workflow context |
| `taskId` | Specific task identifier |
| `duration` | Operation duration (ms) |

---

## Real-time Dashboard

The Observability Dashboard provides live visualization of multi-agent activity.

### Starting the Dashboard

```bash
/start-up
```

Or manually:

```bash
# Start observability engine
cd .agent/observability
bun run engine.ts &

# Open dashboard
open http://localhost:5174
```

### Dashboard Features

- **Agent Activity Timeline**: Real-time view of agent tool calls
- **Session Management**: Track multiple Claude Code sessions
- **Event Filtering**: Filter by agent, tool, or status
- **Performance Metrics**: Timing and resource usage

### SSE Events

The dashboard connects to Server-Sent Events streams:

| Endpoint | Purpose |
|----------|---------|
| `/api/events` | Real-time job updates |
| `/api/logs/stream` | Live log streaming |
| `/api/workflows/events` | Workflow status changes |

---

## Health Checks

### Endpoint

```
GET /health
```

### Response

```json
{
  "status": "ok",
  "timestamp": "2026-01-31T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.4",
  "checks": {
    "projectRoot": true,
    "jobsFile": true
  }
}
```

### Integration with Load Balancers

Use the health endpoint for:
- Kubernetes readiness/liveness probes
- Load balancer health checks
- Uptime monitoring services

```yaml
# Kubernetes example
livenessProbe:
  httpGet:
    path: /health
    port: 8898
  initialDelaySeconds: 10
  periodSeconds: 30
```

---

## Alerting

### Prometheus Alerting Rules

Create `alerts.yml`:

```yaml
groups:
  - name: sam-alerts
    rules:
      - alert: HighJobFailureRate
        expr: |
          sum(rate(sam_jobs_processed_total{status="failed"}[5m])) /
          sum(rate(sam_jobs_processed_total[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High job failure rate"
          description: "More than 10% of jobs are failing"

      - alert: SlowJobProcessing
        expr: |
          histogram_quantile(0.95,
            sum(rate(sam_job_duration_seconds_bucket[5m])) by (le)
          ) > 120
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow job processing"
          description: "P95 job duration exceeds 2 minutes"

      - alert: HighErrorRate
        expr: |
          sum(rate(sam_http_requests_total{status=~"5.."}[5m])) /
          sum(rate(sam_http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High HTTP error rate"
          description: "More than 5% of requests returning 5xx errors"
```

---

## Troubleshooting

### Metrics Not Appearing

1. **Check endpoint**:
   ```bash
   curl http://localhost:8898/api/system/metrics
   ```

2. **Verify server is running**:
   ```bash
   curl http://localhost:8898/health
   ```

3. **Check for port conflicts**:
   ```bash
   lsof -i :8898
   ```

### Missing Job Metrics

Job metrics only increment when jobs complete. Verify:
- Jobs are being submitted to the queue
- Job monitor is running (`jobs_queue_monitor.sh`)
- Jobs are completing (not stuck)

### Log Level Too Verbose

Adjust log level:
```bash
LOG_LEVEL=warn bun run backend/server.ts
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Sam Platform                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Backend    │───▶│   Metrics    │───▶│  Prometheus  │  │
│  │   Server     │    │   Registry   │    │   Scraper    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                       │           │
│         ▼                                       ▼           │
│  ┌──────────────┐                       ┌──────────────┐   │
│  │    Pino      │                       │   Grafana    │   │
│  │   Logger     │                       │  Dashboard   │   │
│  └──────────────┘                       └──────────────┘   │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │   Console    │    │ Observability│                      │
│  │   Output     │    │  Dashboard   │                      │
│  └──────────────┘    └──────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [Task-Runner.md](Task-Runner.md) - Job queue and processing
- [Architecture.md](Architecture.md) - System architecture
- [Configuration.md](Configuration.md) - Configuration options
- [Usage-Guide.md](Usage-Guide.md) - General usage
