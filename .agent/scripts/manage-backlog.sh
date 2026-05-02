#!/usr/bin/env bash
# Enhancement Backlog Manager — Stack Broker pattern
#
# CRUD operations for the enhancement backlog JSONL file.
# All data persistence goes through this script (no direct Bun.write).
#
# Status Values:
#   pending         → Not yet started
#   in_progress     → Currently being worked on
#   approved        → Approved for autonomous execution
#   completed       → Work finished successfully
#   skipped         → Explicitly deferred (reason in notes)
#   done            → Already completed (before we tracked it)
#   duplicate       → Same as another item (reference in notes)
#   wont-implement  → Explicitly rejected (reason in notes)
#
# Usage:
#   manage-backlog.sh add --id ENH-XXX --title "..." --priority P1 --description "..." [--effort S|M|L|XL] [--engine any|claude|jay-gentic|...] [--source user|retrospective|...] [--notes "..."]
#   manage-backlog.sh list [--status pending|in_progress|completed|skipped|approved|done|duplicate|wont-implement] [--priority P0|P1|P2|P3] [--limit N]
#   manage-backlog.sh next [--status pending|approved|...]  # Returns highest-priority item with specified status
#   manage-backlog.sh update --id ENH-XXX --status pending|in_progress|completed|skipped|approved [--result "..." [--notes "..."]]
#   manage-backlog.sh mark-done --id ENH-XXX --evidence "..." # Mark item as already done
#   manage-backlog.sh mark-dupe --id ENH-XXX --original ENH-YYY [--reason "..."] # Mark as duplicate
#   manage-backlog.sh mark-reject --id ENH-XXX --reason "..." # Mark as won't implement
#   manage-backlog.sh count [--status pending|approved]     # Count items by status
#   manage-backlog.sh nextid                       # Returns the next available ENH-XXX id

set -euo pipefail

PAI_DIR="${PAI_DIR:-${HOME}/.claude}"
BACKLOG_FILE="${PAI_DIR}/enhancement-backlog.jsonl"
LOCK_FILE="${PAI_DIR}/.backlog-lock"

# ---------------------------------------------------------------------------
# File locking (cooperative)
# ---------------------------------------------------------------------------

acquire_lock() {
  local max_wait=10
  local elapsed=0
  while [ -f "$LOCK_FILE" ] && [ $elapsed -lt $max_wait ]; do
    sleep 0.2
    elapsed=$((elapsed + 1))
  done
  if [ -f "$LOCK_FILE" ]; then
    # Stale lock — remove it
    rm -f "$LOCK_FILE" 2>/dev/null || true
  fi
  echo $$ > "$LOCK_FILE"
}

release_lock() {
  rm -f "$LOCK_FILE" 2>/dev/null || true
}

trap release_lock EXIT

# ---------------------------------------------------------------------------
# Ensure backlog file exists
# ---------------------------------------------------------------------------

ensure_file() {
  if [[ ! -f "$BACKLOG_FILE" ]]; then
    touch "$BACKLOG_FILE"
  fi
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

cmd_add() {
  local id="" title="" priority="P2" description="" effort="M" engine="any" source="user" notes=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --id)       id="$2"; shift 2 ;;
      --title)    title="$2"; shift 2 ;;
      --priority) priority="$2"; shift 2 ;;
      --description) description="$2"; shift 2 ;;
      --effort)   effort="$2"; shift 2 ;;
      --engine)   engine="$2"; shift 2 ;;
      --source)   source="$2"; shift 2 ;;
      --notes)    notes="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$title" ]]; then
    echo "ERROR: --title is required" >&2
    exit 1
  fi

  # Auto-generate ID if not provided
  if [[ -z "$id" ]]; then
    id=$(cmd_nextid)
  fi

  local created
  created=$(date '+%Y-%m-%d')

  acquire_lock
  ensure_file

  # Build JSON with jq for proper escaping
  local json
  json=$(jq -cn \
    --arg id "$id" \
    --arg title "$title" \
    --arg priority "$priority" \
    --arg description "$description" \
    --arg effort "$effort" \
    --arg engine "$engine" \
    --arg source "$source" \
    --arg notes "$notes" \
    --arg status "pending" \
    --arg created "$created" \
    '{id: $id, title: $title, priority: $priority, description: $description, effort: $effort, engine_compat: $engine, source: $source, status: $status, created: $created, completed: null, result: null, notes: $notes}')

  echo "$json" >> "$BACKLOG_FILE"
  release_lock

  echo "$json"
}

cmd_list() {
  local status_filter="" priority_filter="" limit=50

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --status)   status_filter="$2"; shift 2 ;;
      --priority) priority_filter="$2"; shift 2 ;;
      --limit)    limit="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
  done

  ensure_file

  local filter="."
  if [[ -n "$status_filter" ]]; then
    filter="${filter} | select(.status == \"${status_filter}\")"
  fi
  if [[ -n "$priority_filter" ]]; then
    filter="${filter} | select(.priority == \"${priority_filter}\")"
  fi

  # Sort by priority (P0 first), then by created date
  jq -s "[.[] | ${filter}] | sort_by(.priority, .created) | .[:${limit}] | .[]" "$BACKLOG_FILE" 2>/dev/null || echo "[]"
}

