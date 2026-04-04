# PAI Path Resolution Guide

This document establishes the definitive standard for path resolution across the entire PAI system. It replaces ad-hoc relative path handling with a centralized, maintainable approach.

**Last Updated**: 2026-03-14
**Status**: Active Standard
**Applies To**: All TypeScript, JavaScript, Shell, and configuration files

---

## Table of Contents

1. [Core Principle](#core-principle)
2. [The PAI_DIR Standard](#the-paidir-standard)
3. [Common Directory Exports](#common-directory-exports)
4. [Usage Patterns](#usage-patterns)
5. [Path Construction Rules](#path-construction-rules)
6. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
7. [Special Cases](#special-cases)
8. [Migration Guide](#migration-guide)

---

## Core Principle

**One Source of Truth**: All paths in PAI resolve from a single root: `PAI_DIR`

- `PAI_DIR` = `~/.claude` (user's home directory by default)
- Can be overridden via `PAI_DIR` environment variable
- Can be configured in `.env` file for project-specific paths
- Enables portability without relative path brittleness

```
┌─ PAI_DIR (~/.claude)
│  ├─ hooks/
│  ├─ skills/
│  ├─ agents/
│  ├─ history/          ← All timestamped data
│  │  └─ Reference/
│  │     └─ days/       ← Devotions
│  ├─ tools/
│  └─ commands/
```

---

## The PAI_DIR Standard

### Detection Logic

The system detects `PAI_DIR` in this priority order:

1. **`.env` file** (project-specific, highest priority)
   ```bash
   PAI_DIR=/custom/path/to/pai
   ```

2. **Environment variable**
   ```bash
   export PAI_DIR=/custom/path/to/pai
   ```

3. **Default fallback**
   ```typescript
   PAI_DIR = ~/.claude  // Canonical location
   ```

### Reference Implementation

Located at: `.agent/hooks/lib/pai-paths.ts`

```typescript
import { homedir } from 'os';
import { resolve, join } from 'path';

// This is the single source of truth for path detection
const PAI_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
```

---

## Common Directory Exports

These are centrally exported from `.agent/hooks/lib/pai-paths.ts`:

| Export | Resolves To | Usage |
|--------|-------------|-------|
| `PAI_DIR` | `~/.claude` | Root - base for all paths |
| `HOOKS_DIR` | `$PAI_DIR/hooks` | Hook scripts |
| `SKILLS_DIR` | `$PAI_DIR/skills` | Skill implementations |
| `AGENTS_DIR` | `$PAI_DIR/agents` | Agent definitions |
| `HISTORY_DIR` | `$PAI_DIR/history` | Timestamped session data |
| `REFERENCE_DIR` | `$HISTORY_DIR/Reference` | Reference materials |
| `DEVOTIONS_DIR` | `$REFERENCE_DIR/days` | Daily devotion files |
| `COMMANDS_DIR` | `$PAI_DIR/commands` | Command definitions |

### Importing in Hooks

If your file is in `.agent/hooks/`:

```typescript
import { PAI_DIR, HOOKS_DIR, SKILLS_DIR, DEVOTIONS_DIR } from './lib/pai-paths';

// Use exported constants
const skillPath = join(SKILLS_DIR, 'my-skill');
```

### Using in Skills (Outside Hooks)

If your file is in `.agent/skills/` or elsewhere:

```typescript
import { homedir } from 'os';
import { join } from 'path';

// Replicate the PAI_DIR detection pattern
const PAI_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
const DEVOTIONS_DIR = join(PAI_DIR, 'history', 'Reference', 'days');
```

---

## Usage Patterns

### ✅ Pattern 1: Absolute Path Construction

**Use Case**: Building a path to access a file or directory

```typescript
import { join } from 'path';
import { homedir } from 'os';

const PAI_DIR = process.env.PAI_DIR || join(homedir(), '.claude');

// Construct paths from absolute root
const hookPath = join(PAI_DIR, 'hooks', 'my-hook.ts');
const skillPath = join(PAI_DIR, 'skills', 'my-skill');
const historyFile = join(PAI_DIR, 'history', 'sessions', 'log.txt');
```

**Why This Works**:
- ✅ Portable (works on any machine)
- ✅ Centralized (respects PAI_DIR environment variable)
- ✅ Clear (no relative path confusion)

---

### ✅ Pattern 2: Path Aliases in TypeScript

**Use Case**: Reducing import path complexity in nested modules

**In `tsconfig.json`**:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@pai-tools/*": ["/.claude/tools/*"],
      "@memory/*": ["../../../memory/*"]
    }
  }
}
```

**In code**:

```typescript
// Instead of:
import { buildContext } from '../../../memory/injection.ts';

// Use:
import { buildContext } from '@memory/injection.ts';
```

**When to use this**:
- Deep nesting (3+ levels of relative traversal)
- Within a single skill/module tree
- When absolute paths would be too long

---

### ✅ Pattern 3: Environment Variable Fallback

**Use Case**: Defensive coding in standalone tools

```typescript
import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

const PAI_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
const DEVOTIONS_DIR = join(PAI_DIR, 'history', 'Reference', 'days');

// Fail fast with helpful error
if (!existsSync(DEVOTIONS_DIR)) {
  console.error(`❌ Devotions directory not found: ${DEVOTIONS_DIR}`);
  console.error(`   Current PAI_DIR: ${PAI_DIR}`);
  console.error(`   Set PAI_DIR environment variable if using custom location`);
  process.exit(1);
}
```

**Benefits**:
- ✅ Works with custom PAI_DIR locations
- ✅ Clear error messages for debugging
- ✅ Supports both development and production

---

### ✅ Pattern 4: Dynamic Path Resolution (Runtime)

**Use Case**: When path is determined at runtime

```typescript
import { join } from 'path';

interface Config {
  skillName: string;
}

function getSkillPath(skillName: string): string {
  const PAI_DIR = process.env.PAI_DIR || require('os').homedir() + '/.claude';
  return join(PAI_DIR, 'skills', skillName);
}

const mySkillPath = getSkillPath('my-skill');
```

---

## Path Construction Rules

### Rule 1: Always Use `path.join()` and `path.resolve()`

```typescript
import { join, resolve } from 'path';

// ✅ Good
const filePath = join(PAI_DIR, 'hooks', 'my-hook.ts');
const absolutePath = resolve(filePath);

// ❌ Avoid
const filePath = PAI_DIR + '/hooks/my-hook.ts';           // Platform issues
const filePath = `${PAI_DIR}/hooks/my-hook.ts`;          // String interpolation
```

**Why**: `path.join()` handles platform differences (Windows vs Unix), edge cases, and `.` / `..` correctly.

---

### Rule 2: Never Use Hardcoded Absolute Paths

```typescript
// ❌ Bad - Not portable
const path = '/.claude/hooks/my-hook.ts';
const path = '/Users/username/.claude/hooks/my-hook.ts';

// ✅ Good - Portable
const PAI_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
const path = join(PAI_DIR, 'hooks', 'my-hook.ts');
```

---

### Rule 3: Prefer Relative Imports for Sibling Modules

```typescript
// In the same package, relative imports are fine:
import { handler } from './handlers/text.ts';
import { buildContext } from '../memory/injection.ts';

// These are NOT "bad relative paths" - they're expected module structure
```

---

### Rule 4: Use Environment Variables for Cross-Module Paths

```typescript
// ✅ Good - Works from anywhere
const PAI_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
const externalModule = join(PAI_DIR, 'skills', 'other-skill', 'lib.ts');

// ❌ Bad - Only works from specific locations
const externalModule = '../../../../skills/other-skill/lib.ts';
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Multiple Possible Path Locations

```typescript
// Bad: Fragile, hard to debug
const POSSIBLE_PATHS = [
  join(process.cwd(), '.claude/History/Reference/days'),
  join(homedir(), '$HOME$HOME/Projects/sam/.claude/History/Reference/days'),
  join(PAI_DIR, '../History/Reference/days'),
];
let PATH = POSSIBLE_PATHS.find(p => existsSync(p));
```

**Fix**: Use centralized `PAI_DIR` with clear error on missing paths.

---

### ❌ Anti-Pattern 2: Excessive Relative Path Traversal

```typescript
// Bad: Hard to read, fragile
import { foo } from '../../../../../../../lib/foo.ts';

// Good: Use path alias or `PAI_DIR`
import { foo } from '@pai-tools/lib/foo.ts';
// or
const foo = join(PAI_DIR, 'tools', 'lib', 'foo.ts');
```

---

### ❌ Anti-Pattern 3: Path String Concatenation

```typescript
// Bad: Platform issues, edge case bugs
const path = baseDir + '/subdir/' + filename;
const path = `${baseDir}/subdir/${filename}`;

// Good: Platform-safe path construction
const path = join(baseDir, 'subdir', filename);
```

---

### ❌ Anti-Pattern 4: Assuming Current Working Directory

```typescript
// Bad: Works from specific directory, breaks elsewhere
const config = readFileSync('./config/app.json');

// Good: Explicit absolute path
const PAI_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
const configPath = join(PAI_DIR, 'config', 'app.json');
const config = readFileSync(configPath);
```

---

## Special Cases

### Shell Scripts

Shell scripts can use defensive path resolution:

```bash
#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PAI_DIR="${PAI_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Use $PAI_DIR for all paths
HOOK_FILE="$PAI_DIR/hooks/my-hook.ts"
```

**Key**: Always resolve relative paths to absolute paths using `pwd`.

---

### Bun's `import.meta.dir`

Appropriate for accessing files bundled with the module:

```typescript
import { join } from 'path';

// ✅ Good: schema file shipped with this module
const schemaPath = join(import.meta.dir, 'schema.sql');

// ❌ Bad: Cross-module file that should use PAI_DIR
const otherPath = join(import.meta.dir, '../../../skills/other/lib.ts');
```

**Use Case**: Local files (schemas, templates, migrations) shipped with your code.

---

### Environment Variable Configuration

Your `.env` file:

```bash
# .env (project root or ~/.env)
PAI_DIR=/.claude

# Optional: Custom locations
HISTORY_DIR=/mnt/data/history
SKILLS_DIR=/mnt/data/skills
```

Your code respects it:

```typescript
const PAI_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
const HISTORY_DIR = process.env.HISTORY_DIR || join(PAI_DIR, 'history');
```

---

## Migration Guide

### Step 1: Audit Your Code

Find all relative paths:

```bash
grep -r "\.\./\|\./" .agent/skills/ --include="*.ts"
grep -r "join(import.meta.dir" --include="*.ts"
```

### Step 2: Categorize

1. **Module-relative imports** (OK): `import { foo } from '../handlers'`
2. **Cross-module paths** (Fix): `join(PAI_DIR, '../other-skill')`
3. **File system operations** (Fix): `readFileSync('./config.json')`

### Step 3: Apply Pattern

For each cross-module path, apply the appropriate pattern:

```typescript
// Before
const path = join(import.meta.dir, '../../history/sessions');

// After
import { homedir } from 'os';
import { join } from 'path';

const PAI_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
const path = join(PAI_DIR, 'history', 'sessions');
```

### Step 4: Test

Verify the code works:

```bash
bun run your-script.ts
# or
export PAI_DIR=/custom/path && bun run your-script.ts
```

---

## Summary

| Scenario | Pattern | Example |
|----------|---------|---------|
| Hook importing from `pai-paths.ts` | Direct import | `import { SKILLS_DIR } from './lib/pai-paths'` |
| Skill accessing history | `PAI_DIR` construction | `join(PAI_DIR, 'history', ...)` |
| Module file (schema, etc) | `import.meta.dir` | `join(import.meta.dir, 'schema.sql')` |
| Sibling module import | Relative import | `import { x } from '../handlers/y'` |
| Deep module import | Path alias | `import { x } from '@memory/injection'` |
| Shell script | Path resolution | `cd "$SCRIPT_DIR/../.." && pwd` |

---

## Questions?

If you encounter a path resolution issue:

1. Check if `PAI_DIR` is set correctly: `echo $PAI_DIR`
2. Verify the target file exists: `ls -la $PAI_DIR/path/to/file`
3. Ensure you're using `path.join()` not string concatenation
4. Add error handling with `existsSync()` and helpful messages

---

**This standard is effective immediately and applies to all new code.**
**Existing code should be migrated incrementally during normal refactoring.**
