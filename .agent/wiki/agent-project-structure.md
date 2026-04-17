# .agent Directory Structure

> Complete documentation of the `.agent` directory in Sam PAI infrastructure

---

## Overview

The `.agent` directory is the operational core of the Sam PAI (Personal AI Infrastructure) system. It contains all runtime configuration, skills, agents, hooks, tools, and persistent storage for the AI assistant ecosystem.

```
.agent/
├── agents/           # Custom agent definitions
├── cache/            # Runtime caching
├── config/           # Configuration files
├── debug/            # Debug output and logs
├── docs/             # Project documentation
├── file-history/     # File change tracking
├── git/              # Git-related artifacts
├── History/          # Session and research history
├── hooks/            # Claude Code lifecycle hooks
├── ide/              # IDE integration state
├── plans/            # Implementation plans
├── plugins/          # Plugin configurations
├── projects/         # Multi-project state
├── Recordings/       # Audio recordings
├── rules/            # Custom rules and constraints
├── Scratchpad/       # Temporary test files
├── scripts/          # Utility shell scripts
├── session-env/      # Per-session environment state
├── settings.json     # Global PAI settings
├── shell-snapshots/  # Shell state snapshots
├── skills/           # Custom skill definitions (28+)
├── statsig/          # Feature flag configuration
├── telemetry/        # Usage telemetry
├── todos/            # Todo list persistence
├── Tools/            # CLI tools and utilities
├── voice-server/     # Text-to-speech server
├── workflows/        # Workflow definitions
└── [config files]    # Various configuration
```

---

## Core Directories

### agents/

Custom agent definitions for specialized AI personas.

```
agents/
├── Architect/          # Software architecture specialist
├── claude-researcher/   # Claude-based web research
├── Designer/           # UX/UI design expert
├── Engineer/           # Software engineering specialist
├── gemini-researcher/   # Gemini-based research
├── Investor/           # Financial analysis expert
├── Pentester/          # Security testing specialist
├── perplexity-researcher/ # Perplexity-based research
├── personal-health-coach/ # Health and wellness advisor
└── Researcher/         # General research agent
```

**Structure per agent**:
```
AgentName/
├── AGENT.md           # Agent definition and prompt
└── Reference.md       # Extended context (optional)
```

**Purpose**: Agents are spawned via the Task tool with `subagent_type` parameter. Each agent has specialized tools and capabilities.

---

### skills/

Custom skill definitions for Claude Code. Skills are invokable via `/skillname` command.

```
skills/
├── aggregate-transcriptions/  # Audio transcription aggregation
├── alex-hormozi-pitch/         # Pitch creation methodology
├── Art/                      # Visual content generation
├── bright-data/               # Web scraping with fallback
├── CORE/                     # System identity and core config
├── create-agent/              # Agent creation framework
├── create-cli/                # CLI generation tool
├── create-skill/              # Skill creation framework
├── Fabric/                   # 248 pattern execution engine
├── ffuf/                     # Web fuzzing guidance
├── Investor/                 # Financial research
├── Observability/            # Multi-agent monitoring
├── open-file/                 # File opener utility
├── PackBrowse/               # PAI pack browser
├── PackInstall/              # PAI pack installer
├── Paiupdate/                # PAI update system
├── Prompting/                # Prompt engineering standards
├── read-aloud/                # Voice file reading
├── read-daily-devotion/        # Daily devotion reader
├── Research/                 # Multi-source research
├── start-up/                  # Service lifecycle management
├── story-explanation/         # Narrative summary creation
├── transcribe-audio/          # Audio transcription
├── architect/                # Architecture planning
├── audit-committer/          # Git audit trail
├── phase-checkpoint/         # Phase verification
├── stack-broker/             # Data persistence broker
└── tdd-manager/              # TDD workflow enforcement
```

**Structure per skill**:
```
SkillName/
├── SKILL.md           # Main skill definition (Tier 1)
├── Reference.md       # Extended documentation (Tier 2)
├── tools/             # Skill-specific tools/patterns
└── [other resources]
```

---

### hooks/

Claude Code lifecycle hooks - TypeScript scripts that execute at specific events.

