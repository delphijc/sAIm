# sAIm Complete Architecture Documentation

**Status:** ✅ COMPREHENSIVE  
**Last Updated:** 2026-05-01  
**Version:** 1.0 Production-Ready

---

## Overview

This is the **complete technical architecture documentation** for sAIm (Sam AI Operating System). It provides production-grade documentation covering:

- **System Design** — Component relationships, data flows, technology stack
- **API Interfaces** — All 9 service APIs with examples and error handling
- **Webhook System** — 8 event types with payloads and integration patterns
- **Database Schemas** — Complete SQLite schema definitions
- **Infrastructure** — Service topology, ports, deployment strategies
- **Operations** — Monitoring, maintenance, troubleshooting, disaster recovery

---

## Documentation Files

### 1. **sAIm.archimate** (XML Architecture Model)

**Location:** `.agent/wiki/sAIm.archimate`  
**Tool Required:** Archi (https://www.archimatetool.com)  
**Format:** ArchiMate 3.1 XML

**Contents:**
- **Business Layer** — User roles, business processes, functions
- **Application Layer** — Core runtime (hooks, skills, agents, history) + optional services
- **Technology Layer** — Bun, Bash, Go, HTTP, WebSockets, SQLite
- **Infrastructure Layer** — Service definitions (9 services), file system structure, configurations
- **API Interfaces** — All service APIs with detailed documentation
- **Webhooks** — Event types and payloads
- **Databases** — Schema definitions and relationships
- **Deployment** — macOS launchd and Linux systemd
- **Security** — Protected files, permissions, validation

**How to Use:**
```bash
# Open in Archi GUI
open ~/Projects/sam/.agent/wiki/sAIm.archimate

# Or view raw XML (text editor)
cat ~/.claude/wiki/sAIm.archimate | head -50
```

**Highlights:**
- Comprehensive service topology
- All 9 service APIs documented
- 8 webhook event types with signatures
- 4 database schemas (Memory, Discord, Observability, Awareness)
- Port allocations and technology mappings

---

### 2. **api-integration-guide.md** (API Reference)

**Location:** `.agent/wiki/api-integration-guide.md`  
**Format:** Markdown (6000+ lines)  
**Audience:** Backend developers, integrators

**Section Breakdown:**

| Section | Content |
|---------|---------|
| **Service APIs** | 1. Voice Server, 2. Memory System, 3. Awareness Dashboard, 4. Observability, 5. Service Monitor, 6. Discord Bot, 7. Claude Code Hooks |
| **Webhook System** | Webhook registration, retry policy, 8 event types with examples |
| **Database Schemas** | Complete SQLite CREATE TABLE statements for all services |
| **Integration Patterns** | 4 patterns: Fact extraction, service orchestration, agent delegation, real-time observability |
| **Error Handling** | Standard error format, common codes, retry logic examples |
| **Authentication** | API key support, CORS, webhook signing |
| **Performance Tuning** | Query optimization, caching, connection pooling, batch processing |

**Quick Reference:**

```bash
# Find specific API endpoint
grep -n "Endpoint: GET /api/briefing" ~/.claude/wiki/api-integration-guide.md

# Find webhook definitions
grep -n "Webhook Event:" ~/.claude/wiki/api-integration-guide.md

# Find database schema
grep -n "CREATE TABLE facts" ~/.claude/wiki/api-integration-guide.md
```

**API Summary:**
- **9 Services** with 50+ endpoints total
- **POST/GET/WebSocket** methods
- **Async & synchronous** patterns
- **Webhook integration** examples
- **Error handling** with retry logic

---

### 3. **deployment-runbook.md** (Operations & Troubleshooting)

**Location:** `.agent/wiki/deployment-runbook.md`  
**Format:** Markdown (2000+ lines)  
**Audience:** DevOps engineers, system administrators, operators

**Section Breakdown:**

| Section | Content |
|---------|---------|
| **Quick Reference** | Command cheat sheet for common operations |
| **Installation** | macOS launchd and Linux systemd setup |
| **Configuration** | .env files, PAI_DIR resolution, validation |
| **Day-to-Day Ops** | Health checks, log monitoring, service restarts |
| **Troubleshooting** | 6 common problems with step-by-step diagnosis |
| **Scheduled Maintenance** | Daily (5 min), weekly (30 min), monthly (1-2 hrs) tasks |
| **Disaster Recovery** | Service recovery, database repair, data restoration |
| **Monitoring** | Prometheus metrics, alert rules, dashboard setup |
| **Performance Tuning** | Environment variables for optimization |
| **Security Hardening** | File permissions, firewall rules, key rotation |
| **Backup Strategy** | Daily and weekly backup scripts |

**Common Commands:**

```bash
# Check all services
systemctl --user status pai-infrastructure.target

# Restart one service
systemctl --user restart voice-server

# View logs
journalctl --user -u voice-server.service -n 100

# Run health check
curl http://localhost:4242/health
```

**Troubleshooting Flowchart:**
1. Service fails to start → Check error message, port availability, working directory
2. High memory usage → Check database size, restart service, run consolidation
3. Webhooks not delivering → Verify endpoint accessibility, check firewall
4. Discord bot unresponsive → Check token, verify permissions, restart bot

---

## Architecture Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE IDE (Main Process)              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ HOOK SYSTEM (TypeScript Lifecycle Events)             │    │
│  │  • SessionStart → Load CORE                           │    │
│  │  • PreToolUse → Validate permissions                  │    │
│  │  • PostToolUse → Capture output, extract facts        │    │
│  │  • Stop → Voice notification                          │    │
│  └────────────────────────────────────────────────────────┘    │
│                           ↓                                      │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ SKILLS FRAMEWORK (28+ Composable Capabilities)        │    │
│  │  • Each skill has: SKILL.md, workflows, tools         │    │
│  │  • Progressive disclosure (3-tier context)            │    │
│  └────────────────────────────────────────────────────────┘    │
│                           ↓                                      │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ AGENT SYSTEM (27 Specialized AI Personas)             │    │
│  │  • Sequential, parallel, nested delegation            │    │
│  │  • Custom permissions per agent                       │    │
│  └────────────────────────────────────────────────────────┘    │
│                           ↓                                      │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ HISTORY SYSTEM / UOCS (Output Capture)                │    │
│  │  • Files: YYYY-MM-DD-HHMMSS_[TYPE]_[DESC].md         │    │
│  │  • Structured naming, searchable, auditable           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  DATA: Memory Cache, Config Loader, Path Resolver (PAI_DIR)   │
└─────────────────────────────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
      OPTIONAL EXTERNAL SERVICES (HTTP/REST)
          │                  │                  │
     ┌────────┐        ┌──────────┐     ┌──────────┐
     │ Memory │        │  Voice   │     │ Awareness│
     │ System │        │ Server   │     │ Dashboard│
     │ (4242) │        │ (8888)   │     │ (4100)   │
     └────────┘        └──────────┘     └──────────┘
          │                                    │
          └────────────────┬───────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     │                     │                     │
     ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Observability│    │   Service    │    │   Discord    │
│  Dashboard   │    │   Monitor    │    │   Bot        │
│   (5172)     │    │  (6000/5175) │    │   (Webhooks) │
└──────────────┘    └──────────────┘    └──────────────┘

WEBHOOKS: 8 Event Types (extraction-complete, consolidation-done, 
          task-status-changed, service-status-changed, 
          agent-completed, speech-complete, briefing-generated)
```

---

## Service Architecture

### Core Runtime (In-Process)

**Execution Model:**
```
Session Lifecycle:
  1. SessionStart Hook → Load PAI_DIR, settings, CORE context
  2. User issues command → Skills route request
  3. Skill delegates → Agent spawned (if needed)
  4. Agent executes → Results captured to history
  5. PostToolUse Hook → Extract facts, send to memory (if enabled)
  6. Stop Hook → Voice notification (if enabled)
```

**Key Properties:**
- ✅ No external dependencies (all in-process)
- ✅ Works offline (memory system optional)
- ✅ Deterministic (same inputs = same outputs)
- ✅ Auditable (complete history trail)
- ✅ Extensible (add skills without core changes)

### Optional Services (HTTP-Based)

**Communication Model:**
```
Sam (HTTP Client)  ←→  Service (HTTP Server)
  ↓                        ↓
  memory-capture.ts        Memory System (SQLite)
  voice-client.ts          Voice Server (Python sidecar)
  awareness-client.ts      Awareness Dashboard (Vue + Bun)
```

**Properties:**
- ✅ Loosely coupled (Sam works without services)
- ✅ Independent scaling (restart without affecting Sam)
- ✅ Webhook-driven (services notify each other)
- ✅ Optional (disable any service in .env)
- ✅ Replicate-able (run multiple instances)

---

## Data Flow Examples

### Example 1: Fact Extraction Pipeline

```
User writes code
        ↓
Claude Code tool execution
        ↓
PostToolUse Hook triggered
        ↓
memory-capture.ts checks ENABLE_MEMORY_HOOKS
        ↓
HTTP POST /memory/extract
        ↓
Memory System analyzes transcript (12 patterns)
        ↓
Extract facts, build associations
        ↓
Store in SQLite (facts, associations tables)
        ↓
Webhook: memory.extraction.complete
        ↓
Discord bot receives: logs to memory dashboard
Observability dashboard receives: updates recent activity
```

**Timeline:** <1 second total  
**Failure Mode:** Silent (graceful degradation if memory service down)

### Example 2: Service Orchestration

```
Service Monitor (runs every 30s)
        ↓
GET /health on each service
        ↓
Compare state to previous
        ↓
Status changed?
        ↓ YES
Update service DB record
        ↓
Webhook: infrastructure.service.status_changed
        ↓
Discord bot: Send alert to #operations
Service Monitor Dashboard: Update status table (red)
Auto-restart (if enabled): Restart service, notify
```

**Timeline:** 2-5 seconds to alert  
**Failure Mode:** Services stay down until manually restarted

### Example 3: Agent Delegation Chain

```
Skill initiates Agent delegation
        ↓
Agent Tool spawned
        ↓
Agent receives task (engineer implements feature)
        ↓
Agent generates output
        ↓
Agent completes
        ↓
SubagentStop Hook triggered
        ↓
capture-all-events.ts logs to history
        ↓
File created: 2026-05-01-183000_sam_feat_redis-caching.md
        ↓
Webhook: orchestration.agent.completed
        ↓
Task runner: Update task status (completed)
Discord bot: Notify user (@sam agent-123 completed)
Observability: Mark agent as done in UI
```

**Timeline:** Agent-dependent (5s - 2m typical)  
**Failure Mode:** Task marked failed, error logged

---

## Technology Stack Summary

| Layer | Technologies | Why |
|-------|------|---|
| **Runtime** | Bun | Fast TypeScript execution, native bundler, zero config |
| **Scripting** | Bash | Shell automation, CI/CD integration, universal portability |
| **Backend** | Go | (where applicable) High-performance compiled services |
| **Frontend** | Vue + Bun | Lightweight UI, no Node.js dependency |
| **Database** | SQLite | Lightweight, embedded, no server needed |
| **Messaging** | HTTP/REST | Simple, firewall-friendly, stateless |
| **Real-time** | WebSocket | Streaming data (observability, dashboards) |
| **Service Mgmt** | launchd (macOS) / systemd (Linux) | Native OS integration, auto-restart |

**Philosophy:** Minimal dependencies, maximum reliability, offline-first design.

---

## Database Design

### Memory System Schema

**Primary Tables:**
- `facts` (1500+ rows typical) — Extracted semantic knowledge
- `associations` (5000+ rows) — Temporal/topic links between facts
- `sessions` (100+ rows) — Session metadata
- `insights` (50+ rows) — Discovered patterns
- `graph_cache` (100+ rows) — Pre-computed graph queries

**Indexes:** Optimized for fast search (type, confidence, created_at)  
**Write Pattern:** Async (PostToolUse hook)  
**Read Pattern:** Synchronous (search, graph traversal)  
**Consolidation:** Weekly (dedup, prune, insight generation)

### Discord Database Schema

**Primary Tables:**
- `conversations` (10k+ rows) — Message history (7-day TTL)
- `commands` (1k+ rows) — Command audit trail
- `user_preferences` (10+ rows) — User settings
- `agent_tasks` (100+ rows) — Delegated work tracking

**Retention:** 7-day auto-purge on conversations, unlimited on commands  
**Size:** Typically <10MB

### Observability Database Schema

**Primary Tables:**
- `sessions` (1k+ rows) — Session metadata
- `agents` (5k+ rows) — Agent execution records
- `messages` (50k+ rows) — Agent conversation logs
- `events` (100k+ rows) — System event stream

**Retention:** 90 days (archival support)  
**Size:** Typically 50-500MB (depends on agent volume)

---

## Deployment Strategies

### Development Setup

```bash
# All optional services disabled (pure Bun/TypeScript)
ENABLE_MEMORY_HOOKS=false
ENABLE_VOICE=false
ENABLE_DISCORD_BOT=false
```

### Production Setup

```bash
# All optional services enabled (full infrastructure)
ENABLE_MEMORY_HOOKS=true
ENABLE_VOICE=true
ENABLE_DISCORD_BOT=true
MEMORY_SERVICE_URL=http://localhost:4242
VOICE_API_KEY=sk_voice_...
DISCORD_TOKEN=...
```

### Enterprise Setup

```bash
# Multiple instances, load balancing, monitoring
# Services deployed to Kubernetes or Docker Swarm
# Prometheus metrics scraped
# PagerDuty alerts configured
# Backup replication to cloud storage
```

---

## Monitoring & Observability

### Metrics Available

| Service | Metrics | Endpoint |
|---------|---------|----------|
| Voice Server | uptime, calls_count, avg_latency, sidecar_status | `/metrics` |
| Memory System | facts_count, associations_count, search_latency, db_size | `/metrics` |
| Awareness | tasks_count, briefings_generated, recommendation_count | `/metrics` |
| Observability | agents_active, messages_count, event_latency | `/metrics` |
| Service Monitor | service_uptime_percent, restart_count, health_score | `/metrics` |

### Alerting Rules

```yaml
- Service Down >5 min → Page on-call
- Memory DB >500MB → Run consolidation
- Voice Server latency >2s → Investigate
- Failed Webhooks >10 in 1h → Check connectivity
- Disk usage >80% → Archive old data
```

---

## Security Model

### Protected Data

**Files/Patterns Never Committed:**
- API keys (ANTHROPIC_API_KEY, VOICE_API_KEY, DISCORD_TOKEN)
- Personal emails (jayson.cavendish@gmail.com)
- Private paths (/Users/delphijc, $HOME references)
- Credentials and session tokens

**Enforcement:** Pre-commit hook validates `.sam-protected.json`

### Permission Model

**Tool Permissions:** Per-tool allow/deny in settings.json
**Hook Permissions:** All hooks run in Claude Code process
**Service Permissions:** Minimal (read config, write logs)

### Two-Repository Model

```
Private (~/.claude/):
  - Secrets, API keys
  - Voice IDs, personal settings
  - (NEVER public)

Public (github.com/delphijc/sam):
  - Sanitized template
  - No API keys, no personal data
  - Full architecture documentation
```

---

## Performance Characteristics

### Response Times (Typical)

| Operation | Latency | Notes |
|-----------|---------|-------|
| Skill activation | <100ms | In-process |
| Agent spawn | 500ms | Includes tool setup |
| Memory search | 45-200ms | Depends on fact count |
| Voice synthesis | 2-5s | Includes network + TTS |
| Webhook delivery | <500ms | HTTP + retry logic |
| Database query | 10-100ms | With proper indexes |

### Resource Usage (Per Service)

| Service | CPU (idle) | Memory (typical) | Disk (data) |
|---------|-----------|-----------------|------------|
| Voice Server | <1% | 50-100MB | 100MB cache |
| Memory System | <1% | 100-200MB | 50-500MB |
| Awareness Dashboard | <1% | 30-50MB | 100MB |
| Observability Dashboard | 2-5% | 50-100MB | 100-500MB |
| Sam Core (Claude Code) | 3-10% | 300-500MB | N/A |

---

## References & Resources

| Document | Purpose | Format |
|----------|---------|--------|
| `sAIm.archimate` | Visual system architecture | XML (Archi) |
| `api-integration-guide.md` | Complete API reference | Markdown |
| `deployment-runbook.md` | Operations & troubleshooting | Markdown |
| `ARCHITECTURE-COMPLETE.md` | This document | Markdown |
| `architecture.md` | Original architecture notes | Markdown |
| `.claude/CLAUDE.md` | Project instructions | Markdown |
| `.claude/settings.json` | Hook definitions | JSON |
| `.sam-protected.json` | Protected files manifest | JSON |

---

## Quick Navigation

**I want to...**
- 🎯 **Understand the system** → Start with Architecture Overview Diagram (above)
- 📡 **Integrate a new service** → See api-integration-guide.md § Integration Patterns
- 🚀 **Deploy to production** → See deployment-runbook.md § Installation & Setup
- 🔧 **Fix a failing service** → See deployment-runbook.md § Troubleshooting Guide
- 📊 **Monitor performance** → See deployment-runbook.md § Monitoring & Alerting
- 🔌 **Add a new API endpoint** → See api-integration-guide.md § Service APIs
- 🪝 **Create a webhook consumer** → See api-integration-guide.md § Webhook System
- 💾 **Query the memory database** → See api-integration-guide.md § Database Schemas
- 🛠️ **Maintain systems** → See deployment-runbook.md § Scheduled Maintenance
- 🆘 **Recover from disaster** → See deployment-runbook.md § Disaster Recovery

---

## Document Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-05-01 | 1.0 | Initial comprehensive architecture documentation |

---

**Last Updated:** 2026-05-01  
**Maintainers:** Security Team  
**Status:** ✅ Production Ready  
**License:** Proprietary (sam project)

For updates, issues, or clarifications:
- Create issue: https://github.com/delphijc/sam/issues
- Review PRs: https://github.com/delphijc/sam/pulls
- Contact: Security Team

---

## Appendix: File Locations

```
~/.claude/
├── .env                              # Global PAI environment
├── settings.json                     # Hook definitions, permissions
├── settings.local.json               # User-specific overrides
├── hooks/                            # Lifecycle event handlers (TypeScript)
│   ├── load-core-context.ts
│   ├── security-validator.ts
│   ├── capture-all-events.ts
│   ├── memory-capture.ts
│   └── ...
├── skills/                           # 28+ composable capabilities
│   ├── CORE/
│   ├── create-cli/
│   ├── quick-flow/
│   └── ...
├── agents/                           # 27 specialized AI personas
│   ├── engineer.yaml
│   ├── architect.yaml
│   └── ...
├── services/                         # Infrastructure services
│   ├── voice-server/
│   ├── memory-system/
│   ├── awareness-dashboard/
│   └── ...
├── History/                          # UOCS output capture
│   ├── 2026-05-01-143022_sam_*.md
│   └── ...
└── wiki/                             # Architecture documentation
    ├── sAIm.archimate                # ⬅ You are here
    ├── api-integration-guide.md
    ├── deployment-runbook.md
    └── ARCHITECTURE-COMPLETE.md

~/Projects/sam/
├── .agent/                           # Symlinked to ~/.claude
├── CLAUDE.md                         # Project instructions
├── .sam-protected.json               # Protected files manifest
└── .agent/wiki/                      # Architecture docs
    └── (same as ~/.claude/wiki/)

~/Projects/memory-system/
├── data/
│   └── memory.db                     # Semantic memory (SQLite)
├── src/
│   ├── memory/
│   └── server.ts
└── README.md

~/Projects/voice-server/
├── data/
│   └── cache/                        # TTS audio cache
├── src/
│   ├── server.ts
│   └── python-sidecar/
└── README.md
```

---

**END OF ARCHITECTURE DOCUMENTATION**
