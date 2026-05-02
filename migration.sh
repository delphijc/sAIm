#!/bin/bash
# SAI Migration Script v5 - Cross-platform, current directory structure
# Preserves all platform files, removes personal data, creates clean template
# Safely creates a shareable version of the SAM system

set -e

# ===========================================
# CONFIGURATION & VALIDATION
# ===========================================
SOURCE="${1:-$HOME/Projects/sam}"
TARGET="${2:-$HOME/Projects/SAI}"

# Detect source username for dynamic path replacement
SOURCE_USER=$(basename "$HOME")
SOURCE_HOME="$HOME"

# Portable sed: Linux uses `sed -i`, macOS uses `sed -i ''`
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_INPLACE() { sed -i '' "$@"; }
else
  SED_INPLACE() { sed -i "$@"; }
fi

# Validate paths
if [[ -z "$SOURCE" || "$SOURCE" == "." ]]; then
  echo "❌ Error: Source path cannot be empty or '.'"
  exit 1
fi

if [[ -z "$TARGET" || "$TARGET" == "." || "$TARGET" == "/" ]]; then
  echo "❌ Error: Target path cannot be empty, '.', or root directory"
  exit 1
fi

# Check rsync
if ! command -v rsync &> /dev/null; then
  echo "❌ Error: rsync not found. Please install rsync."
  exit 1
fi

echo "========================================"
echo "🚀 SAI Migration v5: Clean Release"
echo "========================================"
echo "Source:      $SOURCE"
echo "Target:      $TARGET"
echo "Source user: $SOURCE_USER"
echo ""

# Safety check
if [[ -d "$TARGET" ]]; then
  echo "⚠️  Target directory exists: $TARGET"
  echo "The script will NOT overwrite existing directories."
  echo "Options:"
  echo "  1. Remove it: rm -rf '$TARGET'"
  echo "  2. Use a different target: bash migration.sh '$SOURCE' '/new/path'"
  exit 1
fi

# Verify source exists
if [[ ! -d "$SOURCE" ]]; then
  echo "❌ Error: Source directory does not exist: $SOURCE"
  exit 1
fi

# ===========================================
# PHASE 1: rsync with strategic exclusions
# ===========================================
echo "📦 Phase 1: Copying files with rsync..."
echo "   (This may take a minute...)"

rsync -av --progress --stats \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.DS_Store' \
  --exclude='*.lock' \
  --exclude='*.pid' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  --exclude='.pytest_cache/' \
  --exclude='.venv/' \
  --exclude='*.db' \
  --exclude='*.db-shm' \
  --exclude='*.db-wal' \
  "$SOURCE/" "$TARGET/"

echo ""
echo "✅ rsync complete"
echo ""

# ===========================================
# PHASE 2: Remove personal directories
# ===========================================
echo "🧹 Phase 2: Removing personal data directories..."

# Audio/Recordings
[[ -d "$TARGET/.agent/Recordings" ]] && rm -rf "$TARGET/.agent/Recordings" && echo "   ✓ Removed .agent/Recordings"

# Session history and logs
[[ -d "$TARGET/.agent/History/TranscribedAudio" ]] && rm -rf "$TARGET/.agent/History/TranscribedAudio" && echo "   ✓ Removed .agent/History/TranscribedAudio"
[[ -d "$TARGET/.agent/History/Raw-Outputs" ]] && rm -rf "$TARGET/.agent/History/Raw-Outputs" && echo "   ✓ Removed .agent/History/Raw-Outputs"
[[ -d "$TARGET/.agent/History/Sessions" ]] && rm -rf "$TARGET/.agent/History/Sessions" && echo "   ✓ Removed .agent/History/Sessions"
[[ -d "$TARGET/.agent/History/Research" ]] && rm -rf "$TARGET/.agent/History/Research" && echo "   ✓ Removed .agent/History/Research"
[[ -d "$TARGET/.agent/History/Decisions" ]] && rm -rf "$TARGET/.agent/History/Decisions" && echo "   ✓ Removed .agent/History/Decisions"
[[ -d "$TARGET/.agent/History/Learnings" ]] && rm -rf "$TARGET/.agent/History/Learnings" && echo "   ✓ Removed .agent/History/Learnings"
[[ -d "$TARGET/.agent/History/security" ]] && rm -rf "$TARGET/.agent/History/security" && echo "   ✓ Removed .agent/History/security"
[[ -d "$TARGET/.agent/History/backups" ]] && rm -rf "$TARGET/.agent/History/backups" && echo "   ✓ Removed .agent/History/backups"