```
hooks/
├── capture-all-events.ts          # Event logging
├── capture-session-summary.ts     # Session summarization
├── capture-tool-output.ts         # Tool output capture
├── compact-reminder.ts            # Context compaction reminders
├── context-compression-hook.ts    # Context management
├── initialize-session.ts          # Session startup
├── lib/                           # Shared hook utilities
├── load-core-context.ts           # CORE skill loader
├── load-dynamic-requirements.ts   # Dynamic context loading
├── load-on-demand-references.ts   # Lazy reference loading
├── pre-commit.template            # Git pre-commit template
├── pre-commit-with-docs.template  # Pre-commit with docs
├── security-validator.ts          # Security validation
├── self-test.ts                   # Hook self-testing
├── stop-hook.ts                   # Session end handling
├── subagent-stop-hook.ts          # Subagent cleanup
├── test-progressive-loader.ts     # Progressive disclosure test
├── update-documentation.ts        # Doc auto-update
├── update-tab-on-action.ts        # IDE tab updates
├── update-tab-titles.ts           # Tab title management
├── validate-docs.ts               # Documentation validation
├── validate-protected.ts          # Protected file validation
└── validate-response-format.ts    # Response format check
```

**Hook Types**:
- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool execution
- `Stop` - Session end
- `Notification` - Event notifications

---

### voice-server/

Text-to-speech server for audible responses.

```
voice-server/
├── PROVIDER_CONFIGURATION.md  # TTS provider setup
├── QUICKSTART.md              # Quick start guide
├── README.md                  # Full documentation
├── install.sh                 # Installation script
├── logs/                      # Server logs
├── macos-service/             # macOS service config
├── menubar/                   # Menu bar integration
├── python-sidecar/            # Python TTS sidecar
├── restart.sh                 # Restart script
├── run-server.sh              # Server runner
├── server.ts                  # Main server (Bun)
├── sounds/                    # Sound effects
├── start.sh                   # Start script
├── status.sh                  # Status checker
├── stop.sh                    # Stop script
├── troubleshoot.sh            # Troubleshooting
├── uninstall.sh               # Uninstallation
└── voices.json                # Voice configuration
```

**Endpoint**: `http://localhost:8888/notify`

**Usage**:
```bash
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello from Sam","voice_enabled":true}'
```

---

### Tools/

CLI utilities and helper scripts.

```
Tools/
├── SkillWorkflowNotification  # Workflow notification script
├── VoiceNotify                # Voice notification shortcut
├── context-monitor.ts         # Context usage monitor
├── mcp-profile-switch.ts      # MCP profile switcher
├── performance-benchmark.ts   # Performance testing
├── setup/                     # Setup utilities
├── skill-refactor.ts          # Skill refactoring tool
└── voice-notification-background.sh  # Background voice
```

---

### History/

Session history and research archives.

```
History/
├── Decisions/         # Key decision records
├── Execution/         # Execution logs
├── Learnings/         # Captured learnings
├── Raw-Outputs/       # Raw LLM outputs
├── Reference/         # Reference materials
├── Research/          # Research outputs
├── Sessions/          # Session transcripts
├── TranscribedAudio/  # Transcribed recordings
├── backups/           # Backup archives
└── security/          # Security-related history
```

**Purpose**: Long-term storage of valuable session outputs, research findings, and decision records.

---

### scripts/

Utility scripts for project management.

```
scripts/
├── enforce_workflow.sh    # Workflow enforcement
├── find_plan_md.sh        # Plan file finder
├── manage_tasks.sh        # Task management
├── merge-coverage.ts      # Coverage merging
├── resource_manager.sh    # Resource management
├── setup_dev_env.sh       # Development setup
└── state_syncer.sh        # State synchronization
```

---

## Configuration Files

### settings.json

Global PAI settings including:
- LLM backend configuration
- Voice server settings
- Feature flags
- User preferences

### config.json

Core configuration:
- Project paths
- API endpoints
- Resource limits

### .env / .env.example

Environment variables:
- API keys (Anthropic, OpenAI, Google)
- Service endpoints
- Feature toggles

### .mcp.json

Model Context Protocol configuration:
- MCP server definitions
- Tool registrations
- Protocol settings

### antigravity.config.json

Skill and workflow configuration:
- Registered skills
- Workflow definitions
- Routing rules

