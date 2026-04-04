---
name: ffuf
description: Expert guidance for ffuf web fuzzing during penetration testing, including authenticated fuzzing with raw requests, auto-calibration, and result analysis. USE WHEN user needs help with web fuzzing, directory enumeration, parameter testing, or automated web vulnerability discovery.
contributor: Joseph Thacker (@rez0)
---

# ffuf Skill - Web Fuzzing Guidance

## What is ffuf?

**ffuf** is a fast web fuzzer written in Go. It's essential for:
- Directory and file enumeration
- Parameter fuzzing (GET, POST, headers)
- Virtual host discovery
- Authenticated endpoint testing
- API endpoint mapping

## When to Use This Skill

USE WHEN:
- User asks for "web fuzzing guidance" or "directory enumeration"
- User wants to fuzz API endpoints, parameters, or paths
- User needs help setting up authenticated fuzzing with tokens/cookies
- User wants to test multiple targets with custom wordlists
- User needs auto-calibration or filtering strategies

## How It Works

1. **Prepare Raw Request File** - Create HTTP request template with FUZZ placeholder
2. **Select Wordlist** - Choose appropriate wordlist for target type (paths, params, vhosts, etc.)
3. **Configure Fuzzing Parameters** - Set filtering, matching, and output options
4. **Authenticate (if needed)** - Include Bearer tokens, session cookies, CSRF tokens
5. **Execute Fuzzing** - Run ffuf with optimized settings
6. **Analyze Results** - Filter results by status codes, response size, redirect chains

## Examples

**Example 1: Basic Directory Enumeration**
```bash
ffuf -u "https://target.com/FUZZ" -w common-wordlist.txt -mc 200,301,302 -o results.json
```

**Example 2: Authenticated API Fuzzing**
```bash
ffuf --request api-request.txt -w api-endpoints.txt -H "Authorization: Bearer TOKEN" -mc 200,201 -ac
```

**Example 3: Parameter Fuzzing**
```bash
ffuf -u "https://target.com/api/users?FUZZ=value" -w parameter-names.txt -fc 404
```

## Request Templates

Common authenticated request patterns included:
- JWT Bearer token authentication
- Session cookies with CSRF tokens
- API key headers
- Custom authorization schemes

## Result Analysis

Key strategies:
- Auto-calibration (`-ac`) to filter false positives
- Status code matching (`-mc` / `-fc`)
- Response size filtering (`-fs` / `-fr`)
- Recursive fuzzing for directory paths
- Parallel execution optimization

## Extended Context

For complete fuzzing methodology, request templates, wordlist guidance, authenticated patterns, and optimization strategies, see `Reference.md`
