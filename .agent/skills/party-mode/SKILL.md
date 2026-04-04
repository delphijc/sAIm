---
name: party-mode
description: "Dynamic multi-agent collaboration with 17+ specialized agents communicating in real-time to solve complex cross-functional problems. USE WHEN a task requires multiple agent perspectives simultaneously, cross-functional problem-solving, or real-time multi-agent collaboration."
triggers:
  - "party mode"
  - "activate all agents"
  - "multi-agent collaboration"
  - "all hands on deck"
  - "team collaboration"
---

# Party Mode

## Purpose

Orchestrates real-time multi-agent collaboration where specialized agents work in parallel independent context windows to solve complex, cross-functional problems. Party Mode supports two orchestration strategies: the native TeammateTool (preferred, requires feature flag) and the legacy Task-based sequential fallback.

---

## Prerequisites: TeammateTool

TeammateTool is an experimental Claude Code feature. Enable it before invoking party-mode:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Set this in your shell profile or `.env` to make it persistent. Without this flag, party-mode automatically falls back to the legacy Task-based approach documented at the end of this file.

**TeammateTool constraints:**
- Supports 2 to 5 teammates per team (hard limit)
- Each teammate runs in an independent context window
- Teammates communicate peer-to-peer (not hub-and-spoke through the orchestrator)
- A shared file-locked task list coordinates work across agents
- The orchestrator can optionally be restricted to coordination-only (delegate mode)

---

## Agent Registry

All 21 available agents, categorized by domain:

### Research
| Agent | Path | Specialization |
|-------|------|----------------|
| claude-researcher | `.agent/agents/claude-researcher` | Deep research via Claude native context |
| perplexity-researcher | `.agent/agents/perplexity-researcher` | Real-time web search via Perplexity |
| gemini-researcher | `.agent/agents/gemini-researcher` | Broad synthesis via Gemini |
| Researcher | `.agent/agents/Researcher` | General-purpose research agent |

### Engineering
| Agent | Path | Specialization |
|-------|------|----------------|
| developer | `.agent/agents/developer` | Feature implementation, clean code, TDD |
| Engineer | `.agent/agents/Engineer` | Production engineering, system-level work |
| architect | `.agent/agents/architect` | System architecture, TADs, tech stack selection |
| quick-flow-solo-dev | `.agent/agents/quick-flow-solo-dev` | Rapid prototyping, small features, bugs |
| test-architect | `.agent/agents/test-architect` | Test strategy, QA pipeline, coverage |

### Security
| Agent | Path | Specialization |
|-------|------|----------------|
| Pentester | `.agent/agents/Pentester` | Penetration testing, exploit research |
| security-architect | `.agent/agents/security-architect` | Security design, threat modeling |
| security-test-analyst | `.agent/agents/security-test-analyst` | Security testing, vulnerability analysis |
| chief-security-officer | `.agent/agents/chief-security-officer` | Strategic security leadership, compliance |

### Design
| Agent | Path | Specialization |
|-------|------|----------------|
| Designer | `.agent/agents/Designer` | Visual design, UI components |
| ux-designer | `.agent/agents/ux-designer` | UX flows, user research, accessibility |
| design-thinking-coach | `.agent/agents/design-thinking-coach` | Design thinking facilitation |

### Analysis and Product
| Agent | Path | Specialization |
|-------|------|----------------|
| analyst | `.agent/agents/analyst` | Data analysis, metrics, insights |
| product-manager | `.agent/agents/product-manager` | PRDs, user stories, roadmap |
| innovation-oracle | `.agent/agents/innovation-oracle` | Future-thinking, opportunity identification |
| problem-solver | `.agent/agents/problem-solver` | Structured problem decomposition |

### Communication and Process
| Agent | Path | Specialization |
|-------|------|----------------|
| master-storyteller | `.agent/agents/master-storyteller` | Narrative framing, content strategy |
| technical-writer | `.agent/agents/technical-writer` | Docs, specs, clear communication |
| brainstorming-coach | `.agent/agents/brainstorming-coach` | Ideation facilitation, creative divergence |
| scrum-master | `.agent/agents/scrum-master` | Sprint management, agile ceremonies |
| personal-health-coach | `.agent/agents/personal-health-coach` | Wellness, habits, lifestyle guidance |
| investor | `.agent/agents/investor` | Financial analysis, market research |

