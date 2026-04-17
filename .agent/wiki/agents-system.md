# Agents System

Agents are specialized AI personas in Sam, each with unique capabilities and focus areas.

---

## Overview

Sam includes **26 pre-configured agents**, organized into 7 domains:

### 🏗️ Architecture & Engineering (6 agents)
| Agent | Model | Specialty |
|-------|-------|-----------|
| **architect** | Sonnet | System design, PRDs, technical specs |
| **engineer** | Sonnet | Code implementation, optimization |
| **developer** | Sonnet | Software development execution |
| **quick-flow-solo-dev** | Haiku | Rapid prototyping & quick builds |
| **test-architect** | Sonnet | QA strategy, testing architecture |
| **technical-writer** | Sonnet | Documentation & technical writing |

### 🔒 Security (4 agents)
| Agent | Model | Specialty |
|-------|-------|-----------|
| **chief-security-officer** | Sonnet | Security strategy & leadership |
| **security-architect** | Sonnet | Secure system design |
| **security-test-analyst** | Sonnet | Penetration testing, audits |
| **pentester** | Sonnet | Offensive security testing |

### 🎨 Design (3 agents)
| Agent | Model | Specialty |
|-------|-------|-----------|
| **designer** | Sonnet | UX/UI design, design systems |
| **ux-designer** | Sonnet | User experience design |
| **design-thinking-coach** | Sonnet | Design thinking methodology |

### 📊 Product & Management (3 agents)
| Agent | Model | Specialty |
|-------|-------|-----------|
| **product-manager** | Sonnet | Requirements, roadmaps, strategy |
| **scrum-master** | Sonnet | Agile coordination, ceremonies |
| **analyst** | Sonnet | Data analysis, research insights |

### 🔬 Research (4 agents)
| Agent | Model | Specialty |
|-------|-------|-----------|
| **researcher** | Sonnet | General web research & synthesis |
| **claude-researcher** | Haiku | Parallel Claude WebSearch |
| **perplexity-researcher** | Haiku | Perplexity web research |
| **gemini-researcher** | Gemini 2.5 | Multi-perspective Gemini research |

### 💡 Creative & Innovation (5 agents)
| Agent | Model | Specialty |
|-------|-------|-----------|
| **brainstorming-coach** | Sonnet | Ideation & brainstorming |
| **innovation-oracle** | Sonnet | Strategic innovation |
| **master-storyteller** | Sonnet | Narrative & messaging |
| **problem-solver** | Sonnet | Complex problem analysis |
| **design-thinking-coach** | Sonnet | Design thinking coaching |

### 💰 Finance
| Agent | Model | Specialty |
|-------|-------|-----------|
| **investor** | Sonnet | Financial analysis, trading |

### 🏥 Health
| Agent | Model | Specialty |
|-------|-------|-----------|
| **personal-health-coach** | Haiku | Health & wellness guidance |

---

## Agent Structure

Each agent is defined in `~/.claude/agents/AgentName/`:

```
AgentName/
├── AGENT.md         # Main definition
└── Reference.md     # Extended context (optional)
```

### AGENT.md Format

```yaml
---
name: engineer
description: Software engineering specialist with expertise in
             TypeScript, Python, and system design.
model: sonnet
color: green
voiceId: Tom
permissions:
  allow:
    - Bash
    - Read
    - Write
    - Edit
    - Grep
    - Glob
---

# Engineer Agent

[Extended system prompt and instructions]
```

---

## Agent Configuration

### Model Selection

| Model | Speed | Intelligence | Cost | Use For |
|-------|-------|--------------|------|---------|
| `haiku` | Fast | Good | Low | Simple tasks, grunt work |
| `sonnet` | Medium | Better | Medium | Standard implementation |
| `opus` | Slow | Best | High | Complex reasoning |

### Color Coding

Visual identification in dashboards:

| Color | Agent Type |
|-------|------------|
| green | Development (Engineer) |
| blue | Architecture (Architect) |
| purple | Design (Designer) |
| cyan | Research (Researcher) |
| red | Security (Pentester) |
| yellow | Finance (Investor) |

### Voice Configuration

Each agent can have a unique voice:

