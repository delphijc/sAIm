# MemSearch Quick Reference Guide

**For bash-based agent implementation**

---

## TL;DR - Core Architecture

MemSearch combines:
1. **Markdown files** (human-readable, version-controlled) - source of truth
2. **BGE-M3 embeddings** (ONNX, local, 1024-dim vectors)
3. **Milvus vector database** (dense + sparse indices)
4. **Hybrid search** (dense + BM25 + RRF fusion)
5. **Temporal decay** (recent memories ranked higher)

---

## Quick Start (5 minutes)

```bash
# 1. Source the implementation
source MEMSEARCH_BASH_IMPLEMENTATION.sh

# 2. Initialize
memory_init

# 3. Write observation
memory_write "PostgreSQL 16 chosen for reliability" "decision" "database"

# 4. Search memory
memory_search "database decisions"

# 5. Get context
memory_recall "How do we handle database errors?" 5
```

---

## Key Concepts

### Memory Types

| Type | Location | Purpose | Lifecycle |
|------|----------|---------|-----------|
| **Persistent** | `MEMORY.md` | Durable facts, decisions | Manual review, archival |
| **Daily** | `YYYY-MM-DD.md` | Session observations | Auto-created, pruned |
| **Topic** | `*.md` (custom) | Organized knowledge | Grows with exploration |

### Search Strategy

```
Query → BGE-M3 Embed → Two Parallel Searches:
                      ├─ Dense (semantic): cosine similarity
                      └─ Sparse (keyword): BM25 ranking
                            ↓
                       RRF Fusion (combine ranks)
                            ↓
                       Apply temporal decay
                            ↓
                       Return top-K with attribution
```

### Hybrid Search Scoring (RRF)

**Reciprocal Rank Fusion** combines dense and sparse results:

```
rrf_score = 1/(k + rank_dense) + 1/(k + rank_sparse)

where k=60 (balances early-rank importance)
```

**Result:** Chunks good in BOTH searches rank highest.

---

## API Reference

### Core Functions

```bash
# Write
memory_write "content" [category] [tags]

# Search
memory_search "query" [top_k]          # Returns JSON

# Retrieve & Format
memory_recall "query" [top_k] [format] # format: json|markdown|compact

# Get Full Content
memory_expand chunk_id                 # Get full chunk from ID

# Expand Discovery
memory_related "topic"                 # Find related memories
```

### Maintenance

```bash
# Indexing
memory_reindex                         # Force full reindex (5 min for 10k chunks)
memory_watch                           # Start auto-reindex daemon

# Cleanup
memory_cleanup [days]                  # Archive old files (default: 90 days)
memory_compact                         # Compress archived summaries

# Introspection
memory_list                            # List all memory files
memory_stats                           # System statistics
memory_search_regex "pattern"          # Advanced grep search
```

---

## Configuration

```bash
# Directory (default: ~/.agent/memory)
export MEMORY_DIR="/custom/path"

# Vector search mode (default: true)
export ENABLE_VECTOR_SEARCH=true       # false = grep-only fallback

# Milvus connection
export MILVUS_HOST="localhost"
export MILVUS_PORT="19530"

# memsearch command
export MEMSEARCH_CMD="python3 -m memsearch"
```

---

## Memory File Format

**MEMORY.md (persistent)**
```markdown
# Persistent Knowledge Base

## Architectural Decisions
- PostgreSQL 16 for reliability (date: 2025-11)
- Event sourcing for audit trail

## Known Issues
- Pool exhaustion under high load
  - Solution: Reduced from 50 to 30 connections
```

**Daily Notes (memory/YYYY-MM-DD.md)**
```markdown
# YYYY-MM-DD Session Notes

## HH:MM:SS category
Tags: tag1, tag2

Observation text...
```

---

## Temporal Decay Formula

```
adjusted_score = base_score × 2^(-age_hours / halflife_hours)

Examples:
- Halflife 30 days, chunk age 30 days → multiplier = 0.5
- Halflife 30 days, chunk age 60 days → multiplier = 0.25
```

**Configuration:**
```bash
# Daily notes (high change rate)
halflife_hours=720        # 30 days

# Technical docs (stable)
halflife_hours=2160       # 90 days

# Decay weight (0-1)
decay_weight=0.2          # How much decay affects final score
```

---

## Implementation Modes

### Full Mode (Recommended)
- Requires: Milvus, memsearch Python, ONNX embeddings
- Provides: Semantic search, BM25, RRF, decay
- Setup: 10-15 minutes
- Performance: 50ms search, CPU-only

