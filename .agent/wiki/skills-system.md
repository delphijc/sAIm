# Skills System

Skills are the atomic units of capability in Sam. This guide explains how skills work and how to use them.

---

## What is a Skill?

A skill is a self-contained package of:
- **Domain expertise** - Knowledge and context
- **Routing logic** - When to activate
- **Workflows** - Step-by-step procedures
- **Tools** - CLI utilities

Skills auto-activate based on user intent, making Sam context-aware.

---

## Skill Structure

Every skill follows this structure:

```
SkillName/                      # TitleCase directory
├── SKILL.md                    # Main definition (UPPERCASE)
├── Reference.md                # Extended docs (optional)
├── workflows/                  # Execution procedures
│   ├── Create.md
│   └── Update.md
├── tools/                      # CLI tools (even if empty)
│   └── ToolName.ts
└── templates/                  # Optional templates
```

### SKILL.md Structure

```yaml
---
name: SkillName
description: [What it does]. USE WHEN [intent triggers]. [Capabilities].
---

# SkillName

## Workflow Routing
[Table mapping user intents to specific workflows]

## Examples
[2-3 concrete examples - REQUIRED for 90% accuracy]

## Extended Context
[Pointer to Reference.md for Tier 3 content]
```

---

## Available Skills (38 Total)

✅ **For comprehensive skill documentation, see [Skills-Catalog.md](Skills-Catalog.md)** — Complete reference for all 38 skills including new domain clusters.

### Domain Cluster Skills (10)

The new domain cluster architecture consolidates 54 modules into 10 specialized skills:

| Skill | Description | Trigger |
|-------|-------------|---------|
| **life-management** | Personal scheduling, vacation, goals | "schedule my appointments" |
| **quick-flow** | Fast-track development (spec-dev-review) | "quick flow" |
| **party-mode** | Multi-agent collaboration (17+ agents) | "party mode" |
| **research** | Deep multi-source investigation | "do research", "research this" |
| **game-dev** | Complete game development pipeline (BMGD) | "game development" |
| **content** | End-to-end content creation | "create content" |
| **architecture-rules** | Cross-cutting architectural constraints | "architecture principles" |
| **security-grc** | Enterprise security & compliance | "security assessment", "grc" |
| **cis** | Creative Intelligence Suite (6 creative techniques) | "brainstorming", "design thinking" |
| **agile** | Complete Agile development pipeline | "agile methodology", "sprint planning" |

### Core System Skills

| Skill | Description | Trigger |
|-------|-------------|---------|
| **CORE** | System identity and configuration | Auto-loads at session start |
| **create-agent** | Agent creation framework | "create agent", "new agent" |
| **create-skill** | Skill creation framework | "create skill", "new skill" |
| **create-cli** | CLI tool generation | "create CLI", "build command-line" |

### Content & Analysis

| Skill | Description | Trigger |
|-------|-------------|---------|
| **fabric** | 248 AI patterns for content | "extract wisdom", "summarize", "analyze" |
| **Research** | Multi-source research | "research", "investigate" |
| **story-explanation** | Narrative summaries | "explain as story", "narrative summary" |
| **aggregate-transcriptions** | Audio transcription processing | "aggregate transcriptions" |
| **transcribe-audio** | Audio to text | "transcribe audio" |

### Security & Analysis

| Skill | Description | Trigger |
|-------|-------------|---------|
| **ffuf** | Web fuzzing guidance | "ffuf", "web fuzzing" |
| **prompting** | Prompt engineering standards | "prompting", "prompt engineering" |

### Infrastructure

| Skill | Description | Trigger |
|-------|-------------|---------|
| **Observability** | Agent monitoring dashboard | "start observability", "monitor agents" |
| **start-up** | Service lifecycle | "startup", "shutdown" |

### Productivity

| Skill | Description | Trigger |
|-------|-------------|---------|
| **open-file** | Open files in default app | "open file" |
| **read-aloud** | Voice file reading | "read aloud" |
| **read-daily-devotion** | Daily devotion reader | "read daily devotion" |
| **alex-hormozi-pitch** | Pitch creation methodology | "create pitch", "Hormozi" |
| **art** | Visual content generation | "create visual", "art" |

### Data & Web

| Skill | Description | Trigger |
|-------|-------------|---------|
| **bright-data** | Web scraping with fallback | "scrape URL", "fetch page" |
| **investor** | Financial research | "stock prices", "option chains" |
| **playwright-testing** | E2E testing framework | E2E testing setup |

