# Transcribe Workflow

Transform raw audio from a lecture/webinar into a structured, readable Markdown document.

## Engine: whisper.cpp + Ollama (via Bun)

Transcription uses the shared `$PAI_DIR/.agent/tools/transcribe.ts` module which wraps whisper.cpp for speech-to-text and Ollama for formatting.

---

## Procedure

1. **Prepare Input**

   - Place audio files in `.agent/history/TranscribedAudio/raw-recordings/`
   - Supported formats: .m4a, .mp3, .wav, .ogg, .flac
   - Max file size: 100MB

2. **Run Transcription Tool**

   **Single file:**
   ```bash
   bun run $PAI_DIR/.agent/tools/transcribe.ts <path-to-audio-file> --format
   ```

   **Batch transcribe all files in raw-recordings:**
   ```bash
   for file in .agent/history/TranscribedAudio/raw-recordings/*.m4a; do
     bun run $PAI_DIR/.agent/tools/transcribe.ts "$file" --format
   done
   ```

   Optional flags:
   - `--model <size>` - Whisper model: tiny, base, small, medium, large (env: WHISPER_MODEL, default: base)
   - `--ollama-model <name>` - Ollama model for formatting (env: OLLAMA_MODEL, default: gpt-oss)
   - `--template <path>` - Custom Markdown template
   - `--output <path>` - Custom output location
   - `--translate` - Translate to English

3. **Format & Save**

   - With `--format`, the tool uses whisper.cpp for transcription, then Ollama for structured formatting
   - Formatting includes: speaker diarization, timestamps, key insights, and actionable items
   - Output saves to `.agent/history/TranscribedAudio/` with `{basename}.md` naming

4. **Notification**
   - Inform the user of the successful transcription and the location of the output file.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| whisper-cli not found | Build whisper.cpp: `cd $PAI_DIR/.agent/tools/whisper.cpp && cmake -B build && cmake --build build --config Release` |
| Model not found | Download: `bash $PAI_DIR/.agent/tools/whisper.cpp/models/download-ggml-model.sh base` |
| Ollama formatting fails | Ensure `ollama serve` is running and model is pulled |
| m4a files fail | Ensure `ffmpeg` is installed |
| Output file not created | Check that output directory is writable |