# Runtime history (lowercase - event/security logs)
[[ -d "$TARGET/.agent/history" ]] && rm -rf "$TARGET/.agent/history" && echo "   ✓ Removed .agent/history (runtime logs)"

# Discord remote control personal data
# (code/skills are kept; only personal runtime data removed)
[[ -d "$TARGET/.agent/discord-remote-control/history" ]] && rm -rf "$TARGET/.agent/discord-remote-control/history" && echo "   ✓ Removed discord-remote-control/history"
[[ -d "$TARGET/.agent/discord-remote-control/History" ]] && rm -rf "$TARGET/.agent/discord-remote-control/History" && echo "   ✓ Removed discord-remote-control/History"
[[ -d "$TARGET/.agent/discord-remote-control/raw-outputs" ]] && rm -rf "$TARGET/.agent/discord-remote-control/raw-outputs" && echo "   ✓ Removed discord-remote-control/raw-outputs"
[[ -d "$TARGET/.agent/discord-remote-control/raw-transcripts" ]] && rm -rf "$TARGET/.agent/discord-remote-control/raw-transcripts" && echo "   ✓ Removed discord-remote-control/raw-transcripts"
[[ -d "$TARGET/.agent/discord-remote-control/sessions" ]] && rm -rf "$TARGET/.agent/discord-remote-control/sessions" && echo "   ✓ Removed discord-remote-control/sessions"
[[ -d "$TARGET/.agent/discord-remote-control/TranscribedAudio" ]] && rm -rf "$TARGET/.agent/discord-remote-control/TranscribedAudio" && echo "   ✓ Removed discord-remote-control/TranscribedAudio"
[[ -d "$TARGET/.agent/discord-remote-control/wisdom" ]] && rm -rf "$TARGET/.agent/discord-remote-control/wisdom" && echo "   ✓ Removed discord-remote-control/wisdom"

# Session-specific data
[[ -d "$TARGET/.agent/projects" ]] && rm -rf "$TARGET/.agent/projects" && echo "   ✓ Removed .agent/projects"
[[ -d "$TARGET/.agent/debug" ]] && rm -rf "$TARGET/.agent/debug" && echo "   ✓ Removed .agent/debug"
[[ -d "$TARGET/.agent/todos" ]] && rm -rf "$TARGET/.agent/todos" && echo "   ✓ Removed .agent/todos"
[[ -d "$TARGET/.agent/cache" ]] && rm -rf "$TARGET/.agent/cache" && echo "   ✓ Removed .agent/cache"
[[ -d "$TARGET/.agent/plans" ]] && rm -rf "$TARGET/.agent/plans" && echo "   ✓ Removed .agent/plans"
[[ -d "$TARGET/.agent/file-history" ]] && rm -rf "$TARGET/.agent/file-history" && echo "   ✓ Removed .agent/file-history"
[[ -d "$TARGET/.agent/statsig" ]] && rm -rf "$TARGET/.agent/statsig" && echo "   ✓ Removed .agent/statsig"
[[ -d "$TARGET/.agent/shell-snapshots" ]] && rm -rf "$TARGET/.agent/shell-snapshots" && echo "   ✓ Removed .agent/shell-snapshots"
[[ -d "$TARGET/.agent/session-env" ]] && rm -rf "$TARGET/.agent/session-env" && echo "   ✓ Removed .agent/session-env"
[[ -d "$TARGET/.agent/ide" ]] && rm -rf "$TARGET/.agent/ide" && echo "   ✓ Removed .agent/ide"
[[ -d "$TARGET/.agent/telemetry" ]] && rm -rf "$TARGET/.agent/telemetry" && echo "   ✓ Removed .agent/telemetry"
[[ -d "$TARGET/.agent/paste-cache" ]] && rm -rf "$TARGET/.agent/paste-cache" && echo "   ✓ Removed .agent/paste-cache"
[[ -d "$TARGET/.agent/hook-events" ]] && rm -rf "$TARGET/.agent/hook-events" && echo "   ✓ Removed .agent/hook-events"
[[ -d "$TARGET/.agent/sessions" ]] && rm -rf "$TARGET/.agent/sessions" && echo "   ✓ Removed .agent/sessions"
[[ -d "$TARGET/.agent/reports" ]] && rm -rf "$TARGET/.agent/reports" && echo "   ✓ Removed .agent/reports"
[[ -d "$TARGET/.agent/backups" ]] && rm -rf "$TARGET/.agent/backups" && echo "   ✓ Removed .agent/backups"