### Development Workflow

| Skill | Description | Trigger |
|-------|-------------|---------|
| **architect** | Architecture planning | "architect", "design system" |
| **audit-committer** | Git audit trail | "audit commit" |
| **phase-checkpoint** | Phase verification | "checkpoint" |
| **stack-broker** | Data persistence | Internal use |
| **tdd-manager** | TDD workflow | "TDD", "red-green-refactor" |
| **discord-remote-control** | Discord bot interface | Discord remote |
| **rsync-sync-missing** | File synchronization | "sync files" |

---

## How Skills Activate

### Intent Matching

Skills activate based on the `USE WHEN` clause in their YAML frontmatter:

```yaml
description: Research skill. USE WHEN user says "research", "investigate",
             "find information", or needs web/content research.
```

**Matching Process:**
1. User input analyzed for intent
2. Intents matched against skill triggers
3. Best-match skill activated
4. Skill's SKILL.md body loaded (Tier 2)

### Explicit Invocation

Skills can also be invoked directly:
```
/fabric          # Invoke fabric skill
/research        # Invoke Research skill
/startup         # Invoke start-up skill
```

---

## Using Skills Effectively

### Example: Research

```
User: "Research the latest developments in quantum computing"

→ Detects: Research skill trigger
→ Loads: Research skill context
→ Applies: Multi-source research workflow
→ Returns: Synthesized findings
```

### Example: Fabric Pattern

```
User: "Extract wisdom from this podcast transcript"

→ Detects: fabric skill trigger
→ Loads: extract_wisdom pattern
→ Applies: Pattern to content
→ Returns: IDEAS, INSIGHTS, QUOTES, etc.
```

### Example: Content Creation

```
User: "Create a pitch for my new SaaS product using Hormozi methodology"

→ Detects: alex-hormozi-pitch trigger
→ Loads: Pitch creation workflow
→ Applies: Value equation, guarantees, pricing
→ Returns: Structured pitch document
```

---

## Creating Custom Skills

### Step 1: Use create-skill

```
/createskill
```

### Step 2: Define Structure

```
MySkill/
├── SKILL.md
├── Reference.md
└── tools/
```

### Step 3: Write SKILL.md

```yaml
---
name: MySkill
description: [What it does]. USE WHEN [triggers]. [Capabilities].
---

# MySkill

## Workflow Routing

| Action | Trigger | Behavior |
|--------|---------|----------|
| Create | "create X" | Run Create workflow |

## Examples

**Example 1:**
User: "Create a new X"
→ Invokes Create workflow
→ Returns result

## Extended Context
See Reference.md for detailed documentation.
```

### Step 4: Test Activation

```
"What skills are available?"
"[Your trigger phrase]"
```

---

## Skill Best Practices

### 1. Clear USE WHEN Clause

```yaml
# Good
description: Translation skill. USE WHEN user says "translate",
             "convert to [language]", or needs language conversion.

# Bad
description: Helps with languages.
```

### 2. Include Examples

Examples improve skill activation accuracy from 72% to 90%.

### 3. Progressive Disclosure

- SKILL.md: Essential routing and examples
- Reference.md: Detailed documentation
- tools/: CLI utilities

### 4. TitleCase Naming

```
✓ MySkillName/
✓ SKILL.md
✓ Reference.md
✗ myskillname/
✗ skill.md
```

---

## Skill Configuration

### In settings.json

Skills can be enabled/disabled in `settings.json`:

```json
{
  "skills": {
    "enabled": ["CORE", "Fabric", "Research"],
    "disabled": ["experimental-skill"]
  }
}
```

### Environment Variables

Some skills require API keys in `.env`:

```bash
PERPLEXITY_API_KEY=...    # For Research
VOICE_PROVIDER=chatterbox  # For read-aloud (ChatterboxTTS, local)
BRIGHTDATA_API_KEY=...    # For bright-data
```

---

## Troubleshooting

### Skill Not Activating

1. Check USE WHEN clause matches intent
2. Verify TitleCase naming
3. Ensure examples section exists
4. Test with explicit invocation: `/skillname`

### Skill Loading Slowly

1. Check Tier 2/3 content size
2. Ensure progressive disclosure is used
3. Move heavy content to Reference.md

### Tool Not Found

1. Verify tool exists in `tools/` directory
2. Check file permissions
3. Ensure TypeScript compiles

---

*See also: [Fabric Patterns](Fabric-Patterns.md) | [Creating Skills](Creating-Skills.md)*
