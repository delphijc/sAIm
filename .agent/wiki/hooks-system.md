# Hooks System

Hooks are TypeScript scripts that execute automatically at specific lifecycle events.

---

## Overview

Sam uses hooks for:
- Loading context at session start
- Capturing output automatically
- Providing voice feedback
- Security validation
- Performance monitoring

---

## Hook Types

| Hook | Trigger | Purpose |
|------|---------|---------|
| `SessionStart` | Session begins | Load CORE context |
| `SessionEnd` | Session ends | Generate summaries |
| `UserPromptSubmit` | Before processing prompt | Pre-process, update tabs |
| `PreToolUse` | Before tool execution | Security validation |
| `PostToolUse` | After tool execution | Capture output |
| `Stop` | Response complete | Voice notification |
| `SubagentStop` | Agent completes | Tracking |
| `PreCompact` | Before context compression | Save important context |

---

## Hook Configuration

Hooks are configured in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bun ${PAI_DIR}/hooks/initialize-session.ts"
      },
      {
        "type": "command",
        "command": "bun ${PAI_DIR}/hooks/load-core-context.ts"
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "bun ${PAI_DIR}/hooks/stop-hook.ts"
      }
    ],
    "PreToolUse": [
      {
        "type": "command",
        "command": "bun ${PAI_DIR}/hooks/security-validator.ts"
      }
    ]
  }
}
```

---

## Available Hooks

### Session Lifecycle

| Hook | File | Purpose |
|------|------|---------|
| `initialize-session.ts` | SessionStart | Initialize session state |
| `load-core-context.ts` | SessionStart | Load CORE skill |
| `capture-session-summary.ts` | SessionEnd | Generate session summary |
| `stop-hook.ts` | Stop | Voice notification, tab update |

### Tool Execution

| Hook | File | Purpose |
|------|------|---------|
| `security-validator.ts` | PreToolUse | Validate tool safety |
| `capture-tool-output.ts` | PostToolUse | Capture tool results |
| `capture-all-events.ts` | PostToolUse | Log all events |

### Context Management

| Hook | File | Purpose |
|------|------|---------|
| `compact-reminder.ts` | PreCompact | Remind before compaction |
| `context-compression-hook.ts` | PreCompact | Manage context |
| `load-on-demand-references.ts` | UserPromptSubmit | Load Tier 3 content |

### UI Updates

| Hook | File | Purpose |
|------|------|---------|
| `update-tab-on-action.ts` | Various | Update IDE tabs |
| `update-tab-titles.ts` | Various | Update tab titles |

### Validation

| Hook | File | Purpose |
|------|------|---------|
| `validate-protected.ts` | PreToolUse | Protect sensitive files |
| `validate-response-format.ts` | Stop | Check response format |
| `validate-docs.ts` | Various | Validate documentation |

---

## Hook Execution Flow

### Session Start

```
claude command
    │
    ▼
┌──────────────────────────┐
│ initialize-session.ts    │
│ - Create session ID      │
│ - Set up environment     │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ load-core-context.ts     │
│ - Load CORE skill        │
│ - Set up routing         │
└──────────────────────────┘
```

### Request Processing

```
User Input
    │
    ▼
┌──────────────────────────┐
│ UserPromptSubmit hooks   │
│ - Pre-process prompt     │
│ - Load references        │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ PreToolUse hooks         │
│ - Security validation    │
│ - Logging                │
└──────────┬───────────────┘
           │
           ▼
      [Tool Execution]
           │
           ▼
┌──────────────────────────┐
│ PostToolUse hooks        │
│ - Capture output         │
│ - Update observability   │
└──────────────────────────┘
```

### Response Complete

```
Response Generated
    │
    ▼
┌──────────────────────────┐
│ Stop hooks               │
│ - Voice notification     │
│ - Tab title update       │
│ - Session tracking       │
└──────────────────────────┘
```

---

## Writing Custom Hooks

### Basic Structure

```typescript
#!/usr/bin/env bun

// filepath: ~/.claude/hooks/my-hook.ts

import { resolve } from "path";

