# Build History

This document chronicles how Sam was built, from initial concept to current implementation.

---

## Origins

Sam is a fork of the original [PAI 1.0 platform](https://github.com/danielmiessler/PAI) created by Daniel Miessler, now maintained under [delphijc/sam](https://github.com/delphijc/sam). It embodies the philosophy of building AI infrastructure that serves the user, not the AI company.

### Foundational Ideas

- **Fabric Project** - Daniel Miessler's AI patterns for content processing (patterns maintained locally with manual refreshes)
- **Human 3.0** - Philosophy of AI as human augmentation
- **CLI-First Architecture** - Deterministic tools wrapped with AI

---

## Development Timeline

### Phase 1: Foundation (Epic 1)

**Goal:** Establish project structure and core visual identity.

**Achievements:**
- Monorepo structure with shared dev scripts
- "Cyberpunk" design system using Vanilla CSS
- Core layout and navigation for dashboard
- Bash-based backend architecture

**Key Decisions:**
- Chose Bun over Node.js for performance
- JSONL for persistence (simplicity over SQLite)
- Git worktrees for job isolation

### Phase 2: Task Management (Epic 1.5)

**Goal:** Implement basic task queue functionality.

**Achievements:**
- JSONL-based job queue system
- `manage_jobs.sh` for CRUD operations
- Queue monitoring with `jobs_queue_monitor.sh`
- File locking for concurrent access

### Phase 3: Dashboard (Epic 2)

**Goal:** Create React dashboard for job visualization.

**Achievements:**
- React + Vite frontend
- Real-time SSE updates
- Kanban board view
- Agent status indicators
- Job submission forms

### Phase 4: Orchestration (Epic 4)

**Goal:** Enable complex multi-agent workflows.

**Achievements:**
- Sequential task execution with dependencies
- Parallel task execution with resource management
- `ParallelGroupCard` and `ResourceMonitor` components
- Dependency graph visualization
- Error handling and rollback

### Phase 5: Code Review (Epic 5)

**Goal:** Streamline code review for AI-generated changes.

**Achievements:**
- Interactive diff viewer with syntax highlighting
- Side-by-side and unified diff modes
- Line-specific commenting
- Approval/rejection workflow
- Feedback collection mechanism

### Phase 6: Dev Tooling (Epic 6)

**Goal:** Integrated development environment tools.

**Achievements:**
- Dev server control from dashboard
- Real-time log streaming
- Virtualized log rendering
- Settings management UI
- Performance optimizations

### Phase 7: Integrations (Epic 7)

**Goal:** Connect with external platforms.

**Achievements:**
- GitHub PR creation
- Azure Repos integration
- VSCode extension scaffold
- MCP server implementation

### Phase 8: Multi-Agent System (Epic 8)

**Goal:** Full multi-agent orchestration.

**Achievements:**
- Multiple LLM backend support (Claude, Gemini, Ollama, Qwen)
- Agent delegation patterns
- Parallel agent execution
- Result synthesis

---

## Architecture Evolution

### From Simple to Complex

```
v0.1: Single script    │  v0.5: Queue system     │  v0.9: Full platform
─────────────────────  │  ──────────────────     │  ──────────────────
- Bash scripts         │  - JSONL queues         │  - Skills system
- Manual execution     │  - Queue monitor        │  - Agents system
- No UI                │  - Basic dashboard      │  - Hooks system
                       │  - Git worktrees        │  - Voice server
                       │                         │  - Multi-LLM
                       │                         │  - React dashboard
```

### Key Architectural Patterns

1. **Shell-First Design**
   - Core operations in Bash scripts
   - TypeScript for UI and hooks
   - Bun runtime for performance

2. **Skills-as-Containers**
   - Self-contained capabilities
   - Progressive context loading
   - Intent-based routing

3. **Event-Driven Automation**
   - Hooks for lifecycle events
   - Automatic history capture
   - Voice notifications

4. **JSONL Persistence**
   - Simple file-based storage
   - Line-by-line processing
   - Easy debugging and recovery

---

## Technology Choices

### Why Bun?

| Factor | Bun | Node.js |
|--------|-----|---------|
| Startup | ~25ms | ~300ms |
| TypeScript | Native | Requires build |
| Package manager | Built-in | npm/yarn |
| File operations | Fast | Standard |

### Why JSONL over SQLite?

| Factor | JSONL | SQLite |
|--------|-------|--------|
| Simplicity | One file per queue | Database setup |
| Debugging | Human readable | Requires tools |
| Concurrency | File locking | Built-in |
| Scale limit | ~10k jobs | Unlimited |

For Sam's use case (personal AI), JSONL simplicity wins.

### Why Git Worktrees?

| Approach | Pros | Cons |
|----------|------|------|
| Full clone | Complete isolation | Slow, disk heavy |
| Worktree | Fast, shared objects | Requires same repo |
| Docker | Full isolation | Complex, slow |

Worktrees provide fast isolation for AI job execution.

---

## Lessons Learned

### What Worked

1. **Progressive Disclosure** - 3-tier context loading dramatically reduced token usage
2. **Shell Scripts** - Bash for core operations proved reliable and debuggable
3. **JSONL** - Simple persistence that "just works"
4. **Hooks System** - Event-driven architecture enabled extensibility

### What Was Challenging

1. **Concurrent Access** - File locking required careful implementation
2. **Context Management** - Balancing loaded context vs. token limits
3. **Multi-LLM Support** - Different APIs required abstraction layer
4. **Voice Integration** - Async notifications and latency management

### What We'd Do Differently

1. **Earlier TypeScript** - Started with more Bash than needed
2. **Better Testing** - Unit tests from day one
3. **API Versioning** - Plan for API evolution earlier
4. **SQLite Option** - Provide migration path for scale

---

## Commit History Highlights

| Epic | Key Commits | Description |
|------|-------------|-------------|
| Epic 1 | Initial structure | Monorepo, design system |
| Epic 4 | `acdba45` | Workflow orchestration |
| Epic 4 | `dde1fc7` | Dependency graph |
| Epic 5 | `5e82ce8` | Diff viewer |
| Epic 5 | `27c28c2` | Line commenting |
| Epic 5 | `4f0a2e1` | Approval workflow |
| Epic 6 | `f3671c9` | Metrics tracking |
| Epic 7 | `2a9020f` | PR creation |
| Epic 7 | `8cda309` | PR UI |

---

## Current State

### Version 0.9.1

**Complete:**
- Skills system (28+ skills)
- Agents system (10 agents)
- Hooks system (24 hooks)
- Task runner with dashboard
- Voice server
- Multi-LLM support
- Git integration

**In Progress:**
- Platform improvements (see [Improvements Roadmap](Improvements-Roadmap.md))
- Testing coverage expansion
- Documentation completion

**Future:**
- SQLite migration option
- Cloud deployment guides
- Advanced workflow features

---

## Contributors

Sam is built on the foundation of:
- Daniel Miessler's PAI and Fabric projects
- The Claude Code platform by Anthropic
- Open-source community contributions

---

*See also: [Epic Roadmap](Epic-Roadmap.md) | [Improvements Roadmap](Improvements-Roadmap.md)*
