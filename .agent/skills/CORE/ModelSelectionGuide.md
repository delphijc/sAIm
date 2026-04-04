# Model Selection Guide

**Last Updated:** January 1, 2026
**Version:** 1.0
**Purpose:** Guide for selecting appropriate Claude models for different task types

---

## Quick Reference

| Task Type | Model | Speed | Cost Multiplier | When to Use |
|-----------|-------|-------|-----------------|-------------|
| **Simple verification** | Haiku | 10-20x faster | 1x baseline | Spotchecks, yes/no answers, simple lookups |
| **Parallel research** | Haiku | 10-20x faster | 1x baseline | Web search, data gathering, fact checking |
| **Code implementation** | Sonnet | Standard | 5x baseline | Writing code, debugging, standard engineering |
| **Complex design** | Sonnet | Standard | 5x baseline | UX/UI work, system design, refactoring |
| **Deep reasoning** | Opus | Slower | 10-20x baseline | Architecture decisions, strategic planning |

---

## Model Characteristics

### Haiku 4.5 (Fast & Efficient)

**Pricing:** $1/M input, $5/M output
**Speed:** 10-20x faster than Sonnet
**Context:** 200K tokens

**Strengths:**
- ✅ Extremely fast response times
- ✅ Excellent for parallel agent execution
- ✅ Good for straightforward tasks
- ✅ Cost-effective for high-volume operations

**Best For:**
- Web search and research aggregation
- Data extraction and summarization
- Verification and validation tasks
- Simple code reviews and spotchecks
- Parallel operations (9+ agents)
- Quick yes/no determinations

**Limitations:**
- ❌ Less sophisticated reasoning than Sonnet
- ❌ May struggle with complex architectural decisions
- ❌ Not ideal for nuanced design work

**Example Use Cases:**
```typescript
// Research command with 9 parallel agents
Task({
  subagent_type: "claude-researcher",
  prompt: "Find latest pricing for X",
  model: "haiku"  // Fast parallel research
})

// Spotcheck verification
Task({
  subagent_type: "intern",
  prompt: "Verify all tests pass",
  model: "haiku"  // Quick verification
})
```

### Sonnet 4.5 (Balanced Performance)

**Pricing:** $3/M input, $15/M output
**Speed:** Standard (baseline)
**Context:** 200K tokens

**Strengths:**
- ✅ Excellent code generation quality
- ✅ Strong reasoning capabilities
- ✅ Good balance of speed and intelligence
- ✅ Handles most engineering tasks well

**Best For:**
- Code implementation and debugging
- Feature development
- System design and refactoring
- UX/UI design work
- Security testing and penetration testing
- General engineering tasks

**Limitations:**
- ❌ 5x more expensive than Haiku
- ❌ Slower than Haiku for simple tasks
- ❌ May not provide sufficient depth for complex architecture

**Example Use Cases:**
```typescript
// Code implementation
Task({
  subagent_type: "engineer",
  prompt: "Implement authentication system",
  model: "sonnet"  // Balanced quality + speed
})

// Design work
Task({
  subagent_type: "designer",
  prompt: "Create UX flow for checkout",
  model: "sonnet"  // Good design reasoning
})
```

### Opus 4.5 (Maximum Intelligence)

**Pricing:** $5/M input, $25/M output
**Speed:** Slower than Sonnet
**Context:** 200K tokens

**Strengths:**
- ✅ Deepest reasoning capabilities
- ✅ Best for complex architectural decisions
- ✅ Handles nuanced strategic planning
- ✅ Excellent for comprehensive PRDs

**Best For:**
- Software architecture design
- Strategic planning and decision-making
- Complex system design
- Comprehensive documentation (PRDs, specs)
- Multi-faceted problem analysis

**Limitations:**
- ❌ 10-20x more expensive than Haiku
- ❌ Slower response times
- ❌ Overkill for simple tasks

**Example Use Cases:**
```typescript
// Architecture planning
Task({
  subagent_type: "architect",
  prompt: "Design microservices architecture for scaling to 1M users",
  model: "opus"  // Deep strategic reasoning needed
})
```

---

## Decision Matrix

### Use Haiku When:

