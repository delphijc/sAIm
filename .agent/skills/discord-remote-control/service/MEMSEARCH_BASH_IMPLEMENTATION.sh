#!/bin/bash
#
# MEMSEARCH_BASH_IMPLEMENTATION.sh
# Complete working implementation of MemSearch memory system for bash agents
#
# This script provides production-ready memory functions based on MemSearch/OpenClaw
# architecture, with both Python+Milvus (full) and pure-bash (minimal) modes
#

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEMORY_DIR="${MEMORY_DIR:-${HOME}/.agent/memory}"
MILVUS_HOST="${MILVUS_HOST:-localhost}"
MILVUS_PORT="${MILVUS_PORT:-19530}"
MEMSEARCH_CMD="${MEMSEARCH_CMD:-python3 -m memsearch}"
ENABLE_VECTOR_SEARCH="${ENABLE_VECTOR_SEARCH:-true}"

# Ensure memory directory exists
mkdir -p "$MEMORY_DIR"

# ============================================================================
# SECTION 1: INITIALIZATION
# ============================================================================

memory_init() {
  """
  Initialize the memory system with directory structure and seed files.
  """
  local verbose="${1:-false}"

  # Create structure
  mkdir -p "$MEMORY_DIR"

  # Create MEMORY.md if not exists
  if [ ! -f "$MEMORY_DIR/MEMORY.md" ]; then
    cat > "$MEMORY_DIR/MEMORY.md" << 'EOF'
# Persistent Knowledge Base

## Agent Profile
- Created: $(date -Iseconds)
- System: Bash Agent

## Architectural Decisions
(To be populated as decisions are made)

## Known Issues and Solutions
(To be populated as issues are encountered)

## User Preferences
(To be populated as preferences are learned)

## Important Facts
(To be populated with durable facts)
EOF
    [ "$verbose" = "true" ] && echo "Created MEMORY.md"
  fi

  echo "Memory system initialized at: $MEMORY_DIR"
}

# ============================================================================
# SECTION 2: MEMORY WRITE OPERATIONS
# ============================================================================

memory_write() {
  """
  Write an observation to daily memory file.

  Usage: memory_write "content" [category] [tags]

  Examples:
    memory_write "PostgreSQL fix" "solution" "database"
    memory_write "Task completed" "task"
  """
  local content="$1"
  local category="${2:-general}"
  local tags="${3:-}"

  if [ -z "$content" ]; then
    echo "Error: content required" >&2
    return 1
  fi

  local today=$(date +%Y-%m-%d)
  local daily_file="$MEMORY_DIR/${today}.md"
  local timestamp=$(date -Iseconds)
  local hour_min=$(date +%H:%M:%S)

  # Create daily file if needed
  if [ ! -f "$daily_file" ]; then
    cat > "$daily_file" << EOF
# $today Session Notes

EOF
  fi

  # Append entry
  {
    echo "## [$hour_min] $category"
    [ -n "$tags" ] && echo "**Tags:** $tags"
    echo ""
    echo "$content"
    echo ""
  } >> "$daily_file"

  # Trigger reindex if watch is enabled
  if [ "$ENABLE_VECTOR_SEARCH" = "true" ] && command -v "$MEMSEARCH_CMD" &>/dev/null; then
    # Fire off background reindex (don't wait)
    ( $MEMSEARCH_CMD index --directory "$MEMORY_DIR" --batch_size 500 >/dev/null 2>&1 ) &
  fi

  return 0
}

# ============================================================================
# SECTION 3: MEMORY READ OPERATIONS
# ============================================================================

memory_search() {
  """
  Search memory using hybrid search (vector + keyword).

  Usage: memory_search "query" [top_k]

  Returns JSON with results.
  """
  local query="$1"
  local top_k="${2:-3}"

  if [ -z "$query" ]; then
    echo "Error: query required" >&2
    return 1
  fi

  if [ "$ENABLE_VECTOR_SEARCH" = "true" ] && command -v "$MEMSEARCH_CMD" &>/dev/null; then
    _memory_search_vector "$query" "$top_k"
  else
    _memory_search_grep "$query" "$top_k"
  fi
}

