# MCP Management

Guide to managing Model Context Protocol (MCP) servers in Sam PAI.

---

## Overview

MCPs (Model Context Protocol servers) are integrations that provide Claude Code with access to external tools and services. Sam currently uses a single active MCP:

- **`playwright`** — Browser automation and web testing

MCPs are configured in `~/.claude/.mcp.json` (also at `.agent/.mcp.json` in the repo).

---

## Current Configuration

```json
{
  "mcpServers": {
    "playwright": {
      "command": "bunx",
      "args": ["@playwright/mcp@latest", "--extension"],
      "description": "Browser automation and testing using Playwright for visual debugging and web interaction"
    }
  }
}
```

### Active MCPs

| MCP | Type | Purpose | Resource Cost |
|-----|------|---------|----------------|
| `playwright` | Command (bunx) | Browser automation, E2E testing, visual debugging | Medium-High (on demand) |

---

## Playwright MCP

**What it does:** Launches a Playwright-controlled browser session, enabling Claude to interact with web pages, take screenshots, fill forms, click elements, and debug web applications visually.

**When it's used:**
- Web application testing and E2E test writing
- Debugging UI issues that require seeing a live browser
- Scraping or interacting with pages that require JavaScript execution
- Visual verification of UI changes

**Resource behavior:** Spawns a browser process on demand. Idle when not in use.

---

## Adding New MCPs

To add an MCP server, edit `.agent/.mcp.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "bunx",
      "args": ["@playwright/mcp@latest", "--extension"],
      "description": "Browser automation"
    },
    "my-new-mcp": {
      "command": "npx",
      "args": ["-y", "@my-org/mcp-server"],
      "description": "What this MCP does"
    }
  }
}
```

After editing, restart Claude Code for the change to take effect.

**Path substitution note:** If your MCP config contains absolute paths, run `fix_hardcoded_paths` after modifying:
```bash
bash ~/Projects/sam/.agent/setup.sh --fix-paths
```

---

## Removing or Disabling MCPs

To disable an MCP, remove its entry from `.mcp.json` and restart Claude Code:

```bash
# Edit config
nano ~/.claude/.mcp.json

# Restart Claude Code
# (close and reopen the terminal / restart the claude process)
```

---

## Troubleshooting

**MCP not loading?**
- Verify the command exists: `which bunx` or `which npx`
- Check `.mcp.json` syntax is valid JSON: `cat ~/.claude/.mcp.json | python3 -m json.tool`
- Restart Claude Code after any config change
- Check Claude Code logs for MCP errors

**Playwright not found?**
```bash
# Verify bunx is available
which bunx
bun --version

# Test playwright MCP manually
bunx @playwright/mcp@latest --version
```

**Config path issue after machine migration?**
```bash
bash ~/Projects/sam/.agent/setup.sh --fix-paths
```

---

## Historical Note

Earlier versions of Sam's `.mcp.json` included several MCPs that have since been removed:

| MCP | Former type | Reason removed |
|-----|-------------|----------------|
| `httpx` | HTTP remote | Service unavailable / no longer maintained |
| `naabu` | HTTP remote | Service unavailable / no longer maintained |
| `Ref` | Command | Replaced by native search patterns |
| `jagents-*` | Node.js | Replaced by native Claude Code agent capabilities |

The security tools `httpx`, `naabu`, `nuclei`, and `nmap` are still available but as **CLI tools** installed via Homebrew/Linuxbrew — not as MCP servers. See [Security Tools Reference](security-tools.md).

---

## Integration with PAI Setup

During `setup.sh`, `fix_hardcoded_paths()` processes `.mcp.json` to ensure any absolute paths reference the current user's home directory. This makes the config portable across machines and users.

```bash
# Re-run path fixing if needed
bash ~/Projects/sam/.agent/setup.sh --fix-paths
```

---

## See Also

- [Getting Started](getting-started.md) — Installation walkthrough
- [Setup Scripts Reference](setup-scripts.md) — setup.sh documentation
- [Security Tools](security-tools.md) — CLI security tools (httpx, naabu, nuclei, nmap)
- [MCP Protocol](https://modelcontextprotocol.io/) — Official MCP specification

---

*Last updated: 2026-03-26*