---

## Data Storage

### JSONL Files (Task Runner)

```
jobs.jsonl       # Pending job queue
todo.jsonl       # Todo items
done.jsonl       # Completed jobs
failed.jsonl     # Failed jobs
```

**Format**:
```json
{"job_id":"uuid","agent":"analyst","status":"pending","prompt":"...","created_at":"..."}
```

### Session State

```
session-env/
└── {session-id}/
    ├── env.json           # Session environment
    ├── context.json       # Context state
    └── history.json       # Session history
```

### Debug Output

```
debug/
└── {uuid}.txt             # Debug traces
```

### Todos

```
todos/
└── {agent-id}.json        # Per-agent todo lists
```

---

## Multi-Project Support

```
projects/
└── {project-path-encoded}/
    ├── state.md           # Project state
    ├── plan.md            # Project plan
    └── docs/              # Project documentation
```

**Path Encoding**: Full paths with `/` replaced by `-`

Example: `/Users/foo/Projects/bar` becomes `-Users-foo-Projects-bar`

---

## Key Artifacts

### state.md

Project blackboard for:
- Current focus
- Active tasks
- Blockers
- Decisions

### plan.md

Project implementation plan:
- Epics and stories
- Task status (`[ ]`, `[~]`, `[x]`)
- Commit hashes

### history.jsonl

Session history with:
- User messages
- Assistant responses
- Tool calls
- Timestamps

---

## Runtime Directories

### cache/

Runtime caching for:
- API responses
- Computed results
- Temporary data

### shell-snapshots/

Shell state preservation:
- Working directory
- Environment variables
- Active processes

### statsig/

Feature flag state from Statsig service.

### telemetry/

Usage telemetry (opt-in):
- Feature usage
- Error rates
- Performance metrics

---

## Integration Points

### IDE Integration (ide/)

VS Code integration state:
- Open files
- Active selections
- Editor state

### Git Integration (git/)

Git-related artifacts:
- Hook configurations
- Commit templates
- Worktree state

### Plugin System (plugins/)

Plugin configurations for extensibility.

---

## File Naming Conventions

| Pattern | Description |
|---------|-------------|
| `*.jsonl` | Newline-delimited JSON (logs, queues) |
| `*.md` | Markdown documentation |
| `*.ts` | TypeScript scripts/hooks |
| `*.sh` | Shell scripts |
| `*.json` | Configuration files |
| `SKILL.md` | Main skill definition |
| `AGENT.md` | Main agent definition |
| `Reference.md` | Extended documentation |

---

## Access Patterns

### Read Operations

```bash
# Read settings
cat .agent/settings.json | jq .

# Read skill definition
cat .agent/skills/SkillName/SKILL.md
```

### Write Operations

**Important**: Use shell brokers for JSONL writes:

```bash
# Add job (via broker)
./manage_jobs.sh append pending "$job_json"

# Update state (via broker)
./state_syncer.sh update
```

---

## Security Considerations

1. **API Keys**: Stored in `.env`, never committed
2. **Session Data**: Per-session isolation
3. **Protected Files**: Validated by `validate-protected.ts`
4. **Audit Trail**: Git notes via `audit-committer`

---

## Maintenance

### Cleanup

```bash
# Clean debug files
rm -rf .agent/debug/*.txt

# Clean old sessions
rm -rf .agent/session-env/*

# Clean todo artifacts
rm -rf .agent/todos/*.json
```

### Backup

```bash
# Backup history
tar -czf history-backup.tar.gz .agent/History/

# Backup settings
cp .agent/settings.json .agent/settings.json.bak
```

---

## Quick Reference

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `agents/` | Custom agent definitions | `AGENT.md` |
| `skills/` | Skill definitions | `SKILL.md`, `Reference.md` |
| `hooks/` | Lifecycle hooks | `*.ts` |
| `voice-server/` | TTS server | `server.ts` |
| `History/` | Session archives | `*.md` |
| `Tools/` | CLI utilities | `*.ts`, `*.sh` |
| `scripts/` | Project scripts | `*.sh` |

---

*Last updated: 2026-01-29*
*Directory count: 50+*
*Total patterns: 248 (Fabric)*
*Skills: 28*
*Agents: 10*
