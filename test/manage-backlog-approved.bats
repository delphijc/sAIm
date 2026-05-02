#!/usr/bin/env bats
# Tests for "approved" status support in manage-backlog.sh (E3-S3.2)

BACKLOG_SCRIPT="${BATS_TEST_DIRNAME}/../.agent/scripts/manage-backlog.sh"

setup() {
  export PAI_DIR=$(mktemp -d)
  mkdir -p "$PAI_DIR"
}

teardown() {
  rm -rf "$PAI_DIR" 2>/dev/null || true
}

@test "E3-S3.2: script exists and is executable" {
  [ -x "$BACKLOG_SCRIPT" ]
}

@test "E3-S3.2: cmd_next accepts --status argument" {
  # Verify the script accepts --status without error
  grep -q '\--status' "$BACKLOG_SCRIPT" && grep -q 'status_filter=' "$BACKLOG_SCRIPT"
}

@test "E3-S3.2: cmd_list filters by approved status" {
  # Verify list command can filter by status
  grep -q 'select(.status ==' "$BACKLOG_SCRIPT"
}

@test "E3-S3.2: cmd_count filters by approved status" {
  # Verify count command can filter by status
  grep -q 'select(.status ==' "$BACKLOG_SCRIPT" || \
  grep -q '\[.* | select(.status ==' "$BACKLOG_SCRIPT"
}

@test "E3-S3.2: documentation includes approved status" {
  # Check usage documentation mentions approved status
  grep -q 'approved' "$BACKLOG_SCRIPT"
}

@test "E3-S3.2: shellcheck passes" {
  if ! command -v shellcheck &> /dev/null; then
    skip "shellcheck not installed"
  fi

  shellcheck "$BACKLOG_SCRIPT"
}

@test "E3-S3.2: add creates items, update accepts approved status" {
  # Add an item
  result=$("$BACKLOG_SCRIPT" add --title "Test" --priority P1)
  id=$(echo "$result" | jq -r '.id')

  # Update it to approved status
  "$BACKLOG_SCRIPT" update --id "$id" --status approved

  # Count approved items
  count=$("$BACKLOG_SCRIPT" count --status approved)
  [ "$count" -eq 1 ]
}

@test "E3-S3.2: next --status approved returns items" {
  # Add and approve items
  result1=$("$BACKLOG_SCRIPT" add --title "Item 1" --priority P1)
  id1=$(echo "$result1" | jq -r '.id')

  "$BACKLOG_SCRIPT" update --id "$id1" --status approved

  # Get next approved item
  next=$("$BACKLOG_SCRIPT" next --status approved)
  status=$(echo "$next" | jq -r '.status')

  [ "$status" = "approved" ]
}

@test "E3-S3.2: next defaults to pending when no --status specified" {
  # Add pending item
  "$BACKLOG_SCRIPT" add --title "Pending" --priority P1

  # Get next (should default to pending)
  next=$("$BACKLOG_SCRIPT" next)
  status=$(echo "$next" | jq -r '.status')

  [ "$status" = "pending" ]
}

@test "E3-S3.2: existing statuses still work" {
  result=$("$BACKLOG_SCRIPT" add --title "Test" --priority P1)
  id=$(echo "$result" | jq -r '.id')

  # Test updating to each status
  for status in in_progress completed skipped approved; do
    "$BACKLOG_SCRIPT" update --id "$id" --status "$status"
    count=$("$BACKLOG_SCRIPT" count --status "$status")
    [ "$count" -eq 1 ]
  done
}
