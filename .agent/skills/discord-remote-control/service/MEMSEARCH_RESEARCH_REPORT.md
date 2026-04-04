# MemSearch/OpenClaw Memory System - Complete Technical Research Report

**Date:** 2026-03-24
**Project:** Bash-based Agent Memory System Implementation
**Source:** Milvus Blog, MemSearch GitHub, OpenClaw Documentation

---

## EXECUTIVE SUMMARY

MemSearch is a markdown-first, semantic memory system extracted from OpenClaw that enables persistent, searchable agent memory. It combines:
- **Markdown files** as the authoritative source (human-readable, version-controllable)
- **Milvus vector database** as a derived, rebuildable index
- **Hybrid search** combining dense embeddings + BM25 sparse retrieval + RRF fusion
- **ONNX-based local embeddings** (BGE-M3 model, no API keys required)

This architecture is directly applicable to bash-based agents with minimal adaptation.

---

## SECTION 1: MEMORY SYSTEM ARCHITECTURE

### 1.1 Core Philosophy

The foundational principle: **Markdown is the source of truth; Milvus is the derived index.**

**Why this matters:**
- Delete the entire Milvus database? Re-index in minutes by re-scanning markdown files
- Markdown files remain human-readable and version-controllable
- No black-box memory storage obscures what the agent knows
- Supports git workflows for auditing memory changes
- Plain-text format allows manual editing, debugging, and inspection