_memory_search_vector() {
  """
  Hybrid search using memsearch (vector + BM25 + RRF).
  Requires: Milvus, memsearch Python library, ONNX embeddings
  """
  local query="$1"
  local top_k="$2"

  # Call memsearch CLI
  if $MEMSEARCH_CMD search \
    --directory "$MEMORY_DIR" \
    --query "$query" \
    --top_k "$top_k" \
    --output json 2>/dev/null; then
    return 0
  else
    # Fallback to grep if memsearch fails
    echo "Warning: Vector search unavailable, falling back to grep" >&2
    _memory_search_grep "$query" "$top_k"
  fi
}

_memory_search_grep() {
  """
  Fallback: Grep-based search (keyword matching only).
  No vector embeddings, but requires zero setup.
  """
  local query="$1"
  local top_k="$2"

  local json_output="{"
  json_output+="\"results\": ["

  local count=0
  local first=true

  while IFS= read -r line; do
    if [ $count -ge "$top_k" ]; then break; fi

    # Parse grep output: file:line:content
    local file=$(echo "$line" | cut -d: -f1)
    local content=$(echo "$line" | cut -d: -f3-)

    if [ "$first" = true ]; then
      first=false
    else
      json_output+=","
    fi

    json_output+="{
      \"text\": \"$(echo "$content" | sed 's/"/\\"/g' | head -c 200)...\",
      \"source_file\": \"$file\",
      \"relevance_score\": 0.0,
      \"chunk_id\": \"grep-fallback\"
    }"

    ((count++))
  done < <(grep -r "$query" "$MEMORY_DIR" 2>/dev/null | sort -t: -k1 -u | head -$((top_k * 2)))

  json_output+="]}"

  echo "$json_output"
}

# ============================================================================
# SECTION 4: CHUNK EXPANSION
# ============================================================================

memory_expand() {
  """
  Get full content of a memory chunk by ID or file reference.

  Usage: memory_expand chunk_id
         memory_expand /path/to/file.md:start_line:end_line
  """
  local chunk_ref="$1"

  if [ -z "$chunk_ref" ]; then
    echo "Error: chunk reference required" >&2
    return 1
  fi

  # Try memsearch first
  if [ "$ENABLE_VECTOR_SEARCH" = "true" ] && command -v "$MEMSEARCH_CMD" &>/dev/null; then
    if $MEMSEARCH_CMD expand \
      --directory "$MEMORY_DIR" \
      --chunk_id "$chunk_ref" \
      --output text 2>/dev/null; then
      return 0
    fi
  fi

  # Fallback: Try direct file reference
  if [[ "$chunk_ref" == *":"* ]]; then
    local file=$(echo "$chunk_ref" | cut -d: -f1)
    local start=$(echo "$chunk_ref" | cut -d: -f2)
    local end=$(echo "$chunk_ref" | cut -d: -f3)

    if [ -f "$file" ] && [ -n "$start" ] && [ -n "$end" ]; then
      sed -n "${start},${end}p" "$file"
      return 0
    fi
  fi

  echo "Error: could not expand chunk: $chunk_ref" >&2
  return 1
}

# ============================================================================
# SECTION 5: MEMORY INDEXING
# ============================================================================

memory_reindex() {
  """
  Force reindex of all memory files.

  This regenerates embeddings for all chunks.
  Safe operation - never loses data (markdown is source of truth).
  """
  if [ "$ENABLE_VECTOR_SEARCH" = "false" ]; then
    echo "Vector search disabled; nothing to reindex"
    return 0
  fi

  if ! command -v "$MEMSEARCH_CMD" &>/dev/null; then
    echo "Error: memsearch not installed" >&2
    return 1
  fi

  echo "Reindexing memory files in: $MEMORY_DIR"
  $MEMSEARCH_CMD index \
    --directory "$MEMORY_DIR" \
    --batch_size 1000 \
    --force
}