cmd_next() {
  local status_filter="pending"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --status) status_filter="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
  done

  ensure_file

  # Return highest-priority item with specified status (P0 > P1 > P2 > P3)
  jq -s "[.[] | select(.status == \"${status_filter}\")] | sort_by(.priority, .created) | .[0] // empty" "$BACKLOG_FILE" 2>/dev/null
}

cmd_update() {
  local id="" new_status="" result="" notes=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --id)     id="$2"; shift 2 ;;
      --status) new_status="$2"; shift 2 ;;
      --result) result="$2"; shift 2 ;;
      --notes)  notes="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$id" || -z "$new_status" ]]; then
    echo "ERROR: --id and --status are required" >&2
    exit 1
  fi

  acquire_lock
  ensure_file

  local completed_date="null"
  if [[ "$new_status" == "completed" || "$new_status" == "skipped" || "$new_status" == "done" || "$new_status" == "duplicate" || "$new_status" == "wont-implement" ]]; then
    completed_date="\"$(date '+%Y-%m-%d')\""
  fi

  # Rewrite the file with the updated item
  local tmp
  tmp=$(mktemp)

  while IFS= read -r line; do
    local line_id
    line_id=$(printf '%s' "$line" | jq -r '.id' 2>/dev/null || echo "")
    if [[ "$line_id" == "$id" ]]; then
      printf '%s' "$line" | jq -c \
        --arg status "$new_status" \
        --arg result "$result" \
        --arg notes "$notes" \
        --argjson completed "$completed_date" \
        '.status = $status | .completed = $completed | (if $result != "" then .result = $result else . end) | (if $notes != "" then .notes = $notes else . end)'
    else
      printf '%s' "$line"
    fi
    echo ""
  done < "$BACKLOG_FILE" > "$tmp"

  mv "$tmp" "$BACKLOG_FILE"
  release_lock

  echo "Updated ${id} -> ${new_status}"
}

cmd_count() {
  local status_filter=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --status) status_filter="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
  done

  ensure_file

  if [[ -n "$status_filter" ]]; then
    jq -s "[.[] | select(.status == \"${status_filter}\")] | length" "$BACKLOG_FILE" 2>/dev/null || echo "0"
  else
    jq -s 'length' "$BACKLOG_FILE" 2>/dev/null || echo "0"
  fi
}

cmd_nextid() {
  ensure_file

  # Find the highest ENH-XXX number and increment
  local max_num
  max_num=$(jq -r '.id' "$BACKLOG_FILE" 2>/dev/null | grep -oE '[0-9]+' | sort -n | tail -1 || echo "0")
  max_num="${max_num:-0}"

  local next_num=$((max_num + 1))
  printf 'ENH-%03d\n' "$next_num"
}

# ---------------------------------------------------------------------------
# Lifecycle Management Commands
# ---------------------------------------------------------------------------

cmd_mark_done() {
  local id="" evidence=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --id)       id="$2"; shift 2 ;;
      --evidence) evidence="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$id" ]]; then
    echo "ERROR: --id is required" >&2
    exit 1
  fi

  local notes="Already completed: ${evidence}"
  cmd_update --id "$id" --status "done" --notes "$notes"
}

cmd_mark_dupe() {
  local id="" original="" reason=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --id)       id="$2"; shift 2 ;;
      --original) original="$2"; shift 2 ;;
      --reason)   reason="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$id" || -z "$original" ]]; then
    echo "ERROR: --id and --original are required" >&2
    exit 1
  fi

  local notes="Duplicate of ${original}"
  if [[ -n "$reason" ]]; then
    notes="${notes}: ${reason}"
  fi
  cmd_update --id "$id" --status "duplicate" --notes "$notes"
}

cmd_mark_reject() {
  local id="" reason=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --id)     id="$2"; shift 2 ;;
      --reason) reason="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$id" ]]; then
    echo "ERROR: --id is required" >&2
    exit 1
  fi

  local notes="Won't implement"
  if [[ -n "$reason" ]]; then
    notes="${notes}: ${reason}"
  fi
  cmd_update --id "$id" --status "wont-implement" --notes "$notes"
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

if [[ $# -lt 1 ]]; then
  echo "Usage: manage-backlog.sh <add|list|next|update|promote|count|nextid> [options]" >&2
  exit 1
fi

CMD="$1"
shift

case "$CMD" in
  add)         cmd_add "$@" ;;
  list)        cmd_list "$@" ;;
  next)        cmd_next "$@" ;;
  update)      cmd_update "$@" ;;
  mark-done)   cmd_mark_done "$@" ;;
  mark-dupe)   cmd_mark_dupe "$@" ;;
  mark-reject) cmd_mark_reject "$@" ;;
  count)       cmd_count "$@" ;;
  nextid)      cmd_nextid ;;
  *)
    echo "Unknown command: $CMD" >&2
    echo "Usage: manage-backlog.sh <add|list|next|update|mark-done|mark-dupe|mark-reject|count|nextid> [options]" >&2
    exit 1
    ;;
esac
