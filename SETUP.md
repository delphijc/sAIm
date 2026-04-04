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
- Change "PAI" to your assistant's name (e.g., "Nova", "sAIm")
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
