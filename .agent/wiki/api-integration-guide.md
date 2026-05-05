# sAIm API & Integration Guide

**Document Version:** 1.0  
**Last Updated:** 2026-05-01  
**Audience:** Developers, DevOps, System Integrators  

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Service APIs](#service-apis)
3. [Webhook System](#webhook-system)
4. [Database Schemas](#database-schemas)
5. [Integration Patterns](#integration-patterns)
6. [Error Handling](#error-handling)
7. [Authentication & Security](#authentication--security)
8. [Performance Tuning](#performance-tuning)

---

## API Overview

sAIm exposes **9 core service APIs** plus **8 webhook event types**. All services communicate via **HTTP/REST** with optional **WebSocket** for real-time data.

### Service Topology

```
┌─────────────────────────────────────────────────────────────┐
│              Claude Code Harness (Main Process)             │
├─────────────────────────────────────────────────────────────┤
│  Hook System → Skills → Agents → History (all in-process)  │
├─────────────────────────────────────────────────────────────┤
│  Optional External Services (HTTP clients + servers)        │
│  ┌──────────────────┬──────────────┬──────────────────┐    │
│  │  Memory System   │ Voice Server │ Awareness Dash   │    │
│  │  (4242)          │ (8888)       │ (4100/5173)      │    │
│  └──────────────────┴──────────────┴──────────────────┘    │
│  ┌──────────────────┬──────────────┬──────────────────┐    │
│  │  Observability   │ Service Mon  │ Discord Bot      │    │
│  │  (5172)          │ (6000/5175)  │ (Discord API)    │    │
│  └──────────────────┴──────────────┴──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Service Communication Patterns

| From → To | Protocol | Auth | Async | Retry |
|-----------|----------|------|-------|-------|
| Sam → Memory | HTTP POST | Optional | Yes | Exponential |
| Sam → Voice | HTTP POST | Optional | No | 3x backoff |
| Sam → Awareness | HTTP GET | Optional | No | None |
| Memory → Webhook Consumer | HTTP POST | None | Yes | 3x backoff |
| Discord Bot → Services | HTTP | Internal | No | 3x retry |
| Service Monitor → All | HTTP GET | None | No | 1x (scheduled) |

---

## Service APIs

### 1. Voice Server API

**Base URL:** `http://localhost:8888`  
**Status Endpoint:** `GET /health`  
**Response:** `{ status: 'ok'|'degraded', uptime: number, python_sidecar: boolean }`

#### Endpoint: POST /api/speak

Convert text to speech.

```http
POST /api/speak HTTP/1.1
Host: localhost:8888
Content-Type: application/json

{
  "text": "Your deployment was successful",
  "voiceId": "Jessica",
  "rate": 1.0,
  "pitch": 1.0
}
```

**Response (200 OK):**
```json
{
  "audioUrl": "http://localhost:8888/audio/speak-12345.wav",
  "duration": 2.5,
  "format": "wav",
  "taskId": "speak-12345"
}
```

**Webhook:** `POST /webhooks/speech-complete`
```json
{
  "taskId": "speak-12345",
  "text": "Your deployment was successful",
  "voiceId": "Jessica",
  "duration": 2.5,
  "success": true,
  "timestamp": "2026-05-01T18:30:00Z"
}
```

**Error Codes:**
- `400 Bad Request` — Invalid text format or missing required fields
- `413 Payload Too Large` — Text exceeds max length (>2000 chars)
- `503 Service Unavailable` — Python sidecar not responding
- `504 Gateway Timeout` — TTS processing took >30s

**Examples:**

```bash
# Simple notification
curl -X POST http://localhost:8888/api/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "Build complete", "voiceId": "Jessica"}'

# Custom rate and pitch
curl -X POST http://localhost:8888/api/speak \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Critical alert: memory usage at 92%",
    "voiceId": "Tom",
    "rate": 1.2,
    "pitch": 1.1
  }'
```

#### Endpoint: POST /api/notify

Send audible notification with fallback to status message.

```http
POST /api/notify HTTP/1.1
Host: localhost:8888
Content-Type: application/json

{
  "message": "Agent deployment completed successfully",
  "type": "success",
  "voiceId": "Jessica",
  "priority": "normal"
}
```

**Response (200 OK):**
```json
{
  "notificationId": "notify-12345",
  "scheduled": 1714604400000,
  "voiceId": "Jessica",
  "type": "success"
}
```

**Notification Types:**
- `success` — Completion, achievement, positive outcome
- `warning` — Degraded state, high memory, approaching limits
- `error` — Service down, task failed, critical issue
- `info` — Status update, routine notification

---

### 2. Memory System API

**Base URL:** `http://localhost:4242`  
**Status Endpoint:** `GET /health`  
**Response:** `{ status: 'ok', db: 'healthy', facts: number, associations: number }`

#### Endpoint: POST /memory/extract

Extract semantic facts from conversation transcript.

```http
POST /memory/extract HTTP/1.1
Host: localhost:4242
Content-Type: application/json

{
  "sessionId": "claude-session-xyz",
  "transcript": "User asked me to implement Redis caching. I suggested using node-redis with connection pooling.",
  "timestamp": "2026-05-01T18:30:00Z",
  "source": "claude-code-session"
}
```

**Response (200 OK):**
```json
{
  "facts": [
    {
      "id": "fact-123",
      "text": "User requested Redis caching implementation",
      "type": "task",
      "confidence": 0.95,
      "source_field": "transcript",
      "created_at": "2026-05-01T18:30:00Z"
    },
    {
      "id": "fact-124",
      "text": "Recommended node-redis with connection pooling",
      "type": "recommendation",
      "confidence": 0.88,
      "source_field": "transcript",
      "created_at": "2026-05-01T18:30:00Z"
    }
  ],
  "associations": [
    {
      "source": "fact-123",
      "target": "fact-124",
      "type": "related",
      "weight": 0.9
    }
  ],
  "totalExtracted": 2,
  "executionTime": 234
}
```

**Extraction Patterns:**
Memory system runs 12 extraction patterns:
1. Task identification (`user requested X`)
2. Completed actions (`I implemented Y`)
3. Recommendations (`I suggested Z`)
4. Learning insights (`I discovered that...`)
5. Technical decisions (`We chose X over Y because...`)
6. Problem identification (`The issue is...`)
7. Person mentions (`John said...`)
8. Project references (`In the sam project...`)
9. Code patterns (`Use async/await for...`)
10. Domain concepts (`Redis is a...`)
11. Temporal markers (`Last week`, `next quarter`)
12. Confidence modifiers (`Definitely`, `Maybe`, `I'm unsure`)

**Webhook:** `POST /webhooks/extraction-complete`
```json
{
  "sessionId": "claude-session-xyz",
  "timestamp": "2026-05-01T18:30:05Z",
  "facts": [...],
  "associations": [...],
  "totalExtracted": 2,
  "executionTime": 234
}
```

#### Endpoint: POST /memory/consolidation/run

Run weekly consolidation cycle (deduplication, pruning, insights).

```http
POST /memory/consolidation/run HTTP/1.1
Host: localhost:4242
Content-Type: application/json

{
  "mode": "aggressive",
  "retentionDays": 90,
  "minConfidence": 0.6
}
```

**Response (200 OK):**
```json
{
  "timestamp": "2026-05-01T23:00:00Z",
  "mode": "aggressive",
  "results": {
    "factsProcessed": 1543,
    "factsMerged": 127,
    "factsRemoved": 89,
    "associationsUpdated": 412,
    "insightsGenerated": [
      "User frequently uses Redis for caching",
      "Prefers async/await over callbacks",
      "Works primarily on backend services"
    ]
  },
  "executionTime": 8932
}
```

**Consolidation Logic:**
1. **Duplicate Detection** — Find facts with >90% text similarity
2. **Merge** — Combine duplicate facts, keep highest confidence score
3. **Prune** — Remove facts with confidence < threshold
4. **Age Out** — Remove facts older than retentionDays
5. **Association Cleanup** — Remove associations to deleted facts
6. **Insight Generation** — Run pattern analysis on consolidated facts
7. **ACT-R Activation** — Decay activation scores for old facts

**Webhook:** `POST /webhooks/consolidation-done`

#### Endpoint: GET /memory/search

Hybrid semantic + keyword search.

```http
GET /memory/search?q=Redis+caching&type=task&limit=10&minConfidence=0.7 HTTP/1.1
Host: localhost:4242
```

**Query Parameters:**
- `q` — Search query (required)
- `type` — Fact type filter: `user|project|feedback|reference|task|recommendation|insight`
- `limit` — Max results (default: 50, max: 500)
- `minConfidence` — Minimum confidence score (0.0-1.0, default: 0.5)
- `orderBy` — Sort order: `relevance|confidence|recent` (default: relevance)

**Response (200 OK):**
```json
{
  "query": "Redis caching",
  "results": [
    {
      "id": "fact-123",
      "text": "User requested Redis caching implementation",
      "type": "task",
      "confidence": 0.95,
      "relevanceScore": 0.98,
      "created_at": "2026-05-01T18:30:00Z",
      "lastAccessed": "2026-05-01T20:15:30Z"
    }
  ],
  "totalCount": 5,
  "executionMs": 45,
  "suggestedFilters": ["type:recommendation", "recent"]
}
```

#### Endpoint: GET /api/graph

Graph visualization and analysis.

```http
GET /api/graph?nodeId=fact-123&depth=2&algorithm=neighbor HTTP/1.1
Host: localhost:4242
```

**Query Parameters:**
- `nodeId` — Starting node (required)
- `depth` — Traversal depth (1-3, default: 1)
- `algorithm` — `neighbor|path|community` (default: neighbor)
- `layout` — Visualization layout: `hierarchical|force` (default: hierarchical)

**Response (200 OK):**
```json
{
  "nodeId": "fact-123",
  "depth": 2,
  "algorithm": "neighbor",
  "nodes": [
    {
      "id": "fact-123",
      "label": "User requested Redis caching implementation",
      "type": "task",
      "confidence": 0.95,
      "activationScore": 0.85,
      "distance": 0
    },
    {
      "id": "fact-124",
      "label": "Recommended node-redis with connection pooling",
      "type": "recommendation",
      "confidence": 0.88,
      "activationScore": 0.72,
      "distance": 1
    }
  ],
  "edges": [
    {
      "source": "fact-123",
      "target": "fact-124",
      "type": "related",
      "weight": 0.9
    }
  ],
  "layout": {
    "nodes": [
      { "id": "fact-123", "x": 100, "y": 100 },
      { "id": "fact-124", "x": 250, "y": 100 }
    ]
  }
}
```

---

### 3. Awareness Dashboard API

**Base URL:** `http://localhost:4100`  
**Status Endpoint:** `GET /health`

#### Endpoint: GET /api/briefing

Generate AI operations briefing.

```http
GET /api/briefing?period=daily&format=json HTTP/1.1
Host: localhost:4100
```

**Query Parameters:**
- `period` — `daily|weekly|monthly` (default: daily)
- `format` — `json|markdown` (default: json)
- `includeMetrics` — Include system metrics (boolean, default: true)

**Response (200 OK - JSON):**
```json
{
  "period": "daily",
  "date": "2026-05-01",
  "briefing": "# Daily Operations Briefing\n\n## Summary\n...",
  "insights": [
    "Memory system hit 92% capacity during consolidation",
    "Discord bot processed 47 commands successfully",
    "3 new facts extracted from 2 agent sessions"
  ],
  "recommendations": [
    "Archive old observability data (>90 days) to improve search performance",
    "Schedule memory system maintenance window for consolidation",
    "Monitor voice server Python sidecar for memory leaks"
  ],
  "metrics": {
    "agents_run": 12,
    "tasks_completed": 8,
    "uptime_percent": 99.8,
    "average_response_time_ms": 245
  },
  "timestamp": "2026-05-01T23:59:59Z",
  "generatedAt": "2026-05-01T23:59:59Z"
}
```

**Response (200 OK - Markdown):**
```markdown
# Daily Operations Briefing — May 1, 2026

## Executive Summary
All systems operational. 12 agents completed tasks successfully with 99.8% uptime.

## Key Metrics
- Agents Run: 12
- Tasks Completed: 8
- Uptime: 99.8%
- Avg Response: 245ms

## Insights
- Memory system hit 92% capacity during consolidation
- Discord bot processed 47 commands successfully
- 3 new facts extracted from 2 agent sessions

## Recommendations
1. Archive old observability data (>90 days)
2. Schedule memory system maintenance
3. Monitor voice server Python sidecar
```

#### Endpoint: GET /api/operations/status

Current operations status.

```http
GET /api/operations/status HTTP/1.1
Host: localhost:4100
```

**Response (200 OK):**
```json
{
  "timestamp": "2026-05-01T18:30:00Z",
  "systemStatus": "healthy",
  "services": [
    {
      "name": "voice-server",
      "status": "running",
      "uptime": 86400,
      "port": 8888
    },
    {
      "name": "memory-system",
      "status": "running",
      "uptime": 172800,
      "port": 4242
    }
  ],
  "activeAgents": [
    {
      "id": "agent-123",
      "type": "engineer",
      "status": "running",
      "startTime": "2026-05-01T18:25:00Z"
    }
  ],
  "queuedTasks": 3
}
```

---

### 4. Observability Dashboard API

**Base URL:** `http://localhost:5172`  
**WebSocket:** `ws://localhost:5172/ws/agents`

#### WebSocket: /ws/agents

Real-time agent activity stream.

**Connect:**
```javascript
const ws = new WebSocket('ws://localhost:5172/ws/agents');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message);
};
```

**Message Format:**
```json
{
  "type": "agent-started",
  "timestamp": "2026-05-01T18:30:00Z",
  "agentId": "agent-123",
  "payload": {
    "type": "engineer",
    "task": "Implement Redis caching",
    "status": "running"
  }
}
```

**Event Types:**
- `agent-started` — Agent begins execution
- `agent-completed` — Agent finishes successfully
- `agent-error` — Agent encounters error
- `message-sent` — New message in agent thread
- `task-updated` — Task status changes
- `error` — Observability system error

#### Endpoint: GET /api/agents

List agents.

```http
GET /api/agents?status=active&limit=50 HTTP/1.1
Host: localhost:5172
```

**Response (200 OK):**
```json
{
  "agents": [
    {
      "id": "agent-123",
      "type": "engineer",
      "status": "running",
      "startTime": "2026-05-01T18:25:00Z",
      "endTime": null,
      "taskId": "task-456",
      "outputSize": 12400,
      "messagesCount": 8
    }
  ],
  "totalActive": 1,
  "totalCompleted": 47
}
```

#### Endpoint: POST /api/agents/:agentId/stop

Stop a running agent.

```http
POST /api/agents/agent-123/stop HTTP/1.1
Host: localhost:5172

{
  "reason": "User requested cancellation"
}
```

**Response (200 OK):**
```json
{
  "agentId": "agent-123",
  "stopped": true,
  "stoppedAt": "2026-05-01T18:32:15Z",
  "finalStatus": "cancelled",
  "outputSize": 15600
}
```

---

### 5. Service Monitor API

**Base URL:** `http://localhost:6000`

#### Endpoint: GET /api/services

List all PAI services.

```http
GET /api/services HTTP/1.1
Host: localhost:6000
```

**Response (200 OK):**
```json
{
  "services": [
    {
      "name": "voice-server",
      "status": "running",
      "port": 8888,
      "pid": 12345,
      "uptime": 86400,
      "memory": 45000000,
      "cpu": 2.1
    },
    {
      "name": "memory-system",
      "status": "running",
      "port": 4242,
      "pid": 12346,
      "uptime": 172800,
      "memory": 120000000,
      "cpu": 1.5
    }
  ],
  "systemStatus": "healthy",
  "timestamp": "2026-05-01T18:30:00Z"
}
```

#### Endpoint: POST /api/services/:serviceName/restart

Restart a service.

```http
POST /api/services/voice-server/restart HTTP/1.1
Host: localhost:6000

{
  "force": false,
  "gracefulTimeoutSeconds": 10
}
```

**Response (200 OK):**
```json
{
  "serviceName": "voice-server",
  "action": "restart",
  "success": true,
  "previousPid": 12345,
  "newPid": 12789,
  "restartTime": "2026-05-01T18:31:00Z"
}
```

---

### 6. Discord Remote Control API

**Command Interface:** Discord chat commands (`!sam <command>`)

#### Command: !sam help

List available commands.

```
!sam help
```

**Response:**
```
📋 **sAIm Discord Commands**

🤖 **Agents**
!sam agent list          — List active agents
!sam agent stop <id>     — Stop a running agent
!sam agent logs <id>     — View agent output

🧠 **Memory**
!sam memory search <query> — Search semantic memory
!sam memory graph <id>      — View memory graph

🔧 **Services**
!sam service status          — Check service health
!sam service restart <name>  — Restart a service
!sam service logs <name>     — Tail service logs

📊 **Operations**
!sam briefing daily|weekly   — Get operations briefing
!sam metrics                 — View system metrics
!sam audit <command>         — View command history
```

#### Command: !sam agent list

List active agents.

```
!sam agent list
```

**Response (Embed):**
```
Active Agents (1)

🔵 Agent ID: agent-123
  Type: engineer
  Status: Running
  Runtime: 5m 23s
  Task: Implement Redis caching
  
Completed Today: 12
Success Rate: 91.7%
```

---

## Webhook System

### Webhook Registration

Webhooks are configured per-service in their `.env` or config file:

```bash
# .agent/services/memory-system/.env
WEBHOOK_ENDPOINTS='
{
  "extraction-complete": "http://localhost:5172/webhooks/extraction-complete",
  "consolidation-done": "http://localhost:5172/webhooks/consolidation-done"
}'
```

### Webhook Retry Policy

All webhooks use **exponential backoff with jitter**:

```
Attempt 1: Immediate
Attempt 2: 3.5s + jitter
Attempt 3: 7.5s + jitter
Attempt 4: 15s + jitter
Attempt 5: Give up, log to audit trail
```

**Request Timeout:** 30 seconds

### Webhook Event: memory.extraction.complete

Emitted when memory system finishes fact extraction.

```json
{
  "eventId": "evt-12345",
  "eventType": "memory.extraction.complete",
  "timestamp": "2026-05-01T18:30:05Z",
  "sessionId": "claude-session-xyz",
  "facts": [
    {
      "id": "fact-123",
      "text": "User requested Redis caching",
      "type": "task",
      "confidence": 0.95
    }
  ],
  "associations": [
    {
      "source": "fact-123",
      "target": "fact-124",
      "type": "related",
      "weight": 0.9
    }
  ],
  "totalExtracted": 2,
  "executionTime": 234
}
```

**Consumers:**
- Observability Dashboard (logs event)
- Discord Bot (optional: announce memory update)
- Sam session logger (for audit trail)

### Webhook Event: infrastructure.service.status_changed

Emitted when a service changes state.

```json
{
  "eventId": "evt-12346",
  "eventType": "infrastructure.service.status_changed",
  "timestamp": "2026-05-01T18:45:00Z",
  "serviceName": "voice-server",
  "oldStatus": "running",
  "newStatus": "error",
  "details": "Python sidecar crashed with exit code 1",
  "pid": 12345,
  "port": 8888
}
```

**Consumers:**
- Service Monitor Dashboard (updates status table)
- Discord Bot (alert: !sam service voice-server is DOWN)
- Alerting system (optional: page on-call)

---

## Database Schemas

### Memory System Database

**Location:** `~/Projects/memory-system/data/memory.db`

```sql
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  type TEXT NOT NULL,  -- task|recommendation|insight|person|project|etc
  confidence REAL NOT NULL,  -- 0.0-1.0
  source_file TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  activation_score REAL DEFAULT 1.0,  -- ACT-R activation decay
  UNIQUE(text, type)  -- Prevent exact duplicates
);

CREATE INDEX idx_facts_type ON facts(type);
CREATE INDEX idx_facts_created ON facts(created_at DESC);
CREATE INDEX idx_facts_activation ON facts(activation_score DESC);
CREATE INDEX idx_facts_confidence ON facts(confidence DESC);

CREATE TABLE associations (
  id TEXT PRIMARY KEY,
  source_fact_id TEXT NOT NULL,
  target_fact_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- temporal|topic|causal|person
  weight REAL NOT NULL,  -- 0.0-1.0
  created_at TIMESTAMP NOT NULL,
  last_accessed TIMESTAMP,
  FOREIGN KEY(source_fact_id) REFERENCES facts(id),
  FOREIGN KEY(target_fact_id) REFERENCES facts(id),
  UNIQUE(source_fact_id, target_fact_id)
);

CREATE INDEX idx_assoc_source ON associations(source_fact_id);
CREATE INDEX idx_assoc_target ON associations(target_fact_id);
CREATE INDEX idx_assoc_weight ON associations(weight DESC);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  session_start TIMESTAMP NOT NULL,
  session_end TIMESTAMP,
  summary TEXT,
  fact_count INTEGER DEFAULT 0,
  association_count INTEGER DEFAULT 0
);

CREATE TABLE insights (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  generated_at TIMESTAMP NOT NULL,
  confidence REAL NOT NULL,
  fact_ids TEXT  -- JSON array of contributing fact IDs
);

CREATE TABLE graph_cache (
  nodeId TEXT PRIMARY KEY,
  neighbors TEXT,  -- JSON array of neighbor facts
  paths TEXT,      -- JSON array of shortest paths
  communities TEXT, -- JSON array of community IDs
  updated_at TIMESTAMP
);
```

### Discord Remote Control Database

**Location:** `.agent/skills/discord-remote-control/service/data/discord.db`

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  reaction_count INTEGER DEFAULT 0,
  is_command BOOLEAN DEFAULT 0
);

CREATE INDEX idx_conv_user ON conversations(user_id);
CREATE INDEX idx_conv_timestamp ON conversations(timestamp DESC);

CREATE TABLE commands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  command TEXT NOT NULL,
  args TEXT,  -- JSON
  result TEXT,
  status TEXT,  -- success|error|timeout
  error_message TEXT,
  timestamp TIMESTAMP NOT NULL,
  execution_time_ms INTEGER
);

CREATE INDEX idx_cmd_user ON commands(user_id);
CREATE INDEX idx_cmd_status ON commands(status);
CREATE INDEX idx_cmd_timestamp ON commands(timestamp DESC);

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  theme TEXT DEFAULT 'dark',
  notification_level TEXT DEFAULT 'normal',  -- quiet|normal|verbose
  auto_briefing BOOLEAN DEFAULT 0,
  updated_at TIMESTAMP
);

CREATE TABLE agent_tasks (
  task_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- pending|running|completed|failed
  created_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  output_size INTEGER
);

CREATE INDEX idx_task_user ON agent_tasks(user_id);
CREATE INDEX idx_task_status ON agent_tasks(status);
```

---

## Integration Patterns

### Pattern 1: Fact Extraction Pipeline

Automatically extract facts from tool outputs:

```
Claude Code Tool Execution
    ↓
PostToolUse Hook (capture-all-events.ts)
    ↓
memory-capture.ts checks: ENABLE_MEMORY_HOOKS=true?
    ↓ YES
HTTP POST to /memory/extract
    ↓
Memory System processes transcript
    ↓
Emit webhook: memory.extraction.complete
    ↓
Consumers (Discord, Observability) receive event
```

**Configuration:**
```bash
# Enable in .agent/.env
ENABLE_MEMORY_HOOKS=true
MEMORY_SERVICE_URL=http://localhost:4242
```

### Pattern 2: Service Orchestration

Monitor and auto-restart failing services:

```
Service Monitor (runs every 30s)
    ↓
GET /health on all services
    ↓
Compare current state to previous
    ↓
Status changed?
    ↓ YES
Emit webhook: infrastructure.service.status_changed
    ↓
Webhook consumers react:
  - Discord bot sends alert
  - Alert manager pages on-call
  - Auto-restart if enabled
```

### Pattern 3: Agent Delegation Chain

Delegate complex work to specialized agents:

```
Skill initiates Agent delegation
    ↓
Agent executor spawned
    ↓
Agent processes task
    ↓
Agent completes
    ↓
SubagentStop Hook triggered
    ↓
capture-all-events.ts logs to history
    ↓
Emit webhook: orchestration.agent.completed
    ↓
Task runner receives webhook
    ↓
Update task status (completed/failed)
    ↓
Notify Discord (if configured)
```

### Pattern 4: Real-Time Observability

Stream agent activity to dashboard:

```
Agent execution starts
    ↓
Emit event: agent-started
    ↓
WebSocket clients receive (ws://localhost:5172/ws/agents)
    ↓
Dashboard updates UI in real-time
    ↓
Agent sends messages
    ↓
Emit event: message-sent
    ↓
Dashboard appends message to agent thread
    ↓
Agent completes
    ↓
Emit event: agent-completed
    ↓
Dashboard marks as done, shows duration
```

---

## Error Handling

### Error Response Format (Standard)

All services return errors in this format:

```json
{
  "error": {
    "code": "ERR_INVALID_REQUEST",
    "message": "The text field is required",
    "details": {
      "field": "text",
      "constraint": "required"
    },
    "requestId": "req-12345",
    "timestamp": "2026-05-01T18:30:00Z"
  }
}
```

### Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `ERR_INVALID_REQUEST` | 400 | Missing or invalid field |
| `ERR_UNAUTHORIZED` | 401 | Missing or invalid API key |
| `ERR_FORBIDDEN` | 403 | User lacks permission |
| `ERR_NOT_FOUND` | 404 | Resource does not exist |
| `ERR_CONFLICT` | 409 | Resource already exists |
| `ERR_PAYLOAD_TOO_LARGE` | 413 | Request body exceeds limit |
| `ERR_INTERNAL` | 500 | Server error (see logs) |
| `ERR_SERVICE_UNAVAILABLE` | 503 | Service is down |
| `ERR_TIMEOUT` | 504 | Request took too long |

### Retry Logic

**Implement exponential backoff for transient failures:**

```typescript
async function callWithRetry(
  fn: () => Promise<Response>,
  maxAttempts: number = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fn();
      if (response.ok || !isRetryable(response.status)) {
        return response;
      }
    } catch (error) {
      lastError = error as Error;
    }
    
    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

function isRetryable(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status);
}
```

---

## Authentication & Security

### API Key Authentication (Optional)

Services support optional API key authentication via header:

```bash
curl -X POST http://localhost:8888/api/speak \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello"}'
```

**Environment Variables:**
```bash
VOICE_API_KEY=sk_voice_...
MEMORY_API_KEY=sk_memory_...
```

### CORS Policy

Services should configure CORS for browser access:

```typescript
// Allow sam UI origins only
app.use(cors({
  origin: [
    'http://localhost:5172',  // Observability
    'http://localhost:5173',  // Awareness frontend
    'http://localhost:5175',  // Service Monitor frontend
    'http://localhost:4444'   // Markdown Editor
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Request Signing (for Webhooks)

Services should verify webhook authenticity:

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return hash === signature;
}

// Verify on webhook receipt
app.post('/webhooks/extraction-complete', (req, res) => {
  const signature = req.headers['x-sam-signature'] as string;
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  handleExtractionComplete(req.body);
  res.status(200).json({ ok: true });
});
```

---

## Performance Tuning

### Memory System Optimization

**Query Performance:**
```sql
-- Slow query: searching 10k facts
SELECT * FROM facts WHERE text LIKE '%redis%' LIMIT 50;  -- 1200ms

-- Fast query: with proper indexes
SELECT * FROM facts WHERE type = 'recommendation' AND confidence > 0.8;  -- 45ms

-- Optimize: add composite index
CREATE INDEX idx_facts_type_confidence ON facts(type, confidence DESC);
```

**Database Maintenance:**
```sql
-- Run weekly to optimize performance
ANALYZE;
VACUUM;
REINDEX;
```

### Voice Server Optimization

**Caching:**
```typescript
// Cache frequently-used voices in memory
const voiceCache = new Map<string, AudioBuffer>();

async function getAudio(text: string, voiceId: string): Promise<AudioBuffer> {
  const cacheKey = `${voiceId}:${hashText(text)}`;
  if (voiceCache.has(cacheKey)) {
    return voiceCache.get(cacheKey)!;
  }
  
  const audio = await synthesize(text, voiceId);
  voiceCache.set(cacheKey, audio);
  return audio;
}
```

### Observability Dashboard Optimization

**WebSocket Connection Pooling:**
```typescript
// Reuse WebSocket connections
class ObservabilityClient {
  private ws: WebSocket;
  
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;  // Already connected
    }
    this.ws = new WebSocket('ws://localhost:5172/ws/agents');
  }
}
```

### Webhook Delivery Optimization

**Batch Processing:**
```typescript
// Batch webhooks to reduce network overhead
const webhookBatch: WebhookEvent[] = [];
const BATCH_SIZE = 10;
const BATCH_TIMEOUT_MS = 1000;

function addToBatch(event: WebhookEvent): void {
  webhookBatch.push(event);
  if (webhookBatch.length >= BATCH_SIZE) {
    flushBatch();
  }
}

function flushBatch(): void {
  if (webhookBatch.length === 0) return;
  
  const batch = webhookBatch.splice(0);
  deliverWebhook({
    type: 'batch',
    events: batch,
    timestamp: new Date().toISOString()
  });
}

// Auto-flush on timeout
setInterval(() => flushBatch(), BATCH_TIMEOUT_MS);
```

---

**End of API & Integration Guide**

For questions or updates, contact the sAIm development team or submit an issue at https://github.com/delphijc/sam/issues
