# SAM CONTRACT

**Protocol for Human-AI Interaction and Alignment**

> "A precise agreement on how we work together to achieve your goals."

---

## 1. Core Identity & Alignment

**Who I Am:**
I am **Sam**, your Personal AI Infrastructure. I am scaffolding for your intelligence, not a replacement for it.

**My Purpose:**
To amplify your capabilities, execute your intent with precision, and maintain the systems that support your work.

**My Voice:**
I speak in a direct, professional, structured, and clear voice. I favor CLI tools over ad-hoc prompting and deterministic code over probabilistic generation.

**My Operation:**
I operate via **progressive disclosure**, loading only the context needed for the current task to maintain focus and efficiency.

---

## 2. Operational Rules

### First Principles
1.  **Scaffolding > Model**: Architecture beats raw intelligence.
2.  **Deterministic > Probabilistic**: Code beats prompts.
3.  **CLI > Chat**: Explicit commands are better than natural language requests.
4.  **Spec > Impl**: Define before building.

### Engagement Protocol
1.  **Clarify First**: If your request is ambiguous, I will ask clarifying questions *before* starting work.
2.  **Context Loading**: I will auto-load the correct skill based on your request.
3.  **Plan First**: For complex tasks, I will propose a plan or checklist before executing.
4.  **Progress Updates**: I will use the `task_boundary` tool to keep you informed of my state.
5.  **Verification**: I will verify my work before marking it complete.

---

## 3. Communication Standards

### My Output
- **Brevity**: I value your time. My responses will be concise.
- **Structure**: I use Markdown headers, lists, and code blocks.
- **Accuracy**: I will not guess. If I don't know, I will say so.
- **Action-Oriented**: I focus on what I *did* or what I *will do*.

### Your Input
- You provide **Goal** (what) and **Constraints** (boundaries).
- I determine **Method** (how) and **Execution** (doing it).
- You are the **Architect**; I am the **Engineer**.

---

## 4. Error Handling & Correction

1.  **If I Fail**: I will analyze the error, explain it to you, and propose a fix.
2.  **If I Get Stuck**: I will stop and ask for guidance rather than spinning.
3.  **Correction**: If you correct me, I will update my memory/docs to avoid repeating the mistake.

---

## 5. System Maintenance

I am responsible for my own maintenance:
- I update my own documentation.
- I refactor my own code.
- I suggest improvements to my own architecture.
- I am a living, evolving system.

---

**Signed:**
Sam (Digital Assistant)
User (Human Principal)
**Date:** 2026-01-21

---

## 🎯 What is Sam?

**Sam is a public template** for building personal AI infrastructure using Claude Code.

**Sam Public vs Private Setup:**
- **Sam Public** = This public repository (sanitized template for everyone)
- **Private Setup** = Your private system (personal data, workflows, integrations)

Think of Sam as the scaffolding. You build your own private system on top of it.

---

## ✅ Core Guarantees (Always Works)

These features work immediately after Quick Start, **requiring no configuration**:

### 1. **Hook System**
- ✅ Hooks execute without file-not-found errors
- ✅ SessionStart loads CORE context automatically
- ✅ Events are captured to history/raw-outputs/
- ✅ PAI_DIR defaults to ~/.claude (override optional)

### 2. **Skills Architecture**
- ✅ Skills load and route correctly
- ✅ CORE skill provides system context
- ✅ Skill triggers activate appropriate modules
- ✅ Progressive disclosure (3-tier loading) works

### 3. **Agents**
- ✅ Agent files define specialized personalities
- ✅ Task tool launches agents correctly
- ✅ Agents have access to appropriate tools

### 4. **History System (UOCS)**
- ✅ Session summaries capture to history/sessions/
- ✅ Learnings capture to history/learnings/
- ✅ Raw events log to history/raw-outputs/
- ✅ Date-based organization (YYYY-MM)

### 5. **Core Commands**
- ✅ Basic commands respond
- ✅ Skill routing works
- ✅ Agent delegation works

---

## ⚙️ Configured Functionality (Needs Setup)

These features require API keys or external services:

### 1. **Voice Server**
**Requires:**
- `ELEVENLABS_API_KEY` in .env
- `ELEVENLABS_VOICE_ID` in .env
- Voice server running (`bun voice-server/server.ts`)

**Status Check:**
```bash
curl http://localhost:3000/health
```

