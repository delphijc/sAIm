# Memory System - Quick Reference

Quick lookup for common memory operations and concepts.

## Core Concepts at a Glance

| Concept | What It Does | Example |
|---------|-------------|---------|
| **ACT-R Score** | Ranks memories by frequency, recency, confidence | Recent ✅ → High score |
| **Confidence** | How certain the system is about a fact | 85% = "Fixed security issue" |
| **Hebbian Link** | Connection between related ideas | "JWT" ↔ "Token validation" |
| **Extraction** | Automatic fact capture from conversations | "✅ Fixed timeout" → Saved |
| **Deduplication** | Merging similar facts to avoid redundancy | Jaccard similarity >60% |

## Extraction Rules & Confidence

Quick reference for what gets extracted and at what confidence:

```
Completion markers (Fixed, Done, ✅)        → 85% confidence
Decisions & choices                         → 75% confidence
Architecture & design patterns              → 70% confidence
Security findings & vulnerabilities         → 70% confidence
Debugging insights (root cause)             → 75% confidence
Analysis & status updates                   → 60% confidence
Recommendations & next steps                → 55% confidence
```

**Boost:** If message includes completion marker or status table, multiply confidence by 1.2 (capped at 95%)

## How to Maximize Memory Learning

### ✅ DO THIS

```
"Fixed the session timeout validation - added explicit 500ms fail-closed behavior. ✅"
→ Extracted at 85% confidence + 1.2× boost = ready to use

"Decided to switch from in-memory cache to Redis for scalability"
→ Extracted at 75% confidence, linked to "Architecture" topic

"Security review found 15 prompt injection patterns - added sanitization for all"
→ Extracted at 70% confidence, corroborated facts increase 15% each
```

### ❌ DON'T DO THIS

```
"Did some work"
→ Too vague, not extracted

"I think this might be an issue"
→ No completion marker, low substantive content

"Lorem ipsum dolor sit amet"
→ <50 chars, insufficient length
```

## Memory Server API

### Search Memories
```bash
curl -X POST http://localhost:4242/memory/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "JWT authentication",
    "limit": 5,
    "sessionId": "optional-filter"
  }'
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "mem-abc123",
      "topic": "Decision",
      "summary": "Using JWT for stateless auth",
      "confidence": 0.85,
      "accessCount": 12,
      "lastAccess": 1709859600000,
      "source": "discord"
    }
  ]
}
```

### Extract Facts
```bash
curl -X POST http://localhost:4242/memory/extract \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "Fix the timeout bug",
    "assistantResponse": "Fixed. Added 500ms fail-closed timer. ✅",
    "sessionId": "session-123",
    "source": "cli-tool"
  }'
```

**Response:**
```json
{
  "success": true,
  "savedCount": 1
}
```

### Health Check
```bash
curl http://localhost:4242/memory/health
```

**Response:**
```json
{"status": "ok"}
```

## Common Commands

### Start Memory Server
```bash
# Already running if you started Sam normally
# Manually restart:
/start-up
```

### Search Database Directly
```bash
sqlite3 ~/.../discord-remote-control/memory.db

# Find all memories about JWT
SELECT topic, summary, confidence
FROM semantic
WHERE summary LIKE '%JWT%'
ORDER BY confidence DESC;

# Find memories by confidence level
SELECT topic, confidence
FROM semantic
WHERE confidence > 0.8
LIMIT 10;

# Check memory growth
SELECT COUNT(*) as total_memories,
       AVG(confidence) as avg_confidence
FROM semantic;
```

### Backup Memory Database
```bash
cp ~/.../discord-remote-control/memory.db \
   ~/.../discord-remote-control/memory.db.backup-$(date +%Y%m%d)
```

### View Recent Extractions
```bash
sqlite3 ~/.../discord-remote-control/memory.db \
  "SELECT datetime(created_at/1000, 'unixepoch') as date,
          topic, summary, confidence
   FROM semantic
   ORDER BY created_at DESC
   LIMIT 20;"
```

## Troubleshooting Checklist

### "Memories aren't being extracted"
- [ ] Discord message has ✅, "Fixed", "Done", or completion marker?
- [ ] Response is longer than 50 characters?
- [ ] Response includes headers (##), tables, or findings?
- [ ] Check memory.db: `SELECT COUNT(*) FROM semantic;`

### "Memory server is slow"
- [ ] Check server health: `curl http://localhost:4244/memory/health`
- [ ] Database size: `sqlite3 memory.db ".dbinfo"`
- [ ] Run VACUUM: `sqlite3 memory.db "VACUUM;"`

### "Same facts extracted multiple times"
- [ ] That's OK! Confidence increases instead of duplicating
- [ ] Check Jaccard similarity: 60% word overlap = treated as duplicate
- [ ] Original memory confidence will increase on corroboration

### "Memory server won't start"
- [ ] Port 4242 in use? `lsof -i :4242`
- [ ] Check for errors: `bun run index.ts` in service directory
- [ ] Memory database corrupted? `sqlite3 memory.db "PRAGMA integrity_check;"`

## ACT-R Scoring Explained

The formula that ranks memories:

```
Score = ln(access_count + 1)
       - 0.5 × ln(days_since_access)
       + (confidence - 0.5)
```

**Example calculations:**

| Memory | Access | Days Old | Confidence | Score |
|--------|--------|----------|-----------|-------|
| Hot topic | 10 | 1 | 85% | +1.87 |
| Solved | 3 | 7 | 80% | +0.66 |
| Old insight | 1 | 30 | 70% | -0.85 |

→ Hot topic wins (1.87 > 0.66 > -0.85)

## Context Injection Format

When memories are included in your prompt, they appear as:

```
---
## Context from Memory

**Relevant Prior Learning:**

• **Completed**: Fixed security validator with 500ms timeout (confidence: 85%)
• **Architecture**: Chose Redis over in-memory cache (confidence: 75%)
• **Security**: Added prompt injection detection with 4 pattern sets (confidence: 80%)

---
```

These are **automatically** included when:
- You ask a related question
- Confidence is >50%
- Total context budget allows

## Advanced Usage

### Manual Memory Touch (increment access)
```python
# In your own scripts
curl -X POST http://localhost:4244/memory/extract \
  -d '{"userMessage":"Query","assistantResponse":"Found X items. ✅","sessionId":"s1"}'
```

### Filter by Source
```sql
-- Only Discord memories
SELECT * FROM semantic WHERE source = 'discord';

-- Only Claude Code memories
SELECT * FROM semantic WHERE source = 'claude-code-hook';

-- Mixed sources
SELECT source, COUNT(*) FROM semantic GROUP BY source;
```

### Association Analysis
```sql
-- Find heavily linked memories
SELECT source_id, COUNT(*) as link_count
FROM associations
GROUP BY source_id
ORDER BY link_count DESC
LIMIT 10;

-- Find memory clusters
SELECT * FROM associations
WHERE weight > 0.5
ORDER BY weight DESC;
```

---

**See Also:** [Memory System Documentation](memory-system.md) for full details
**Updated:** 2026-03-07
