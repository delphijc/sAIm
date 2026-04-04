# Voice Prosody System - Complete Guide

**Purpose:** Enable rich, personality-driven voice delivery across all Sam agents using emotional intelligence markers and markdown prosody.

**When to Reference:** Writing COMPLETED lines, creating voice notifications, or enhancing voice delivery

---

## Overview

The voice server (ElevenLabs eleven_turbo_v2_5) processes text markers to control emotional delivery and pacing. Two systems work together:

1. **Emotional Intelligence Markers**: `[emoji context]` for emotional delivery
2. **Markdown Prosody**: `**bold**`, `...`, `--` for emphasis and pacing

Both are preserved throughout the pipeline and delivered naturally by the voice system.

---

## Emotional Intelligence Markers

**Format:** `[emoji descriptor]` at the start of the message

### Available Markers

| Marker | When to Use | Example |
|--------|-------------|---------|
| `[💥 excited]` | Breakthroughs, discoveries, exciting results | `[💥 excited] Found the **actual** bug!` |
| `[✨ success]` | Completions, wins, achievements | `[✨ success] Deployment complete!` |
| `[⚠️ caution]` | Warnings, partial success, needs review | `[⚠️ caution] Tests passing but performance slow` |
| `[🚨 urgent]` | Critical issues, immediate action needed | `[🚨 urgent] Production server down!` |

### How They Work

- Voice server adjusts tone, energy, and delivery style based on marker
- `[💥 excited]` → energetic, enthusiastic, fast-paced
- `[✨ success]` → confident, warm, satisfied
- `[⚠️ caution]` → careful, uncertain, measured
- `[🚨 urgent]` → intense, immediate, high-priority

### Examples

```
❌ BAD (no emotion):
Completed the migration

✅ GOOD (with emotion):
[✨ success] Migration complete -- all data transferred!
```

```
❌ BAD (too formal):
Fixed the authentication issue

✅ GOOD (enthusiastic):
[💥 excited] Found it... the session token was **expiring** early!
```

---

## Markdown Prosody

**Purpose:** Control pacing, emphasis, and natural speech rhythms

### Bold for Emphasis `**text**`

**When to use:**
- Key action verbs
- Critical discoveries
- Important results
- Contrast or correction

**Examples:**
```
Found the **actual** solution
Deployed to **production** successfully
This is **not** a race condition -- it's a deadlock
The issue was **authentication**, not authorization
```

**Voice effect:** Stronger emphasis, slightly louder, more assertive

### Ellipsis for Pauses `...`

**When to use:**
- Dramatic pauses
- Building suspense
- Thought processes
- Before revelations

**Examples:**
```
Wait... I think I found something
Analyzing the logs... yes, there it is!
After three hours... finally working
Hmm... this doesn't look right
```

**Voice effect:** Natural pause, builds anticipation, conversational flow

### Em-Dash for Breaks `--`

**When to use:**
- Thoughtful pauses
- Clause separation
- Adding context
- Measured delivery

**Examples:**
```
Deployment complete -- all services operational
Fixed the bug -- turned out to be a caching issue
Tests passing -- ready for production
Migration successful -- no data loss detected
```

**Voice effect:** Slight break, maintains flow, connects related ideas

### Exclamations for Energy `!`

**When to use:**
- Excitement
- Success
- Urgency
- Emphasis

**Examples:**
```
This is working!
All tests passed!
Found the solution!
Critical issue detected!
```

**Voice effect:** Energetic delivery, upward inflection, enthusiasm

### Questions for Queries `?`

**When to use:**
- Asking questions
- Expressing uncertainty
- Rhetorical questions

**Examples:**
```
Should we deploy now?
Is this the right approach?
Could this be a race condition?
```

**Voice effect:** Upward inflection, questioning tone

---

## Combining Prosody Systems

**Most powerful:** Combine emotional markers with markdown prosody

### Examples

```
[💥 excited] Wait... I found the **actual** root cause!
(Marker: excited energy + pause for drama + emphasis on "actual")

[✨ success] Deployment complete -- all services **operational**!
(Marker: confident success + measured break + emphasis on result)

[⚠️ caution] Tests passing... but response times are **slow**
(Marker: careful tone + thoughtful pause + emphasis on issue)

[🚨 urgent] Production down -- database connection **failing**!
(Marker: urgent intensity + quick break + emphasis on problem)
```

---

## Agent-Specific Prosody Patterns

Each agent has a personality-specific prosody style based on their archetype.

### Enthusiasts (Sam, Intern, Pentester, Artist)

**Characteristics:** Chaotic energy, expressive, excited

**Prosody patterns:**
- More ellipses for excited pauses
- Exclamations for energy
- Bold emphasis on discoveries
- `[💥 excited]` marker frequently

**Examples:**
```
[💥 excited] Wait wait wait... check this out!
Found the vulnerability... this is **critical**!
Ooh... I see what's happening here!
```

**Voice delivery:** Fast-paced (235-270 wpm), low stability (0.18-0.38), variable energy

### Professionals (Engineer, Writer)

**Characteristics:** Balanced, reliable, warm expertise

**Prosody patterns:**
- Emphasis on key actions
- Balanced use of pauses
- Professional but expressive
- `[✨ success]` marker for wins

**Examples:**
```
[✨ success] **Deployed** to production -- all checks passing!
Fixed the issue... it was a configuration problem
Tests **complete** -- ready for review
```

**Voice delivery:** Medium pace (220-235 wpm), moderate stability (0.38-0.50), steady presence

### Analysts (Perplexity, Claude, Gemini Researchers)