# Personal projects
[[ -d "$TARGET/projects/realms-of-tomorrow" ]] && rm -rf "$TARGET/projects/realms-of-tomorrow" && echo "   ✓ Removed projects/realms-of-tomorrow"
[[ -d "$TARGET/projects/default_project" ]] && rm -rf "$TARGET/projects/default_project" && echo "   ✓ Removed projects/default_project"

# Root-level personal files
[[ -f "$TARGET/blue-team-defender.png" ]] && rm -f "$TARGET/blue-team-defender.png" && echo "   ✓ Removed blue-team-defender.png"
[[ -d "$TARGET/backups" ]] && rm -rf "$TARGET/backups" && echo "   ✓ Removed backups/"

# Deprecated docs
[[ -d "$TARGET/Docs (deprecated see wiki)" ]] && rm -rf "$TARGET/Docs (deprecated see wiki)" && echo "   ✓ Removed deprecated Docs"

echo "✅ Personal directories removed"
echo ""

# ===========================================
# PHASE 3: Remove sensitive files
# ===========================================
echo "🔐 Phase 3: Removing sensitive files..."

[[ -f "$TARGET/.agent/.env" ]] && rm -f "$TARGET/.agent/.env" && echo "   ✓ Removed .agent/.env"
[[ -f "$TARGET/.agent/.env.discord" ]] && rm -f "$TARGET/.agent/.env.discord" && echo "   ✓ Removed .agent/.env.discord"
[[ -f "$TARGET/.agent/.credentials.json" ]] && rm -f "$TARGET/.agent/.credentials.json" && echo "   ✓ Removed .agent/.credentials.json"
[[ -f "$TARGET/.agent/agent-sessions.json" ]] && rm -f "$TARGET/.agent/agent-sessions.json" && echo "   ✓ Removed agent-sessions.json"
[[ -f "$TARGET/.agent/stats-cache.json" ]] && rm -f "$TARGET/.agent/stats-cache.json" && echo "   ✓ Removed stats-cache.json"
[[ -f "$TARGET/.agent/history.jsonl" ]] && rm -f "$TARGET/.agent/history.jsonl" && echo "   ✓ Removed history.jsonl"
[[ -f "$TARGET/.agent/.session-briefing-state.json" ]] && rm -f "$TARGET/.agent/.session-briefing-state.json" && echo "   ✓ Removed .session-briefing-state.json"
[[ -f "$TARGET/.agent/mcp-needs-auth-cache.json" ]] && rm -f "$TARGET/.agent/mcp-needs-auth-cache.json" && echo "   ✓ Removed mcp-needs-auth-cache.json"
[[ -f "$TARGET/frontmatter.log" ]] && rm -f "$TARGET/frontmatter.log" && echo "   ✓ Removed frontmatter.log"
[[ -f "$TARGET/.env" ]] && rm -f "$TARGET/.env" && echo "   ✓ Removed .env"
[[ -f "$TARGET/.env.local" ]] && rm -f "$TARGET/.env.local" && echo "   ✓ Removed .env.local"

# Keep .compact-reminder-state.json for autocompaction helper

echo "✅ Sensitive files removed"
echo ""

# ===========================================
# PHASE 4: Replace hardcoded paths in settings.json
# ===========================================
echo "🔧 Phase 4: Fixing hardcoded paths..."

