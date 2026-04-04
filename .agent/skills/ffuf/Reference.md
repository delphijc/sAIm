# ffuf Reference Guide

> This is Tier 2 documentation for the ffuf skill. It's loaded on-demand when you use this skill. For quick routing and examples, see `SKILL.md`.

---

## Skill Philosophy

ffuf excels at discovering hidden content, endpoints, and parameters through intelligent fuzzing. This skill provides proven methodologies for web fuzzing in authorized penetration testing engagements, including authenticated scenarios, advanced filtering strategies, and result analysis techniques.

---

## ffuf Fundamentals

### What is ffuf?

**ffuf** (Fuzz Faster U Fool) is a high-performance web fuzzer that:
- Performs concurrent fuzzing with tunable thread counts
- Filters responses by status code, response size, redirect chains
- Supports raw HTTP request files for complex scenarios
- Auto-calibrates to reduce false positives
- Outputs results in JSON for downstream analysis

### Core Use Cases

1. **Directory/File Discovery** - Find hidden paths and files
2. **API Endpoint Mapping** - Discover API routes and parameters
3. **Parameter Fuzzing** - Identify hidden/undocumented parameters
4. **Subdomain Discovery** - Map virtual hosts
5. **IDOR Testing** - Find authorization bypass vulnerabilities
6. **Authenticated Fuzzing** - Test protected endpoints with credentials

---

## Wordlist Selection Guide

### Directory/File Discovery

**For rapid scanning:**
- `Discovery/Web-Content/common.txt` (~4.6k entries) - Quick baseline
- Takes ~30 seconds on well-configured target

**For comprehensive scanning:**
- `Discovery/Web-Content/raft-large-directories.txt` - Recommended balance
- `Discovery/Web-Content/directory-list-2.3-medium.txt` (~220k entries)
- Takes 5-15 minutes depending on target responsiveness

**For exhaustive scanning:**
- `Discovery/Web-Content/directory-list-2.3-big.txt` (~1.2M entries)
- Only use when time/resources allow (hours of scanning)

### API Testing

- `Discovery/Web-Content/api/api-endpoints.txt` - General API routes
- `Discovery/Web-Content/common-api-endpoints-mazen160.txt` - Expanded list
- `Discovery/Web-Content/swagger-parameters.txt` - OpenAPI-style endpoints

### Subdomain Discovery

**Top-N approach:**
- `subdomains-top1million-5000.txt` - Ultra-fast, catches most legitimate subdomains
- `subdomains-top1million-20000.txt` - Balanced coverage
- `subdomains-top1million-110000.txt` - Comprehensive

**Tips:**
- Combine with DNS wildcard detection
- Use `-ac` auto-calibration to filter false positives
- Consider rate limiting on DNS to avoid blocking

### Parameter Names

- `burp-parameter-names.txt` - Most common GET/POST parameters
- `raft-large-words.txt` - Extended vocabulary
- Useful for: hidden parameters, new API parameters

### Backup & Config Files

- `backup-files-only.txt` - Common backup extensions (.bak, .old, .swp)
- `Common-DB-Backups.txt` - Database dumps (.sql, .sqlite, .db)
- Finds accidental data exposure

### Technology-Specific

By server technology:
- `PHP.fuzz.txt` - PHP file extensions and common paths
- `IIS.fuzz.txt` - ASP/ASP.NET specific paths
- `Apache.fuzz.txt` - Apache-specific configuration paths
- `git-head-potential-file-exposure.txt` - Git repository exposure

### Authentication Testing

**Usernames:**
- `Usernames/top-usernames-shortlist.txt` - First ~100 common usernames
- `Usernames/xato-net-10-million-usernames.txt` - Comprehensive list

**Passwords:**
- `Passwords/Common-Credentials/10-million-password-list-top-1000.txt` - Top 1000
- `Passwords/Common-Credentials/top-20-common-SSH-passwords.txt` - SSH-specific

### Installing SecLists

```bash
# Clone to standard location
git clone https://github.com/danielmiessler/SecLists.git /opt/SecLists

# Or via package manager (Kali Linux)
sudo apt install seclists

# Then reference in ffuf
ffuf -w /opt/SecLists/Discovery/Web-Content/common.txt ...
```

---

## File Extensions by Technology

When fuzzing, include relevant extensions:

**PHP:**
`.php .php3 .php4 .php5 .phtml .phps`

**ASP/ASP.NET:**
`.asp .aspx .ashx .asmx .axd`

**JSP/Java:**
`.jsp .jspx .jsw .jsv .jspf`

