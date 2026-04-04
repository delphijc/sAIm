---
name: architecture-rules
description: "Cross-cutting architectural constraints and foundational design principles for system reliability, security, and scalability. USE WHEN reviewing architecture decisions, enforcing design constraints, or validating system design against established principles."
triggers:
  - "architecture principles"
  - "system design constraints"
  - "platform portability"
  - "zero trust security"
  - "cloud storage sync"
---

# Architecture Rules

## Purpose

Defines cross-cutting architectural constraints and foundational design principles that guide all system design decisions. These rules ensure platform independence, security by default, modularity, and reliable multi-organization support. Applied to all agents, skills, and workflows.

## Core Rules

### Rule 1: Cloud Storage & Synchronization

**Domain:** Infrastructure, Deployment, Accessibility
**Priority:** High

#### Rule Statement
All specs, code, and configurations SHALL be stored in Git repositories hosted on GitHub, enabling full functionality after standard setup on any workstation within 30 minutes.

#### Acceptance Criteria
- All content in GitHub repositories
- Full functionality after standard setup
- Separate repositories per organization (isolation)
- 30-minute setup target with automated scripts
- Secret management via external systems (no secrets in repo)

#### Key Guidelines
- Repository structure: `org-<uuid>/{specs,code,docs,config}`
- Setup script template: `setup.sh` with dependency checks
- `.gitignore` template: Secrets, platform-specific dirs, build artifacts
- .env.example for required environment variables
- Pre-commit hooks for secret scanning

#### Secret Management
**DO NOT COMMIT:**
- API keys, passwords, tokens, certificates, private keys

**DO COMMIT:**
- `.env.example` with variable names
- Documentation of required secrets
- Secret management integration code

#### Workflow
1. Clone repository: `git clone https://github.com/org/project-uuid.git`
2. Run setup: `chmod +x setup.sh && ./setup.sh`
3. Configure secrets: Copy `.env.example` to `.env`, fill secrets
4. Verify: `make test`

---

### Rule 2: Platform Portability & Agnosticism

**Domain:** Architecture, Tooling, Vendor Independence
**Priority:** High

#### Rule Statement
Use platform-agnostic file formats and standards for all specifications and configurations, enabling migration between AI-integrated IDEs without rebuilding the environment.

#### Acceptance Criteria
- All specs in standard Markdown format
- Only open standard formats (Markdown, YAML, JSON)
- No platform-specific features in core specs
- No IDE-specific syntax
- Supported platforms: Cursor, Kiro, VS Code, Claude Code
- Platform-specific integrations documented separately

#### File Format Standards

**Specifications:**
- Format: Markdown (.md)
- Metadata: YAML frontmatter
- Diagrams: Mermaid or standard formats

**Configuration:**
- Format: YAML or JSON
- Documented schema
- Supported comments

**Code:**
- Languages: Python, JavaScript, Go, TypeScript
- Standards: PEP 8, StandardJS
- No IDE-specific syntax

#### Spec Structure Template
```markdown
---
title: [Spec Title]
type: [agent|skill|workflow|rule]
version: 1.0.0
created: YYYY-MM-DD
---

# [Title]

**[Type]:** [Value]
**Domain:** [Value]

## Overview
[Content]
```

#### Migration Path
1. **Preserve Core Assets:** Move spec files, configuration, code
2. **Update Platform Integrations:** Remove old, add new
3. **Verify Functionality:** Test parsing, validate workflows

---

### Rule 3: Modular & Extensible Architecture

**Domain:** Architecture, System Design, Reusability
**Priority:** High

#### Rule Statement
Organize capabilities into discrete, reusable modules following the UNIX philosophy: solve a problem once and turn the solution into a module that can be chained with others.

#### UNIX Philosophy Applied
1. **Solve Once, Reuse Forever** — Solutions become reproducible modules
2. **Interoperable System** — Output of one = input to next
3. **Single Responsibility** — Each module does one thing well

#### Module Types

