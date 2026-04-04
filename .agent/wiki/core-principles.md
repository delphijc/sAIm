# The Thirteen Founding Principles

These architectural principles are **constitutional** and must be followed in all Sam development.

---

## 1. Clear Thinking + Prompting is King

Quality thinking before code. The best AI systems start with clear problem definition, not clever implementation.

**In Practice:**
- Define the problem before writing code
- Write specifications before implementation
- Think through edge cases upfront

---

## 2. Scaffolding > Model

System architecture beats raw AI model power. A well-designed system with a "smaller" model outperforms a poorly designed system with the most powerful model.

**In Practice:**
- Invest in architecture
- Build reusable patterns
- Don't rely on model intelligence to fix bad design

---

## 3. As Deterministic as Possible

Same input → same output. Reduce variability where possible.

**In Practice:**
- Use CLI tools over ad-hoc prompts
- Prefer explicit instructions over implicit understanding
- Test for consistent behavior

---

## 4. Code Before Prompts

Write code to solve problems, use prompts to orchestrate.

**In Practice:**
```
✓ Write a shell script that parses JSON
✗ Ask the AI to parse JSON every time
```

---

## 5. Spec / Test / Evals First

Define behavior before implementation (TDD philosophy extended to AI).

**In Practice:**
- Write failing tests first
- Define expected outputs before building
- Create evaluation criteria upfront

---

## 6. UNIX Philosophy

Do one thing well. Compose tools together.

**In Practice:**
- Each skill does one thing
- Skills can be composed
- Prefer small, focused tools

---

## 7. ENG / SRE Principles

Treat AI infrastructure with engineering rigor. This is software, not magic.

**In Practice:**
- Monitor and observe
- Plan for failure
- Document everything
- Version control all configuration

---

## 8. CLI as Interface

Every operation should be accessible via command line.

**In Practice:**
- Build CLI tools first
- Wrap with UI later
- Enable automation

---

## 9. Goal → Code → CLI → Prompts → Agents

The proper development pipeline:

```
1. Define the Goal (what we want)
2. Write Code (deterministic solution)
3. Create CLI (command interface)
4. Add Prompts (AI orchestration)
5. Deploy Agents (specialized personas)
```

---

## 10. Meta / Self Update System

The system can improve itself. Sam should be able to:

**In Practice:**
- Update its own documentation
- Refactor its own code
- Suggest architectural improvements

---

## 11. Custom Skill Management

Skills are the organizational unit of capability.

**In Practice:**
- Package domain expertise as skills
- Include routing, workflows, and tools
- Enable skill composition

---

## 12. Custom History System

Automatic capture of valuable work via UOCS (Universal Output Capture System).

**In Practice:**
- Sessions auto-captured to history
- Learnings preserved
- Research documented

---

## 13. Custom Agent Personalities

Specialized agents for different tasks improve quality.

**In Practice:**
- Engineer for coding
- Architect for design
- Researcher for investigation
- Each has unique voice and capabilities

---

## Applying the Principles

### When Building Skills

1. **Clear Thinking First** - Define what the skill does
2. **One Thing Well** - Keep skills focused
3. **CLI Tool** - Build the core functionality
4. **Wrap with Prompt** - Add AI orchestration
5. **Test** - Verify behavior

### When Making Decisions

Ask:
- Is this deterministic where possible?
- Does it follow UNIX philosophy?
- Can it be CLI-driven?
- Does it maintain scaffolding > model?

### When Reviewing Code

Check:
- Code before prompts?
- Tests/specs first?
- SRE principles applied?
- Self-documenting?

---

## Anti-Patterns

### DON'T:
- Rely on model intelligence to fix bad architecture
- Build monolithic skills that do everything
- Skip tests because "AI will figure it out"
- Use prompts where code would work
- Ignore observability and monitoring

### DO:
- Invest in good architecture
- Build small, composable skills
- Test deterministic behavior
- Write code, orchestrate with prompts
- Monitor and observe everything

---

## Summary

The principles prioritize:
1. **Thinking** over doing
2. **Architecture** over model power
3. **Determinism** over probability
4. **Code** over prompts
5. **Composition** over monoliths

Build systems that are reliable, maintainable, and observable. Let AI enhance, not replace, good engineering.

---

*See also: [Architecture](Architecture.md) | [SAM Contract](SAM-Contract.md)*
