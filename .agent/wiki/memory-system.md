# Memory System - Muninn Cognitive Architecture

The **Memory System** is Sam's intelligent long-term knowledge store, inspired by cognitive neuroscience and the Norse god Muninn (memory). It learns from your interactions and builds sophisticated associations between ideas.

## What is the Memory System?

The Memory System is a sophisticated database that:

- **Learns continuously** - Extracts facts and insights from every conversation
- **Ranks intelligently** - Uses ACT-R activation to surface relevant memories
- **Strengthens through repetition** - Confidence increases when ideas are corroborated
- **Builds associations** - Links related concepts together (Hebbian learning)
- **Captures universally** - Records insights from Discord bot, Claude Code, and CLI usage

## Key Features

### 1. ACT-R Activation Scoring

Memories are ranked by a three-component score that captures how useful they are:

```
ACT-R Score = ln(access_count + 1)
            - 0.5 × ln(recency_days)
            + (confidence - 0.5)
```

**Components:**
- **Frequency** (ln access_count): Memories you use often rank higher
- **Recency**: Recently accessed memories are more relevant
- **Confidence**: High-confidence facts boost the score

### 2. Non-Destructive Confidence

Unlike traditional decay systems, confidence **compounds**:

| Event | Confidence Change |
|-------|------------------|
| New fact extracted | +50-85% (by type) |
| Corroborating evidence | +15% of remaining gap |
| Completion confirmed | ×1.2 boost (max 95%) |
| Contradicted | ×0.8 reduction |

Example:
```
Initial confidence:      50%
After corroboration:     50% + (50% × 15%) = 57.5%
After completion mark:   57.5% × 1.2 = 69% (capped at 95%)
```

### 3. Fact Extraction & Categorization

The system automatically extracts memories by recognizing patterns:

| Pattern | Confidence | Example |
|---------|-----------|---------|
| **Completed** | 85% | "Fixed the security timeout ✅" |
| **Decision** | 75% | "Decided to use JWT tokens" |
| **Architecture** | 70% | "Chose microservices pattern" |
| **Security** | 70% | "Added prompt injection validation" |
| **Debugging** | 75% | "Root cause: race condition" |
| **Analysis** | 60% | "Found 35 of 35 security issues" |
| **Recommendation** | 55% | "Should use connection pooling" |

### 4. Hebbian Associations

When memories appear in the same conversation, they build weighted links:

```
Co-retrieved memories → bidirectional associations
Each co-activation → weight increases (capped at 1.0)
Stale links (30+ days, <3 activations) → auto-pruned
```

This means related concepts naturally cluster together, improving context injection.

### 5. Hybrid Search with RRF Fusion

When building context, the system combines multiple ranking signals:

1. **Primary:** ACT-R-scored FTS5 matches
2. **Secondary:** High-confidence memories
3. **Tertiary:** Associated memories from primary results
4. **Fusion:** RRF (Reciprocal Rank Fusion) combines all signals

Result: More relevant, contextualized memories injected into prompts.

## How Memories Are Captured

### From Discord Bot
Every message in the Discord channel is analyzed:
- Completion markers (✅, "Fixed", "Done") trigger extraction
- Status tables ("| **Finding** | Fixed |") capture remediated items
- Structured responses (headers, tables) extract analysis

Source tag: `discord`

### From Claude Code Sessions
The `memory-capture.ts` hook runs on Stop events:
- Extracts last user message + assistant response
- Automatically posts to memory server
- Non-blocking (500ms timeout)
- Works with all Claude Code sessions

Source tag: `claude-code-hook`

### Universal HTTP API
The memory server (localhost:4242) accepts:
- `POST /memory/extract` - save facts from any source
- `POST /memory/search` - hybrid search across all memories
- `GET /memory/health` - service status

This enables integration with external tools and scripts.

## Memory Lifecycle

### Extraction Phase
```
Conversation Turn
    ↓
Pattern Matching (8 extraction rules)
    ↓
Confidence Scoring (per pattern)
    ↓
Jaccard Deduplication (word-set similarity >60%)
    ↓
Save or Strengthen
```

If a memory exists (Jaccard >60%), its confidence is boosted instead of creating a duplicate.

### Retrieval Phase
```
User Query
    ↓
FTS5 Full-Text Search
    ↓
ACT-R Activation Scoring
    ↓
Touch (increment access_count, update last_access)
    ↓
Hebbian Association Building
    ↓
RRF Fusion Ranking
    ↓
Context Injection into Claude Prompt
```

### Pruning Phase
Hourly cleanup (automatic):
- Stale associations (>30 days, <3 activations) → deleted
- Session cleanup (idle >24 hours) → auto-closed
- Confidence never decreases except on contradiction

## User Interface Integration

### In Discord
Memories are **transparently built** - you won't see them, but they improve accuracy:

```
You: "Fix the authentication bug"
Sam: [searches memory for similar issues]
     "Here's what I've learned about auth..."
     [injects 2-3 relevant prior learnings]
```