```yaml
voiceId: jessica        # ChatterboxTTS voice ID (maps to reference audio file)
voiceId: jamie          # Alternative voice
```

---

## Using Agents

### Implicit Delegation

Sam automatically routes to appropriate agents:

```
"Implement this feature"
→ Routes to Engineer agent

"Design the architecture for this system"
→ Routes to Architect agent

"Research quantum computing"
→ Routes to Researcher agent
```

### Explicit Delegation

```
"Have the engineer implement this"
"Ask the architect to review this design"
"Let the pentester analyze security"
```

### Via Task Tool

```typescript
Task({
  prompt: "Implement the login feature",
  subagent_type: "engineer",
  model: "sonnet"
});
```

---

## Delegation Patterns

### Sequential

One agent after another:

```
Main → Engineer → Architect → Complete

"Implement this feature, then have the architect review it"
```

### Parallel

Multiple agents simultaneously:

```
Main → [Researcher1, Researcher2, Researcher3] → Synthesize

"Research these 3 companies in parallel"
```

### Nested

Agents spawning other agents:

```
Main → Architect → Engineer → Verify

"Design and implement this system"
```

### Spotcheck

Verification pattern:

```
[N Interns] → Spotcheck validates all

"Have interns research, spotcheck the results"
```

---

## Launching Agents in Practice

### Using the Agent Tool

The Agent tool allows you to spawn specialized agents with full autonomy. Basic syntax:

```javascript
Agent({
  description: "Brief description of what agent will do",
  prompt: "Detailed task description for the agent",
  subagent_type: "agent-name",  // From list below
  isolation: "worktree"  // Optional: git worktree isolation
})
```

### Common Workflows

#### 🏗️ Feature Development Flow

**Sequential Design → Implement → Test**

```javascript
// Step 1: Architect designs the solution
Agent({
  description: "Design authentication system",
  prompt: "Design a JWT-based authentication system with refresh tokens for a SPA app",
  subagent_type: "architect"
})

// Step 2: Engineer implements the design
Agent({
  description: "Implement JWT authentication",
  prompt: "Implement the JWT authentication system from the design",
  subagent_type: "engineer",
  isolation: "worktree"
})

// Step 3: Test architect ensures coverage
Agent({
  description: "Plan QA strategy",
  prompt: "Create a comprehensive test strategy for JWT auth including edge cases",
  subagent_type: "test-architect"
})
```

#### 🔒 Security Audit Flow

**Parallel security reviews with consolidation**

```javascript
// Run multiple security perspectives in parallel
Agent({
  description: "Threat modeling on API endpoints",
  prompt: "Perform threat modeling on all API endpoints, identify OWASP top 10 risks",
  subagent_type: "security-architect"
})

Agent({
  description: "Penetration testing analysis",
  prompt: "Analyze this system for common web vulnerabilities and exploitation paths",
  subagent_type: "pentester"
})

Agent({
  description: "Strategic security assessment",
  prompt: "Provide a high-level security strategy and risk assessment",
  subagent_type: "chief-security-officer"
})
```

#### 🔬 Research & Competitive Analysis

**Parallel research with multiple sources**

```javascript
// Research the same topic from different angles simultaneously
Agent({
  description: "Research market trends for real-time collaboration tools",
  prompt: "Research current market trends in real-time collaboration platforms",
  subagent_type: "researcher"
})

Agent({
  description: "Search Claude WebSearch for competitor analysis",
  prompt: "Analyze the top 5 competitors in real-time collaboration",
  subagent_type: "claude-researcher"
})

Agent({
  description: "Perplexity research on emerging technologies",
  prompt: "What emerging technologies are changing the collaboration space?",
  subagent_type: "perplexity-researcher"
})

Agent({
  description: "Multi-perspective Gemini analysis",
  prompt: "Provide market size, growth rates, and investment opportunities in collaboration tools",
  subagent_type: "gemini-researcher"
})
```

#### 💡 Product Development & Strategy

**Parallel ideation with cross-functional perspectives**

