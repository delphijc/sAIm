---
name: playwright-testing
description: Browser automation and E2E testing via playwright-cli (token-efficient CLI alternative to Playwright MCP). USE WHEN user wants to automate browser interactions, write E2E tests, debug web pages, take screenshots, mock network requests, OR manage browser sessions. Also USE WHEN user says "open browser", "test this page", "take a screenshot", "debug E2E", "visual regression".
allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(bunx:*)
---

# Browser Automation with playwright-cli

playwright-cli is a token-efficient CLI for browser automation — **4x fewer tokens** than Playwright MCP. Snapshots save to disk instead of flooding the context window.

## Quick Start

```bash
# Open browser and navigate
playwright-cli open https://example.com
# Get page snapshot with element refs
playwright-cli snapshot
# Interact using refs from snapshot
playwright-cli click e15
playwright-cli fill e5 "user@example.com" --submit
playwright-cli type "search query"
# Take a screenshot
playwright-cli screenshot
# Close browser
playwright-cli close
```

## Workflow Routing

**When executing a workflow, do BOTH:**
1. Run: `~/.claude/Tools/SkillWorkflowNotification WORKFLOWNAME playwright-testing`
2. Output: `Running the **WorkflowName** workflow from the **playwright-testing** skill...`

| Workflow | Trigger | File |
|----------|---------|------|
| **BrowserAutomation** | "open browser", "navigate to", "click on", "fill form", "take screenshot" | `workflows/BrowserAutomation.md` |
| **WriteTests** | "write E2E test", "create Playwright test", "test this page" | `workflows/WriteTests.md` |
| **Debug** | "Playwright test failing", "debug E2E", "fix flaky test" | `workflows/Debug.md` |
| **MockApi** | "mock API in Playwright", "intercept requests", "stub backend" | `workflows/MockApi.md` |
| **VisualRegression** | "visual regression", "screenshot comparison", "visual testing" | `workflows/VisualRegression.md` |
| **Setup** | "set up Playwright", "install Playwright", "configure Playwright" | `workflows/Setup.md` |
| **CiCd** | "Playwright in CI", "GitHub Actions Playwright", "CI pipeline E2E" | `workflows/CiCd.md` |
| **Authentication** | "Playwright auth", "session management E2E", "login flow test" | `workflows/Authentication.md` |

## Core Commands

```bash
# Navigation
playwright-cli open [url]
playwright-cli goto <url>
playwright-cli go-back
playwright-cli go-forward
playwright-cli reload

# Interaction (use element refs from snapshot)
playwright-cli click <ref>
playwright-cli dblclick <ref>
playwright-cli fill <ref> <text> [--submit]
playwright-cli type <text>
playwright-cli select <ref> <value>
playwright-cli check <ref>
playwright-cli uncheck <ref>
playwright-cli hover <ref>
playwright-cli drag <startRef> <endRef>
playwright-cli upload <file>

# Page State
playwright-cli snapshot
playwright-cli screenshot [--filename=page.png]
playwright-cli screenshot <ref>
playwright-cli eval "document.title"
playwright-cli eval "el => el.getAttribute('data-testid')" <ref>

# Keyboard
playwright-cli press Enter
playwright-cli press ArrowDown
playwright-cli keydown Shift
playwright-cli keyup Shift

# Tabs
playwright-cli tab-list
playwright-cli tab-new [url]
playwright-cli tab-select <index>
playwright-cli tab-close [index]

# Network Mocking
playwright-cli route "**/api/users" --body='[{"id":1}]' --content-type=application/json
playwright-cli route "**/*.jpg" --status=404
playwright-cli route-list
playwright-cli unroute [pattern]

# Storage
playwright-cli state-save [filename.json]
playwright-cli state-load <filename.json>
playwright-cli cookie-list [--domain=example.com]
playwright-cli cookie-set <name> <value> [--domain --httpOnly --secure]
playwright-cli cookie-delete <name>
playwright-cli localstorage-list / localstorage-get / localstorage-set / localstorage-delete

# Sessions
playwright-cli -s=<name> <command>      # Named session
playwright-cli list                      # List sessions
playwright-cli close                     # Close current
playwright-cli close-all                 # Close all

# DevTools
playwright-cli console
playwright-cli network
playwright-cli run-code "async page => { ... }"
playwright-cli tracing-start / tracing-stop
playwright-cli video-start <file.webm> / video-stop

# Raw output (pipe-friendly)
playwright-cli --raw eval "document.title"
playwright-cli --raw snapshot > page.yml
```

## Key Principles

- **Snapshot First:** Always `snapshot` before interacting — refs like `e15` come from the snapshot
- **Token Efficient:** CLI saves to disk, agent reads only what's needed (~27K vs ~114K tokens)
- **Accessibility-First Locators:** Generated code uses getByRole, getByLabel, getByText
- **No Hard Waits:** Use proper assertions; never waitForTimeout in production tests
- **Test Isolation:** Each test independent; parallel safe
- **CI Parity:** Local and CI environments must match

## Extended Context

For detailed patterns, test-writing methodology, and advanced recipes, see `Reference.md`.
For topic-specific deep dives, see `references/` directory.