if [[ -f "$TARGET/.agent/settings.json" ]]; then
  TEMP_SETTINGS=$(mktemp)

  # Replace source user's home path and project path with placeholders.
  # Handles both Linux (/home/user) and macOS (/Users/user) conventions.
  # We replace longest/most-specific patterns first to avoid partial replacements.
  sed "s|${SOURCE_HOME}/Projects/sam/.claude|\${PAI_DIR}|g" "$TARGET/.agent/settings.json" > "$TEMP_SETTINGS"
  SED_INPLACE "s|${SOURCE_HOME}/Projects/sam|\${SAI_ROOT}|g" "$TEMP_SETTINGS"
  SED_INPLACE "s|${SOURCE_HOME}|\${HOME}|g" "$TEMP_SETTINGS"

  mv "$TEMP_SETTINGS" "$TARGET/.agent/settings.json"

  echo "   ✓ Replaced paths from: $SOURCE_HOME"
  echo "   ℹ️  User will run setup.sh to configure PAI_DIR automatically"
else
  echo "   ⚠️  settings.json not found (may have been removed)"
fi

echo "✅ Paths updated with environment variable placeholders"
echo ""

# ===========================================
# PHASE 5: Clean wiki documentation
# ===========================================
echo "📚 Phase 5: Cleaning documentation paths..."

if [[ -d "$TARGET/wiki" ]]; then
  MARKDOWN_COUNT=$(find "$TARGET/wiki" -name "*.md" -type f | wc -l)

  find "$TARGET/wiki" -name "*.md" -type f | while read -r file; do
    SED_INPLACE "s|${SOURCE_HOME}/Projects/sam|~/Projects/SAI|g" "$file"
    SED_INPLACE "s|${SOURCE_HOME}|~|g" "$file"
  done

  echo "   ✓ Cleaned $MARKDOWN_COUNT markdown files"
else
  echo "   ⚠️  wiki/ directory not found"
fi

echo "✅ Documentation paths cleaned"
echo ""

# ===========================================
# PHASE 6: Create fresh directory structure
# ===========================================
echo "📁 Phase 6: Creating fresh directory structure..."

# Empty History structure (for templates)
mkdir -p "$TARGET/.agent/History/Decisions"
mkdir -p "$TARGET/.agent/History/Learnings"
mkdir -p "$TARGET/.agent/History/Research"
mkdir -p "$TARGET/.agent/History/Sessions"
touch "$TARGET/.agent/History/Decisions/.gitkeep"
touch "$TARGET/.agent/History/Learnings/.gitkeep"
touch "$TARGET/.agent/History/Research/.gitkeep"
touch "$TARGET/.agent/History/Sessions/.gitkeep"

# Empty projects structure
mkdir -p "$TARGET/projects/example_project"
mkdir -p "$TARGET/.agent/projects"
touch "$TARGET/.agent/projects/.gitkeep"

# Empty runtime directories
mkdir -p "$TARGET/.agent/debug"
mkdir -p "$TARGET/.agent/todos"
mkdir -p "$TARGET/.agent/cache"
mkdir -p "$TARGET/.agent/plans"
mkdir -p "$TARGET/.agent/session-env"
mkdir -p "$TARGET/.agent/shell-snapshots"
mkdir -p "$TARGET/.agent/reports"
touch "$TARGET/.agent/debug/.gitkeep"
touch "$TARGET/.agent/todos/.gitkeep"
touch "$TARGET/.agent/reports/.gitkeep"

# Empty discord-remote-control data dirs (code stays, data dirs are empty)
mkdir -p "$TARGET/.agent/discord-remote-control/history"
mkdir -p "$TARGET/.agent/discord-remote-control/sessions"
touch "$TARGET/.agent/discord-remote-control/history/.gitkeep"
touch "$TARGET/.agent/discord-remote-control/sessions/.gitkeep"

# Ensure config directory exists
mkdir -p "$TARGET/.agent/config"

echo "   ✓ Created directory structure"
echo ""

# ===========================================
# PHASE 7: Create template configuration files
# ===========================================
echo "📝 Phase 7: Creating template configurations..."

# Settings profile template
if [[ ! -f "$TARGET/.agent/config/profile.json" ]]; then
  cat > "$TARGET/.agent/config/profile.json" << 'EOF'
{
  "user": {
    "name": "YOUR_USERNAME",
    "email": "your.email@example.com"
  },
  "assistant": {
    "name": "PAI",
    "color": "purple",
    "voiceId": "Jessica"
  },
  "paths": {
    "home": "$HOME",
    "pai_dir": "$HOME/.claude",
    "projects_root": "$HOME/Projects"
  },
  "voice": {
    "enabled": true,
    "port": 8888
  },
  "version": "1.0.0"
}
EOF
  echo "   ✓ Created profile.json template"
