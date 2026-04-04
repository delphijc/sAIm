# NotebookLM Plugin (`!nlm`)

Discord integration for Google NotebookLM via the [`nlm` CLI tool](https://github.com/tmc/nlm). Provides notebook management, source ingestion, note creation, audio overview generation, and AI-powered chat — all from Discord.

## Prerequisites

- **nlm CLI** must be installed and in PATH (Go binary from `github.com/tmc/nlm`)
- **One-time browser auth** required: run `nlm` in a terminal to complete Google login

## Commands

### Notebook Management
| Command | Description |
|---------|-------------|
| `!nlm list` | List all notebooks |
| `!nlm create "Title"` | Create a new notebook |
| `!nlm delete <id>` | Delete a notebook |
| `!nlm use <id>` | Set active notebook (shorthand for all commands) |
| `!nlm status` | Show current active notebook |

### Sources
| Command | Description |
|---------|-------------|
| `!nlm sources [id]` | List sources in a notebook |
| `!nlm add [id] <url-or-text>` | Add a URL or text as a source |
| `!nlm add [id]` + file attachment | Upload a file as a source |

### Notes
| Command | Description |
|---------|-------------|
| `!nlm notes [id]` | List notes in a notebook |
| `!nlm note [id] "Title" [content]` | Create a new note |

### Audio Overviews
| Command | Description |
|---------|-------------|
| `!nlm audio create [id] [instructions]` | Generate an audio overview |
| `!nlm audio list [id]` | List audio overviews |
| `!nlm audio download <audio-id>` | Download audio and upload to Discord |

### AI Generation
| Command | Description |
|---------|-------------|
| `!nlm chat [id] <prompt>` | Chat with notebook content |
| `!nlm guide [id]` | Generate a notebook study guide |
| `!nlm outline [id]` | Generate a content outline |

## Active Notebook

Set an active notebook with `!nlm use <id>` to omit the ID from most commands. The `[id]` parameter in commands above is optional when an active notebook is set.

Active notebooks are tracked per-user and persist for the session lifetime (cleared on service restart).

## Trigger Aliases

Both `!nlm` and `!notebook` are accepted as command prefixes.

## Error Handling

- **Authentication errors**: directs user to run `nlm` in a terminal for browser login
- **nlm not found**: warns that the CLI needs to be installed
- **Output truncation**: long outputs are truncated to fit Discord's 2000-character limit

## Files

| File | Purpose |
|------|---------|
| `plugins/notebooklm/index.ts` | Full plugin — CLI runner, command routing, file handling |

## Architecture

The plugin shells out to the `nlm` binary using `Bun.spawn()` for each command. This keeps the integration stateless and delegates all NotebookLM API complexity to the Go CLI. File attachments are downloaded to `/tmp`, passed to nlm, then cleaned up.
