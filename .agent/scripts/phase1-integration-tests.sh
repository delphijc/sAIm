#!/usr/bin/env bash
# Phase 1 Integration Tests for Backlog System
#
# Tests all Phase 1 components together:
# - ENUM-001: manage-backlog.sh test suite
# - ENUM-002: Heartbeat integration
# - ENUM-003: Strategy integration
# - ENUM-004: Discord commands
# - ENUM-005: Journal integration (validated)
# - ENUM-006: Lifecycle integration (validated)
#
# Run with: bash phase1-integration-tests.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# Setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR=$(mktemp -d)
export PAI_DIR="$TEST_DIR"
BACKLOG_FILE="$TEST_DIR/enhancement-backlog.jsonl"
MANAGE_BACKLOG="$SCRIPT_DIR/manage-backlog.sh"

cleanup() {
  rm -rf "$TEST_DIR"
}

trap cleanup EXIT

# Helper functions
test_start() {
  printf "${BLUE}[TEST]${NC} $1\n"
}

test_pass() {
  TESTS_PASSED=$((TESTS_PASSED + 1))
  printf "${GREEN}✓ PASS${NC}\n"
}

test_fail() {
  TESTS_FAILED=$((TESTS_FAILED + 1))
  printf "${RED}✗ FAIL${NC}: $1\n"
}

assert_file_exists() {
  if [[ -f "$1" ]]; then
    test_pass
  else
    test_fail "File does not exist: $1"
  fi
}

assert_command_success() {
  if "$@" > /dev/null 2>&1; then
    test_pass
  else
    test_fail "Command failed: $*"
  fi
}

assert_contains() {
  if echo "$1" | grep -q "$2"; then
    test_pass
  else
    test_fail "Expected to find '$2' in output"
  fi
}

echo ""
echo "=========================================="
echo "Phase 1 Integration Test Suite"
echo "=========================================="
echo ""

# ============================================================================
# ENUM-001: Test Suite for manage-backlog.sh
# ============================================================================

echo "${BLUE}## ENUM-001: Test Suite for manage-backlog.sh${NC}"
test_start "Running manage-backlog.sh test suite..."
if bash "$SCRIPT_DIR/manage-backlog.test.sh" > /tmp/manage-backlog-tests.log 2>&1; then
  test_pass
else
  test_fail "Test suite failed — see /tmp/manage-backlog-tests.log"
fi

# ============================================================================
# ENUM-002: Heartbeat Integration
# ============================================================================

echo ""
echo "${BLUE}## ENUM-002: Heartbeat Integration${NC}"

test_start "Checking heartbeat script exists..."
assert_file_exists /Users/delphijc/Projects/sam/.agent/bin/pai-heartbeat

test_start "Verifying heartbeat_feed_to_backlog function exists..."
if grep -q "heartbeat_feed_to_backlog" /Users/delphijc/Projects/sam/.agent/bin/pai-heartbeat; then
  test_pass
else
  test_fail "heartbeat_feed_to_backlog function not found"
fi

test_start "Verifying is_duplicate_backlog_item function exists..."
if grep -q "is_duplicate_backlog_item" /Users/delphijc/Projects/sam/.agent/bin/pai-heartbeat; then
  test_pass
else
  test_fail "is_duplicate_backlog_item function not found"
fi

test_start "Checking heartbeat script is executable..."
if [[ -x /Users/delphijc/Projects/sam/.agent/bin/pai-heartbeat ]]; then
  test_pass
else
  test_fail "Heartbeat script is not executable"
fi

# ============================================================================
# ENUM-003: Strategy Integration
# ============================================================================

echo ""
echo "${BLUE}## ENUM-003: Strategy Integration${NC}"

test_start "Checking strategy script exists..."
assert_file_exists /Users/delphijc/Projects/sam/.agent/bin/pai-weekly-strategy

test_start "Verifying strategy_extract_and_feed_backlog function exists..."
if grep -q "strategy_extract_and_feed_backlog" /Users/delphijc/Projects/sam/.agent/bin/pai-weekly-strategy; then
  test_pass
else
  test_fail "strategy_extract_and_feed_backlog function not found"
fi

test_start "Checking strategy script is executable..."
if [[ -x /Users/delphijc/Projects/sam/.agent/bin/pai-weekly-strategy ]]; then
  test_pass
else
  test_fail "Strategy script is not executable"
fi

# ============================================================================
# ENUM-004: Discord Commands
# ============================================================================

echo ""
echo "${BLUE}## ENUM-004: Discord Commands${NC}"

test_start "Checking backlog-command.ts exists..."
assert_file_exists /Users/delphijc/Projects/sam/.agent/skills/discord-remote-control/service/commands/backlog-command.ts

test_start "Verifying handleBacklogStatus exported..."
if grep -q "export.*handleBacklogStatus" /Users/delphijc/Projects/sam/.agent/skills/discord-remote-control/service/commands/backlog-command.ts; then
  test_pass
else
  test_fail "handleBacklogStatus not exported"
fi

test_start "Verifying handleBacklogNext exported..."
if grep -q "export.*handleBacklogNext" /Users/delphijc/Projects/sam/.agent/skills/discord-remote-control/service/commands/backlog-command.ts; then
  test_pass
else
  test_fail "handleBacklogNext not exported"
fi

test_start "Verifying handleBacklogDone exported..."
if grep -q "export.*handleBacklogDone" /Users/delphijc/Projects/sam/.agent/skills/discord-remote-control/service/commands/backlog-command.ts; then
  test_pass
else
  test_fail "handleBacklogDone not exported"
fi