```javascript
// Generate product ideas from multiple angles
Agent({
  description: "Brainstorm feature ideas",
  prompt: "Brainstorm 10 innovative features for our SaaS product",
  subagent_type: "brainstorming-coach"
})

Agent({
  description: "Design product experience",
  prompt: "Design the user experience for our new reporting feature",
  subagent_type: "designer"
})

Agent({
  description: "Define product requirements",
  prompt: "Write a PRD for the new reporting feature",
  subagent_type: "product-manager"
})

Agent({
  description: "Plan QA approach",
  prompt: "Create a test strategy for the new reporting feature",
  subagent_type: "test-architect"
})
```

#### 🎨 Design System Creation

**Sequential design workflow**

```javascript
// Design thinking process
Agent({
  description: "Design thinking workshop",
  prompt: "Guide me through a design thinking process for our new dashboard",
  subagent_type: "design-thinking-coach"
})

// Translate to visual design
Agent({
  description: "Create design system components",
  prompt: "Design a complete component library for our dashboard based on the workshop output",
  subagent_type: "designer"
})

// Get UX perspective
Agent({
  description: "UX optimization review",
  prompt: "Review the design system for accessibility and usability",
  subagent_type: "ux-designer"
})
```

#### 💰 Financial Analysis

**Investment research workflow**

```javascript
Agent({
  description: "Analyze investment opportunity",
  prompt: "Analyze this startup for investment potential: revenue model, market size, team",
  subagent_type: "investor"
})

Agent({
  description: "Market research on financial sector",
  prompt: "Research financial technology trends and market opportunities",
  subagent_type: "analyst"
})
```

#### ⚡ Rapid Prototyping

**Quick solo development**

```javascript
Agent({
  description: "Build quick prototype",
  prompt: "Build a working prototype for a todo app with localStorage persistence",
  subagent_type: "quick-flow-solo-dev"
})
```

### Pattern Examples

#### Parallel Independent Tasks (Fast)

```javascript
// All run simultaneously - ideal for research
Agent({
  description: "Research competitor 1",
  prompt: "Analyze Company A's strategy",
  subagent_type: "researcher"
})

Agent({
  description: "Research competitor 2",
  prompt: "Analyze Company B's strategy",
  subagent_type: "researcher"
})

Agent({
  description: "Research competitor 3",
  prompt: "Analyze Company C's strategy",
  subagent_type: "researcher"
})
// Main agent synthesizes results when all complete
```

#### Sequential Dependent Tasks (Correct Order Matters)

```javascript
// Must run in order: design, then implement, then verify
Agent({
  description: "Create architecture plan",
  prompt: "Design the system architecture for a real-time chat application",
  subagent_type: "architect"
})
.then(designResult => {
  return Agent({
    description: "Implement based on design",
    prompt: `Implement this design: ${designResult}`,
    subagent_type: "engineer",
    isolation: "worktree"
  })
})
.then(implResult => {
  return Agent({
    description: "Security review of implementation",
    prompt: `Review this implementation for security issues: ${implResult}`,
    subagent_type: "security-test-analyst"
  })
})
```

#### Nested Delegation (Agent Spawns Agents)

```javascript
Agent({
  description: "Complex system design with implementation",
  prompt: "Design and implement a complete authentication system. Have the engineer implement your design.",
  subagent_type: "architect"
  // The architect agent will internally spawn the engineer
  // for implementation tasks
})
```

### Agent Selection by Task Type

| Task Type | Best Agent | Speed | Complexity |
|-----------|-----------|-------|------------|
| "Build this feature" | **engineer** | Medium | High |
| "Design the system" | **architect** | Slow | Very High |
| "Find information about X" | **researcher** | Medium | Medium |
| "Test this code" | **test-architect** | Medium | High |
| "Design the UI" | **designer** | Medium | High |
| "Optimize performance" | **engineer** | Medium | High |
| "Analyze security" | **pentester** | Slow | Very High |
| "Generate ideas" | **brainstorming-coach** | Fast | Low |
| "Write documentation" | **technical-writer** | Fast | Medium |
| "Quick prototype" | **quick-flow-solo-dev** | Very Fast | Low |
| "Research markets" | **researcher** + parallels | Medium | Medium |
| "Financial analysis" | **investor** | Medium | High |

---

## Agent Profiles