memory_watch() {
  """
  Start background daemon to watch for changes and auto-reindex.

  The daemon monitors for file modifications with debounce.
  Safe to run multiple times (idempotent).
  """
  if [ "$ENABLE_VECTOR_SEARCH" = "false" ]; then
    echo "Vector search disabled; watch not started"
    return 0
  fi

  if ! command -v "$MEMSEARCH_CMD" &>/dev/null; then
    echo "Error: memsearch not installed" >&2
    return 1
  fi

  # Check if already running
  if pgrep -f "memsearch watch.*$MEMORY_DIR" > /dev/null; then
    echo "Watch daemon already running"
    return 0
  fi

  echo "Starting memory watch daemon..."
  $MEMSEARCH_CMD watch \
    --directory "$MEMORY_DIR" \
    --debounce_ms 1500 \
    &

  disown
  return 0
}

# ============================================================================
# SECTION 6: MEMORY RETRIEVAL AND SUMMARIZATION
# ============================================================================

memory_recall() {
  """
  Retrieve relevant memory chunks and return as formatted markdown.

  This is the main interface for agents seeking context.
  Returns chunks with source attribution and scoring.

  Usage: memory_recall "what I need to know"
  """
  local query="$1"
  local top_k="${2:-5}"
  local format="${3:-markdown}"

  if [ -z "$query" ]; then
    echo "Error: query required" >&2
    return 1
  fi

  local results=$(memory_search "$query" "$top_k")

  case "$format" in
    json)
      echo "$results"
      ;;
    markdown)
      _format_recall_markdown "$results"
      ;;
    compact)
      _format_recall_compact "$results"
      ;;
    *)
      echo "Unknown format: $format" >&2
      return 1
      ;;
  esac
}

_format_recall_markdown() {
  """
  Format recall results as markdown for LLM context.
  """
  local results="$1"

  echo "## Recalled Memory"
  echo ""
  echo "**Relevant context retrieved from persistent memory:**"
  echo ""

  echo "$results" | jq -r '.results[] |
    "### " + (.source_file | split("/") | .[-1]) + ":" + (.start_line|tostring) + "\n" +
    "**Relevance:** " + (.relevance_score|tostring) + "\n" +
    (.text | gsub("\\n"; "  \n")) + "\n"' 2>/dev/null || \
    echo "No results found"

  echo ""
}

_format_recall_compact() {
  """
  Format recall results as compact bullets.
  """
  local results="$1"

  echo "$results" | jq -r '.results[] |
    "- [" + (.relevance_score|tostring|.[0:4]) + "] " +
    (.source_file | split("/") | .[-1]) + ": " +
    (.text | .[0:80] | gsub("\\n"; " ")) + "..."' 2>/dev/null || \
    echo "No results found"
}

memory_related() {
  """
  Find all chunks related to a topic, with relationship scoring.

  Useful for discovering connected knowledge.
  """
  local topic="$1"
  local depth="${2:-2}"

  # Recall primary results
  local primary=$(memory_search "$topic" 10)

  # For each result, find related chunks
  echo "## Related Topics: $topic"
  echo ""

  echo "$primary" | jq -r '.results[0:3] | .[] | .text' 2>/dev/null | while read -r chunk; do
    echo "### From: $(echo "$chunk" | head -c 50)..."
    echo ""

    # Extract key phrases and search for them too
    local keywords=$(echo "$chunk" | tr ' ' '\n' | grep -v '^$' | sort -u | head -3)
    for kw in $keywords; do
      if [ ${#kw} -gt 4 ]; then
        memory_search "$kw" 2 | jq -r '.results[] | "  - " + .text[0:60]' 2>/dev/null
      fi
    done

    echo ""
  done
}

# ============================================================================
# SECTION 7: MEMORY CLEANUP AND MAINTENANCE
# ============================================================================

memory_cleanup() {
  """
  Archive old session notes and compact memory.

  Moves daily notes older than N days to archive.
  Useful for keeping working memory lean.

  Usage: memory_cleanup [days_threshold=90]
  """
  local days_threshold="${1:-90}"

  echo "Archiving memory files older than $days_threshold days..."

  local cutoff=$(date -d "$days_threshold days ago" +%Y-%m-%d)

  count=0
  while IFS= read -r file; do
    filename=$(basename "$file")

    # Extract date from filename (YYYY-MM-DD.md)
    if [[ $filename =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2})\.md$ ]]; then
      filedate="${BASH_REMATCH[1]}"

      if [ "$filedate" \< "$cutoff" ] 2>/dev/null; then
        mkdir -p "$MEMORY_DIR/archive"
        mv "$file" "$MEMORY_DIR/archive/${filedate}.archive.md"
        ((count++))
        echo "  Archived: $filedate"
      fi
    fi
  done < <(find "$MEMORY_DIR" -maxdepth 1 -name '*.md' -type f | sort)

  echo "Archived $count files"

  # Reindex to remove archived chunks
  if [ "$ENABLE_VECTOR_SEARCH" = "true" ]; then
    memory_reindex
  fi
}

