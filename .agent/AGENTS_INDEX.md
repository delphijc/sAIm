# PAI Agents Index
**Last Updated:** 2026-04-04
**Total Agents:** 27 | **Location:** `$PAI_DIR/agents/`

---

## Primary Assistant (1 agent)

| Agent | Model | Color | Voice | Description |
|-------|-------|-------|-------|-------------|
| **sam** | opus | purple | jessica | Primary AI assistant and PAI system orchestrator. The soul of the system. |

---

## Development & Engineering (5 agents)

| Agent | Model | Color | Voice | Description |
|-------|-------|-------|-------|-------------|
| **developer** | sonnet | lime | jamie | Implements features from user stories with team coordination and QA handoff. NOT for debugging/optimization (engineer) or quick prototypes (quick-flow). |
| **engineer** | sonnet | green | charlie | Principal-level engineering — complex debugging, performance optimization, security hardening, full system ownership. NOT for straightforward stories (developer). |
| **quick-flow-solo-dev** | claude | amber | roger | Fast-track solo delivery of small features, bug fixes, prototypes — sub-1-hour, self-review, no handoffs. |
| **test-architect** | sonnet | emerald | zoe | Quality assurance specialist (TEA). Test strategies, test cases, quality validation. |
| **technical-writer** | sonnet | sky | zoe | Documentation specialist (Paige). Docs, guides, architecture diagrams. |

---

## Architecture & Planning (4 agents)

| Agent | Model | Color | Voice | Description |
|-------|-------|-------|-------|-------------|
| **architect** | sonnet | indigo | alice | Enterprise architecture designer. System architecture, technology stacks, technical specifications. |
| **product-manager** | sonnet | sky | mattie | Scale-adaptive planner. Converts briefs into PRDs with epic and story breakdown. |
| **scrum-master** | sonnet | teal | roger | Agile process facilitator. Sprint planning, ceremonies, blocker removal. |
| **analyst** | sonnet | teal | ava | Reflective coach and brainstormer. Structured thinking and assumption testing. |

---

## Research & Intelligence (5 agents)

| Agent | Model | Color | Voice | Description |
|-------|-------|-------|-------|-------------|
| **researcher** | sonnet | cyan | ava | Deep multi-source synthesis, comprehensive investigations, expert-level analysis. NOT for quick lookups (claude-researcher). |
| **claude-researcher** | haiku 4.5 | yellow | sarah | Fast web lookups via Claude's WebSearch. Cost-efficient, speed over depth. NOT for deep synthesis (researcher). |
| **gemini-researcher** | gemini-flash | yellow | jamie | Multi-perspective research via Google's Gemini. 3-10 parallel query variations. NOT for single-answer queries (claude-researcher). |
| **perplexity-researcher** | haiku 4.5 | yellow | roger | Real-time web research with Perplexity's search index and source citations. Current events and recent publications. |
| **investor** | sonnet | blue | george | Financial research and paper trading (Warren). Technical analysis, option chains, risk assessment. |

---

## Security (4 agents)

| Agent | Model | Color | Voice | Description |
|-------|-------|-------|-------|-------------|
| **pentester** | sonnet | red | callum | Offensive security — attack simulation, vulnerability discovery, CTF, red team. NOT for architecture or compliance. |
| **security-architect** | sonnet | slate | charlie | Secure system design, threat modeling, zero-trust architecture, hardening baselines. NOT for testing or governance. |
| **security-test-analyst** | sonnet | slate | mattie | Security validation — compliance audits, OWASP verification, control effectiveness testing. NOT for offensive testing. |
| **chief-security-officer** | sonnet | slate | alice | Security strategy, GRC programs, governance, risk acceptance, executive reporting. NOT for technical work. |

---

## Design & Creative (4 agents)

| Agent | Model | Color | Voice | Description |
|-------|-------|-------|-------|-------------|
| **designer** | sonnet | orange | laura | High-fidelity design deliverables — Figma, component libraries, design systems, visual polish. NOT for ideation or research. |
| **ux-designer** | sonnet | pink | zoe | User flows, wireframes, information architecture, accessibility audits. NOT for visual polish (designer). |
| **design-thinking-coach** | sonnet | pink | sarah | Design thinking facilitator (Maya). Empathy mapping, How Might We, user research synthesis. NOT for producing artifacts. |
| **brainstorming-coach** | sonnet | amber | george | Divergent ideation (Carson). Six Thinking Hats, lateral thinking, assumption reversal. NOT for design execution. |

---

## Strategy & Communication (3 agents)

| Agent | Model | Color | Voice | Description |
|-------|-------|-------|-------|-------------|
| **innovation-oracle** | sonnet | violet | zoe | Strategic innovation (Victor). Market opportunities, trends, transformative features. |
| **master-storyteller** | sonnet | rose | callum | Narrative strategist (Sophia). Message framing, compelling stories, emotional resonance. |
| **problem-solver** | sonnet | emerald | sarah | Root-cause analysis (Dr. Quinn). Diagnostics, systems thinking, solution engineering. |

---

## Wellness (1 agent)

| Agent | Model | Color | Voice | Description |
|-------|-------|-------|-------|-------------|
| **personal-health-coach** | haiku 4.5 | yellow | laura | Nutrition, fitness, meal planning, healthy lifestyle guidance. NOT for general research. |

---

## When to Use X vs. Y

### Researcher Cluster
| Signal | Route To |
|--------|----------|
| "deep research", "comprehensive", "synthesize" | **researcher** (sonnet) |
| "quick lookup", "what is", "simple fact" | **claude-researcher** (haiku) |
| "from Gemini's perspective", "non-Claude viewpoint" | **gemini-researcher** |
| "use Perplexity", "real-time web", "current events" | **perplexity-researcher** |

### Security Cluster
| Signal | Route To |
|--------|----------|
| "pentest", "attack simulation", "find vulnerabilities" | **pentester** |
| "design secure system", "threat model", "zero trust" | **security-architect** |
| "validate controls", "compliance audit", "OWASP check" | **security-test-analyst** |
| "security strategy", "GRC", "governance policy" | **chief-security-officer** |

### Designer Cluster
| Signal | Route To |
|--------|----------|
| "Figma mockup", "component library", "visual design" | **designer** |
| "user flow", "wireframe", "information architecture" | **ux-designer** |
| "empathy mapping", "user research", "How Might We" | **design-thinking-coach** |
| "brainstorm ideas", "lateral thinking", "divergent ideas" | **brainstorming-coach** |

### Developer Cluster
| Signal | Route To |
|--------|----------|
| "implement this story", "build per spec" | **developer** |
| "debug", "optimize performance", "security hardening" | **engineer** |
| "quick fix", "prototype", "small bug fix" | **quick-flow-solo-dev** |

---

## Agent Statistics

| Metric | Value |
|--------|-------|
| **Total** | 27 |
| **Model: sonnet** | 20 |
| **Model: opus** | 1 (sam) |
| **Model: haiku 4.5** | 3 |
| **Model: claude** | 1 (quick-flow-solo-dev) |
| **Model: gemini-flash** | 1 (gemini-researcher) |
| **All agents have color** | Yes (27/27) |
| **All agents have voiceId** | Yes (27/27) |
| **Unique voices** | 12 (jessica exclusive to sam) |

---

**Next Review:** 2026-07-04 (quarterly)
**Maintenance Owner:** PAI System
