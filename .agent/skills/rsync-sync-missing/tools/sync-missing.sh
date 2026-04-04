#!/bin/bash
# rsync-sync-missing - Sync missing files from source to target
# Usage: sync-missing.sh source=/path target=/path [execute=true] [verbose=true] [remote=false]

set -euo pipefail

# Parse arguments
SOURCE=""
TARGET=""
EXECUTE="false"
VERBOSE="true"
REMOTE="false"

for arg in "$@"; do
  case "$arg" in
    source=*) SOURCE="${arg#source=}" ;;
    target=*) TARGET="${arg#target=}" ;;
    execute=*) EXECUTE="${arg#execute=}" ;;
    verbose=*) VERBOSE="${arg#verbose=}" ;;
    remote=*) REMOTE="${arg#remote=}" ;;
  esac
done

# Validation
if [[ -z "$SOURCE" ]]; then
  echo "❌ Error: source parameter required"
  echo "Usage: sync-missing.sh source=/path/source target=/path/target [execute=true]"
  exit 1
fi

if [[ -z "$TARGET" ]]; then
  echo "❌ Error: target parameter required"
  echo "Usage: sync-missing.sh source=/path/source target=/path/target [execute=true]"
  exit 1
fi

# Expand ~ to $HOME
SOURCE="${SOURCE/\~/$HOME}"
TARGET="${TARGET/\~/$HOME}"

# Validate source exists (unless remote)
if [[ "$REMOTE" != "true" ]] && [[ ! -d "$SOURCE" ]]; then
  echo "❌ Error: Source directory does not exist: $SOURCE"
  exit 1
fi

# Create target if it doesn't exist
if [[ "$REMOTE" != "true" ]] && [[ ! -d "$TARGET" ]]; then
  echo "▶ Creating target directory: $TARGET"
  mkdir -p "$TARGET"
fi

# Build rsync command
RSYNC_OPTS="-a --ignore-existing"

if [[ "$VERBOSE" == "true" ]]; then
  RSYNC_OPTS="$RSYNC_OPTS -v"
fi

if [[ "$REMOTE" == "true" ]]; then
  RSYNC_OPTS="$RSYNC_OPTS -z"  # Add compression for remote
fi

# Add dry-run if not executing
if [[ "$EXECUTE" != "true" ]]; then
  RSYNC_OPTS="$RSYNC_OPTS -n"
fi

# Ensure trailing slashes
SOURCE="${SOURCE%/}/"
TARGET="${TARGET%/}/"

# Execute rsync
echo "═══════════════════════════════════════════════════════════════"
if [[ "$EXECUTE" != "true" ]]; then
  echo "🔍 DRY RUN MODE (no files will be copied)"
else
  echo "📋 EXECUTING SYNC"
fi
echo "═══════════════════════════════════════════════════════════════"
echo "Source:  $SOURCE"
echo "Target:  $TARGET"
echo ""

if rsync $RSYNC_OPTS "$SOURCE" "$TARGET"; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  if [[ "$EXECUTE" != "true" ]]; then
    echo "✅ Preview complete. Run with execute=true to perform sync."
  else
    echo "✅ Sync completed successfully"
  fi
  echo "═══════════════════════════════════════════════════════════════"
else
  echo ""
  echo "❌ Sync failed with error code: $?"
  exit 1
fi