---

## Smart Agent Selection

Since TeammateTool supports 2-5 agents per team, selection must be deliberate. Apply this decision logic:

### Step 1: Classify the problem domain

Identify which 1-3 primary domains the problem belongs to:
- **Research-heavy**: Use 1-2 research agents + 1 synthesis agent
- **Build-heavy**: Use architect + developer/engineer + test-architect
- **Security audit**: Use security-architect + pentester + chief-security-officer
- **Strategy/product**: Use product-manager + analyst + innovation-oracle
- **Design sprint**: Use ux-designer + designer + design-thinking-coach
- **Communication artifact**: Use technical-writer + master-storyteller + analyst
- **Cross-functional**: Pick the top specialist from 2-3 domains + 1 synthesis role

### Step 2: Apply the selection rules

1. Never exceed 5 agents. Prefer 3-4 for most problems.
2. Always include at least one agent with synthesis capability (analyst, product-manager, or master-storyteller) when the goal is a deliverable.
3. For competing hypothesis mode, select agents with naturally opposing viewpoints (e.g., security-architect vs. developer, innovation-oracle vs. analyst).
4. For delegate mode, select agents that can work fully independently without needing the orchestrator's judgment mid-task.

### Step 3: Domain-to-agent quick reference

| Problem Type | Recommended Team (3-4 agents) |
|--------------|-------------------------------|
| New feature design | architect, developer, ux-designer, test-architect |
| Security review | security-architect, pentester, chief-security-officer |
| Market research | perplexity-researcher, claude-researcher, analyst |
| Product strategy | product-manager, innovation-oracle, analyst |
| Content/docs | technical-writer, master-storyteller, analyst |
| Rapid prototype | quick-flow-solo-dev, architect, test-architect |
| Design sprint | ux-designer, designer, design-thinking-coach, brainstorming-coach |
| Innovation session | brainstorming-coach, innovation-oracle, problem-solver, master-storyteller |
| Full-stack problem | architect, developer, security-architect, analyst |
| Research synthesis | claude-researcher, gemini-researcher, perplexity-researcher |

---

## TeammateTool Orchestration Workflow

### Standard Mode

Use this when you want parallel, collaborative problem-solving with the orchestrator actively participating.

1. Set the environment variable:
   ```bash
   export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
   ```

2. Identify your team using the selection logic above. Example for a new feature:
   - architect (design the system)
   - developer (implementation concerns)
   - ux-designer (user experience)
   - security-architect (threat model the feature)

3. Initialize the team using `coordinate()` with a shared task file:
   ```
   Shared task list: /tmp/party-mode-tasks.md
   Problem statement: [paste the full problem here]
   Each agent: read the task list, claim your domain, write your analysis, update the task list when done
   ```

4. Each teammate works in its own context window. Teammates can message each other directly. The shared task file is the coordination backbone.

5. Collect outputs and synthesize. If a synthesis agent (analyst, product-manager) is in the team, assign synthesis to them explicitly.

### Delegate Mode

Use this when the problem is well-defined and agents can work independently. The orchestrator is restricted to coordination and does not contribute domain expertise.

- Assign a clear deliverable to each agent upfront
- Orchestrator monitors progress via the shared task file
- Orchestrator only intervenes to unblock, not to solve
- Final synthesis is done by the orchestrator after all agents complete

Example prompt for delegate mode:
```
You are the coordinator. Your job is to assign tasks and collect results only.
Do not contribute domain analysis yourself.

Assign to each teammate:
- architect: produce a component diagram for [problem]
- developer: identify implementation blockers and estimates
- security-architect: produce a threat model
- analyst: define success metrics

Coordinate via /tmp/party-mode-tasks.md. Synthesize all outputs when complete.
```

### Competing Hypothesis Mode

Use this when you need stress-testing, devil's advocacy, or validation of a proposal. Agents are assigned opposing positions and must argue and validate.

Structure:
1. Select agents with naturally conflicting perspectives
2. One agent is assigned "proposer" (builds the case)
3. One or two agents are assigned "challenger" (finds flaws, risks, alternatives)
4. One agent is assigned "judge" (evaluates arguments, produces verdict)