### Minimal Mode (Fallback)
- Requires: bash, grep only
- Provides: Keyword search only
- Setup: 1 minute (zero dependencies)
- Performance: Fast, but no semantic understanding

### Hybrid Mode (Smart)
- Uses full mode when available
- Auto-fallback to minimal when dependencies missing
- Default behavior in `MEMSEARCH_BASH_IMPLEMENTATION.sh`

---

## Integration Examples

### In Agent Tools (JSON)

```json
{
  "name": "memory_search",
  "execute": "bash memory.sh search \"${query}\" ${top_k}"
}

{
  "name": "memory_write",
  "execute": "bash memory.sh write \"${content}\" \"${category}\" \"${tags}\""
}
```

### In Bash Scripts

```bash
#!/bin/bash
source memory.sh

# Search before starting task
context=$(memory_search "similar past tasks" 3)
echo "Context: $context"

# Work...

# Log completion
memory_write "Task completed successfully" "task" "completed"
```

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Embed 1 chunk | 100ms | ONNX bge-m3 on CPU |
| Upsert 1000 chunks | 2-3s | Batch mode |
| Full reindex (10k chunks) | 5 min | Sequential |
| Search (hybrid) | 50ms | Parallel dense + sparse |
| RRF fusion | <1ms | In-process |
| Memory_write | <10ms | File append only |

---

## Troubleshooting

**Search returns irrelevant results**
- Force reindex: `memory_reindex`
- Check chunk sizes: Large chunks = semantic drift
- Try different top_k values

**Index grows too large**
- Archive old files: `memory_cleanup 90`
- Compact summaries: `memory_compact`

**Vector search unavailable**
- Check: `command -v memsearch`
- Falls back to grep automatically
- Install: `pip install "memsearch[onnx]"`

**Milvus connection issues**
- Check: `telnet localhost 19530`
- Check logs: `journalctl -u milvus -n 20`
- Use: `export ENABLE_VECTOR_SEARCH=false` for grep-only mode

---

## Design Patterns for Bash Agents

### 1. Pre-Task Context Window
```bash
# At task start
context=$(memory_recall "relevant context" 5)
# Use context in task logic
```

### 2. Error-Driven Documentation
```bash
# When error occurs
memory_write "
### Error: $error
Stack: $stack
Fix: $solution
" "error" "debugging"
```

### 3. Decision Logging
```bash
# After architectural choice
memory_write "
### Chose Redis over Memcached
Rationale: Need pub/sub support
" "decision" "architecture"
```

### 4. End-of-Session Summarization
```bash
# At session end
memory_write "
## Session Summary
- Completed: task1, task2
- Errors: error1 (fixed)
- Learnings: insight1
" "summary" "session"
```

---

## Key Insights for Implementation

1. **Markdown First:** Keep source in plain text; index is always rebuildable
2. **Hybrid is Best:** Semantic + keyword together beats either alone
3. **RRF Magic:** Simple algorithm with powerful results; k=60 empirically proven
4. **Lean Context:** Summarize before returning to LLM; don't bloat context
5. **Decay Matters:** Time-based decay is simple; access-based is better
6. **Graceful Fallback:** Always degrade to grep if Milvus unavailable

---

## Quick Implementation Checklist

```bash
□ Copy MEMSEARCH_BASH_IMPLEMENTATION.sh
□ Set MEMORY_DIR environment variable
□ Run: memory_init
□ Add memory_search to agent tools
□ Add memory_write to error handlers
□ Setup memory_watch daemon (background)
□ Schedule memory_cleanup via cron (weekly)
□ Optional: Setup Milvus for full semantic search
```

---

## Additional Resources

**Full Documentation:**
- `/Projects/sam/.agent/skills/discord-remote-control/service/MEMSEARCH_RESEARCH_REPORT.md`

**Implementation:**
- `/Projects/sam/.agent/skills/discord-remote-control/service/MEMSEARCH_BASH_IMPLEMENTATION.sh`

**Official Sources:**
- [MemSearch GitHub](https://github.com/zilliztech/memsearch)
- [Milvus Blog Article](https://milvus.io/blog/we-extracted-openclaws-memory-system-and-opensourced-it-memsearch.md)
- [OpenClaw Docs](https://docs.openclaw.ai/concepts/memory)

---

**Generated:** 2026-03-24
**Status:** Production-ready for bash agent implementation