| Type | Purpose | Location | Interface |
|---|---|---|---|
| **Agents** | Specialized roles in workflow | `agents/[name]/` | Input/Output contracts |
| **Skills** | Reusable capabilities | `skills/[name]/` | Workflows, Tools |
| **Workflows** | Step-by-step execution | `workflows/[name]/` | Steps, Prerequisites |
| **Rules** | Constraints & requirements | `rules/[name]/` | Acceptance criteria |

#### Module Interface Standards

**Metadata (YAML Frontmatter):**
```yaml
type: [agent|skill|workflow|rule]
name: "Module Name"
version: "1.0.0"
dependencies: ["dep-1", "dep-2"]
inputs: [{name: "input1", type: "string", required: true}]
outputs: [{name: "output1", type: "document"}]
```

**Standard Sections:**
- **Overview:** Purpose and domain
- **Core Capabilities:** What it does
- **Integration Points:** Inputs, outputs, dependencies
- **Usage Examples:** How to use
- **Related Modules:** Connections

#### Module Chaining Examples
- Content → Images → Blog post with header
- Research → Synthesis → Comprehensive report
- Analyst → PM → Architect → Dev (full pipeline)

#### Extension Mechanisms
- Add new agents: `agents/[name]/AGENT.md`
- Add new skills: `skills/[name]/SKILL.md`
- Add new workflows: `workflows/[name]/WORKFLOW.md`
- Override templates at organization level

---

### Rule 4: Mandatory Context Loading

**Domain:** AI Architecture, Context Management, Reliability
**Priority:** Critical

#### Rule Statement
Enforce a four-layer mandatory context loading protocol to ensure AI agents read foundational knowledge before executing tasks.

**Failure to load context = "lying to the user"**

#### Four-Layer Enforcement

**Layer 1: Context System Documentation**
- Master context file (e.g., `CLAUDE.md`)
- Defines entire context structure
- Specifies all mandatory reading

**Layer 2: UserPromptSubmit Hook**
- Custom code hook (`~/.claude/hooks/`)
- Intercepts every user message
- Injects mandatory instructions

**Layer 3: Aggressive Instructions**
- ALL CAPS for critical requirements
- Emoji for visual emphasis (🚨, ✅)
- Explicit prohibition of lying
- Observable tool requirement

**Layer 4: Redundant Symlinks**
- Critical files accessible from multiple paths
- Via symbolic links in hierarchy
- Ensures discoverability

#### Implementation Guidelines

**UFC Structure:**
```
~/.claude/
  /context/
    CLAUDE.md              # Master context
    /tools/
      CLAUDE.md
    /projects/
      /project-a/
        CONTEXT.md
  /hooks/
    user-prompt-submit-context-loader.ts
  CLAUDE.md -> context/CLAUDE.md
```

#### Observable Tool Usage Required
- Read tool calls appear in logs
- Specific files listed
- Confirmation message sent

#### Targeted Context Hydration
Load the "exact right amount of context at the exact right time":
1. Identify task domain
2. Load only relevant context
3. Progressive disclosure as needed
4. Just-in-time context delivery

---

### Rule 5: Multi-Organization Isolation

**Domain:** Security, Data Privacy, Client Separation
**Priority:** Critical

#### Rule Statement
Maintain complete isolation between organization contexts with no shared data storage, ensuring no client data or information can leak to another client.

#### Acceptance Criteria
- Separate data storage per organization
- Clean context switching (no residual data)
- Isolated directory structure (separate repos or directories)
- Sanitized central outputs (no identifying info)
- Scalability: Support 3+ concurrent contexts

#### Repository Structure
```
/org-<uuid-1>/
  /specs/
  /code/
  /docs/
  .git/

/org-<uuid-2>/
  /specs/
  /code/
  /docs/
  .git/

/central-management/
  /aggregated-status/  # Sanitized only
```

#### Context Switching
- Explicit context selection required
- Environment variable: `CURRENT_ORG_CONTEXT`
- No automatic context inference
- Clear visual indicator of active context