### In Claude Code
Via the context injection system:

```markdown
---
## Context from Memory

**Relevant Prior Learning:**

• **Completed**: Fixed validator timeout with fail-closed design (confidence: 85%)
• **Security**: Implemented 10 prompt injection patterns (confidence: 80%)
• **Architecture**: Service mesh reduces latency by 40% (confidence: 72%)

---
```

### Direct Memory Access
Search memories manually via the HTTP API:

```bash
curl -X POST http://localhost:4242/memory/search \
  -H "Content-Type: application/json" \
  -d '{"query":"JWT validation","limit":5}'
```

## Configuration

### Environment Variables
```bash
# In .env or ~/.claude/settings.json
PAI_DIR=/path/to/sam/.claude
```

### Settings
Memory system is **auto-enabled** with no additional configuration required.

To disable memory-capture hook:
1. Edit `~/.claude/settings.json`
2. Remove or comment out the `memory-capture.ts` entry in Stop hooks
3. Memory server continues running (Discord bot still captures)

### Database Location
```
$PAI_DIR/../discord-remote-control/memory.db
```

SQLite format - can be directly queried or backed up.

## Best Practices

### For Effective Learning

1. **Use completion markers** - "✅", "Fixed", "Done" boost confidence
2. **Be explicit** - "Decided to use Redis" vs "Going with that thing"
3. **Link ideas** - Reference prior decisions in new context
4. **Confirm contradictions** - If correcting a prior fact, be clear
5. **Use status updates** - Table format extracts facts reliably

### For Privacy

- Memories are **local-only** - no cloud sync
- Discord history is not retroactively analyzed - only new messages
- Claude Code sessions are self-contained per-session
- Sensitive data is auto-scrubbed from context (tokens, passwords)

### For Performance

- Memory server is lightweight - runs on 4242
- Database grows ~1MB per 10,000 memories
- FTS5 indexing is fast even with 100,000+ memories
- ACT-R scoring adds <10ms to context building

## Troubleshooting

### Memory server not responding

Check if it's running:
```bash
curl http://localhost:4242/memory/health
```

Restart via main infrastructure:
```bash
/start-up --start-voice --start-observe
```

### Memories not being captured

Verify extraction patterns are matching:
1. Check Discord messages have completion markers (✅, "Fixed", "Done")
2. Check response length >50 chars
3. Check response has substantive content (headers, tables, or findings)

### Stale memories not improving

- ACT-R only improves with access: use `findSimilarMemories()` to touch memories
- Touch happens automatically on context injection
- Confidence never decreases on its own (only on contradiction)

### Database size growing too fast

Memories are permanent - no automatic cleanup (by design). To archive:
```bash
cp memory.db memory.db.backup
sqlite3 memory.db "DELETE FROM semantic WHERE created_at < <timestamp>"
```

## Architecture Details

### Database Schema

```sql
semantic (
  id: TEXT PRIMARY KEY,
  session_id: TEXT,
  topic: TEXT,
  summary: TEXT,
  relevance_score: REAL,  -- legacy field
  created_at: INTEGER,
  source_message_ids: TEXT[],
  access_count: INTEGER,          -- ACT-R frequency
  last_access: INTEGER,           -- ACT-R recency
  confidence: REAL,               -- Bayesian strength
  source: TEXT ('discord', 'claude-code-hook')
)

associations (
  source_id: TEXT REFERENCES semantic.id,
  target_id: TEXT REFERENCES semantic.id,
  weight: REAL (0.1-1.0),
  co_activation_count: INTEGER,
  last_activated: INTEGER
)
```

### Key Functions

- `findSimilarMemories(query, sessionId?, limit)` - Primary retrieval
- `hybridSearch(query, options)` - Advanced RRF fusion search
- `touchMemory(id)` - Increment access history
- `updateAssociations(retrievedIds)` - Build Hebbian links
- `pruneStaleAssociations()` - Clean old links

## Limitations & Future Enhancements

### Current Limitations
- Hebbian associates not yet used in ranking (reserved for future enhancement)
- Vector embeddings not supported (would improve semantic search)
- No multi-user memory isolation (single-user system)
- No memory export/import UI

### Planned Enhancements
- Semantic similarity clustering (group related memories)
- Memory visualization dashboard
- Temporal memory analysis (what was learned when)
- Cross-session memory bridging
- Integration with Claude Projects for multi-session coherence

## See Also

- [Discord Remote Control](discord-remote-control.md) - How facts are captured
- [Claude Hooks System](Claude-Hooks-System.md) - Stop hook architecture
- [Architecture Overview](Architecture.md) - System design
- [Best Practices](Best-Practices.md) - Usage recommendations

---

**Memory System Version:** 2.0 (Muninn Cognitive Architecture)
**Last Updated:** 2026-03-07
**Status:** Production Ready - 447 tests passing
