---
name: retrospective
description: Analyze accumulated semantic memories to detect patterns, pain points, and generate improvement recommendations. USE WHEN user says 'run retrospective', 'analyze memories', 'what patterns do you see', 'self-improvement analysis', or wants system health insights.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Retrospective Analysis Skill

Analyzes accumulated semantic memories from the SQLite database to detect recurring patterns, pain points, preference drift, and skill usage gaps. Produces prioritized recommendations for continuous system improvement.

## Usage

```
/retrospective              # Daily mode (last 24 hours)
/retrospective weekly       # Weekly mode (last 7 days)
/retrospective full         # Full mode (all-time analysis)
```

## Modes

| Mode | Time Window | Analysis Depth |
|------|------------|----------------|
| **daily** | Last 24 hours | Topic clustering, pain point detection |
| **weekly** | Last 7 days | + preference drift, skill usage analytics |
| **full** | All time | + comprehensive cross-topic correlations |

## Execution

Run the retrospective engine from the discord-remote-control service:

```bash
cd ~/Projects/sam/.agent/skills/discord-remote-control/service
bun -e "
import { runAndSaveRetrospective, formatForDiscord } from './memory/retrospective.ts';
import { initializeMemory } from './memory/db.ts';

const paiDir = process.env.PAI_DIR || '${process.env.HOME}/.claude';
await initializeMemory({ paiDir });

const mode = process.argv[2] || 'daily';
const { report, filePath } = runAndSaveRetrospective(mode);

console.log(formatForDiscord(report));
console.log('\nFull report saved to:', filePath);
" -- "${1:-daily}"
```

## Output

1. **Structured report** saved to `~/.claude/projects/-home-obsidium-Projects-sam/memory/retrospective-YYYY-MM-DD-MODE.md`
2. **Top recommendations** saved back into semantic memory (tagged `recommendation`, `insight`)
3. **Skill invocation** recorded for self-tracking
4. **Summary** displayed inline

## What It Detects

- **Recurring pain points**: Same component/issue mentioned in debugging fixes 3+ times
- **Topic clusters**: Which areas accumulate the most knowledge (complexity hotspots)
- **Preference drift**: Earlier decisions contradicted by later ones
- **Skill gaps**: Skills with low success rates or frequent manual overrides
- **Anti-patterns**: Workarounds and temporary fixes that persist

## Integration

- Wire into cron: `/loop 1d /retrospective` for daily lightweight analysis
- Manual deep dive: `/retrospective full` for comprehensive review
- Recommendations feed back into memory for future sessions