test_start "Verifying handleBacklogDupe exported..."
if grep -q "export.*handleBacklogDupe" /Users/delphijc/Projects/sam/.agent/skills/discord-remote-control/service/commands/backlog-command.ts; then
  test_pass
else
  test_fail "handleBacklogDupe not exported"
fi

test_start "Verifying handleBacklogReject exported..."
if grep -q "export.*handleBacklogReject" /Users/delphijc/Projects/sam/.agent/skills/discord-remote-control/service/commands/backlog-command.ts; then
  test_pass
else
  test_fail "handleBacklogReject not exported"
fi

test_start "Checking backlog-command.test.ts exists..."
assert_file_exists /Users/delphijc/Projects/sam/.agent/skills/discord-remote-control/service/commands/backlog-command.test.ts

# ============================================================================
# ENUM-005: Daily Journal Integration (Validation)
# ============================================================================

echo ""
echo "${BLUE}## ENUM-005: Daily Journal Integration (Validation)${NC}"

test_start "Checking journal script exists..."
assert_file_exists /Users/delphijc/Projects/sam/.agent/bin/pai-memory-journal

test_start "Verifying journal_reconcile_backlog function exists..."
if grep -q "journal_reconcile_backlog" /Users/delphijc/Projects/sam/.agent/bin/pai-memory-journal; then
  test_pass
else
  test_fail "journal_reconcile_backlog function not found"
fi

# ============================================================================
# ENUM-006: Memory Lifecycle Integration (Validation)
# ============================================================================

echo ""
echo "${BLUE}## ENUM-006: Memory Lifecycle Integration (Validation)${NC}"

test_start "Checking lifecycle script exists..."
assert_file_exists /Users/delphijc/Projects/sam/.agent/bin/pai-memory-lifecycle

test_start "Verifying lifecycle_audit_backlog function exists..."
if grep -q "lifecycle_audit_backlog" /Users/delphijc/Projects/sam/.agent/bin/pai-memory-lifecycle; then
  test_pass
else
  test_fail "lifecycle_audit_backlog function not found"
fi

# ============================================================================
# End-to-End Flow Test
# ============================================================================

echo ""
echo "${BLUE}## End-to-End Flow Test${NC}"

test_start "Creating test backlog items..."
if "$MANAGE_BACKLOG" add --title "E2E Test Item 1" --priority P0 --source "test" > /dev/null 2>&1 && \
   "$MANAGE_BACKLOG" add --title "E2E Test Item 2" --priority P1 --source "test" > /dev/null 2>&1; then
  test_pass
else
  test_fail "Failed to create test items"
fi

test_start "Listing backlog items..."
result=$("$MANAGE_BACKLOG" list --status pending)
if [[ -n "$result" ]]; then
  test_pass
else
  test_fail "No items returned from list"
fi

test_start "Getting next item..."
result=$("$MANAGE_BACKLOG" next)
if echo "$result" | grep -q "E2E Test Item 1"; then
  test_pass
else
  test_fail "next command didn't return highest priority item"
fi

test_start "Marking item as done..."
if "$MANAGE_BACKLOG" mark-done --id ENH-001 --evidence "Completed in E2E test" > /dev/null 2>&1; then
  test_pass
else
  test_fail "Failed to mark item as done"
fi

test_start "Verifying item marked as done..."
result=$("$MANAGE_BACKLOG" list --status done)
if echo "$result" | grep -q "ENH-001"; then
  test_pass
else
  test_fail "Item not found in done list"
fi

test_start "Creating duplicate items..."
if "$MANAGE_BACKLOG" add --id ENH-100 --title "Original Item" --source "test" > /dev/null 2>&1 && \
   "$MANAGE_BACKLOG" add --id ENH-101 --title "Duplicate Item" --source "test" > /dev/null 2>&1; then
  test_pass
else
  test_fail "Failed to create duplicate items"
fi

test_start "Marking item as duplicate..."
if "$MANAGE_BACKLOG" mark-dupe --id ENH-101 --original ENH-100 > /dev/null 2>&1; then
  test_pass
else
  test_fail "Failed to mark item as duplicate"
fi

test_start "Creating rejected item..."
if "$MANAGE_BACKLOG" add --id ENH-200 --title "To Reject" --source "test" > /dev/null 2>&1; then
  test_pass
else
  test_fail "Failed to create item to reject"
fi

test_start "Marking item as rejected..."
if "$MANAGE_BACKLOG" mark-reject --id ENH-200 --reason "Out of scope" > /dev/null 2>&1; then
  test_pass
else
  test_fail "Failed to mark item as rejected"
fi

test_start "Verifying expected statuses present..."
# Check for the main statuses we set during tests: pending, done, duplicate, wont-implement
required_statuses="done duplicate wont-implement"
all_present=true
for status in $required_statuses; do
  if ! grep -q "\"status\":\"$status\"" "$BACKLOG_FILE" 2>/dev/null; then
    all_present=false
    echo "Missing status: $status"
  fi
done
if [[ "$all_present" == true ]]; then
  test_pass
else
  test_fail "Not all expected statuses present in backlog"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=========================================="
echo "Integration Test Summary"
echo "=========================================="
printf "${GREEN}Passed:${NC} %d\n" "$TESTS_PASSED"
printf "${RED}Failed:${NC} %d\n" "$TESTS_FAILED"

if [[ $TESTS_FAILED -eq 0 ]]; then
  printf "\n${GREEN}✓ All Phase 1 integration tests passed!${NC}\n"
  exit 0
else
  printf "\n${RED}✗ Some tests failed.${NC}\n"
  exit 1
fi