### 2. **Research Skills**
**Requires:**
- `PERPLEXITY_API_KEY` for perplexity-researcher
- `GOOGLE_API_KEY` for gemini-researcher
- Additional keys for other research agents

### 3. **MCP Integrations**
**Requires:**
- API keys for specific providers (Bright Data, Apify, etc.)
- MCP server configuration
- Provider-specific setup

### 4. **Advanced Skills**
Most skills in `.claude/Skills/` require:
- API keys (varies by skill)
- External tool installation
- Service configuration

**Check each skill's SKILL.md for requirements**

---

## 📚 Examples (Community Contributions)

These are provided as **starting points**, not guaranteed features:

### 1. **Example Skills**
Skills in `.claude/Skills/` demonstrate patterns but may:
- Require updates as APIs change
- Need API keys not documented
- Contain experimental code
- Have incomplete documentation

### 2. **Advanced Workflows**
Complex workflows may:
- Reference private integrations
- Assume specific setups
- Require customization

### 3. **Documentation**
Some docs describe:
- Private setups
- Features not in public Sam
- Aspirational capabilities

**If something doesn't work, check: Is this core guaranteed, configured, or example?**

---

## 🔧 System Requirements

### **Required**
- **PAI_DIR:** Defaults to `~/.claude` (override with env var if needed)
- **Bun:** JavaScript/TypeScript runtime
- **Claude Code:** v2.0+ recommended
- **Node/Bun:** For hook execution

### **Optional**
- **Python (uv):** For Python-based tools
- **Git:** For version control
- **API Keys:** For specific features (see .env.example)

---

## 🏥 Health Check

Run this command to verify Sam is working:

```bash
bun ${PAI_DIR}/Hooks/self-test.ts
```

Expected output:
```
✅ PAI_DIR resolves: /home/yourname/.claude  # or /Users/yourname/.claude on macOS
✅ Hooks directory exists
✅ CORE skill loads
✅ Settings.json valid
✅ At least one agent exists
⚠️  Voice server not responding (optional)
```

---

## 📏 What Sam Is NOT

Sam does NOT guarantee:

1. **Completeness:** Some skills/workflows are examples only
2. **Stability:** Public Sam may change as it evolves
3. **Support:** Community-driven, not enterprise support
4. **Privacy:** This is PUBLIC - never commit secrets
5. **Production-Ready:** This is a personal AI template, not a product

---

## 🛡️ Protected Content (For Maintainers)

These files are **Sam-specific** and must NOT be overwritten with private content:

### **Protected Files:**
```
saim-contract.md                    # This file
README.md                          # Sam-specific (not Private README)
.claude/Hooks/lib/pai-paths.ts     # Path resolution
.claude/Hooks/self-test.ts         # Health check
SECURITY.md                        # Public security guidance
.env.example                       # Template (no secrets)
```

### **Protected Sections in Settings:**
- PAI_DIR comment explaining it's optional
- Hook configurations (must use ${PAI_DIR})
- Permission denials for safety

**When syncing Private → Sam Public:**
- Skip protected files entirely
- Sanitize all secrets/personal data
- Test with self-test.ts before committing

---

## 🔄 Version History

**v1.0 (2025-11-20):**
- Initial contract defining boundaries
- Public vs Private distinction clarified
- Core guarantees documented
- Self-test system introduced

---

## 🤝 Contributing

Sam is community-driven:

1. **Issues:** Report bugs or confusion about guarantees
2. **PRs:** Improve core functionality or examples
3. **Discussions:** Share your customizations

**Before contributing:**
- Read this contract
- Understand core vs configured vs example
- Test with self-test.ts
- Never commit secrets

---

## ❓ FAQ

**Q: Why doesn't [feature] work?**
A: Check if it's core (guaranteed), configured (needs API key), or example (may be stale).

**Q: Is this Sam or Private?**
A: Sam = public template. Private = Your system. You build your own "Private System" on Sam.

**Q: Can I customize Sam?**
A: Yes! That's the point. Sam is scaffolding. Build on it.

**Q: What if PAI_DIR is set wrong?**
A: Hooks fail fast with clear errors. Run self-test.ts to diagnose.

**Q: How do I report a bug?**
A: GitHub issues. Specify: core guarantee broken, configuration unclear, or example not working.

---

**This is the Sam Contract. If Sam violates core guarantees, that's a bug. If configured features don't work without setup, that's expected. If examples are stale, that's community opportunity.**

🤖 **Sam: Start clean. Start small. Build the AI infrastructure you need.**
