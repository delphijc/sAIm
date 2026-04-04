# Discord Plugin System

The Discord Remote Control service uses a plugin architecture that allows message handlers to be added without modifying the core bot logic. Plugins get first crack at incoming messages before the default Claude subprocess handler.

## Architecture

```
Message Received
    |
    v
PluginRegistry.tryHandle()
    |
    +--> Plugin 1 (priority 10): canHandle()? --> handle()
    +--> Plugin 2 (priority 20): canHandle()? --> handle()
    +--> Plugin 3 (priority 30): canHandle()? --> handle()
    |
    v (no plugin handled it)
Default Claude Subprocess Handler
```

## Key Files

| File | Purpose |
|------|---------|
| `plugins/types.ts` | `Plugin`, `PluginResult`, `DiscordConfig`, `MessageContext` interfaces |
| `plugins/registry.ts` | Singleton `PluginRegistry` — manages lifecycle, discovery, dispatch |
| `plugins/loader.ts` | Auto-imports and registers all plugins at startup |

## Plugin Interface

Every plugin must implement:

```typescript
interface Plugin {
  name: string;           // Unique identifier
  description: string;    // Human-readable description
  version: string;        // Semver
  priority: number;       // Lower = checked first (0-49 core, 50-99 user, 1000 default)

  canHandle(message, context): boolean;    // Fast check, no I/O
  handle(message, config, context): Promise<PluginResult>;  // Do the work
  onLoad?(): Promise<void>;    // Called once at startup
  onUnload?(): Promise<void>;  // Called on shutdown
}
```

## Creating a New Plugin

1. Create a directory under `plugins/<name>/`
2. Create `index.ts` that default-exports a `Plugin` object
3. Import and register it in `plugins/loader.ts`

## Registered Plugins

| Plugin | Trigger | Priority | Description | Wiki |
|--------|---------|----------|-------------|------|
| **wizard** | `!wizard` | 10 | Conversational project planning with 4 persona interviews | [wizard-plugin](wizard-plugin.md) |
| **export** | `!export` / `/export` | 15 | Export conversation history as JSON, Markdown, or HTML | [export-plugin](export-plugin.md) |
| **doc-gen** | `!doc` | 20 | Generate DOCX and PPTX documents from markdown | [doc-gen-plugin](doc-gen-plugin.md) |
| **notebooklm** | `!nlm` / `!notebook` | 30 | Google NotebookLM integration via nlm CLI | [notebooklm-plugin](notebooklm-plugin.md) |

The export plugin also includes a built-in **analyze** submodule (`!analyze`) for conversation analytics — topic detection, sentiment analysis, helpful response ranking, and token efficiency metrics. See [analyze-plugin](analyze-plugin.md).

## Message Context

The `MessageContext` object passed to plugins includes:

- `isDM` — whether the message is a DM
- `messageType` — `"text"`, `"image"`, `"file"`, `"voice"`, or `"mixed"`
- `hasAttachments` / `attachmentCount`
- `contentPreview` — truncated message content

## Session Model

Several plugins (wizard, doc-gen) use a per-user session model where:
- Starting a command creates a session for that user
- Subsequent messages are routed to the active session
- A "done" or "cancel" command ends the session
- Only one session per user at a time

This allows multi-message workflows through Discord's single-message interface.