Example team: innovation-oracle (proposer), security-architect (challenger), analyst (judge)

Example framing:
```
Competing hypothesis mode:
- innovation-oracle: argue FOR [proposal], build the strongest case
- security-architect: argue AGAINST [proposal], find every risk and flaw
- analyst: evaluate both arguments, produce a verdict with confidence level

Coordinate via /tmp/party-mode-tasks.md
```

### Shared Task List Format

Create `/tmp/party-mode-tasks.md` before initializing the team:

```markdown
# Party Mode Task List
## Problem Statement
[Full problem description]

## Team
- Agent 1: [name] - [assigned domain]
- Agent 2: [name] - [assigned domain]
- Agent 3: [name] - [assigned domain]

## Tasks
- [ ] [agent-1]: [specific deliverable]
- [ ] [agent-2]: [specific deliverable]
- [ ] [agent-3]: [specific deliverable]

## Outputs
<!-- Agents write their results here -->
```

---

## Workflow: Invoke Party Mode

When `*party-mode` is triggered:

1. Read the problem statement from the user
2. Classify the problem domain (see Smart Agent Selection)
3. Select 2-5 agents using the quick reference table
4. Check whether `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set
   - If yes: proceed with TeammateTool orchestration
   - If no: fall back to Task-based sequential approach (see Legacy section)
5. Create the shared task list at `/tmp/party-mode-tasks.md`
6. Announce the team and mode to the user before launching
7. Initialize teammates and assign tasks
8. Monitor and synthesize when complete
9. Deliver the consolidated output

---

## Legacy Fallback: Task-Based Sequential Approach

When TeammateTool is unavailable (feature flag not set, or environment constraint), party-mode uses sequential Task tool spawning.

### Structure

1. **Initialization:** User invokes `*party-mode` with a complex problem
2. **Role Selection:** Dynamically select participating agents based on problem context (same selection logic as above)
3. **Sequential Spawning:** Launch each agent via `Task` tool, one at a time
4. **Context Passing:** Each agent receives the problem statement plus outputs from previous agents
5. **Synthesis:** Lead agent (analyst or product-manager) receives all prior outputs and synthesizes
6. **Resolution:** Consolidated output delivered to user

### Task Tool Pattern

```
Task 1 → architect: "Analyze [problem], produce architecture overview"
Task 2 → developer: "Given [architect output], identify implementation concerns"
Task 3 → security-architect: "Given [problem + arch], produce threat model"
Task 4 → analyst: "Synthesize [all outputs] into recommendations"
```

For agents that write code or modify files, add `isolation: "worktree"` to sandbox their work in a temporary git worktree. The worktree is auto-cleaned if no changes are made; if changes are made, the branch path is returned for review before merging:

```typescript
Task({
  description: "Implement feature in isolation",
  prompt: "...",
  subagent_type: "developer",
  isolation: "worktree"
})
```

### Limitations of Legacy Mode

- Agents cannot communicate peer-to-peer (outputs only flow forward)
- No true parallelism (sequential execution)
- Context window pressure increases with each handoff
- No competing hypothesis dynamic (all agents work in the same direction)

---

## Available Agents Summary (21 total)

**Agile Pipeline:** analyst, product-manager, architect, developer, Engineer, test-architect, scrum-master, quick-flow-solo-dev

**Creative Intelligence:** brainstorming-coach, design-thinking-coach, innovation-oracle, master-storyteller, problem-solver

**Security:** chief-security-officer, security-architect, security-test-analyst, Pentester

**Content and Design:** technical-writer, ux-designer, Designer

**Research:** claude-researcher, perplexity-researcher, gemini-researcher, Researcher

**Specialized:** personal-health-coach, Investor

---

## Trigger

- Command: `*party-mode`
- Context: Complex cross-functional problems requiring multiple perspectives
- Best For: Strategic decisions, architecture reviews, security audits, innovation challenges, research synthesis, design sprints

## Integration Points

- **Input:** Complex problem, cross-functional query, strategic decision
- **Output:** Multi-perspective analysis, synthesized recommendations, actionable plan
- **Coordination:** Shared task file at `/tmp/party-mode-tasks.md`
- **Feature Flag:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
