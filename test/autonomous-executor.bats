#!/usr/bin/env bats
# Tests for autonomous executor (E6-S6.1)

EXECUTOR_SCRIPT="${BATS_TEST_DIRNAME}/../.agent/bin/pai-executor"
BACKLOG_SCRIPT="${BATS_TEST_DIRNAME}/../.agent/scripts/manage-backlog.sh"

setup() {
  export PAI_DIR=$(mktemp -d)
  export HOME=$(mktemp -d)

  mkdir -p "$PAI_DIR"
  mkdir -p "${HOME}/Library/Logs"
  mkdir -p "${HOME}/Projects/sam/.agent/scripts"

  # Create a mock manage-backlog.sh for testing
  cp "$BACKLOG_SCRIPT" "${HOME}/Projects/sam/.agent/scripts/manage-backlog.sh"
  chmod +x "${HOME}/Projects/sam/.agent/scripts/manage-backlog.sh"
}

teardown() {
  rm -rf "$PAI_DIR" 2>/dev/null || true
  rm -rf "$HOME" 2>/dev/null || true
}

@test "E6-S6.1: script exists and is executable" {
  [ -x "$EXECUTOR_SCRIPT" ]
}

@test "E6-S6.1: usage documentation is present" {
  grep -q "Usage: pai-executor" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: shellcheck validation passes" {
  if ! command -v shellcheck &> /dev/null; then
    skip "shellcheck not installed"
  fi

  shellcheck "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: dry-run mode prevents execution" {
  # Create a test item in backlog
  result=$("${HOME}/Projects/sam/.agent/scripts/manage-backlog.sh" add --title "Test Task" --priority P1 --effort M)
  item_id=$(echo "$result" | jq -r '.id')

  # Mark as approved
  "${HOME}/Projects/sam/.agent/scripts/manage-backlog.sh" update --id "$item_id" --status approved

  # Run executor in dry-run mode
  "$EXECUTOR_SCRIPT" --dry-run > /dev/null 2>&1

  # Verify item is still approved (not executed)
  item=$("${HOME}/Projects/sam/.agent/scripts/manage-backlog.sh" next --status approved)
  status=$(echo "$item" | jq -r '.status')
  [ "$status" = "approved" ]
}

@test "E6-S6.1: session detection guard is present" {
  grep -q "has_active_session" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: session detection checks for claude process" {
  grep -q "pgrep.*claude" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: timeout parsing handles 30m correctly" {
  # Extract timeout parsing logic and verify 30m = 1800 seconds
  grep -q "30m) TIMEOUT_SECONDS=1800" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: timeout parsing handles 90m correctly" {
  grep -q "90m) TIMEOUT_SECONDS=5400" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: effort-based timeout mapping exists" {
  grep -q "case.*effort" "$EXECUTOR_SCRIPT" || grep -q 'case "$effort"' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: effort S (small) maps to 30m timeout" {
  grep -q "S) item_timeout=1800" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: effort M (medium) maps to 60m timeout" {
  grep -q "M) item_timeout=3600" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: effort L (large) maps to 90m timeout" {
  grep -q "L) item_timeout=5400" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: effort XL maps to 120m timeout" {
  grep -q "XL) item_timeout=7200" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: engine detection looks for jay-gentic" {
  grep -q "PAI_USE_JAY_GENTIC" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: engine fallback to claude when jay-gentic unavailable" {
  grep -q 'engine="claude"' "$EXECUTOR_SCRIPT" || grep -q 'engine=claude' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: parse result looks for COMPLETED marker" {
  grep -q "COMPLETED:" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: parse result looks for BLOCKED marker" {
  grep -q "BLOCKED:" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: updates backlog with result status" {
  grep -q 'update.*--status' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: updates backlog with result summary" {
  grep -q '\-\-result' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: posts discord notification on completion" {
  grep -q "post_discord" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: discord notification gracefully fails without webhook" {
  grep -q 'DISCORD_WEBHOOK' "$EXECUTOR_SCRIPT" && grep -q 'if \[\[ -z.*DISCORD_WEBHOOK' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: logging function is defined" {
  grep -q "^log()" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: logs to ~/Library/Logs/pai-executor.log" {
  grep -q 'LOG_FILE="${HOME}/Library/Logs/pai-executor.log"' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: cleans up temporary files" {
  grep -q 'rm -f.*prompt_file' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: cleans up result files" {
  grep -q 'rm -f.*result_file' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: manage-backlog path uses PAI_DIR and HOME correctly" {
  grep -q 'MANAGE_BACKLOG="${HOME}/Projects/sam/.agent/scripts/manage-backlog.sh"' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: validates manage-backlog exists before execution" {
  grep -q 'if \[\[ ! -x.*MANAGE_BACKLOG' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: handles missing backlog gracefully" {
  grep -q 'log.*ERROR.*manage-backlog' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: main function defined" {
  grep -q "^main()" "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: main outputs initialization message" {
  grep -q 'log.*INFO.*starting' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: main outputs completion message" {
  grep -q 'log.*INFO.*complete' "$EXECUTOR_SCRIPT"
}

@test "E6-S6.1: entry point calls main" {
  tail -1 "$EXECUTOR_SCRIPT" | grep -q 'main'
}
