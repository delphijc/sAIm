# PAI Security Toolkit

Optional security CLI tools used by the `security-test-analyst` and `pentester` agents.

## Overview

PAI uses the **ProjectDiscovery** toolkit alongside **nmap** for network reconnaissance, port scanning, HTTP probing, and vulnerability scanning. All tools are installed via Homebrew/Linuxbrew.

## Tools

| Tool | Purpose | Example |
|------|---------|---------|
| **naabu** | Fast port scanner (preferred for speed) | `naabu -host example.com -p 1-65535` |
| **httpx** | HTTP probing & tech stack detection | `echo example.com \| httpx -title -tech-detect` |
| **nuclei** | Vulnerability scanner with templates | `nuclei -u https://example.com` |
| **subfinder** | Passive subdomain discovery | `subfinder -d example.com` |
| **nmap** | Comprehensive port/service scanner | `nmap -sV -sC example.com` |

## Installation

### Via setup.sh (recommended)

```bash
# During full setup — prompted interactively:
bash .agent/setup.sh

# Or standalone:
bash .agent/setup.sh --install-security-tools
```

### Manual (requires Homebrew or Linuxbrew)

```bash
brew install naabu httpx nuclei subfinder nmap
```

## Prerequisites

Security tools require **Homebrew** (macOS) or **Linuxbrew** (Linux). `setup.sh` installs this automatically before offering the security toolkit.

### Homebrew/Linuxbrew install paths

| Platform | Binary | Install script |
|----------|--------|----------------|
| macOS | `/opt/homebrew/bin/brew` or `/usr/local/bin/brew` | Homebrew official |
| Linux | `/home/linuxbrew/.linuxbrew/bin/brew` | Linuxbrew official |

## Usage by Agents

The `security-test-analyst` and `pentester` agents use these tools via Bash commands:

```bash
# Port scan — prefer naabu for speed
naabu -host <target> -p top-1000 -silent

# Fallback with nmap for service/OS detection
nmap -sV -sC -p <ports> <target>

# HTTP probing after port scan
echo "<target>" | httpx -title -tech-detect -status-code

# Subdomain enumeration
subfinder -d <domain> -silent

# Vulnerability scan
nuclei -u https://<target> -severity medium,high,critical
```

## Update Tools

```bash
brew upgrade naabu httpx nuclei subfinder nmap

# Update nuclei templates separately
nuclei -update-templates
```

## Verification

```bash
# Check all tools are installed and in PATH
for tool in naabu httpx nuclei subfinder nmap; do
  which $tool && $tool --version 2>&1 | head -1 || echo "MISSING: $tool"
done
```