### Engineer

**Specialty:** Code implementation, debugging, testing

**Strengths:**
- TypeScript/JavaScript expertise
- Python proficiency
- Test-driven development
- Code review

**Use When:**
- Implementing features
- Fixing bugs
- Writing tests
- Refactoring code

### Architect

**Specialty:** System design, technical decisions

**Strengths:**
- High-level design
- Technology selection
- Pattern application
- Trade-off analysis

**Use When:**
- Designing systems
- Making architectural decisions
- Reviewing designs
- Planning implementations

### Designer

**Specialty:** User experience and interface design

**Strengths:**
- UX principles
- UI patterns
- Accessibility
- Design systems

**Use When:**
- Designing interfaces
- Improving UX
- Creating design specs
- Reviewing designs

### Researcher

**Specialty:** Information gathering and synthesis

**Strengths:**
- Deep investigation
- Source validation
- Synthesis
- Documentation

**Use When:**
- Investigating topics
- Gathering information
- Comparing options
- Writing research reports

### Pentester

**Specialty:** Security testing and analysis

**Strengths:**
- Vulnerability assessment
- Threat modeling
- Security review
- Defensive recommendations

**Use When:**
- Security audits
- Code security review
- Threat analysis
- Penetration testing guidance

### Investor

**Specialty:** Financial analysis and market research

**Strengths:**
- Market analysis
- Financial metrics
- Risk assessment
- Investment research

**Use When:**
- Stock research
- Option analysis
- Market investigation
- Financial planning

---

## Creating Custom Agents

### Step 1: Create Directory

```bash
mkdir ~/.claude/agents/MyAgent
```

### Step 2: Create AGENT.md

```yaml
---
name: my-agent
description: Custom agent for [purpose]. USE WHEN [triggers].
model: sonnet
color: cyan
voiceId: Jessica
permissions:
  allow:
    - Read
    - Grep
    - WebFetch
---

# MyAgent

## Identity
You are a specialist in [domain]...

## Capabilities
- Capability 1
- Capability 2

## Approach
When working on tasks, you...

## Output Format
Provide responses in this format...
```

### Step 3: Test

```
"Have my-agent work on this task"
```

---

## Performance Optimization

### Model Selection Guidelines

```
Simple lookup → haiku (fast, cheap)
Standard work → sonnet (balanced)
Deep reasoning → opus (thorough)
```

### Parallel Execution

For independent tasks, use parallel agents:

```
// WRONG - sequential, slow
await Task({ prompt: "Task 1", subagent_type: "researcher" });
await Task({ prompt: "Task 2", subagent_type: "researcher" });

// RIGHT - parallel, fast
Task({ prompt: "Task 1", subagent_type: "researcher", model: "haiku" });
Task({ prompt: "Task 2", subagent_type: "researcher", model: "haiku" });
```

### Haiku for Grunt Work

Use haiku for simple tasks:
- Data formatting
- Simple lookups
- Routine checks
- Bulk operations

---

## Agent Permissions

### Permission Types

```yaml
permissions:
  allow:
    - Bash           # Shell commands
    - Read(*)        # Read any file
    - Write(*)       # Write any file
    - Edit(*)        # Edit any file
    - Grep(*)        # Search files
    - Glob(*)        # Find files
    - WebFetch       # Web requests
    - WebSearch      # Web search
    - Task           # Spawn sub-agents
```

### Restricting Agents

Limit agent capabilities:

```yaml
permissions:
  allow:
    - Read(src/*)    # Only read src/
    - Grep           # Search allowed
  deny:
    - Bash           # No shell access
    - Write          # No writing
```

---

## Troubleshooting

### Agent Not Found

1. Check directory exists: `ls ~/.claude/agents/`
2. Verify AGENT.md has correct frontmatter
3. Check agent name matches directory

### Wrong Agent Selected

1. Be more specific in request
2. Use explicit delegation: "Have the engineer..."
3. Check agent triggers in description

### Agent Underperforming

1. Try different model (opus for complex tasks)
2. Provide more context
3. Break task into smaller pieces

---

*See also: [Task Runner](Task-Runner.md) | [Usage Guide](Usage-Guide.md)*