fi

# State blackboard template
if [[ ! -f "$TARGET/.agent/state.md" ]]; then
  cat > "$TARGET/.agent/state.md" << 'EOF'
# PAI State Blackboard

## System Status
- **Current Phase**: Initialized
- **Active Agents**: 0
- **Global Status**: 0 Completed / 0 Active / 0 Todo
- **Last Updated**: $(date)

## Quality Gates
- **Last Coverage**: N/A
- **Last Sync**: N/A

## Recent Activity
> New instance - no prior history
EOF
  echo "   ✓ Created state.md template"
fi

# Copy .env.example as template if it exists
if [[ -f "$TARGET/.agent/.env.example" ]]; then
  cp "$TARGET/.agent/.env.example" "$TARGET/.agent/.env.template"
  echo "   ✓ Created .env.template from .env.example"
fi

echo "✅ Templates created"
echo ""

# ===========================================
# PHASE 8: Create setup and documentation
# ===========================================
echo "📖 Phase 8: Creating setup documentation..."

# SETUP.md
cat > "$TARGET/SETUP.md" << 'EOF'
# SAI Setup Guide

Welcome to your Personal AI System instance! This is a clean copy ready for configuration.

## Quick Start

### 1. Configure Environment
```bash
cd "$(pwd)"  # Your SAI directory
bash .claude/setup.sh
```

This script will automatically:
- Set `PAI_DIR` to your system path in `.agent/settings.json`
- Create symlink `.claude -> .agent`
- Verify configuration

### 2. Create API Configuration
```bash
cp .agent/.env.template .agent/.env
# Edit .agent/.env with your API keys
nano .agent/.env
```

Required variables:
- `ANTHROPIC_API_KEY` - Claude API key from https://console.anthropic.com
- Any other service API keys your skills require

### 3. Customize Assistant Name
Edit `.agent/config/profile.json` and `.claude/CLAUDE.md`:
- Change "PAI" to your assistant's name (e.g., "Nova", "Sam")
- Update `voiceId` if desired
- Adjust colors and other settings

### 4. Initialize Version Control
```bash
git init
git add .
git commit -m "Initial SAI release - clean template"
git remote add origin <your-repo-url>
git push -u origin main
```

## Directory Structure

```
.
├── .agent/                      # Core system configuration
│   ├── .claude -> .agent        # Symlink for compatibility
│   ├── .env.template            # API keys template
│   ├── CLAUDE.md                # System instructions
│   ├── settings.json            # Claude Code settings
│   ├── config/                  # Configuration files
│   ├── History/                 # Your decision/learning logs
│   ├── agents/                  # Agent definitions
│   ├── skills/                  # Custom skills
│   ├── discord-remote-control/  # Discord bot (optional)
│   └── projects/                # Per-project memory
├── projects/                    # Your AI projects
│   └── example_project/         # Template project
├── wiki/                        # Documentation (if included)
├── SETUP.md                     # This file
└── CLAUDE.md                    # Project-specific instructions
```

## Verification Checklist

After setup, verify:
- [ ] `.agent/settings.json` shows correct PAI_DIR path
- [ ] `.agent/.env` is configured with API keys
- [ ] No references to prior user's home directory remain: `grep -r '/home/' .`
- [ ] No personal email addresses remain: `grep -r '@gmail' .`
- [ ] Voice server starts: check localhost:8888 (optional)
- [ ] First prompt works with `claude code`

## Troubleshooting

**"No such file or directory" errors in hooks?**
→ Run `bash .claude/setup.sh` to configure PAI_DIR

**Voice features not working?**
→ Voice is optional. Set `voice.enabled: false` in `.agent/config/profile.json`

**API errors?**
→ Check `.agent/.env` has valid API keys

**Discord bot not connecting?**
→ Discord is optional. Add `DISCORD_BOT_TOKEN` to `.agent/.env.discord` when ready.

## Next Steps

1. Check `.agent/skills/CORE/SKILL.md` for system identity
2. Read `wiki/` for full documentation (if included)
3. Modify `.agent/CLAUDE.md` for your preferences
4. Create your first project in `projects/`

Happy building! 🚀
EOF
echo "   ✓ Created SETUP.md"