- [ ] Task is verification or validation
- [ ] Answer is straightforward (yes/no, simple facts)
- [ ] Running 5+ parallel agents
- [ ] Doing web research or data gathering
- [ ] Need fast turnaround (seconds matter)
- [ ] Task requires speed over sophistication

### Use Sonnet When:

- [ ] Writing or modifying code
- [ ] Implementing features
- [ ] Debugging complex issues
- [ ] Creating UX/UI designs
- [ ] Security testing or pentesting
- [ ] General engineering work

### Use Opus When:

- [ ] Making architectural decisions
- [ ] Strategic planning (multi-month scope)
- [ ] Designing complex systems
- [ ] Writing comprehensive PRDs
- [ ] Deep technical analysis required
- [ ] Multiple trade-offs to evaluate

---

## PAI Agent Model Assignments

Based on the optimization plan, our agents are configured as:

| Agent | Model | Rationale |
|-------|-------|-----------|
| **Architect** | Opus | Strategic planning, complex system design |
| **claude-researcher** | Haiku | Fast web search and parallel research |
| **gemini-researcher** | Haiku | API-based research (speed optimized) |
| **perplexity-researcher** | Haiku | API-based research (speed optimized) |
| **Engineer** | Sonnet | Code implementation and debugging |
| **Designer** | Sonnet | UX/UI design and product work |
| **Pentester** | Sonnet | Security testing and vulnerability assessment |
| **Researcher** | Sonnet | Complex research requiring deep analysis |

**Distribution:**
- Haiku: 37.5% (3/8 agents) - optimized for parallel operations
- Sonnet: 50% (4/8 agents) - standard implementation
- Opus: 12.5% (1/8 agent) - strategic only

**Note:** When running 9 parallel research agents (3 of each type), the effective distribution becomes ~70% Haiku due to parallelization.

---

## Performance Benchmarks

Based on research and testing:

| Task Type | Haiku | Sonnet | Opus | Winner |
|-----------|-------|--------|------|--------|
| **Simple verification** | ~1s | ~5s | ~8s | Haiku (5-8x faster) |
| **Web research** | ~2s | ~10s | ~15s | Haiku (5-7x faster) |
| **Code implementation** | ~5s | ~10s | ~20s | Sonnet (quality matters) |
| **Architecture planning** | ~10s | ~15s | ~25s | Opus (depth matters) |
| **Parallel research (9 agents)** | ~3s | ~30s | ~60s | Haiku (10-20x faster) |

**Key Insight:** Haiku's speed advantage is most dramatic for parallel operations and simple tasks.

---

## Cost Comparison (API Pricing)

**Note:** Currently on Claude Pro subscription, so costs are predictable. This analysis is for future API usage consideration.

### Multi-Agent Research Example (9 agents × 100K tokens each)

| Model | Input Cost | Output Cost | Total | vs Haiku |
|-------|-----------|-------------|-------|----------|
| **Haiku** | $0.90 | $4.50 | **$5.40** | 1x baseline |
| **Sonnet** | $2.70 | $13.50 | **$16.20** | 3x more |
| **Opus** | $4.50 | $22.50 | **$27.00** | 5x more |

**Impact of Model Selection:**
- Using Haiku for 70% of tasks → 60% cost reduction
- Using Sonnet for everything → 3x higher costs
- Using Opus for everything → 5x higher costs

**ROI Calculation:**
- Current unoptimized API cost: $112-$225/month
- With model optimization: $22-$45/month
- Savings: $90-$180/month ($1,080-$2,160/year)

---

## Best Practices

### 1. Default to Appropriate Model

Always specify model explicitly in Task calls:

```typescript
// ✅ GOOD: Explicit model selection
Task({ subagent_type: "intern", model: "haiku", prompt: "..." })

// ❌ BAD: Relying on defaults (may use wrong model)
Task({ subagent_type: "intern", prompt: "..." })
```

### 2. Optimize Parallel Operations

Use Haiku for all parallel operations:

