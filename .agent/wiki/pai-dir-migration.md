# PAI_DIR Resolution Migration Guide

**Status**: Four-tier system implemented and available at `~/.claude/utils/env.ts`

## Overview

All projects in `/Users/delphijc/Projects` now have access to a centralized, defensive PAI_DIR resolution utility with four tiers of fallback.

### Four Tiers (In Order)

1. **Explicit**: `PAI_DIR` environment variable (highest priority)
2. **HOME Fallback**: `HOME` env var + `~/.claude`
3. **Service Context**: Parse `USER`, `SUDO_USER`, `LOGNAME` + try `/home` or `/Users`
4. **os.homedir()**: Node.js built-in + loud error if all fail

## Usage

### Before (Ad-hoc, inconsistent)
```typescript
// Vulnerable to missing HOME, no service context handling
const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME || "", ".claude");
```

### After (Centralized, defensive)
```typescript
import { getPAIDir, getPAIPath, resolvePAIFile } from '~/.claude/utils/env.ts';

// Get PAI directory (throws if all tiers fail with diagnostic)
const paiDir = getPAIDir();  // /Users/delphijc/.claude

// Resolve relative path
const hookPath = getPAIPath('hooks', 'self-test.ts');
// => /Users/delphijc/.claude/hooks/self-test.ts

// Resolve file (validates exists)
const skill = resolvePAIFile('skills/CORE/SKILL.md');

// Optional (returns null instead of throwing)
const optionalDir = getPAIDirOptional();
```

## Migration Checklist

### Phase 1: Core PAI (sam project)
- [ ] `.agent/hooks/*.ts` - Update all hooks to use centralized utility
- [ ] `.agent/services/*/index.ts` - Update service entry points
- [ ] `.agent/skills/*/tools/*.ts` - Update skill tools that reference PAI paths

### Phase 2: Dependent Projects
- [ ] `memory-system/hooks/*.ts` - All session hooks
- [ ] `memory-system/services/memory-system/src/index.ts` - Service entry
- [ ] `memory-system/src/**/*.ts` - Any PAI path references
- [ ] `voice-server/**/*.ts` - Any PAI path references
- [ ] `awareness-dashboard/**/*.ts` - Any PAI path references

### Phase 3: Tools & Scripts
- [ ] `discord-remote-control/service/**/*.ts`
- [ ] `markdown-editor/**/*.ts`
- [ ] `cyber-alert-mgr/**/*.ts`

## Example Migration (memory-system)

### Before
```typescript
// session-end-synthesis.ts
const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME || "", ".claude");
const DB_PATH = process.env.MEMORY_DB_PATH || join(PAI_DIR, "memory-system", "memory.db");
```

### After
```typescript
import { getPAIPath } from '~/.claude/utils/env.ts';

// Service context automatically handled by getPAIPath
const DB_PATH = process.env.MEMORY_DB_PATH || getPAIPath("memory-system", "memory.db");
```

## Benefits

1. **Consistency**: Same logic everywhere (no ad-hoc fallbacks)
2. **Defensive**: Fails loud with actionable diagnostics instead of silently using wrong paths
3. **Service-aware**: Handles systemd, cron, Docker contexts where HOME might not be set
4. **Maintainable**: Single source of truth for PAI_DIR resolution

## Testing

Validate the utility:
```bash
bun ~/.claude/utils/env.ts

# Expected output:
# PAI_DIR Resolution Diagnostic
# ==============================
# Tier 1 (Explicit): /Users/delphijc/.claude
# Tier 2 (HOME):     /Users/delphijc
# Tier 3 (Service):  /Users/delphijc
# Tier 4 (os.homedir): /Users/delphijc
# 
# ✓ PAI_DIR resolved: /Users/delphijc/.claude
```

## Fallback Scenarios

### Local Dev (HOME is set)
```
✓ Tier 2 resolves: $HOME/.claude
```

### Systemd Service (HOME not set)
```
# In service definition:
[Service]
Environment="PAI_DIR=/Users/delphijc/.claude"  # Tier 1

# Or service user context:
Environment="USER=delphijc"  # Tier 3
```

### Cron Job (Minimal environment)
```bash
# In crontab:
0 9 * * * PAI_DIR=/Users/delphijc/.claude /path/to/script.ts
```

### Docker Container (No /Users directory)
```dockerfile
ENV PAI_DIR=/root/.claude
```

## Diagnostic Examples

If PAI_DIR cannot be resolved, the error message includes:
- What each tier returned
- Which tier(s) are missing required env vars
- Exact fixes to apply (e.g., "export PAI_DIR=/path/to/.claude")

### Example Error
```
[PAI] Cannot determine PAI_DIR. All four resolution tiers failed:

Tier 1 (Explicit): PAI_DIR env var = (not set)
Tier 2 (HOME):    HOME env var = (not set)
Tier 3 (Service): USER=(not set), SUDO_USER=(not set), LOGNAME=(not set)
Tier 4 (os.homedir()): /

Fix this by setting ONE of:
  export PAI_DIR="/path/to/.claude"                    (recommended)
  export HOME="/path/to/home"
  export USER="username" (with existing /home or /Users/username)
```

## Backward Compatibility

Old code like this **will still work** because Tier 2 handles HOME:
```typescript
const paiDir = process.env.PAI_DIR || `${process.env.HOME}/.claude`;
```

But should be migrated to use the centralized utility for consistency.
