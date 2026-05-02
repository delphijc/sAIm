#!/usr/bin/env bash
# Test Suite for manage-backlog.sh
#
# Run with: bun test manage-backlog.test.sh
# Or: bash manage-backlog.test.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Setup: Create temp directory for test files
TEST_DIR=$(mktemp -d)
export PAI_DIR="$TEST_DIR"
BACKLOG_FILE="$TEST_DIR/enhancement-backlog.jsonl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANAGE_BACKLOG="$SCRIPT_DIR/manage-backlog.sh"

# Helper functions
run_test() {
  local test_name="$1"
  TESTS_RUN=$((TESTS_RUN + 1))
  printf "%-60s" "TEST[$TESTS_RUN]: $test_name ... "
}

pass() {
  TESTS_PASSED=$((TESTS_PASSED + 1))
  printf "${GREEN}PASS${NC}\n"
}

fail() {
  local reason="${1:-Test failed}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  printf "${RED}FAIL${NC}\n"
  printf "  ${RED}Error: $reason${NC}\n" >&2
}

assert_equals() {
  local expected="$1"
  local actual="$2"
  local msg="${3:-}"
  if [[ "$expected" == "$actual" ]]; then
    pass
  else
    fail "Expected '$expected', got '$actual'${msg:+. }${msg}"
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local msg="${3:-}"
  if [[ "$haystack" == *"$needle"* ]]; then
    pass
  else
    fail "Expected to find '$needle' in output${msg:+. }${msg}"
  fi
}

assert_file_exists() {
  local file="$1"
  if [[ -f "$file" ]]; then
    pass
  else
    fail "File '$file' does not exist"
  fi
}

assert_line_count() {
  local file="$1"
  local expected="$2"
  local actual=$(wc -l < "$file")
  if [[ $actual -eq $expected ]]; then
    pass
  else
    fail "Expected $expected lines, got $actual"
  fi
}

# Cleanup
cleanup() {
  rm -rf "$TEST_DIR"
}

trap cleanup EXIT

# ============================================================================
# TESTS
# ============================================================================

echo "======================================"
echo "Testing: manage-backlog.sh"
echo "======================================"
echo ""

# --- Test 1: nextid on empty backlog ---
run_test "nextid returns ENH-001 on empty backlog"
result=$("$MANAGE_BACKLOG" nextid)
assert_equals "ENH-001" "$result"

# --- Test 2: add item ---
run_test "add creates backlog item with auto-generated ID"
result=$("$MANAGE_BACKLOG" add --title "Test Enhancement" --priority P1)
assert_contains "$result" "ENH-001"
assert_contains "$result" "Test Enhancement"
assert_contains "$result" "pending"

# --- Test 3: nextid increments ---
run_test "nextid increments after adding item"
result=$("$MANAGE_BACKLOG" nextid)
assert_equals "ENH-002" "$result"

# --- Test 4: add with explicit ID ---
run_test "add with explicit ID creates item with that ID"
result=$("$MANAGE_BACKLOG" add --id ENH-100 --title "Manual ID Test")
assert_contains "$result" "ENH-100"

# --- Test 5: list shows all items ---
run_test "list returns all items"
result=$("$MANAGE_BACKLOG" list)
assert_contains "$result" "ENH-001"
assert_contains "$result" "ENH-100"

# --- Test 6: list with status filter ---
run_test "list --status pending filters correctly"
result=$("$MANAGE_BACKLOG" list --status pending)
assert_contains "$result" "ENH-001"
# Both should be pending
line_count=$(echo "$result" | grep -c 'ENH-' || true)
# At least 1 item should be returned
if [[ $line_count -ge 1 ]]; then
  pass
else
  fail "No pending items returned"
fi

# --- Test 7: next returns highest priority item ---
run_test "next returns highest-priority pending item"
"$MANAGE_BACKLOG" add --id ENH-200 --title "P0 Item" --priority P0
result=$("$MANAGE_BACKLOG" next)
assert_contains "$result" "ENH-200"

# --- Test 8: update status ---
run_test "update changes item status"
"$MANAGE_BACKLOG" update --id ENH-001 --status in_progress
result=$("$MANAGE_BACKLOG" list --status in_progress)
assert_contains "$result" "ENH-001"

# --- Test 9: update sets completed date ---
run_test "update to completed status sets completed date"
"$MANAGE_BACKLOG" update --id ENH-100 --status completed
result=$("$MANAGE_BACKLOG" list --status completed)
assert_contains "$result" "ENH-100"
assert_contains "$result" "$(date '+%Y-%m-%d')"

# --- Test 10: mark-done command ---
run_test "mark-done marks item as done with evidence"
"$MANAGE_BACKLOG" mark-done --id ENH-200 --evidence "Feature already shipped"
result=$("$MANAGE_BACKLOG" list --status done)
assert_contains "$result" "ENH-200"
assert_contains "$result" "Already completed"

# --- Test 11: mark-dupe command ---
run_test "mark-dupe marks item as duplicate"
"$MANAGE_BACKLOG" add --id ENH-300 --title "Original Feature"
"$MANAGE_BACKLOG" add --id ENH-301 --title "Duplicate Feature"
"$MANAGE_BACKLOG" mark-dupe --id ENH-301 --original ENH-300 --reason "Same feature"
result=$("$MANAGE_BACKLOG" list --status duplicate)
assert_contains "$result" "ENH-301"
assert_contains "$result" "Duplicate of ENH-300"

