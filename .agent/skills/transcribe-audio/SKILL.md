---
name: transcribe-audio
description: Transform raw audio into structured, readable Markdown. USE WHEN user wants to transcribe audio, format session notes, or process audio recordings.
---

## Transcription Engine: whisper.cpp + Ollama

Uses a unified Bun-based transcription module at `$PAI_DIR/.agent/tools/transcribe.ts`.

### Default Directories

- **Input:** `.agent/history/TranscribedAudio/raw-recordings/` - Place raw .m4a/.mp3/.wav audio files here
- **Output:** `.agent/history/TranscribedAudio/` - Formatted Markdown transcripts are saved here

### Quick Start

```bash
# Simple transcription (text output)
bun run $PAI_DIR/.agent/tools/transcribe.ts <audio-file>

# Full transcription + Ollama formatting (structured Markdown)
bun run $PAI_DIR/.agent/tools/transcribe.ts <audio-file> --format

# Transcribe all files in raw-recordings directory
for file in .agent/history/TranscribedAudio/raw-recordings/*.m4a; do
  bun run $PAI_DIR/.agent/tools/transcribe.ts "$file" --format
done

# Custom models
bun run $PAI_DIR/.agent/tools/transcribe.ts <audio-file> --format \
  --model small \
  --ollama-model gpt-oss
```

### Environment Variables (optional, set in $PAI_DIR/.env)

- `WHISPER_MODEL` - Whisper model size: tiny, base, small, medium, large (default: base)
- `OLLAMA_MODEL` - Ollama model for formatting (default: gpt-oss)

### Supported Formats

wav, mp3, ogg, flac (native), m4a (via ffmpeg conversion)

---

## Extended Context

For detailed information, see `Reference.md` and `workflows/Transcribe.md`