**Characteristics:** Confident, authoritative, analytical

**Prosody patterns:**
- Emphasis on findings and evidence
- Measured delivery
- Less exclamation, more certainty
- Minimal emotional markers (analytical tone)

**Examples:**
```
**Confirmed** across three independent sources
The data shows... consistent pattern in all cases
**Verified** the hypothesis -- evidence supports conclusion
```

**Voice delivery:** Medium-fast pace (229-240 wpm), higher stability (0.55-0.64), confident authority

### Wise Leaders (Principal Engineer, Architect)

**Characteristics:** Measured, thoughtful, deliberate

**Prosody patterns:**
- Em-dashes for thoughtful breaks
- Minimal exclamations
- Emphasis on long-term implications
- Very measured delivery

**Examples:**
```
Consider this -- the architectural implications are significant
We need to **rethink** the approach here
This decision will impact us for years -- choose carefully
```

**Voice delivery:** Slower pace (205-212 wpm), high stability (0.72-0.75), deliberate wisdom

---

## COMPLETED Line Best Practices

The `🎯 COMPLETED:` line drives the voice notification. Make it count!

### Structure

```
🎯 COMPLETED: [AGENT:type] [optional marker] message with prosody
```

### Rules

1. **Use emotional markers** when appropriate (success, excited, caution, urgent)
2. **Add emphasis** to key actions or discoveries (`**bold**`)
3. **Use pauses** for natural delivery (`...` or `--`)
4. **Match your personality** - enthusiast vs analyst vs wise leader
5. **Maximum 12 words** for concise voice delivery
6. **End with punctuation** - `!` for energy, `.` for measured

### Examples by Agent Type

**Sam (Professional/Enthusiast):**
```
❌ BAD: Completed the task
✅ GOOD: [✨ success] **Deployed** successfully -- all systems go!
✅ GOOD: [💥 excited] Found it... the bug was in the **cache**!
```

**Intern (Enthusiast/Chaotic):**
```
❌ BAD: Fixed the issue
✅ GOOD: [💥 excited] Wait... I **actually** fixed it!
✅ GOOD: This is working... **finally**!
```

**Engineer (Professional/Measured):**
```
❌ BAD: Deployed to production
✅ GOOD: [✨ success] Deployment **complete** -- zero downtime achieved
✅ GOOD: **Fixed** the race condition -- tests passing
```

**Perplexity Researcher (Analyst/Confident):**
```
❌ BAD: Found the information
✅ GOOD: **Confirmed** across five independent sources
✅ GOOD: Research **complete** -- data validates hypothesis
```

**Architect (Wise Leader/Measured):**
```
❌ BAD: Reviewed the architecture
✅ GOOD: Analysis complete -- **fundamental** redesign recommended
✅ GOOD: This approach scales... but consider the **long-term** cost
```

---

## Quick Reference

### Emotional Markers
- `[💥 excited]` - Breakthroughs, discoveries
- `[✨ success]` - Completions, wins
- `[⚠️ caution]` - Warnings, concerns
- `[🚨 urgent]` - Critical issues

### Markdown Prosody
- `**text**` - Emphasis
- `...` - Dramatic pause
- `--` - Thoughtful break
- `!` - Energy/excitement
- `?` - Questions

### Combining
```
[marker] text with **emphasis**... pauses -- and breaks!
```

### Agent Archetypes
- **Enthusiasts**: Chaotic energy, `...`, `!`, `**discoveries**`
- **Professionals**: Balanced, `**actions**`, measured pauses
- **Analysts**: Confident, `**findings**`, authoritative
- **Wise Leaders**: Measured, `--` breaks, deliberate

---

## Automatic Enhancement

**Good news:** The prosody-enhancer hook automatically adds emotional markers and personality-specific prosody based on:
- Content analysis (detecting success, excitement, caution, urgency)
- Agent personality archetype
- Your existing prosody markers

**But don't rely on it!** Manually adding prosody gives you full creative control and sounds best.

---

## Testing Prosody

Test your prosody with curl:

```bash
# Test emotional marker
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"[💥 excited] Found the **actual** bug!","voice_id":"s3TPKV1kjDlVtZbl4Ksh","title":"Sam"}'

# Test markdown prosody
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"Wait... I found something **critical**!","voice_id":"s3TPKV1kjDlVtZbl4Ksh","title":"Sam"}'

# Test combined
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"[✨ success] Deployment **complete** -- all systems operational!","voice_id":"s3TPKV1kjDlVtZbl4Ksh","title":"Sam"}'
```

---

## Common Mistakes

### Too Generic
```
❌ Completed the task
✅ [✨ success] Migration **complete** -- zero errors!
```

### No Prosody
```
❌ Fixed the authentication bug
✅ [💥 excited] Found it... **authentication** token was expiring!
```

### Wrong Personality
```
❌ [Architect using chaotic energy] Wait wait... found it!!
✅ [Architect measured delivery] Analysis complete -- **fundamental** redesign needed
```

### Overuse
```
❌ [💥 excited] **This** is... **so** -- **amazing**!!!
✅ [💥 excited] Found the **actual** solution!
```

---

## Related Documentation

- `${PAI_DIR}/voice-server/USAGE.md` - Voice server complete usage guide
- `${PAI_DIR}/Skills/CORE/agent-personalities.md` - Agent personality definitions
- `${PAI_DIR}/Skills/CORE/workflows/voice-routing-full.md` - Voice routing table
- `${PAI_DIR}/Hooks/lib/prosody-enhancer.ts` - Prosody enhancement library

---

**Last Updated:** 2025-11-17
