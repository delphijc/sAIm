# transcribe-audio Reference Guide

> This is Tier 3 documentation for the transcribe-audio skill. It's loaded on-demand when you need detailed information. For quick routing and examples, see `SKILL.md`.

---

## Architecture: whisper.cpp + Ollama (Bun)

transcribe-audio uses a shared Bun module at `$PAI_DIR/.agent/tools/transcribe.ts` that wraps:

1. **whisper.cpp** - Local C++ speech-to-text (no Python, no API keys)
2. **Ollama** - Local LLM for formatting transcripts into structured Markdown

### Why whisper.cpp (not Python whisper)

| Aspect | Python whisper | whisper.cpp |
|--------|---------------|-------------|
| Runtime | Python + PyTorch (~2GB) | Native C++ binary (~10MB) |
| Speed | Slower (Python overhead) | 2-4x faster |
| Dependencies | pip, CUDA bindings | cmake, make, g++ (build only) |
| Integration | Subprocess to Python | Subprocess to native binary |
| Interpreter issues | PATH conflicts, silent hangs | None - single binary |

### Shared Module

The `transcribe.ts` module is used by both:
- **Discord Remote Control** - Voice note transcription (replaces Groq API)
- **transcribe-audio skill** - Full audio transcription with formatting

---

## Directory Structure

Default locations for audio input and transcription output:

```
.agent/history/TranscribedAudio/
├── raw-recordings/          # ← Input: Place .m4a/.mp3/.wav files here
│   ├── 202602261300.m4a
│   ├── 202602271300.m4a
│   └── ...
├── 202602261300.md          # ← Output: Formatted transcripts (auto-generated)
├── 202602271300.md
└── ...
```

---

## Environment Variables

Set in `$PAI_DIR/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `WHISPER_MODEL` | Whisper model size (tiny, base, small, medium, large) | `base` |
| `OLLAMA_MODEL` | Ollama model for transcript formatting | `gpt-oss` |
| `PAI_DIR` | Root PAI directory (used to resolve output path) | Auto-detected |

---

## Complete Invocation Examples

### Example 1: Simple Transcription (text only)
```bash
bun run $PAI_DIR/.agent/tools/transcribe.ts /path/to/audio.m4a
```

### Example 2: Full Formatting Pipeline
```bash
bun run $PAI_DIR/.agent/tools/transcribe.ts /path/to/audio.m4a \
  --format \
  --model base \
  --ollama-model gpt-oss
```

### Example 3: Custom Output Location
```bash
bun run $PAI_DIR/.agent/tools/transcribe.ts /path/to/audio.m4a \
  --format \
  --output /custom/output/path/transcript.md
```

### Example 4: Batch Transcription (Process All Files)
```bash
# Using default raw-recordings directory
cd /path/to/project
for file in .agent/history/TranscribedAudio/raw-recordings/*.m4a; do
  echo "Transcribing: $(basename $file)"
  bun run $PAI_DIR/.agent/tools/transcribe.ts "$file" --format
done
```

Output: All `.md` files appear in `.agent/history/TranscribedAudio/`

### Example 5: As a Module (from TypeScript)
```typescript
import { transcribe, transcribeWithFormatting } from "$PAI_DIR/.agent/tools/transcribe.ts";

// Simple transcription
const result = await transcribe("/path/to/audio.ogg");

// With Ollama formatting
const formatted = await transcribeWithFormatting("/path/to/audio.m4a", {
  model: "base",
  ollamaModel: "gpt-oss",
});
```

---

## Troubleshooting Matrix

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| whisper-cli not found | Not built | `cd $PAI_DIR/.agent/tools/whisper.cpp && cmake -B build && cmake --build build --config Release` |
| Model file missing | Not downloaded | `bash $PAI_DIR/.agent/tools/whisper.cpp/models/download-ggml-model.sh base` |
| m4a files fail | ffmpeg not installed | `sudo apt install ffmpeg` (Linux) or `brew install ffmpeg` (macOS) |
| Ollama formatting fails | Server not running | `ollama serve` in separate terminal |
| Ollama model not found | Model not pulled | `ollama pull gpt-oss` |
| Output file not created | Directory doesn't exist | Check path or use `--output` flag |

---

## Build Requirements (one-time setup)

```bash
# Build whisper.cpp
cd $PAI_DIR/.agent/tools/whisper.cpp
cmake -B build
cmake --build build --config Release

# Download model
bash models/download-ggml-model.sh base
```

Required system packages: `cmake`, `make`, `g++`, `ffmpeg` (for m4a conversion)
