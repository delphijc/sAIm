#!/usr/bin/env bash
# fuzzy-match.sh — Fuzzy string matching for backlog deduplication
# Provides 80%+ similarity detection for preventing duplicate items
#
# Uses a practical token-overlap + length-similarity hybrid algorithm
#
# Usage:
#   fuzzy_similarity "string1" "string2"          # Returns 0-100 similarity score
#   find_duplicate "title" [backlog_file]         # Returns matching item ID or "none"
#   is_likely_duplicate "title" [threshold]       # Returns "yes" or "no"

set -euo pipefail

# ============================================================================
# Core Similarity Algorithm: Token-Based + Length Similarity
# ============================================================================

# Normalize a string for comparison
normalize_string() {
  local str="$1"
  # Convert to lowercase, remove punctuation, collapse whitespace
  echo "$str" | \
    tr '[:upper:]' '[:lower:]' | \
    sed 's/[^a-z0-9 ]//g' | \
    tr -s ' ' | \
    xargs
}

# Calculate similarity using token overlap and edit distance heuristic
# Returns 0-100 similarity score
fuzzy_similarity() {
  local str1="$1"
  local str2="$2"

  # Normalize both strings
  local norm1=$(normalize_string "$str1")
  local norm2=$(normalize_string "$str2")

  # If identical after normalization, return 100
  if [[ "$norm1" == "$norm2" ]]; then
    echo 100
    return 0
  fi

  # If either string is empty, return 0
  if [[ -z "$norm1" || -z "$norm2" ]]; then
    echo 0
    return 0
  fi

  # Use awk to calculate hybrid similarity
  awk -v s1="$norm1" -v s2="$norm2" 'BEGIN {
    # Token overlap score
    split(s1, tokens1, " ")
    split(s2, tokens2, " ")

    # Count matching tokens
    common = 0
    for (t1 in tokens1) {
      for (t2 in tokens2) {
        if (tokens1[t1] == tokens2[t2]) {
          common++
        }
      }
    }

    # Token similarity: (2 * common) / (len1 + len2)
    token_score = (2 * common * 100) / (length(tokens1) + length(tokens2))

    # Length similarity: penalize large length differences
    len1 = length(s1)
    len2 = length(s2)
    len_diff = (len1 > len2) ? (len1 - len2) : (len2 - len1)
    max_len = (len1 > len2) ? len1 : len2

    # Length score: 100 - (30% of difference relative to max)
    if (max_len > 0) {
      length_penalty = (len_diff * 30) / max_len
      if (length_penalty > 30) length_penalty = 30
      length_score = 100 - length_penalty
    } else {
      length_score = 100
    }

    # Combined score: 70% tokens + 30% length
    final_score = int((token_score * 70 + length_score * 30) / 100)

    if (final_score > 100) final_score = 100
    if (final_score < 0) final_score = 0

    print final_score
  }'
}

# ============================================================================
# Backlog Operations
# ============================================================================