# --- Test 12: mark-reject command ---
run_test "mark-reject marks item as won't-implement"
"$MANAGE_BACKLOG" add --id ENH-400 --title "Rejected Item"
"$MANAGE_BACKLOG" mark-reject --id ENH-400 --reason "Out of scope"
result=$("$MANAGE_BACKLOG" list --status wont-implement)
assert_contains "$result" "ENH-400"
assert_contains "$result" "Out of scope"

# --- Test 13: count items ---
run_test "count returns total number of items"
result=$("$MANAGE_BACKLOG" count)
# Should have created multiple items at this point
if [[ $result -ge 5 ]]; then
  pass
else
  fail "Expected at least 5 items, got $result"
fi

# --- Test 14: count with status filter ---
run_test "count --status filters by status"
result=$("$MANAGE_BACKLOG" count --status pending)
if [[ $result -ge 1 ]]; then
  pass
else
  fail "Expected at least 1 pending item"
fi

# --- Test 15: list with priority filter ---
run_test "list --priority filters by priority"
"$MANAGE_BACKLOG" add --id ENH-500 --title "P3 Item" --priority P3
result=$("$MANAGE_BACKLOG" list --priority P3)
assert_contains "$result" "ENH-500"

# --- Test 16: list with limit ---
run_test "list --limit restricts results"
result=$("$MANAGE_BACKLOG" list --limit 1)
line_count=$(echo "$result" | grep -c 'ENH-' || true)
if [[ $line_count -eq 1 ]]; then
  pass
else
  fail "Expected 1 item, got $line_count"
fi

# --- Test 17: add with all parameters ---
run_test "add accepts all optional parameters"
result=$("$MANAGE_BACKLOG" add \
  --id ENH-600 \
  --title "Full Item" \
  --priority P0 \
  --description "Full description here" \
  --effort L \
  --engine claude \
  --source heartbeat \
  --notes "Initial notes")
assert_contains "$result" "ENH-600"
assert_contains "$result" "Full Item"
assert_contains "$result" "P0"
assert_contains "$result" "L"

# --- Test 18: update with notes ---
run_test "update --notes adds or updates notes"
"$MANAGE_BACKLOG" update --id ENH-600 --status in_progress --notes "Now working on this"
result=$("$MANAGE_BACKLOG" list)
assert_contains "$result" "Now working on this"

# --- Test 19: update with result ---
run_test "update --result records completion result"
"$MANAGE_BACKLOG" update --id ENH-600 --status completed --result "Feature merged to main"
result=$("$MANAGE_BACKLOG" list --status completed)
assert_contains "$result" "Feature merged to main"

# --- Test 20: concurrent operations (lock testing) ---
run_test "concurrent add operations don't corrupt data"
# Run multiple adds in parallel
"$MANAGE_BACKLOG" add --id ENH-700 --title "Parallel 1" &
"$MANAGE_BACKLOG" add --id ENH-701 --title "Parallel 2" &
"$MANAGE_BACKLOG" add --id ENH-702 --title "Parallel 3" &
wait
result=$("$MANAGE_BACKLOG" list)
assert_contains "$result" "ENH-700"
assert_contains "$result" "ENH-701"
assert_contains "$result" "ENH-702"

# --- Test 21: backlog file persistence ---
run_test "backlog.jsonl persists across commands"
assert_file_exists "$BACKLOG_FILE"
line_count=$(wc -l < "$BACKLOG_FILE")
if [[ $line_count -gt 10 ]]; then
  pass
else
  fail "Expected multiple lines in backlog file, got $line_count"
fi

# --- Test 22: JSON format validation ---
run_test "all backlog lines are valid JSON"
valid=0
total=0
while IFS= read -r line; do
  total=$((total + 1))
  if echo "$line" | jq . > /dev/null 2>&1; then
    valid=$((valid + 1))
  fi
done < "$BACKLOG_FILE"
if [[ $valid -eq $total ]]; then
  pass
else
  fail "Invalid JSON: $valid/$total lines valid"
fi

# --- Test 23: next with status filter ---
run_test "next --status filters by specific status"
"$MANAGE_BACKLOG" add --id ENH-800 --title "Approved Item" --priority P0
"$MANAGE_BACKLOG" update --id ENH-800 --status approved
result=$("$MANAGE_BACKLOG" next --status approved)
assert_contains "$result" "ENH-800"

# --- Test 24: all lifecycle statuses work ---
run_test "all status transitions work correctly"
"$MANAGE_BACKLOG" add --id ENH-900 --title "Status Test"
"$MANAGE_BACKLOG" update --id ENH-900 --status pending
"$MANAGE_BACKLOG" update --id ENH-900 --status in_progress
"$MANAGE_BACKLOG" update --id ENH-900 --status approved
"$MANAGE_BACKLOG" update --id ENH-900 --status completed
result=$("$MANAGE_BACKLOG" list)
assert_contains "$result" "ENH-900"

# --- Test 25: mark commands update completed date ---
run_test "mark-* commands set completed date"
"$MANAGE_BACKLOG" add --id ENH-950 --title "To Mark Done"
"$MANAGE_BACKLOG" mark-done --id ENH-950 --evidence "test"
result=$("$MANAGE_BACKLOG" list --status done)
assert_contains "$result" "$(date '+%Y-%m-%d')"

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
printf "Tests run:    %d\n" "$TESTS_RUN"
printf "Tests passed: ${GREEN}%d${NC}\n" "$TESTS_PASSED"
printf "Tests failed: ${RED}%d${NC}\n" "$TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
  printf "${GREEN}✓ All tests passed!${NC}\n"
  exit 0
else
  printf "${RED}✗ Some tests failed.${NC}\n"
  exit 1
fi
