# Tracing

Capture detailed execution traces for debugging — DOM snapshots, screenshots, network activity, and console logs.

## Basic Usage

```bash
playwright-cli tracing-start
playwright-cli open https://example.com
playwright-cli click e1
playwright-cli fill e2 "test"
playwright-cli tracing-stop
```

## What Traces Capture

| Category | Details |
|----------|---------|
| Actions | Clicks, fills, hovers, keyboard, navigations |
| DOM | Full snapshots before/after each action |
| Screenshots | Visual state at each step |
| Network | All requests, responses, headers, bodies, timing |
| Console | All console.log, warn, error messages |
| Timing | Precise timing for each operation |

## Trace Output

- `trace-{timestamp}.trace` -- action log with DOM snapshots
- `trace-{timestamp}.network` -- complete network activity
- `resources/` -- cached assets for page reconstruction

## Debugging with Traces

```bash
playwright-cli tracing-start
playwright-cli open https://app.example.com
playwright-cli click e5  # This fails -- why?
playwright-cli tracing-stop
# Open trace to see DOM state when click was attempted
```

## Clean Up

```bash
find .playwright-cli/traces -mtime +7 -delete
```