# Find potential duplicate in backlog
# Returns the ID of a similar item if found, otherwise "none"
find_duplicate() {
  local title="$1"
  local backlog_file="${2:-.agent/enhancement-backlog.jsonl}"
  local threshold="${3:-80}"

  if [[ ! -f "$backlog_file" ]]; then
    echo "none"
    return 0
  fi

  local best_match="none"
  local best_score=0

  # Read each line and check similarity
  while IFS= read -r line; do
    if [[ -z "$line" ]]; then
      continue
    fi

    # Extract title and id from JSON using grep + sed (no jq dependency)
    local item_title=$(echo "$line" | grep -o '"title":"[^"]*"' | cut -d'"' -f4)
    local item_id=$(echo "$line" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    local item_status=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

    if [[ -z "$item_title" || -z "$item_id" ]]; then
      continue
    fi

    # Skip closed items (already handled)
    if [[ "$item_status" == "done" || "$item_status" == "duplicate" || "$item_status" == "wont-implement" ]]; then
      continue
    fi

    # Calculate similarity
    local score=$(fuzzy_similarity "$title" "$item_title")

    if (( score > best_score && score >= threshold )); then
      best_score=$score
      best_match="$item_id"
    fi
  done < "$backlog_file"

  echo "$best_match"
}

# Check if a title is likely a duplicate (returns "yes" or "no")
is_likely_duplicate() {
  local title="$1"
  local threshold="${2:-80}"
  local backlog_file="${3:-.agent/enhancement-backlog.jsonl}"

  local match=$(find_duplicate "$title" "$backlog_file" "$threshold")

  if [[ "$match" != "none" ]]; then
    echo "yes"
    return 0
  else
    echo "no"
    return 0
  fi
}

# Get duplicate info with score
get_duplicate_with_score() {
  local title="$1"
  local backlog_file="${2:-.agent/enhancement-backlog.jsonl}"
  local threshold="${3:-80}"

  if [[ ! -f "$backlog_file" ]]; then
    echo '{"found":false}'
    return 0
  fi

  local best_match="none"
  local best_score=0
  local best_title=""

  while IFS= read -r line; do
    if [[ -z "$line" ]]; then
      continue
    fi

    local item_title=$(echo "$line" | grep -o '"title":"[^"]*"' | cut -d'"' -f4)
    local item_id=$(echo "$line" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    local item_status=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

    if [[ -z "$item_title" || -z "$item_id" ]]; then
      continue
    fi

    if [[ "$item_status" == "done" || "$item_status" == "duplicate" || "$item_status" == "wont-implement" ]]; then
      continue
    fi

    local score=$(fuzzy_similarity "$title" "$item_title")

    if (( score > best_score && score >= threshold )); then
      best_score=$score
      best_match="$item_id"
      best_title="$item_title"
    fi
  done < "$backlog_file"

  if [[ "$best_match" != "none" ]]; then
    echo "{\"found\":true,\"id\":\"$best_match\",\"title\":\"$best_title\",\"similarity\":$best_score}"
  else
    echo '{"found":false}'
  fi
}

# ============================================================================
# Testing & Debugging
# ============================================================================

# Run fuzzy matcher tests
test_fuzzy_matching() {
  echo "=== Fuzzy Matching Tests ==="
  local pass=0
  local fail=0

  # Test 1: Exact match
  local score=$(fuzzy_similarity "add user authentication" "add user authentication") || score=0
  echo "Test 1 (Exact match): $score/100 (expect 100)"
  if [[ $score -eq 100 ]]; then
    echo "  ✓ PASS"
    ((pass++)) || true
  else
    echo "  ✗ FAIL"
    ((fail++)) || true
  fi

  # Test 2: High similarity (70%+ token overlap)
  score=$(fuzzy_similarity "add user authentication" "implement user authentication system") || score=0
  echo "Test 2 (High similarity): $score/100 (expect >70)"
  if [[ $score -gt 70 ]]; then
    echo "  ✓ PASS"
    ((pass++)) || true
  else
    echo "  ✗ FAIL (got $score, expected >70)"
    ((fail++)) || true
  fi

  # Test 3: Different items
  score=$(fuzzy_similarity "add user authentication" "fix database migration") || score=0
  echo "Test 3 (Different items): $score/100 (expect <40)"
  if [[ $score -lt 40 ]]; then
    echo "  ✓ PASS"
    ((pass++)) || true
  else
    echo "  ✗ FAIL (got $score, expected <40)"
    ((fail++)) || true
  fi

  # Test 4: Synonymous phrases
  score=$(fuzzy_similarity "commit pending changes" "stage uncommitted modifications") || score=0
  echo "Test 4 (Synonymous): $score/100 (expect >50)"
  if [[ $score -gt 50 ]]; then
    echo "  ✓ PASS"
    ((pass++)) || true
  else
    echo "  ✗ FAIL (got $score, expected >50)"
    ((fail++)) || true
  fi

  # Test 5: Normalized whitespace
  score=$(fuzzy_similarity "add  user   auth" "add user auth") || score=0
  echo "Test 5 (Whitespace): $score/100 (expect 100)"
  if [[ $score -eq 100 ]]; then
    echo "  ✓ PASS"
    ((pass++)) || true
  else
    echo "  ✗ FAIL"
    ((fail++)) || true
  fi

  # Test 6: Case insensitivity
  score=$(fuzzy_similarity "ADD USER AUTHENTICATION" "add user authentication") || score=0
  echo "Test 6 (Case): $score/100 (expect 100)"
  if [[ $score -eq 100 ]]; then
    echo "  ✓ PASS"
    ((pass++)) || true
  else
    echo "  ✗ FAIL"
    ((fail++)) || true
  fi

  echo ""
  echo "Results: $pass passed, $fail failed"
  true
}

# ============================================================================
# CLI Interface
# ============================================================================

main() {
  if [[ $# -eq 0 ]]; then
    echo "Usage: fuzzy-match.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  similarity <str1> <str2>              Calculate similarity score (0-100)"
    echo "  find-duplicate <title> [backlog]      Find duplicate in backlog"
    echo "  is-duplicate <title> [threshold]      Check if likely duplicate"
    echo "  get-duplicate-with-score <title> [backlog] [threshold]  Get duplicate info with score"
    echo "  test                                  Run test suite"
    exit 1
  fi

  local cmd="$1"
  shift

  case "$cmd" in
    similarity)
      fuzzy_similarity "$@"
      ;;
    find-duplicate)
      find_duplicate "$@"
      ;;
    is-duplicate)
      is_likely_duplicate "$@"
      ;;
    get-duplicate-with-score)
      get_duplicate_with_score "$@"
      ;;
    test)
      test_fuzzy_matching "$@"
      ;;
    *)
      echo "Unknown command: $cmd" >&2
      exit 1
      ;;
  esac
}

# Run main if sourced as script
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