```typescript
// ✅ GOOD: All parallel agents use Haiku
for (const query of queries) {
  Task({ subagent_type: "claude-researcher", model: "haiku", prompt: query })
}

// ❌ BAD: Using Sonnet for parallel (slow + expensive)
for (const query of queries) {
  Task({ subagent_type: "claude-researcher", model: "sonnet", prompt: query })
}
```

### 3. Reserve Opus for Strategic Decisions

Only use Opus when complexity demands it:

```typescript
// ✅ GOOD: Opus for architecture decision
Task({
  subagent_type: "architect",
  model: "opus",
  prompt: "Design database architecture for 100M records"
})

// ❌ BAD: Opus for simple verification (overkill)
Task({
  subagent_type: "architect",
  model: "opus",
  prompt: "Check if file exists"
})
```

### 4. Match Model to Task Complexity

Think about reasoning depth required:

- **Low complexity** (yes/no, facts) → Haiku
- **Medium complexity** (code, design) → Sonnet
- **High complexity** (architecture, strategy) → Opus

### 5. Monitor Distribution

Target distribution for optimal performance:

- **70% Haiku** - verification, research, parallel tasks
- **25% Sonnet** - implementation, design, engineering
- **5% Opus** - architecture, strategic planning

Check actual distribution monthly and adjust if needed.

---

## Common Mistakes

### ❌ Mistake 1: Using Opus for Everything

**Problem:** 10-20x slower and more expensive than needed
**Solution:** Reserve Opus for truly complex reasoning tasks

### ❌ Mistake 2: Using Sonnet for Parallel Research

**Problem:** 9 Sonnet agents take ~30s vs 3s with Haiku
**Solution:** Always use Haiku for parallel operations

### ❌ Mistake 3: Not Specifying Model

**Problem:** Defaults may not match task requirements
**Solution:** Always explicitly set model in Task calls

### ❌ Mistake 4: Optimizing for Cost Over UX

**Problem:** Using Haiku for complex tasks leads to poor results
**Solution:** Match model to task complexity, not just cost

### ❌ Mistake 5: Ignoring Speed as a Feature

**Problem:** Slow responses hurt user experience
**Solution:** Haiku for speed-sensitive operations

---

## Testing Recommendations

### Quality Assurance

After switching models, verify:

1. **Haiku Tasks:**
   - Verification tasks still accurate?
   - Research results still comprehensive?
   - Spotchecks catching issues?

2. **Sonnet Tasks:**
   - Code implementation quality maintained?
   - Design work still thoughtful?
   - Engineering tasks complete?

3. **Opus Tasks:**
   - Architecture decisions sound?
   - PRDs comprehensive?
   - Strategic planning thorough?

### Performance Benchmarking

Track these metrics:

- **Response time** (seconds to completion)
- **Task completion rate** (% successful)
- **Quality score** (subjective 1-10 rating)
- **Token usage** (input + output)

**Target:** 95%+ completion rate with <5% quality drop

---

## Rollback Procedure

If quality drops below acceptable thresholds:

1. Check agent YAML backups:
   ```bash
   $HOME/Projects/sam/.agent/history/backups/2026-01-01-pre-optimization/agents/
   ```

2. Restore original settings:
   ```bash
   cp ~/.claude/History/backups/2026-01-01-pre-optimization/agents/*.md \
      ~/.claude/Agents/
   ```

3. Restart Claude Code to load original configurations

---

## Future Considerations

### Prompt Caching (API Only)

When/if switching to API:

- Cache CORE skill context (loaded in every agent)
- Cache MCP tool definitions
- Cache skill routing tables
- Expected: 60-90% input token savings

### Batch API (API Only)

For non-urgent research:

- Route to Batch API (50% discount)
- Combine with Haiku for 95% total savings
- Use for overnight data processing

---

## Related Documentation

- **Optimization Plan:** `.claude/History/Research/2025-12/2025-12-28_claude-code-pricing-optimization/optimization-plan.md`
- **Research Report:** `.claude/History/Research/2025-12/2025-12-28_claude-code-pricing-optimization/research-report.md`
- **Agent Configurations:** `.claude/Agents/*.md`
- **CORE Skill:** `.claude/Skills/CORE/SKILL.md`

---

**Version History:**
- v1.0 (2026-01-01): Initial guide created based on optimization plan