memory_compact() {
  """
  Summarize old memories and compress them.

  Generates concise summaries of archived memory files.
  """
  local archive_dir="$MEMORY_DIR/archive"

  if [ ! -d "$archive_dir" ]; then
    echo "No archived files to compact"
    return 0
  fi

  echo "Compacting archived memories..."

  local summary_file="$MEMORY_DIR/SUMMARIES.md"
  cat >> "$summary_file" << 'EOF'

# Memory Summaries (Compressed Archives)

EOF

  for archive_file in "$archive_dir"/*.archive.md; do
    [ -f "$archive_file" ] || continue

    local date=$(basename "$archive_file" .archive.md)
    local entries=$(grep -c "^##" "$archive_file" 2>/dev/null || echo "unknown")

    echo "- **$date**: $entries entries" >> "$summary_file"
  done

  echo "Summaries written to: $summary_file"
}

# ============================================================================
# SECTION 8: STATISTICS AND REPORTING
# ============================================================================

memory_stats() {
  """
  Print statistics about memory system.
  """
  echo "Memory System Statistics"
  echo "========================"
  echo ""
  echo "Location: $MEMORY_DIR"
  echo ""

  # Count files
  local total_files=$(find "$MEMORY_DIR" -name "*.md" -type f | wc -l)
  local daily_files=$(find "$MEMORY_DIR" -maxdepth 1 -name "20*.md" -type f | wc -l)
  local archived_files=$(find "$MEMORY_DIR/archive" -name "*.archive.md" -type f 2>/dev/null | wc -l)

  echo "Files:"
  echo "  Total: $total_files"
  echo "  Daily notes: $daily_files"
  echo "  Archived: $archived_files"
  echo ""

  # Count entries
  if [ $total_files -gt 0 ]; then
    local total_entries=$(grep -r "^##" "$MEMORY_DIR" 2>/dev/null | wc -l)
    echo "Entries: $total_entries"
    echo ""
  fi

  # Disk usage
  local size=$(du -sh "$MEMORY_DIR" 2>/dev/null | cut -f1)
  echo "Disk usage: $size"
  echo ""

  # Vector index status
  if [ "$ENABLE_VECTOR_SEARCH" = "true" ]; then
    if command -v "$MEMSEARCH_CMD" &>/dev/null; then
      echo "Vector Search: ENABLED"
      # Try to get Milvus status
      if timeout 2 python3 -c "from pymilvus import MilvusClient; MilvusClient(uri='http://$MILVUS_HOST:$MILVUS_PORT').list_collections()" &>/dev/null; then
        echo "Milvus Status: CONNECTED"
      else
        echo "Milvus Status: DISCONNECTED (fallback to grep)"
      fi
    else
      echo "Vector Search: MEMSEARCH NOT INSTALLED"
    fi
  else
    echo "Vector Search: DISABLED (grep-only mode)"
  fi
}

# ============================================================================
# SECTION 9: UTILITY FUNCTIONS
# ============================================================================

memory_list() {
  """
  List all memory files with dates and entry counts.
  """
  echo "Memory Files:"
  echo "=============="
  echo ""

  find "$MEMORY_DIR" -maxdepth 1 -name "*.md" -type f | sort -r | while read -r file; do
    filename=$(basename "$file")
    entries=$(grep -c "^##" "$file" 2>/dev/null || echo "?")
    size=$(du -h "$file" | cut -f1)

    printf "  %-20s %3s entries  %5s\n" "$filename" "$entries" "$size"
  done

  echo ""
  echo "Use: memory_expand /path/to/file.md to view contents"
}

memory_search_regex() {
  """
  Advanced search using regex (grep -P).

  Usage: memory_search_regex "\\berror\\b" (word boundary)
  """
  local pattern="$1"

  if [ -z "$pattern" ]; then
    echo "Error: pattern required" >&2
    return 1
  fi

  echo "Searching with regex: $pattern"
  echo ""

  grep -r -P "$pattern" "$MEMORY_DIR" 2>/dev/null | \
    head -20 | \
    sed "s|${MEMORY_DIR}/||" | \
    sort | \
    uniq
}

# ============================================================================
# SECTION 10: COMMAND ROUTER AND HELP
# ============================================================================

memory_help() {
  """
  Print help message with all available commands.
  """
  cat << 'EOF'
MemSearch Memory System for Bash Agents
========================================

BASIC COMMANDS:

  init              Initialize memory directory structure
  write [args]      Write observation: memory_write "content" [category] [tags]
  search [args]     Search memory: memory_search "query" [top_k]
  recall [args]     Retrieve context: memory_recall "query" [top_k] [format]
  expand [args]     Get full chunk: memory_expand chunk_id

INDEXING:

  reindex           Force reindex all files (slow but safe)
  watch             Start background auto-reindex daemon

DISCOVERY:

  list              List all memory files
  stats             Show memory system statistics
  related [args]    Find related topics: memory_related "topic"
  regex [args]      Grep search: memory_search_regex "pattern"

MAINTENANCE:

  cleanup [days]    Archive old files (default: 90 days)
  compact           Compress archived summaries

CONFIGURATION:

  export MEMORY_DIR=/path              Set memory directory
  export ENABLE_VECTOR_SEARCH=false    Disable Milvus (use grep only)

EXAMPLES:

  # Basic workflow
  memory_init
  memory_write "Fixed database timeout issue" "solution" "database,incident"
  memory_search "database timeout"

  # Full context recall
  memory_recall "How do I handle connection errors?" 5

  # Maintenance
  memory_stats
  memory_cleanup 90
  memory_reindex

  # Advanced
  memory_search_regex "PostgreSQL|MySQL"
  memory_related "error handling"

MARKDOWN FORMAT:

Memory uses standard markdown with sections:

  # YYYY-MM-DD Session Notes      (daily file)

  ## HH:MM:SS category
  Tags: tag1, tag2

  Observation text here...

EXIT CODES:

  0 = Success
  1 = Error (see stderr for details)
EOF
}

memory_main() {
  """
  Main command router.
  """
  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    init) memory_init "$@" ;;
    write) memory_write "$@" ;;
    search) memory_search "$@" ;;
    expand) memory_expand "$@" ;;
    recall) memory_recall "$@" ;;
    reindex) memory_reindex "$@" ;;
    watch) memory_watch "$@" ;;
    list) memory_list "$@" ;;
    stats) memory_stats "$@" ;;
    cleanup) memory_cleanup "$@" ;;
    compact) memory_compact "$@" ;;
    related) memory_related "$@" ;;
    regex) memory_search_regex "$@" ;;
    help) memory_help ;;
    *)
      echo "Unknown command: $cmd" >&2
      echo "Run: $0 help" >&2
      return 1
      ;;
  esac
}

# ============================================================================
# ENTRY POINT
# ============================================================================

# If sourced, don't run main
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  memory_main "$@"
fi
