---
name: audit-committer
description: "Executes a git commit and attaches a detailed task summary using git notes. Enforces documentation updates for new features. USE WHEN committing code that needs an audit trail, task summary attachment, or documentation compliance check."
---

# Skill: Audit Committer

## Description
Executes a git commit and attaches a detailed task summary using `git notes`. Ensures that new features and significant changes include corresponding documentation updates in `wiki/`.

## Pre-Commit Enforcement

**Before commits are allowed, the pre-commit hook validates:**
- A task is marked `[~]` (in-progress) in `projects/${PROJECT_ID}/docs/plan.md`
- All tests pass: `CI=true bun test`
- Code coverage is ≥80%

If any gate fails, the commit is blocked. There are no overrides—no `--no-verify` allowed.

## Documentation Requirements

**Documentation updates in `wiki/` are REQUIRED for:**

| Change Type | Documentation Action |
|-------------|---------------------|
| New feature (`feat`) | Create or update relevant wiki page |
| New API endpoint | Update [Usage-Guide.md](wiki/Usage-Guide.md) or create API docs |
| New configuration option | Update [Configuration.md](wiki/Configuration.md) |
| New skill or agent | Update [Skills-System.md](wiki/Skills-System.md) or [Agents-System.md](wiki/Agents-System.md) |
| New metrics/observability | Document in wiki with usage examples |
| Breaking changes | Update affected wiki pages + add migration notes |

**Documentation is OPTIONAL for:**
- Bug fixes (`fix`) that don't change behavior
- Code style changes (`style`)
- Internal refactoring (`refactor`) with no API changes
- Test additions (`test`)
- Dependency updates (`chore`)

## Wiki Structure Reference

```
wiki/
├── Home.md                 # Landing page
├── Getting-Started.md      # Quick start guide
├── Architecture.md         # System architecture
├── Configuration.md        # All config options
├── Usage-Guide.md          # How to use features
├── Skills-System.md        # Skills documentation
├── Agents-System.md        # Agents documentation
├── Hooks-System.md         # Hooks documentation
├── Task-Runner.md          # Task runner overview
├── Task-Runner-Scripts.md  # Script reference
├── Setup-Scripts.md        # Setup documentation
└── Improvements-Roadmap.md # Roadmap tracking
```

## Implementation

```bash
# 1. Verify documentation (for feat commits)
if [[ "$COMMIT_TYPE" == "feat" ]]; then
  # Check if wiki/ files are staged
  if ! git diff --cached --name-only | grep -q "^wiki/"; then
    echo "WARNING: New feature without wiki documentation."
    echo "Consider updating relevant wiki/ pages."
  fi
fi

# 2. Execute the commit
git commit -m "<type>(<scope>): <description>"
COMMIT_HASH=$(git log -1 --format="%H")

# 3. Attach the audit note (include docs status)
git notes add -m "Task: <task_name>
Summary: <summary>
Files: <files>
Rationale: <why>
Docs: <updated|not_required|pending>" $COMMIT_HASH
```

## Audit Note Template

```
Task: [Task ID from plan.md]
Summary: [1-2 sentence description of changes]
Files: [List of modified files]
Rationale: [Why this change was needed]
Docs: [updated|not_required|pending]
Coverage: [Current test coverage %]
```

## Constraints

Follow strictly: `<type>(<scope>): <description>`.

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

**Documentation enforcement:**
- `feat` commits should include wiki updates or explicit justification
- The `Docs:` field in audit notes tracks documentation status
- Pending documentation creates tech debt and should be tracked in Improvements.md

