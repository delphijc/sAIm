# Usage Guide

This guide covers day-to-day usage of Sam for maximum effectiveness.

---

## Basic Interaction

### Starting a Session

```bash
claude
```

Sam automatically loads via hooks. You'll see the CORE context initialize.

### Natural Language Commands

Sam understands intent-based requests:

```
"Research quantum computing advances"
"Extract wisdom from this transcript"
"Create a threat model for this API"
"Summarize this document"
```

### Explicit Skill Invocation

Invoke skills directly with `/`:

```
/fabric              # Fabric patterns
/research            # Research skill
/startup             # Start services
```

---

## Working with Skills

### Discovering Skills

```
"What skills are available?"
"List all my capabilities"
"Show me the skills catalog"
```

### Using Specific Skills

**Research:**
```
"Research the history of neural networks"
"Investigate recent AI safety developments"
```

**Fabric Patterns:**
```
"Extract wisdom from this podcast"
"Summarize this article"
"Create a threat model for my application"
"Analyze claims in this document"
```

**Content Creation:**
```
"Create a pitch using Hormozi methodology"
"Write a story explanation of this concept"
```

---

## Working with Agents

### Understanding Agents

Sam has 10 specialized agents:

| Agent | Specialty | When to Use |
|-------|-----------|-------------|
| Engineer | Software development | Code implementation |
| Architect | System design | Architecture decisions |
| Designer | UX/UI design | Interface design |
| Researcher | Information gathering | Deep research |
| Pentester | Security testing | Security analysis |
| investor | Financial analysis | Market research |
| claude-researcher | Web research (Claude) | Quick lookups |
| gemini-researcher | Web research (Gemini) | Alternative research |
| perplexity-researcher | Web research (Perplexity) | Current events |

### Delegating to Agents

```
"Have the engineer implement this feature"
"Ask the architect to design this system"
"Let the researcher investigate this topic"
```

### Parallel Agent Execution

```
"Research these 5 companies in parallel"
"Have 3 researchers investigate different aspects"
```

---

## Voice Feedback

### Enabling Voice

1. Start the voice server:
   ```bash
   ~/.claude/voice-server/start.sh
   ```

2. Verify it's running:
   ```bash
   curl http://localhost:8888/health
   ```

3. Voice activates automatically on response completion.

### Voice Commands

```
"Read this file aloud"
"Read today's devotion"
```

---

## Fabric Patterns

### Most Common Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `extract_wisdom` | Get insights | "Extract wisdom from this talk" |
| `summarize` | Condense content | "Summarize this article" |
| `analyze_claims` | Verify facts | "Analyze claims in this post" |
| `create_threat_model` | Security analysis | "Threat model this API" |
| `improve_writing` | Polish text | "Improve this essay" |

### Pattern Categories

- **Extraction:** extract_wisdom, extract_insights, extract_alpha
- **Summarization:** summarize, summarize_paper, summarize_meeting
- **Analysis:** analyze_claims, analyze_paper, analyze_code
- **Creation:** create_prd, create_design_document, write_essay
- **Security:** create_threat_model, analyze_malware, create_sigma_rules

### Chaining Patterns

```
"First summarize this paper, then extract the key recommendations"
"Analyze this code, then create a threat model for it"
```

---

## Services Management

### start-up/Shutdown

```
/startup              # Start voice server and observability
/startup -sd          # Shutdown all services
```

### Service Status

```bash
# Voice server
~/.claude/voice-server/status.sh

# Check all services
curl http://localhost:8888/health
```

### Observability Dashboard

```
/observability        # Start monitoring dashboard
```

Features:
- Real-time agent activity
- Workflow visualization
- Debug logging

---

## File Operations

### Reading Files

```
"Read the contents of package.json"
"Show me the README"
```

### Opening Files

```
"Open this file in the default editor"
```

### Writing Files

```
"Create a new file called config.yaml with..."
"Update the package.json to add this dependency"
```

---

## Git Operations

### Committing Changes

```
"Commit these changes"
"Create a commit for the login feature"
```

### Pull Requests

```
"Create a PR for this branch"
"Push these changes and open a PR"
```

### Reviewing Changes

```
"Show me the git diff"
"What files have changed?"
```

---

## Research Workflows

### Web Research

```
"Research the latest developments in AI"
"Find information about company XYZ"
```

### Deep Research

```
"Do comprehensive research on this topic"
"Investigate this issue thoroughly"
```

### Multi-Source Research

```
"Use multiple sources to research this"
"Get different perspectives on this topic"
```

---

## Best Practices

### 1. Be Specific

```
# Good
"Extract wisdom from this podcast, focusing on productivity tips"

# Less Good
"Analyze this"
```

### 2. Use Skills

```
# Good
"Use the research skill to investigate quantum computing"

# Also Good (auto-detects)
"Research quantum computing advances"
```

### 3. Leverage Agents

For complex tasks, delegate:
```
"Have the architect design this, then the engineer implement it"
```

### 4. Chain Operations

```
"First summarize this paper, then extract key findings,
finally create action items"
```

### 5. Check Services

Before heavy tasks:
```
"What's the status of the voice server?"
"Is the dashboard running?"
```

---

## Troubleshooting

### "Skill not found"

1. Check skill name spelling
2. Try explicit invocation: `/skillname`
3. List available skills: "What skills do I have?"

### "Voice not working"

1. Check server: `curl http://localhost:8888/health`
2. Check API key in `.env`
3. Restart: `~/.claude/voice-server/restart.sh`

### "Context too large"

1. Start fresh session: `/clear`
2. Sam uses progressive disclosure to manage context
3. Large files may need chunking

---

## Quick Reference

| Action | Command |
|--------|---------|
| Start session | `claude` |
| List skills | "What skills are available?" |
| Use Fabric | "Extract wisdom from..." |
| Start services | `/startup` |
| Stop services | `/startup -sd` |
| Health check | `bun ~/.claude/hooks/self-test.ts` |

---

*See also: [Skills Reference](Skills-Reference.md) | [Fabric Patterns](Fabric-Patterns.md)*