**Node.js:**
`.js .json .jspx`

**Python:**
`.py .pyc .pyo`

**Backup/Config (All platforms):**
`.bak .backup .old .save .tmp .swp .git .env .config .conf .log .sql .db .sqlite`

---

## Authenticated Request Templates

### Template 1: JWT Bearer Token

```http
GET /api/v1/users/FUZZ HTTP/1.1
Host: api.target.com
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
Accept: application/json
Content-Type: application/json
```

**Usage:**
```bash
ffuf --request req.txt -w endpoints.txt -ac -mc 200,201 -o results.json
```

### Template 2: Session Cookie + CSRF Token

```http
POST /api/account/update HTTP/1.1
Host: app.target.com
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36
Cookie: sessionid=abc123xyz789; csrftoken=def456uvw; preferences=theme:dark
X-CSRF-Token: def456uvw
Content-Type: application/x-www-form-urlencoded
Content-Length: 25

field=FUZZ&action=update
```

**Usage:**
```bash
ffuf --request req.txt -w payloads.txt -ac -fc 403 -o results.json
```

### Template 3: API Key Header

```http
GET /v2/data/FUZZ HTTP/1.1
Host: api.target.com
User-Agent: Custom-Client/1.0
X-API-Key: YOUR_API_KEY_HERE_abc123def456ghi789jkl
Accept: application/json
```

**Usage:**
```bash
ffuf --request req.txt -w endpoints.txt -ac -mc 200 -o results.json
```

### Template 4: Basic Authentication

```http
GET /admin/FUZZ HTTP/1.1
Host: target.com
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36
Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=
Accept: text/html,application/xhtml+xml
```

**Usage:**
```bash
ffuf --request req.txt -w admin-paths.txt -ac -mc 200,301,302 -o results.json
```

### Template 5: OAuth 2.0 Bearer

```http
GET /api/v1/resources/FUZZ HTTP/1.1
Host: api.target.com
User-Agent: OAuth-Client/2.0
Authorization: Bearer ya29.a0AfH6SMBx...truncated...aBcDeFgHiJ
Accept: application/json
Cache-Control: no-cache
```

**Usage:**
```bash
ffuf --request req.txt -w resource-names.txt -ac -mc 200,404 -fw 50-100 -o results.json
```

### Template 6: POST JSON with Authorization

```http
POST /api/v1/query HTTP/1.1
Host: api.target.com
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Accept: application/json
Content-Length: 45

{"query":"FUZZ","limit":100,"offset":0}
```

**Usage:**
```bash
ffuf --request req.txt -w query-payloads.txt -ac -fr "error" -o results.json
```

### Template 7: Multiple Fuzzing Points (IDOR Testing)

```http
GET /api/v1/users/USER_ID/documents/DOC_ID HTTP/1.1
Host: api.target.com
User-Agent: Mozilla/5.0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

**Usage:**
```bash
ffuf --request req.txt \
     -w user_ids.txt:USER_ID \
     -w doc_ids.txt:DOC_ID \
     -mode pitchfork \
     -ac -mc 200 \
     -o idor_results.json
```

### Template 8: GraphQL Query

```http
POST /graphql HTTP/1.1
Host: api.target.com
User-Agent: GraphQL-Client/1.0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Accept: application/json
Content-Length: 89

{"query":"query { user(id: \"FUZZ\") { id username email role } }","variables":{}}
```

**Usage:**
```bash
ffuf --request req.txt -w user-ids.txt -ac -mc 200 -mr '"email"' -o graphql_results.json
```

---

## Capturing Your Own Requests

### Method 1: Burp Suite (Recommended)

1. Intercept the authenticated request in Burp
2. Right-click → "Copy to file"
3. Save as `req.txt`
4. Edit to replace target value with `FUZZ`

### Method 2: Browser DevTools

1. Press F12 → Network tab
2. Perform authenticated action
3. Right-click request → "Copy" → "Copy as cURL"
4. Convert to raw HTTP format
5. Insert `FUZZ` keyword where needed

### Method 3: mitmproxy

1. Run `mitmproxy` or `mitmweb`
2. Configure browser to use proxy
3. Capture the request
4. Export as raw HTTP format
5. Edit to add `FUZZ` keyword

### Method 4: From curl

Convert working curl command to request file:

```bash
# Original curl:
curl 'https://api.target.com/users/123' \
  -H 'Authorization: Bearer TOKEN'