# PERSONAL_DATA_CHECKLIST.md
cat > "$TARGET/PERSONAL_DATA_CHECKLIST.md" << 'EOF'
# Personal Data Cleanup Checklist

Before sharing this instance, verify all personal data has been removed.

## Automated Cleanup ✅
The migration script has already removed:
- Personal audio recordings
- Session history and transcripts
- Personal project data
- API keys and sensitive environment files (.env, .env.discord, .credentials.json)
- Session caches and debug logs
- Discord memory database (memory.db)
- Paste cache and hook event logs
- Reports and backup files
- Root-level personal images and assets

## Manual Verification Required ⚠️

Run these commands to spot-check for any remaining personal data:

### 1. Check for home directory paths
```bash
grep -ri "/home/" . --exclude-dir=.git
grep -ri "/Users/" . --exclude-dir=.git
```

### 2. Check for email addresses
```bash
grep -ri "@gmail" . --exclude-dir=.git
grep -ri "@personal" . --exclude-dir=.git
```

### 3. Check for API keys/tokens
```bash
grep -ri "sk-" . --exclude-dir=.git
grep -ri "DISCORD_BOT_TOKEN=" . --exclude-dir=.git
grep -ri "secret" . --exclude-dir=.git
```

### 4. Check for comments with personal references
```bash
grep -ri "TODO" . --exclude-dir=.git
grep -ri "FIXME" . --exclude-dir=.git
```

## Files to Review Manually

1. **`.agent/config/profile.json`** - Update name/email placeholders
2. **`.claude/CLAUDE.md`** - Personalization for your system
3. **`wiki/`** - Check for personal references in documentation
4. **`.agent/settings.json`** - Verify no absolute paths remain

## Before Sharing

- [ ] All grep checks above return no personal references
- [ ] `.env` and `.env.template` contain only examples, not real keys
- [ ] Profile information updated to your identity
- [ ] No commit history leaking secrets (`git log` review)

## In Case of Issues

If you discover personal data after running migration:
1. Remove it manually: `rm -rf <file>`
2. Or edit it: `nano <file>`
3. Update git: `git add .` and `git commit`
4. For git history: see git documentation on removing sensitive data
EOF
echo "   ✓ Created PERSONAL_DATA_CHECKLIST.md"

echo "✅ Documentation created"
echo ""

# ===========================================
# PHASE 9: Create .gitignore
# ===========================================
echo "🔒 Phase 9: Creating .gitignore..."

cat > "$TARGET/.gitignore" << 'EOF'
# Dependencies
node_modules/
__pycache__/
.venv/
venv/
*.egg-info/

# Build outputs
dist/
build/
.next/
out/
.cache/

# IDE and editor
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Environment variables (CRITICAL - never commit secrets!)
.env
.env.local
.env.*.local
.env.discord
.agent/.env
.agent/.env.local
.agent/.env.discord

# Credentials and auth
.agent/.credentials.json
.credentials.json

# Runtime and logs
*.log
*.pid
*.lock
.frontmatter.log

# SQLite databases (contain personal data)
*.db
*.db-shm
*.db-wal

# System and temporary files
.DS_Store
.AppleDouble
.LSOverride
Thumbs.db
*.tmp
*.bak

# Session and debug data
.agent/cache/
.agent/debug/
.agent/session-env/
.agent/shell-snapshots/
.agent/todos/
.agent/plans/
.agent/file-history/
.agent/paste-cache/
.agent/hook-events/
.agent/telemetry/
.agent/sessions/
.agent/backups/

# Runtime state
.agent/agent-sessions.json
.agent/stats-cache.json
.agent/history.jsonl
.agent/.session-briefing-state.json
.agent/.compact-reminder-state.json
.agent/mcp-needs-auth-cache.json

# Recordings and personal data
.agent/Recordings/
.agent/history/
.agent/History/Sessions/
.agent/History/TranscribedAudio/
.agent/reports/

# Discord remote control runtime data
.agent/discord-remote-control/history/
.agent/discord-remote-control/sessions/
.agent/discord-remote-control/raw-outputs/
.agent/discord-remote-control/raw-transcripts/
.agent/discord-remote-control/TranscribedAudio/
.agent/discord-remote-control/wisdom/

