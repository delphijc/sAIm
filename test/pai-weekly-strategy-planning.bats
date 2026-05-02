#!/usr/bin/env bats
# Tests for pai-weekly-strategy planning session (E5-S5.1)

STRATEGY_SCRIPT="${BATS_TEST_DIRNAME}/../.agent/bin/pai-weekly-strategy"
BACKLOG_SCRIPT="${BATS_TEST_DIRNAME}/../.agent/scripts/manage-backlog.sh"

setup() {
  export PAI_DIR=$(mktemp -d)
  export HOME=$(mktemp -d)

  mkdir -p "$PAI_DIR"
  mkdir -p "${HOME}/Library/Logs"
  mkdir -p "${HOME}/Projects/sam/.agent/scripts"
  mkdir -p "${HOME}/Projects/sam/.agent/History/journals"

  # Create a mock manage-backlog.sh
  cp "$BACKLOG_SCRIPT" "${HOME}/Projects/sam/.agent/scripts/manage-backlog.sh"
  chmod +x "${HOME}/Projects/sam/.agent/scripts/manage-backlog.sh"
}

teardown() {
  rm -rf "$PAI_DIR" 2>/dev/null || true
  rm -rf "$HOME" 2>/dev/null || true
}

@test "E5-S5.1: strategy script exists and is executable" {
  [ -x "$STRATEGY_SCRIPT" ]
}

@test "E5-S5.1: MANAGE_BACKLOG variable is defined" {
  grep -q 'MANAGE_BACKLOG=' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: send_planning_session_message function exists" {
  grep -q 'send_planning_session_message()' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function checks for manage-backlog existence" {
  grep -q '! -x.*MANAGE_BACKLOG' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function fetches pending items from backlog" {
  grep -q 'MANAGE_BACKLOG.*list.*pending' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function skips when no pending items" {
  grep -q 'No pending backlog items' "$STRATEGY_SCRIPT" || \
  grep -q 'No pending.*items' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function formats items as numbered list" {
  grep -q 'for i.*enumerate' "$STRATEGY_SCRIPT" || \
  grep -q 'enumerate.*1:' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: formatted output includes item ID" {
  grep -q 'item_id' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: formatted output includes priority" {
  grep -q 'priority.*item' "$STRATEGY_SCRIPT" || \
  grep -q '{priority}' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: formatted output includes title" {
  grep -q '{title}' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: formatted output includes effort" {
  grep -q '{effort}' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: formatted output includes source" {
  grep -q '{source}' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: Discord message includes Weekly Planning Session header" {
  grep -q 'Weekly Planning Session' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: Discord message includes approval instructions" {
  grep -q 'approve 1 3' "$STRATEGY_SCRIPT" || \
  grep -q 'approve.*items' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: Discord message includes approve all option" {
  grep -q 'approve all' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: Discord message includes skip option" {
  grep -q 'skip' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function checks for Discord webhook URL" {
  grep -q 'DISCORD_WEBHOOK_URL' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function reads Discord webhook from .env if not set" {
  grep -q 'DISCORD_WEBHOOK_URL=.*grep' "$STRATEGY_SCRIPT" || \
  grep -q 'grep.*DISCORD_WEBHOOK_URL' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function gracefully skips if Discord not configured" {
  grep -q 'DISCORD_WEBHOOK_URL not set' "$STRATEGY_SCRIPT" || \
  grep -q 'not set.*planning' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function posts to Discord via curl" {
  grep -q 'curl -sf' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function logs planning message sent status" {
  grep -q 'Planning session message sent' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function logs when Discord webhook fails" {
  grep -q 'Discord webhook failed.*planning' "$STRATEGY_SCRIPT" || \
  grep -q 'webhook failed' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: function is called after Step 10" {
  # Verify send_planning_session_message is called (not just defined)
  grep -q '^send_planning_session_message$' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: Step 11 section is present" {
  grep -q 'Step 11' "$STRATEGY_SCRIPT" || \
  grep -q 'E5-S5.1' "$STRATEGY_SCRIPT"
}

@test "E5-S5.1: shellcheck passes" {
  if ! command -v shellcheck &> /dev/null; then
    skip "shellcheck not installed"
  fi

  # Allow pre-existing SC2231 warnings (line 217)
  # Check for any other error lines
  local errors
  errors=$(shellcheck "$STRATEGY_SCRIPT" 2>&1 | grep "^In " | grep -v "line 217" | wc -l)
  [ "$errors" -eq 0 ]
}
