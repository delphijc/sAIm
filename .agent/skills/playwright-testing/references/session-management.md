# Browser Session Management

Run multiple isolated browser sessions concurrently with state persistence.

## Named Browser Sessions

Use `-s` flag to isolate browser contexts:

```bash
playwright-cli -s=auth open https://app.example.com/login
playwright-cli -s=public open https://example.com
playwright-cli -s=auth fill e1 "user@example.com"
playwright-cli -s=public snapshot
```

Each session has independent cookies, localStorage, sessionStorage, IndexedDB, cache, history, and tabs.

## Session Commands

```bash
playwright-cli list                      # List all sessions
playwright-cli close                     # Stop default browser
playwright-cli -s=mysession close        # Stop named browser
playwright-cli close-all                 # Stop all sessions
playwright-cli kill-all                  # Force kill all daemon processes
playwright-cli delete-data               # Delete default browser data
playwright-cli -s=mysession delete-data  # Delete named browser data
```

## Environment Variable

```bash
export PLAYWRIGHT_CLI_SESSION="mysession"
playwright-cli open example.com  # Uses "mysession" automatically
```

## Patterns

### Concurrent Scraping

```bash
playwright-cli -s=site1 open https://site1.com &
playwright-cli -s=site2 open https://site2.com &
wait
playwright-cli -s=site1 snapshot
playwright-cli -s=site2 snapshot
playwright-cli close-all
```

### Persistent Profile

```bash
playwright-cli open https://example.com --persistent
playwright-cli open https://example.com --profile=/path/to/profile
```

### Session Configuration

```bash
playwright-cli open https://example.com --browser=firefox
playwright-cli open https://example.com --headed
playwright-cli open https://example.com --config=my-config.json
```
