# Export Plugin (`!export`)

Exports conversation history from Sam's SQLite memory database to JSON, Markdown, or HTML formats. Supports configurable date ranges and session listing.

## Commands

| Command | Description |
|---------|-------------|
| `!export` | Export last 7 days as Markdown (default) |
| `!export format:json` | Export as JSON |
| `!export format:html` | Export as styled HTML with dark theme |
| `!export format:markdown` | Export as Markdown (explicit) |
| `!export range:last-30-days` | Override date range |
| `!export range:last-24-hours` | Last 24 hours only |
| `!export range:all` | Export all conversations |
| `!export sessions` | List available sessions with metadata |

Both `!export` and `/export` prefixes are accepted.

### Combined Options

Options can be combined freely:
```
!export format:html range:last-30-days
!export format:json range:all
```

## Date Ranges

| Range Key | Duration |
|-----------|----------|
| `last-24-hours` | 24 hours |
| `last-1-hour` / `last-hour` | 1 hour |
| `last-7-days` / `last-week` | 7 days (default) |
| `last-30-days` / `last-month` | 30 days |
| `last-N-hours` | Custom hours (e.g., `last-12-hours`) |
| `last-N-days` | Custom days (e.g., `last-14-days`) |
| `all` | All time |

## Output Formats

### JSON
- Full structured export with metadata
- Includes session grouping, per-turn timestamps, token counts
- Machine-readable for downstream tools

### Markdown
- Human-readable conversation transcript
- Sessions separated by horizontal rules
- User/Sam labels with timestamps
- Stats header (session count, turn count, date range)

### HTML
- Styled dark theme (GitHub-inspired `#0d1117` background)
- Chat bubble layout (user messages right-aligned, Sam left-aligned)
- Summary stats header (sessions, turns, tokens)
- Session headers with duration and turn count
- Fully self-contained — no external CSS/JS dependencies

## Session Listing (`!export sessions`)

Lists all sessions in the last 30 days with:
- Date and day of week
- Turn count per session
- Session duration
- Truncated session ID

## File Delivery

Exports are written to `/tmp/sam-exports/` and attached to the Discord response as a file download. The filename format is:
```
sam-export_<range>_<timestamp>.<ext>
```

## Architecture

| File | Purpose |
|------|---------|
| `plugins/export/index.ts` | Plugin entry point — command parsing, file writing, Discord integration |
| `plugins/export/engine.ts` | Core export logic — SQL queries, format renderers (JSON/MD/HTML) |

### Data Flow

1. `canHandle()` matches `!export` or `/export` prefix
2. `parseExportCommand()` extracts format, range, and subcommand
3. `getRawDb()` provides the SQLite database handle
4. `generateExport()` queries conversations, groups by session, renders to chosen format
5. Result is written to `/tmp/sam-exports/` and returned with file attachment metadata

### Key Types

- **`ExportOptions`** — format, range, userId, sessionId, includeMetadata
- **`ExportResult`** — content string, filename, MIME type, turn/session counts, date range
- **`SessionGroup`** — conversations grouped by session with computed stats
- **`ConversationTurn`** — individual message with role, content, timestamp, metadata

## Tests

114 tests covering export and analysis in `__tests__/export.test.ts`:
- Command parsing (all format/range combinations, error cases)
- Range parsing (named aliases, custom durations, edge cases)
- Session listing with empty/populated databases
- Full export generation for all three formats
- HTML structure validation
- JSON schema validation