#### Data Sanitization
- Use UUID or numeric identifiers
- Remove client names, domains, IP addresses
- Generic task descriptions
- Timestamp only (no client timezone)

#### Testing Requirements
1. **Isolation Testing:** Verify no data sharing
2. **Sanitization Testing:** Audit central outputs
3. **Scalability Testing:** Test with 3+ contexts

---

### Rule 6: Zero Trust Architecture

**Domain:** Security Architecture, Network Security, Access Control
**Priority:** Critical

#### Rule Statement
Implement Zero Trust principles across all systems: assume breach and verify explicitly rather than implicitly trusting based on network location.

#### Core Principles

**1. Verify Explicitly**
- Authenticate and authorize on all data points
- User identity, device health, location, application, data classification

**2. Use Least Privilege Access**
- Just-in-Time (JIT) and Just-Enough-Access (JEA)
- Session-based, time-limited permissions
- Risk-based adaptive policies

**3. Assume Breach**
- Micro-segmentation
- End-to-end encryption
- Continuous monitoring
- Automated threat response

#### Acceptance Criteria
- **AC1:** Identity verification (MFA, device attestation)
- **AC2:** Micro-segmentation with explicit access controls
- **AC3:** Least privilege (RBAC, PAM, JIT)
- **AC4:** Encryption everywhere (TLS 1.2+, data-at-rest)
- **AC5:** Continuous monitoring & logging
- **AC6:** Inspect all traffic (DPI, TLS inspection)

#### Implementation Architecture

**Control Plane:**
- Policy Decision Point (PDP) — centralized policy engine
- Policy Enforcement Point (PEP) — reverse proxy, API gateway, SDP
- Policy Administration Point (PAP) — policy configuration

**Data Plane:**
- Identity Provider (IdP) — auth, MFA, SSO
- Continuous Diagnostics & Mitigation (CDM) — asset inventory, vulnerability assessment
- Industry Compliance — regulatory mapping, reporting
- Threat Intelligence — feeds, IOC, behavioral analytics
- SIEM — log aggregation, event correlation, incident response

#### Zero Trust Maturity Levels
- **Level 0:** Traditional (perimeter-based)
- **Level 1:** Initial (MFA for remote, basic inventory)
- **Level 2:** Developing (MFA all users, device checks, app segmentation)
- **Level 3:** Advanced (risk-based auth, micro-segmentation, JIT access)
- **Level 4:** Optimal (continuous auth, dynamic segmentation, AI/ML)

#### Implementation Phases
- **Phase 1 (Months 1-6):** Identity, Visibility, Segmentation
- **Phase 2 (Months 7-12):** Device Trust, Micro-segmentation, Access Control
- **Phase 3 (Months 13-24):** Automation, Analytics, Optimization

---

## Cross-Cutting Application

These rules apply to:
- **All Agents:** Must respect isolation and context loading rules
- **All Skills:** Must follow modularity and platform portability
- **All Workflows:** Must enforce security and architectural constraints
- **All Code:** Must implement Zero Trust and mandatory context principles

## Risks & Mitigations

| Rule | Risk | Impact | Mitigation |
|---|---|---|---|
| Cloud Storage | Secret exposure | Critical | Pre-commit hooks, scanning, .gitignore |
| Platform Portability | Lock-in | Medium | Strict review, regular audits |
| Modularity | Coupling | Medium | Interface contracts, versioning |
| Context Loading | Hook failure | Critical | Layer 3 backup, aggressive instructions |
| Multi-Org Isolation | Context confusion | High | Visual indicators, explicit selection |
| Zero Trust | User experience | High | Seamless SSO, risk-based auth |

## Compliance & Standards

- **Cloud Storage:** GitHub best practices, secret management standards
- **Platform Portability:** Open standard adherence, vendor independence
- **Modularity:** UNIX philosophy, modular design patterns
- **Context Loading:** AI reliability standards, observable behavior
- **Multi-Org:** Client confidentiality, data privacy (GDPR)
- **Zero Trust:** NIST SP800-207, CISA standards, Executive Order 14028
