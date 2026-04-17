# Voice System Reference

**This file is a reference pointer to the canonical voice system documentation.**

---

## 📍 Canonical Documentation Location

**All voice system documentation is maintained in the voice-server directory:**

`${PAI_DIR}/voice-server/`

---

## 📚 Voice Server Documentation

### Overview and Setup
**Location:** `${PAI_DIR}/voice-server/README.md`

**Contains:**
- Voice server overview and features
- Installation and setup instructions
- Service management (start/stop/restart)
- API usage and endpoints
- Voice IDs for all agents
- Menu bar indicator setup
- Configuration options
- Troubleshooting guide

### Quick Start
**Location:** `${PAI_DIR}/voice-server/QUICKSTART.md`

**Contains:**
- 5-minute setup guide
- Minimal configuration steps
- Basic testing commands

---

## 🎯 Quick Reference

**Start voice server:**
```bash
${PAI_DIR}/voice-server/start.sh
```

**Check status:**
```bash
${PAI_DIR}/voice-server/status.sh
```

**Restart server:**
```bash
${PAI_DIR}/voice-server/restart.sh
```

**Stop server:**
```bash
${PAI_DIR}/voice-server/stop.sh
```

**Test voice:**
```bash
curl -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"Test message","voice_enabled":true}'
```

---

## Available Voice IDs

Voice IDs map to reference audio files used by ChatterboxTTS for voice cloning:

| Agent | Voice ID | Reference File | Description |
|-------|----------|----------------|-------------|
| Sam (Main) | jessica | jessica_ref.wav | Primary default voice |
| Main agents | jamie | jamie_ref.wav | UK Male - Professional |
| Researcher | ava | ava_ref.wav | US Female - Analytical |
| Engineer | zoe | zoe_ref.wav | US Female - Steady |
| Architect | serena | serena_ref.wav | UK Female - Strategic |
| Designer | isha | isha_ref.wav | Indian Female - Creative |
| Pentester | oliver | oliver_ref.wav | UK Male - Technical |

See `${PAI_DIR}/voice-server/README.md` for complete voice list.

---

## 🔗 Related Documentation

- **Prosody Guide:** `${PAI_DIR}/Skills/CORE/prosody-guide.md` (voice parameter tuning)
- **Agent Template:** `${PAI_DIR}/Skills/CORE/prosody-agent-template.md` (creating agent voices)

---

## ⚠️ Important

**DO NOT duplicate voice documentation in CORE.**

- The voice-server directory is the **canonical source** for all voice system documentation
- Duplicating documentation causes version conflicts and maintenance issues
- Always refer to and update voice-server documentation directly
- This reference file should only contain pointers, not duplicated content

---

**Last Updated:** 2025-12-01