# Project-specific session data
.agent/projects/*/session.json
.agent/projects/*/logs/

# Testing
.coverage
coverage/
.pytest_cache/
.bun/

# Keep these template files
!.agent/.env.template
!.agent/.env.example
!.agent/config/.gitkeep
!.agent/History/.gitkeep
EOF
echo "   ✓ Created .gitignore"

echo "✅ Git configuration created"
echo ""

# ===========================================
# PHASE 10: Recreate symlink and final checks
# ===========================================
echo "🔗 Phase 10: Creating .claude symlink..."

# Remove old symlink if it exists
[[ -L "$TARGET/.claude" ]] && rm -f "$TARGET/.claude"

# Create symlink
cd "$TARGET"
ln -sf .agent .claude
echo "   ✓ Created .claude → .agent symlink"

echo "✅ Symlink created"
echo ""

# ===========================================
# PHASE 11: Final verification
# ===========================================
echo "✓ Phase 11: Final verification..."

# Check for obvious remaining personal data using the actual source username
PERSONAL_REFS=$(grep -r "$SOURCE_USER" "$TARGET" 2>/dev/null | grep -v ".git" | wc -l)
HOME_REFS=$(grep -r "$SOURCE_HOME" "$TARGET" 2>/dev/null | grep -v ".git" | wc -l)
EMAIL_REFS=$(grep -r "@gmail\|@personal" "$TARGET" 2>/dev/null | grep -v ".git" | wc -l)
CRED_FILES=$(find "$TARGET" -name ".credentials.json" -o -name ".env.discord" 2>/dev/null | grep -v ".git" | wc -l)

if [[ $PERSONAL_REFS -gt 0 ]]; then
  echo "   ⚠️  Found $PERSONAL_REFS references to '$SOURCE_USER'"
  echo "   → Run: grep -r '$SOURCE_USER' . | grep -v '.git'"
fi

if [[ $HOME_REFS -gt 0 ]]; then
  echo "   ⚠️  Found $HOME_REFS references to home path '$SOURCE_HOME'"
  echo "   → Run: grep -r '$SOURCE_HOME' . | grep -v '.git'"
fi

if [[ $EMAIL_REFS -gt 0 ]]; then
  echo "   ⚠️  Found $EMAIL_REFS personal email references"
  echo "   → Run: grep -r '@gmail\|@personal' . | grep -v '.git'"
fi

if [[ $CRED_FILES -gt 0 ]]; then
  echo "   🚨 Found $CRED_FILES credential file(s) that should have been removed!"
  echo "   → Run: find . -name '.credentials.json' -o -name '.env.discord'"
fi

if [[ $PERSONAL_REFS -eq 0 && $HOME_REFS -eq 0 && $EMAIL_REFS -eq 0 && $CRED_FILES -eq 0 ]]; then
  echo "   ✓ No obvious personal data detected"
fi

echo ""

# ===========================================
# COMPLETE
# ===========================================
echo ""
echo "========================================"
echo "✅ Migration Complete!"
echo "========================================"
echo ""
echo "📍 Location: $TARGET"
echo "📊 Size: $(du -sh "$TARGET" 2>/dev/null | cut -f1)"
echo ""

echo "🚀 Next Steps:"
echo ""
echo "1. Navigate to your new instance:"
echo "   cd '$TARGET'"
echo ""
echo "2. Review the cleanup checklist:"
echo "   cat PERSONAL_DATA_CHECKLIST.md"
echo ""
echo "3. Run spot-checks:"
echo "   grep -r '/home/' . | grep -v '.git'"
echo "   grep -r '@gmail' . | grep -v '.git'"
echo ""
echo "4. Follow setup guide:"
echo "   cat SETUP.md"
echo ""
echo "5. Configure and initialize:"
echo "   bash .claude/setup.sh"
echo "   cp .agent/.env.template .agent/.env"
echo "   nano .agent/.env  # Add your API keys"
echo ""
echo "6. Initialize version control:"
echo "   git init"
echo "   git add ."
echo "   git commit -m 'Initial SAI release - clean template'"
echo ""
echo "7. (Optional) Push to GitHub:"
echo "   git remote add origin <your-repo-url>"
echo "   git push -u origin main"
echo ""
echo "========================================"
echo "✨ Ready to share!"
echo "========================================"
echo ""