### 1.2 System Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Interface (Tools/Skills)                              │
│  - memory_search(query, top_k=3)                             │
│  - memory_recall(query_context, top_k=5)                     │
│  - memory_write(fact, category, tags)                        │
│  - memory_expand(chunk_id)                                   │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│  Markdown File Layer (Source of Truth)                       │
│  /memory/YYYY-MM-DD.md  (daily notes)                        │
│  /memory/MEMORY.md      (durable facts, decisions)           │
│  /memory/*.md           (topic-specific notes)               │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│  Indexing Pipeline (Watch → Chunk → Embed → Upsert)          │
│                                                               │
│  1. Watch: Monitor filesystem for changes (1500ms debounce)  │
│  2. Chunk: Split by heading/paragraph structure              │
│  3. Embed: Generate dense + sparse vectors                   │
│  4. Upsert: Store in Milvus with deduplication              │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│  Vector Database Layer (Milvus)                              │
│  - Dense vectors (cosine similarity)                         │
│  - BM25 sparse vectors (full-text search)                    │
│  - Metadata (source path, line numbers, chunks)              │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│  Retrieval Pipeline (Search → RRF Fusion → Rerank)           │
│                                                               │
│  1. Dense Search: Vector similarity (cosine)                 │
│  2. Sparse Search: BM25 keyword matching                     │
│  3. RRF Fusion: Combine ranks (reciprocal rank fusion)       │
│  4. Return: Top-K chunks with source attribution             │
└────────────────────────────────────────────────────────────────┘
```

---

## SECTION 2: MEMORY TYPES AND CATEGORIES

### 2.1 OpenClaw Memory Classification

OpenClaw distinguishes memory by temporal scope and persistence:

#### Persistent Memory (MEMORY.md)
- **Purpose:** Durable facts, decisions, preferences, long-term context
- **Storage:** `/memory/MEMORY.md`
- **Lifecycle:** Manually reviewed, edited, and archived
- **Examples:**
  - Architectural decisions and their rationale
  - User preferences and communication style
  - System capabilities and constraints
  - Important facts that transcend single sessions

#### Session/Daily Memory (memory/YYYY-MM-DD.md)
- **Purpose:** Day-to-day notes, running context, observations
- **Storage:** `/memory/YYYY-MM-DD.md` (one file per day)
- **Lifecycle:** Automatically created per session, manually pruned
- **Examples:**
  - Work completed today
  - Errors encountered and resolutions
  - Code review feedback
  - Questions for follow-up

#### Topic-Specific Memory (memory/*.md)
- **Purpose:** Organized knowledge on specific domains
- **Storage:** `/memory/project-name.md`, `/memory/api-reference.md`, etc.
- **Lifecycle:** Grows as topic is explored
- **Examples:**
  - API documentation extracted from code
  - Third-party library patterns and gotchas
  - Database schema and relationships
  - Known issues and workarounds

### 2.2 Semantic Memory Classification

Based on OpenClaw's retrieval strategy:

**Categorical:** Facts grouped by type (APIs, errors, preferences)
**Temporal:** Records with timestamp importance (recent events > old events)
**Contextual:** Facts linked by relevance (related to current task)
**Procedural:** Step-by-step processes (how to deploy, how to debug)

### 2.3 Memory Metadata

Each memory chunk carries:
```
- source_file: /memory/2026-03-23.md
- start_line: 42
- end_line: 48
- content_hash: sha256(content)
- chunk_id: hash(source:start:end:content_hash:model_version)
- embedding_model: bge-m3
- timestamp_recorded: 2026-03-23T14:35:00Z
- timestamp_accessed: 2026-03-24T09:15:00Z (for decay)
- relevance_score: 0.89 (after RRF fusion)
- tags: ["deployment", "incident", "postgresql"]
```

---

## SECTION 3: STORAGE ARCHITECTURE

### 3.1 Markdown File Structure

**MEMORY.md (Persistent Knowledge)**
```markdown
# System Knowledge

## Architectural Decisions
- PostgreSQL 16 chosen for reliability over newer 17 (decision: 2025-11)
- Redis cluster prevents singleton failure
- Event sourcing for audit trail

## User Preferences
- Likes concise explanations with examples
- Prefers Markdown documentation
- Timezone: Pacific

## Known Issues
- PostgreSQL connection pool exhaustion under load
  - Solution: Reduced pool size from 50 to 30
  - Monitoring: Check metrics at /admin/health
```

**Daily Notes (memory/2026-03-24.md)**
```markdown
# 2026-03-24 Session Notes

## Completed
- [ ] Debugged memory system integration
- [ ] Updated MemSearch embeddings

## Errors Encountered
- BM25 indexing timeout after 10k chunks
  - Fixed by enabling batch upsert mode

## Learnings
- RRF parameter k=60 works well for this corpus
- Decay halflife should be 30 days for mixed note types

## Questions for Next Session
- Should we implement access-based decay instead of time-based?
- How to handle memory compaction at scale?
```

### 3.2 Chunk Storage in Milvus

**Collection Schema**
```
Collection: memory_index
├── id (Primary Key)
│   └── Type: VARCHAR
│   └── Value: hash(source:start:end:content_hash:model_version)
│
├── text (Original Content)
│   └── Type: VARCHAR
│   └── Max Length: 8192
│   └── Analyzer: Enabled (for BM25)
│
├── dense_vector (Semantic Embedding)
│   └── Type: FLOAT_VECTOR
│   └── Dimension: 1024 (bge-m3 output)
│   └── Index: HNSW (cosine similarity)
│
├── sparse_vector (BM25 Sparse)
│   └── Type: SPARSE_FLOAT_VECTOR
│   └── Function: auto_bm25(text)
│   └── Index: SPARSE_INVERTED_INDEX
│
└── metadata (JSON)
    ├── source_file: string
    ├── start_line: int
    ├── end_line: int
    ├── content_hash: string (SHA-256)
    ├── timestamp: int64 (unix)
    ├── access_count: int (for decay)
    └── tags: array[string]
```

**Chunk Deduplication Strategy**

The system uses **content-addressed deduplication** via SHA-256:

```
chunk_id = hash(
  source_path +           # /memory/YYYY-MM-DD.md
  start_line +            # 42
  end_line +              # 48
  content_hash +          # sha256(chunk_text)
  embedding_model_version # bge-m3-1.5
)
```

**Behavior:**
- Re-running indexing on unchanged content: Skip (no re-embed API calls)
- Content changes: Auto-detected via content_hash mismatch → Re-embed
- Model upgrade (bge-m3 → bge-m4): Model version changes → All chunks re-embed
- No external cache needed; dedup is implicit in chunk ID design

---

## SECTION 4: MEMORY RETRIEVAL MECHANISMS

### 4.1 Hybrid Search Pipeline

The retrieval process combines three independent searches and fuses their results:

#### Step 1: Dense Vector Search (Semantic)
```
Query: "How do I handle database connection failures?"

1. Embed query with bge-m3 → 1024-dim vector
2. Search Milvus dense_vector field with cosine similarity
3. Retrieve top 100 candidates (expanded result set)
4. Score each result: similarity_score ∈ [0, 1]

Results (by score):
  1. Chunk 42 (memory/incident-2026-01.md:58-64): 0.87
  2. Chunk 7 (memory/db-patterns.md:12-18): 0.84
  3. Chunk 51 (memory/MEMORY.md:95-102): 0.78
  ...
```

#### Step 2: BM25 Sparse Search (Keyword)
```
Query: "How do I handle database connection failures?"

1. Tokenize query: ["handle", "database", "connection", "failures"]
2. Search sparse_vector field with BM25 ranking
3. Retrieve top 100 candidates
4. Score each result: bm25_score ∈ [0, ∞]

Results (by BM25 score):
  1. Chunk 42 (memory/incident-2026-01.md:58-64): 12.3
  2. Chunk 99 (memory/debugging.md:201-210): 11.8
  3. Chunk 7 (memory/db-patterns.md:12-18): 9.4
  ...
```

#### Step 3: Reciprocal Rank Fusion (RRF)
```
Fuse the two ranked lists using RRF formula:

For each chunk, calculate:
  rrf_score = 1/(k + rank_dense) + 1/(k + rank_sparse)

where k = 60 (default fusion constant)

Example for Chunk 42:
  - Dense rank: 1 → contribution: 1/(60+1) = 0.0164
  - BM25 rank: 1 → contribution: 1/(60+1) = 0.0164
  - Total RRF: 0.0328

Example for Chunk 7:
  - Dense rank: 2 → contribution: 1/(60+2) = 0.0156
  - BM25 rank: 3 → contribution: 1/(60+3) = 0.0154
  - Total RRF: 0.0310

Final Ranking:
  1. Chunk 42: 0.0328 ✓ (high in both)
  2. Chunk 7: 0.0310 (good in both)
  3. Chunk 99: ~0.01 (only in BM25)
```

### 4.2 RRF Algorithm Details

**Reciprocal Rank Fusion** combines multiple ranked lists without score normalization:

```
rrf_score(chunk, k=60) = Σ 1/(k + rank_in_list_i)

Properties:
- Rank-based (not score-based) → Works across different systems
- No normalization needed → BM25 scores don't need scaling
- Simple and robust → Performs well without tuning
- Missing documents → Treated as rank=∞ (negligible contribution)
```

**Why RRF Works:**
- Dense search excels at semantic queries ("similar concepts")
- Sparse search excels at keyword queries ("exact terms")
- RRF gives highest boost to chunks ranking well in BOTH
- A chunk must be good in at least one dimension to rank high

### 4.3 Result Truncation and Expansion

**Returned Results (Default)**
```
top_k=3 chunks, each truncated to 200 chars:

{
  results: [
    {
      chunk_id: "hash(source:start:end:...)",
      text: "PostgreSQL connection pool exhaustion under load...",
      source_file: "/memory/MEMORY.md",
      start_line: 95,
      end_line: 102,
      relevance_score: 0.0328,
      tags: ["database", "incident"]
    },
    ...
  ]
}
```

**Full Expansion (On-Demand)**
```
When agent calls memory_expand(chunk_id):
1. Load full chunk from /memory/YYYY-MM-DD.md
2. Read lines [start_line:end_line]
3. Return full content with context (surrounding heading, etc.)

Keeps initial context window lean; fetch full content only when needed
```

### 4.4 Temporal Decay and Relevance

**Implemented in OpenClaw** (not yet in base MemSearch):

```
adjusted_score = base_score * decay_multiplier

where decay_multiplier = 2^(-age_hours / halflife_hours)

Example:
- Base RRF score: 0.0328
- Chunk age: 30 days (720 hours)
- Decay halflife: 30 days (720 hours)
- Decay multiplier: 2^(-720/720) = 2^-1 = 0.5
- Final score: 0.0328 * 0.5 = 0.0164

Configuration:
- halflife_hours: 720 (30 days)  → Use for daily notes
- halflife_hours: 2160 (90 days) → Use for technical docs
- weight: 0.3 (scale 0-1) → How much decay affects ranking
```

**Access-Based Decay (Advanced)**
```
Alternative strategy: Decay is reset on access

decay_multiplier = 2^(-hours_since_last_access / 7_days)

Insight: Recently accessed memories are more relevant
Advantage: Better captures "working memory" patterns
Disadvantage: Requires tracking access timestamps
```

---

## SECTION 5: EMBEDDING AND VECTOR GENERATION

### 5.1 BGE-M3 Embedding Model

**Model Selection Rationale**
- Benchmark tested 12+ models on bilingual memory retrieval
- MemSearch selected BGE-M3 for optimal performance
- Zero API keys required (runs locally on CPU via ONNX)
- Supports 100+ languages

**Model Specifications**
```
Name: BGE-M3 (BAAI/bge-m3)
Format: ONNX (Open Neural Network Exchange)
Dimension: 1024-dim dense vectors
Max Input: 8192 tokens per chunk
Output: Three vector types simultaneously
  1. dense: 1024-dim (cosine similarity)
  2. sparse: variable-dim (BM25)
  3. ColBERT: compressed token vectors
```

### 5.2 Chunking Strategy

**Semantic Chunking by Structure**

MemSearch chunks markdown by heading hierarchy and paragraph boundaries:

```markdown
# Section A        ← Level 1 heading

Text for section A goes here...

## Subsection A.1   ← Level 2 heading

Content of A.1...

Paragraph break marks end of chunk.

## Subsection A.2

Content of A.2...
```

**Chunk Boundaries**
- Split by heading hierarchy (H1 splits before H2, etc.)
- Paragraph boundaries within a heading
- Max chunk size: configurable (default ~500 tokens)
- Overlap: heading context repeated in child chunks

**Advantages**
- Related content stays together (same section)
- Heading context preserved in chunks
- Respects markdown semantics
- Natural granularity for agent reasoning

### 5.3 Embedding Workflow

```
1. Scan: List all *.md files in memory/ directory

2. Read: Load file contents

3. Chunk: Split by heading/paragraph
   → For each chunk:
     - Extract text
     - Compute SHA-256 content hash
     - Generate chunk ID

4. Deduplicate: Filter chunks with existing chunk_ids
   → Skip unchanged chunks (saved API calls)

5. Embed: For new/changed chunks:
   - Tokenize with bge-m3 tokenizer
   - Generate dense vector (1024-dim)
   - Generate sparse vector (BM25 auto)
   - Extract metadata (source, line numbers, tags)

6. Upsert to Milvus:
   - INSERT or UPDATE based on chunk_id
   - Batch mode (1000 chunks per batch)
   - Automatic index updates
```

**Performance Characteristics**
- ONNX inference: CPU-based, ~100ms per chunk on modern CPU
- Batch processing: Upsert 1000 chunks in ~2-3 seconds
- Full re-index: ~5 min for 10k chunks on CPU
- Incremental (watch): Seconds for changed files

---

## SECTION 6: SEARCH RANKING AND RELEVANCE

### 6.1 RRF Fusion Formula (Detailed)

```
Input:
  D = dense_search_results (list of chunks with ranks)
  S = sparse_search_results (list of chunks with ranks)
  k = fusion constant (default 60)

Output:
  fused_results = sorted by RRF score descending

Algorithm:
  for each chunk in D ∪ S:
    rrf_score = 0

    if chunk in D:
      rank_dense = position of chunk in D (1-indexed)
      rrf_score += 1 / (k + rank_dense)

    if chunk in S:
      rank_sparse = position of chunk in S (1-indexed)
      rrf_score += 1 / (k + rank_sparse)

    chunk.rrf_score = rrf_score

  return sorted(all chunks, key=rrf_score, reverse=True)
```

**Why k=60?**
- Lower k: Gives more weight to rank differences (0.1 vs 1.0)
- Higher k: Flattens scoring (almost equal weight across ranks)
- k=60: Empirically works well for agent memory (tested across datasets)

### 6.2 Additional Ranking Features

**Recency Weighting (Optional)**
```
final_score = rrf_score * (1 - recency_weight) +
              recency_boost * recency_weight

where:
  recency_boost = 2^(-age_days / halflife_days)
  recency_weight ∈ [0, 1] (typically 0.2-0.3)
```

**Diversity Reranking (Optional)**
```
After RRF fusion, optionally apply Maximal Marginal Relevance:

mmr_score = λ * relevance_score - (1-λ) * similarity_to_selected

where:
  λ ∈ [0, 1] (typically 0.5)
  selected = already-returned chunks

Effect: Penalize chunks too similar to what's already returned
Benefit: More diverse results without losing relevance
```

---

## SECTION 7: PRACTICAL BASH-BASED IMPLEMENTATION PATTERNS

### 7.1 Core Operations as Shell Functions

```bash
#!/bin/bash
# memory.sh - Bash memory system interface

MEMORY_DIR="${HOME}/memory"
MILVUS_HOST="localhost"
MILVUS_PORT="19530"

# Write memory (append to daily notes)
memory_write() {
  local content="$1"
  local category="${2:-general}"
  local tags="${3:-}"

  local today=$(date +%Y-%m-%d)
  local file="${MEMORY_DIR}/${today}.md"

  # Create if needed
  [ -f "$file" ] || {
    echo "# ${today} Session Notes" > "$file"
    echo "" >> "$file"
  }

  # Append entry
  echo "## ${category} - $(date +%H:%M:%S)" >> "$file"
  echo "$content" >> "$file"
  echo "" >> "$file"

  # Trigger reindex (watch service should detect)
  echo "Memory written to ${file}"
}

# Search memory (call Milvus API)
memory_search() {
  local query="$1"
  local top_k="${2:-3}"

  # Call memory indexer CLI or Python API
  python3 -m memsearch search \
    --query "$query" \
    --top_k "$top_k" \
    --directory "$MEMORY_DIR"
}

# Get full chunk content
memory_expand() {
  local chunk_id="$1"

  python3 -m memsearch expand \
    --chunk_id "$chunk_id" \
    --directory "$MEMORY_DIR"
}

# Reindex all files
memory_reindex() {
  echo "Reindexing memory files..."
  python3 -m memsearch index \
    --directory "$MEMORY_DIR" \
    --batch_size 1000
}

# Watch for changes (background daemon)
memory_watch() {
  echo "Starting memory watch daemon..."
  python3 -m memsearch watch \
    --directory "$MEMORY_DIR" \
    --debounce_ms 1500 &
}
```

### 7.2 Integration with Agent Tools

```bash
# In agent tool definition (JSON):
{
  "name": "memory_search",
  "description": "Search persistent memory for relevant context",
  "parameters": {
    "query": {
      "type": "string",
      "description": "Search query (natural language)"
    },
    "top_k": {
      "type": "integer",
      "description": "Number of results",
      "default": 3
    }
  },
  "execute": "bash memory.sh search \"${query}\" ${top_k}"
}

{
  "name": "memory_write",
  "description": "Write observation to memory",
  "parameters": {
    "content": {
      "type": "string",
      "description": "What to remember"
    },
    "category": {
      "type": "string",
      "enum": ["learning", "decision", "error", "todo"],
      "default": "general"
    },
    "tags": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Tags for retrieval"
    }
  },
  "execute": "bash memory.sh write \"${content}\" \"${category}\" \"${tags[*]}\""
}
```

### 7.3 File-Based Memory State

**Alternative Minimal Implementation** (no Milvus):

```bash
#!/bin/bash
# memory-lightweight.sh - Filesystem-only memory (grep-based)

MEMORY_DIR="${HOME}/memory"

# Write
memory_write() {
  local content="$1"
  echo "[$(date -Iseconds)] $content" >> "${MEMORY_DIR}/$(date +%Y-%m-%d).log"
}

# Search (using grep and basic ranking)
memory_search() {
  local query="$1"

  # Simple grep-based search
  grep -r "$query" "$MEMORY_DIR" | \
    sed "s|${MEMORY_DIR}/||" | \
    head -10 | \
    awk -F: '{
      # Score based on match count
      score = gsub(/'$query'/, "", $0)
      print score, $0
    }' | \
    sort -rn | \
    cut -d' ' -f2-
}
```

**Tradeoffs:**
- ✓ No external dependencies
- ✓ Pure bash/grep
- ✗ No semantic search
- ✗ Keyword-only matching
- ✗ Poor ranking for ambiguous queries

### 7.4 Hybrid Bash+Python Pattern

```bash
#!/bin/bash
# This pattern leverages Python for complex ops, bash for glue

memory_search_hybrid() {
  local query="$1"

  # Bash: Handle argument validation, defaults
  query="${query:-}"
  [ -z "$query" ] && { echo "Error: query required"; return 1; }

  # Python: Embedding + Milvus search
  python3 << 'EOF'
import sys
sys.path.insert(0, '/path/to/memsearch')
from memsearch import MemSearch

mem = MemSearch(directory='/home/user/memory')
results = mem.search("$1", top_k=3)

# Bash-friendly output format (TSV)
for r in results:
    print(f"{r['score']}\t{r['source_file']}:{r['start_line']}\t{r['text']}")
EOF
}
```

---

## SECTION 8: SYSTEM ARCHITECTURE PATTERNS

### 8.1 Watch-Chunk-Embed-Index Pipeline

```
Timeline Visualization:

File System          Index Service      Milvus
────────────        ──────────────      ──────

Write to file
  memory.md ────────→ Watch (detect change)
                        │
                        ├─ Debounce 1500ms
                        │
                        └─→ Chunk module
                                │
                                ├─ Read file
                                ├─ Split by heading
                                ├─ Compute hashes
                                │
                                └─→ Embed module
                                        │
                                        ├─ BGE-M3 inference
                                        ├─ Dense + Sparse
                                        │
                                        └─→ Upsert
                                                │
                                        ┌───────┴───────┐
                                        │               │
                                    CREATE      REPLACE
                                  (new chunk)  (changed)
                                        │       │
                                        └───────┤
                                                │
                                            Milvus
                                         (updated)
```

### 8.2 Search Request Flow

```
Agent Query          Memory Index       Milvus         Result
─────────────        ────────────       ──────         ──────

"How do I fix
 connection errors?"
    │
    ├─→ Embed query (BGE-M3)
    │       │
    │       └─→ Dense vector (1024-dim)
    │
    ├─→ Parallel searches:
    │
    │   ┌─→ Dense search: cosine similarity
    │   │       └─→ Top 100 by score
    │   │
    │   └─→ Sparse search: BM25 tokenization
    │           └─→ Top 100 by BM25
    │
    ├─→ RRF fusion
    │   ├─ 1/(60 + rank_dense)
    │   ├─ 1/(60 + rank_sparse)
    │   └─ Sum for each chunk
    │
    ├─→ Sort by RRF score
    │
    ├─→ Apply temporal decay (optional)
    │   └─ Newer chunks boosted
    │
    └─→ Return top-3 with attribution
        ├─ Text (200 chars)
        ├─ Source file
        ├─ Line numbers
        └─ Relevance score
```

---

## SECTION 9: MEMORY DECAY AND RELEVANCE MECHANISMS

### 9.1 Time-Based Decay

```python
def apply_temporal_decay(score, chunk_age_hours, halflife_hours=720):
    """
    Exponential decay formula.

    Args:
        score: Original RRF score
        chunk_age_hours: Hours since chunk was created/modified
        halflife_hours: Hours for score to decay to 50%

    Returns:
        Adjusted score with temporal decay applied
    """
    decay_multiplier = 2 ** (-chunk_age_hours / halflife_hours)
    return score * decay_multiplier
```

**Decay Curves:**
```
Halflife = 30 days (720 hours)

Time    Multiplier  Score (base 0.03)
─────   ──────────  ────────────────
0 days  1.0         0.030
7 days  0.84        0.025
14 days 0.71        0.021
30 days 0.50        0.015
60 days 0.25        0.008
90 days 0.12        0.004
```

### 9.2 Access-Based Decay

```python
def apply_access_decay(score, hours_since_last_access, halflife_hours=168):
    """
    Decay based on when chunk was last retrieved (not when it was created).

    Insight: A chunk retrieved yesterday is more "fresh" than one created
    60 days ago but never accessed.
    """
    decay_multiplier = 2 ** (-hours_since_last_access / halflife_hours)
    return score * decay_multiplier
```

### 9.3 Activation and Salience

**Concept:** Not all memories are equally important at all times.

```python
class MemorySalience:
    def __init__(self):
        self.access_count = 0
        self.last_access = None
        self.creation_time = None

    def get_salience_score(self):
        """
        Higher salience = more likely to activate in context

        Factors:
        - Frequency: How often accessed (recency)
        - Recency: When last accessed
        - Strength: How directly relevant to current task
        """
        recency_score = self.recency_decay()
        frequency_score = min(self.access_count / 10, 1.0)  # Cap at 1.0

        return 0.6 * recency_score + 0.4 * frequency_score

    def recency_decay(self):
        hours_elapsed = (now() - self.last_access).total_seconds() / 3600
        return 2 ** (-hours_elapsed / 168)  # 1-week halflife
```

### 9.4 Recommended Settings for Bash Agents

```bash
# Bash implementation hints

# For daily notes (high change rate):
DECAY_HALFLIFE_HOURS=720   # 30 days

# For technical docs (stable):
DECAY_HALFLIFE_HOURS=2160  # 90 days

# Decay weight in final score:
DECAY_WEIGHT=0.2           # Decay contributes 20% to ranking

# Access frequency cap:
MAX_FREQUENCY_BOOST=1.5    # Don't let frequent access > 1.5x boost
```

---

## SECTION 10: ARCHITECTURE PATTERNS FOR AGENTS

### 10.1 Memory Recall Skill (Isolated Context)

MemSearch recommends running memory recall in a **forked subagent context**:

```
Main Agent               Subagent
──────────              ─────────

Query: "How do we
       handle timeouts?"
    │
    └─→ Fork subagent
            │
            ├─ Search memory
            │   └─ Retrieve 5-10 chunks
            │
            ├─ Expand full content
            │   └─ Load actual files
            │
            ├─ Rank by relevance
            │   └─ Apply decay, RRF
            │
            ├─ Summarize findings
            │   └─ Generate 2-3 sentence summary
            │
            └─→ Return to main agent
                └─ Main keeps context lean
                    (only summary, not full chunks)
```

**Benefits:**
- Main agent context stays small
- Memory operations don't pollute main trace
- Easy to parallelize (run multiple searches)
- Can cache summaries

### 10.2 Memory Update Patterns

**Pattern 1: End-of-Task Summarization**
```bash
# After completing a task, summarize learnings
memory_write "
## Task: Deploy to production

### What worked
- Gradual rollout with monitoring
- Feature flag for instant rollback

### What failed
- Initial deployment to all regions (should be staggered)

### Next time
- Always use canary deployment first
" "learning" "deployment production"
```

**Pattern 2: Error-Driven Documentation**
```bash
# When encountering an error, immediately capture it
memory_write "
### Error: Connection pool exhaustion

Stack trace: [...]
Resolution: Reduced pool size from 50 to 30
Root cause: High concurrency during data sync

Monitor: /admin/health
" "error" "database postgresql"
```

**Pattern 3: Decision Logging**
```bash
# When making an architectural decision
memory_write "
### Chose Redis over Memcached

Rationale:
- Redis supports pub/sub (needed for event streaming)
- Better memory efficiency for large values
- Cluster support for HA

Trade-off: Slightly slower than Memcached for simple caching
Date decided: 2026-03-15
" "decision" "architecture caching"
```

### 10.3 Integration with LLM Agent Tools

**Tool Definitions (JSON Schema):**

```json
{
  "tools": [
    {
      "name": "memory_search",
      "description": "Search long-term memory for relevant context",
      "input_schema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Natural language search query"
          },
          "top_k": {
            "type": "integer",
            "default": 3,
            "description": "Number of results"
          }
        },
        "required": ["query"]
      }
    },
    {
      "name": "memory_write",
      "description": "Write an observation to persistent memory",
      "input_schema": {
        "type": "object",
        "properties": {
          "content": {
            "type": "string",
            "description": "What to remember (markdown format)"
          },
          "category": {
            "type": "string",
            "enum": ["learning", "error", "decision", "todo", "general"],
            "description": "Memory category"
          },
          "tags": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Tags for better retrieval"
          }
        },
        "required": ["content"]
      }
    },
    {
      "name": "memory_expand",
      "description": "Get full content of a memory chunk",
      "input_schema": {
        "type": "object",
        "properties": {
          "chunk_id": {
            "type": "string",
            "description": "Chunk ID from memory_search result"
          }
        },
        "required": ["chunk_id"]
      }
    }
  ]
}
```

---

## SECTION 11: EMBEDDING MODEL CONFIGURATION

### 11.1 BGE-M3 ONNX Setup for Bash

```bash
#!/bin/bash
# setup-embeddings.sh

# Install memsearch with ONNX support
pip install "memsearch[onnx]"

# First run downloads ~558 MB model
python3 -c "
from memsearch.embeddings import ONNXEmbedder
embedder = ONNXEmbedder()  # Auto-downloads bge-m3 from HF Hub
print('Embedding model ready')
"

# Verify
python3 << 'EOF'
from memsearch.embeddings import ONNXEmbedder
embedder = ONNXEmbedder()

# Test embedding
query = "How do I handle database errors?"
embedding = embedder.embed(query)
print(f"Embedding dimension: {len(embedding)}")
print(f"First 10 values: {embedding[:10]}")
EOF
```

### 11.2 Alternative Embedding Providers

OpenClaw supports pluggable embedding providers:

```python
# OpenAI (API key required)
from memsearch.embeddings import OpenAIEmbedder
embedder = OpenAIEmbedder(model="text-embedding-3-small")

# Ollama (self-hosted)
from memsearch.embeddings import OllamaEmbedder
embedder = OllamaEmbedder(model="nomic-embed-text")

# Local GGUF
from memsearch.embeddings import GGUFEmbedder
embedder = GGUFEmbedder(model_path="/path/to/model.gguf")
```

---

## SECTION 12: IMPLEMENTATION ROADMAP FOR BASH AGENT

### Phase 1: Minimal MVP (Week 1)
- [x] Plain markdown memory files (MEMORY.md + daily notes)
- [x] grep-based search (keyword only)
- [x] memory_write bash function
- [x] memory_search bash function
- Tools: bash, grep, sed

### Phase 2: Semantic Search (Week 2-3)
- [ ] Setup Milvus locally (Docker or binary)
- [ ] Integrate memsearch Python library
- [ ] Implement watch-index pipeline
- [ ] Dense + sparse hybrid search
- [ ] RRF fusion ranking
- Tools: Python, Milvus, ONNX

### Phase 3: Advanced Features (Week 4+)
- [ ] Temporal decay scoring
- [ ] Access-based memory activation
- [ ] Memory compaction/summarization
- [ ] Multi-embedding provider support
- [ ] Cross-session context transfer
- Tools: All above + custom bash wrappers

### Phase 4: Production Hardening (Week 5+)
- [ ] Error handling and recovery
- [ ] Memory quota management
- [ ] Parallel search optimization
- [ ] Audit logging
- [ ] Backup/restore procedures

---

## SECTION 13: BASH IMPLEMENTATION EXAMPLES

### 13.1 Complete Memory Module

```bash
#!/bin/bash
set -euo pipefail

MEMORY_DIR="${MEMORY_DIR:-$HOME/.agent/memory}"
MEMSEARCH_CMD="${MEMSEARCH_CMD:-python3 -m memsearch}"

# Initialize memory directory
memory_init() {
  mkdir -p "$MEMORY_DIR"
  [ -f "$MEMORY_DIR/MEMORY.md" ] || {
    cat > "$MEMORY_DIR/MEMORY.md" << 'EOF'
# Persistent Knowledge Base

## Agent Profile
- Name: Bash Agent
- Created: $(date -Iseconds)

## System Preferences
- Language: English
- Verbosity: Concise

## Known Issues
(Empty - will be populated)

## Important Decisions
(Empty - will be populated)
EOF
  }
  echo "Memory initialized at $MEMORY_DIR"
}

# Write to memory
memory_write() {
  local content="$1"
  local category="${2:-general}"
  local tags="${3:-}"

  local today=$(date +%Y-%m-%d)
  local daily_file="$MEMORY_DIR/${today}.md"
  local timestamp=$(date -Iseconds)

  # Create daily file if needed
  [ -f "$daily_file" ] || {
    echo "# $today Session" > "$daily_file"
    echo "" >> "$daily_file"
  }

  # Append entry
  {
    echo "## [$timestamp] $category"
    if [ -n "$tags" ]; then
      echo "Tags: $tags"
    fi
    echo ""
    echo "$content"
    echo ""
  } >> "$daily_file"

  return 0
}

# Search memory
memory_search() {
  local query="$1"
  local top_k="${2:-3}"

  $MEMSEARCH_CMD search \
    --directory "$MEMORY_DIR" \
    --query "$query" \
    --top_k "$top_k" \
    --output json | \
    jq '.results[] | {score: .relevance_score, source: .source_file, text: .text}' || \
    {
      # Fallback to grep if memsearch not available
      grep -r "$query" "$MEMORY_DIR" 2>/dev/null | head -$top_k
    }
}

# Expand a chunk
memory_expand() {
  local chunk_id="$1"

  $MEMSEARCH_CMD expand \
    --directory "$MEMORY_DIR" \
    --chunk_id "$chunk_id" \
    --output text
}

# Reindex memory
memory_reindex() {
  echo "Reindexing memory..."
  $MEMSEARCH_CMD index \
    --directory "$MEMORY_DIR" \
    --batch_size 1000
}

# Retrieve and summarize memory for context window
memory_recall() {
  local query="$1"
  local top_k="${2:-5}"

  local results=$($MEMSEARCH_CMD search \
    --directory "$MEMORY_DIR" \
    --query "$query" \
    --top_k "$top_k" \
    --output json)

  echo "## Recalled Memory"
  echo ""
  echo "Query: $query"
  echo ""

  echo "$results" | jq -r '.results[] | "- \(.source_file):\(.start_line)-\(.end_line): \(.text)"'
}

# Main command router
if [ $# -eq 0 ]; then
  echo "Usage: memory_module.sh {init|write|search|expand|reindex|recall} [args]"
  exit 1
fi

cmd="$1"
shift

case "$cmd" in
  init) memory_init "$@" ;;
  write) memory_write "$@" ;;
  search) memory_search "$@" ;;
  expand) memory_expand "$@" ;;
  reindex) memory_reindex "$@" ;;
  recall) memory_recall "$@" ;;
  *) echo "Unknown command: $cmd"; exit 1 ;;
esac
```

### 13.2 Integration with Agent Main Loop

```bash
#!/bin/bash
# agent-main.sh - Sample agent using memory system

set -euo pipefail

source "$(dirname "$0")/memory_module.sh"

AGENT_MEMORY_DIR="$HOME/.agent/memory"
AGENT_LOGS="$HOME/.agent/logs"

# Initialize on startup
memory_init

# Simulate agent thinking process
agent_process_task() {
  local task="$1"

  echo "Agent received task: $task"

  # Recall relevant context
  local context=$(memory_recall "$task" 3)
  echo "$context"

  # Log the task
  memory_write "
## Task Started
Input: $task
Started: $(date -Iseconds)
" "task" "active"

  # Do work (simulated)
  sleep 2

  # Log completion
  memory_write "
## Task Completed
Input: $task
Completed: $(date -Iseconds)

### Learnings
- Completed successfully
- Context recall improved accuracy
" "task" "completed"
}

# Main loop
main() {
  while read -r task; do
    agent_process_task "$task"
  done
}

# If called with task as argument
if [ $# -gt 0 ]; then
  agent_process_task "$*"
else
  main
fi
```

---

## SECTION 14: KEY INSIGHTS FOR BASH IMPLEMENTATION

### 14.1 Design Principles

1. **Markdown-First:** Keep source of truth in plain text
2. **Rebuild-Safe:** Vector index is always rebuildable
3. **Hybrid Search:** Semantic + keyword together > either alone
4. **Lean Context:** Summarize before returning to main agent
5. **Minimal Dependencies:** ONNX runs on CPU, no cloud APIs required

### 14.2 Performance Optimization

| Operation | Time | Notes |
|-----------|------|-------|
| Embed 1 chunk | 100ms | ONNX on CPU (bge-m3) |
| Upsert 1000 chunks | 2-3s | Batch mode |
| Full reindex (10k chunks) | 5 min | Sequential, CPU-bound |
| Search (dense + sparse) | 50ms | Parallel in Milvus |
| RRF fusion | <1ms | In-process ranking |

### 14.3 Bash-Specific Patterns

**Use `jq` for JSON parsing:**
```bash
memory_search "topic" | jq '.results[0].text'
```

**Batch writes to reduce I/O:**
```bash
{
  memory_write "entry 1" "learning"
  memory_write "entry 2" "error"
  memory_write "entry 3" "decision"
} # All writes buffered, written together
```

**Leverage `grep -P` for regex:**
```bash
# Find all errors with timestamps
grep -P "ERROR.*\d{4}-\d{2}-\d{2}" "$MEMORY_DIR"/*.md
```

**Use `find` for file discovery:**
```bash
# Find all memory files modified today
find "$MEMORY_DIR" -name "*.md" -mtime 0
```

---

## SECTION 15: COMPARISON: MEMSEARCH VS ALTERNATIVES

| Feature | MemSearch | Vector DB Only | Grep Only |
|---------|-----------|---|---|
| Semantic search | ✓ | ✓ | ✗ |
| Keyword search | ✓ | ✗ | ✓ |
| Human-readable source | ✓ | ✗ | ✓ |
| Rebuilding | ✓ (minutes) | Varies | N/A |
| Decay/ranking | ✓ | ✗ | ✗ |
| Setup complexity | Low | Medium | Trivial |
| API cost | None (ONNX) | Varies | None |
| Dependencies | Python, Milvus | (DB) | bash |

---

## SECTION 16: TROUBLESHOOTING GUIDE

### Problem: Search returns irrelevant results

**Root Causes:**
1. Embeddings not updated (check mtime of chunks)
2. RRF weight k too high (try k=60)
3. Chunks too large (semantic drift)

**Solutions:**
```bash
# Force reindex
memory_reindex

# Check chunk sizes
python3 -c "
from memsearch import MemSearch
mem = MemSearch('$MEMORY_DIR')
for chunk in mem.chunks:
    print(f'{len(chunk.text)} tokens: {chunk.id}')
" | sort -n | tail -20
```

### Problem: Memory index grows too large

**Solutions:**
```bash
# Compact old sessions
python3 << 'EOF'
import os
from datetime import datetime, timedelta

memory_dir = os.path.expanduser('~/.agent/memory')
cutoff = datetime.now() - timedelta(days=90)

for file in os.listdir(memory_dir):
    if file.endswith('.md') and file != 'MEMORY.md':
        path = os.path.join(memory_dir, file)
        mtime = datetime.fromtimestamp(os.path.getmtime(path))
        if mtime < cutoff:
            print(f"Archive: {file}")
            os.rename(path, path.replace('.md', '.archive.md'))
EOF

# Rebuild index
memory_reindex
```

### Problem: BGE-M3 model download fails

**Solutions:**
```bash
# Manual download
python3 << 'EOF'
from huggingface_hub import snapshot_download
snapshot_download("BAAI/bge-m3", cache_dir="~/.cache/huggingface")
EOF

# Use alternative model
MEMSEARCH_EMBEDDING_MODEL="nomic-embed-text" memory_reindex
```

---

## SECTION 17: REFERENCES AND SOURCES

### Primary Sources
- [MemSearch GitHub Repository](https://github.com/zilliztech/memsearch)
- [Milvus Blog: We Extracted OpenClaw's Memory System](https://milvus.io/blog/we-extracted-openclaws-memory-system-and-opensourced-it-memsearch.md)
- [OpenClaw Memory Concepts Documentation](https://docs.openclaw.ai/concepts/memory)
- [MemSearch Documentation](https://zilliztech.github.io/memsearch/)

### Technical References
- [BGE-M3 Model (HuggingFace)](https://huggingface.co/BAAI/bge-m3)
- [Milvus Hybrid Search Documentation](https://milvus.io/docs/multi-vector-search.md)
- [Reciprocal Rank Fusion (Azure)](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking)
- [OpenSearch RRF Blog](https://opensearch.org/blog/introducing-reciprocal-rank-fusion-hybrid-search/)

### Related Implementations
- [ClawMem: On-device Memory for AI Agents](https://github.com/yoloshii/ClawMem)
- [Memory-LanceDB-Pro: Enhanced LanceDB Memory Plugin](https://github.com/CortexReach/memory-lancedb-pro)
- [Bash Agent Patterns (Vercel)](https://vercel.com/blog/how-to-build-agents-with-filesystems-and-bash)

---

## APPENDIX: QUICK START CHECKLIST

```bash
# 1. Install memsearch
pip install "memsearch[onnx]"

# 2. Initialize memory structure
mkdir -p ~/.agent/memory
cat > ~/.agent/memory/MEMORY.md << 'EOF'
# Agent Memory

## System Info
Created: $(date)
EOF

# 3. Source memory module
source /path/to/memory_module.sh

# 4. Test basic operations
memory_write "Initial memory test" "learning"
memory_search "memory test"

# 5. Setup background indexing
memory_watch &

# 6. Integrate with agent tools
# Add memory_search and memory_write to agent tool definitions
```

---

**End of Report**

*This research documents MemSearch/OpenClaw memory system architecture, designed for implementation in bash-based AI agents. All technical details extracted from official documentation and GitHub repositories as of March 2026.*