// Get PAI_DIR (with fallback)
const PAI_DIR = process.env.PAI_DIR || `${process.env.HOME}/.claude`;

// Hook logic
async function main() {
  const hookInput = process.argv[2]; // JSON input from Claude Code

  if (hookInput) {
    const data = JSON.parse(hookInput);
    // Process data...
  }

  // Output for Claude Code
  console.log(JSON.stringify({
    status: "success",
    message: "Hook executed"
  }));
}

main().catch(console.error);
```

### Hook Input

Hooks receive JSON input with context:

```json
{
  "session_id": "abc-123",
  "tool_name": "Bash",
  "tool_input": { "command": "ls" },
  "timestamp": "2026-01-29T10:00:00Z"
}
```

### Hook Output

Hooks output JSON results:

```json
{
  "status": "success",
  "message": "Processed successfully",
  "data": { ... }
}
```

---

## Path Resolution

### Using PAI_DIR

All hooks should use `${PAI_DIR}` for paths:

```typescript
const PAI_DIR = process.env.PAI_DIR || `${process.env.HOME}/.claude`;
const skillsPath = `${PAI_DIR}/skills`;
```

### Centralized Library

Use the shared library:

```typescript
import { getPAIDir, getSkillsPath } from "./lib/pai-paths";

const paiDir = getPAIDir();
const skills = getSkillsPath();
```

---

## Security Hooks

### validate-protected.ts

Prevents modification of protected files:

```typescript
const PROTECTED_FILES = [
  "SAM_CONTRACT.md",
  "README.md",
  "SECURITY.md"
];

// Check if tool targets protected file
if (PROTECTED_FILES.some(f => toolInput.path?.includes(f))) {
  return { status: "blocked", reason: "Protected file" };
}
```

### security-validator.ts

Validates tool usage for security:

```typescript
// Check for dangerous commands
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /curl.*\|.*sh/,
  /eval\s+/
];

if (DANGEROUS_PATTERNS.some(p => p.test(command))) {
  return { status: "blocked", reason: "Dangerous command" };
}
```

---

## Voice Integration

### stop-hook.ts

Triggers voice notification on response:

```typescript
// Extract completion message from response
const completedMatch = response.match(/COMPLETED:\s*(.+?)$/m);

if (completedMatch) {
  const message = completedMatch[1];

  // Send to voice server
  await fetch("http://localhost:8888/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      voice_enabled: true
    })
  });
}
```

---

## History Capture

### capture-all-events.ts

Captures events to UOCS:

```typescript
const event = {
  timestamp: new Date().toISOString(),
  session_id: sessionId,
  event_type: hookType,
  data: hookInput
};

const historyPath = `${PAI_DIR}/History/Raw-Outputs/${date}.jsonl`;
appendFileSync(historyPath, JSON.stringify(event) + "\n");
```

---

## Testing Hooks

### Self-Test

Run the self-test hook:

```bash
bun ~/.claude/hooks/self-test.ts
```

### Manual Testing

```bash
# Test with sample input
echo '{"session_id":"test"}' | bun ~/.claude/hooks/my-hook.ts
```

### Test Framework

```typescript
// test-my-hook.ts
import { describe, it, expect } from "bun:test";

describe("my-hook", () => {
  it("should process input correctly", () => {
    // Test logic
  });
});
```

---

## Troubleshooting

### Hook Not Running

1. Check settings.json configuration
2. Verify file permissions: `chmod +x hook.ts`
3. Test manually: `bun ~/.claude/hooks/hook.ts`

### PAI_DIR Errors

If seeing `__HOME__` errors:
```bash
bash ~/.claude/Tools/setup/bootstrap.sh
```

### Hook Timeouts

Hooks have timeout limits. For long operations:
- Use async processing
- Return quickly, process in background
- Check for timeout settings

---

## Best Practices

1. **Use PAI_DIR** - Never hardcode paths
2. **Handle errors** - Catch and log errors gracefully
3. **Return JSON** - Always output valid JSON
4. **Be fast** - Hooks should complete quickly
5. **Log appropriately** - Use structured logging

---

*See also: [Architecture](Architecture.md) | [Configuration](Configuration.md)*