# Convert to req.txt:
GET /users/FUZZ HTTP/1.1
Host: api.target.com
Authorization: Bearer TOKEN
```

---

## Filtering & Result Analysis

### Response Size Baseline

Before fuzzing, identify normal response sizes:

```bash
# Get baseline
ffuf -u "https://target.com/randompath123456" \
     -w <(echo "randompath123456") \
     -v 2>&1 | grep "Size"
```

Common baseline sizes:
- **404 pages**: Often ~1234, ~4242, ~9999 bytes (varies)
- **403 Forbidden**: Check with known forbidden path
- **Default pages**: IIS ~1433 bytes, Apache ~274 bytes
- **Empty responses**: 0 bytes

### Auto-Calibration

The `-ac` flag automatically filters responses matching baseline (404s, default pages):

```bash
# Let ffuf figure out what's "normal"
ffuf -u https://target.com/FUZZ \
     -w wordlist.txt \
     -ac
```

### Manual Filtering

**Match status codes:**
```bash
-mc 200,201,204    # Match these codes
-fc 404,403        # Filter out these codes
```

**Match response size:**
```bash
-fs 1234           # Filter 1234-byte responses (404 page size)
-fw 10-50          # Filter 10-50 word responses
```

**Match response content:**
```bash
-mr "Success"      # Match responses containing "Success"
-fr "Not Found"    # Filter responses containing "Not Found"
```

**Combine filters:**
```bash
ffuf -u https://target.com/FUZZ \
     -w wordlist.txt \
     -ac -fc 404 -fs 1234 \
     -mc 200,201 \
     -mr "id" \
     -o results.json
```

---

## Performance Tuning

### Rate Limiting

Different targets have different tolerances:

| Target Type | Recommended | Threads | Notes |
|------------|-------------|---------|-------|
| Production (careful) | `-rate 2 -t 10` | 10 | Very stealthy, ~360 req/min |
| Production (normal) | `-rate 10 -t 20` | 20 | Balanced, ~1,200 req/min |
| Development/Staging | `-rate 50 -t 40` | 40 | Fast, ~3,000 req/min |
| Local/Lab | No limit | 100+ | Maximum speed, 10k+ req/min |

### Complete Command Example

```bash
ffuf -u "https://target.com/FUZZ" \
     -w /opt/SecLists/Discovery/Web-Content/raft-large-directories.txt \
     -ac \                          # Auto-calibrate (filter baselines)
     -c \                           # Colorize output
     -v \                           # Verbose
     -t 40 \                        # 40 threads
     -rate 50 \                     # Rate limit: 50 requests/second
     -mc 200,301,302 \             # Match these status codes
     -fs 1234 \                     # Filter 404 page size
     -o results.json \              # JSON output
     -timeout 3                     # 3-second timeout per request
```

---

## Advanced Techniques

### IDOR Testing (Insecure Direct Object Reference)

```bash
# Generate ID ranges
seq 1 10000 > user_ids.txt

# Fuzz with authenticated request
ffuf --request api-request.txt \
     -w user_ids.txt \
     -ac -mc 200 \
     -o idor_findings.json
```

### GraphQL Introspection

```bash
# Discover GraphQL schema
ffuf --request graphql-request.txt \
     -w /path/to/graphql-fields.txt \
     -ac -mc 200 \
     -mr "type" \
     -o graphql_schema.json
```

### Recursive Directory Fuzzing

```bash
ffuf -u "https://target.com/FUZZ" \
     -w wordlist.txt \
     -ac \
     -recursion \                   # Recursive mode
     -recursion-depth 2 \           # Max depth
     -o recursive_results.json
```

---

## Pro Tips

1. **Content-Length Header**: ffuf automatically adjusts if your request file has wrong length
2. **Multiple FUZZ Points**: Use custom keywords `-w wordlist.txt:KEYWORD`
3. **Test Your Request**: Run single-value test first to verify req.txt works
4. **Token Expiration**: Some tokens expire - implement refresh strategy if needed
5. **HTTPS/HTTP**: Default is HTTPS; use `-request-proto http` for HTTP
6. **Redirect Following**: Use `-follow` to follow 3xx redirects
7. **Response Body Inspection**: Use `-mr` to match specific strings in responses
8. **JSON Output**: All findings in `-o results.json` for parsing and reporting

---

## Key Principles

1. **Authorized Testing Only** - ffuf is for authorized penetration testing and security research
2. **Rate Limiting** - Respect target infrastructure; adjust thread count and rate limits
3. **Calibration** - Use `-ac` to automatically filter noise and false positives
4. **Request Templates** - Raw request files enable complex authentication scenarios
5. **Comprehensive Fuzzing** - Combine multiple wordlists and techniques for complete coverage


