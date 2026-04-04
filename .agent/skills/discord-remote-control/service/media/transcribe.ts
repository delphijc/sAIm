/**
 * Voice Transcription - Phase 6 (Updated: whisper.cpp)
 * Transcribe voice notes using local whisper.cpp instead of Groq API
 */

import {
  transcribe as whisperTranscribe,
  validateAudioFile as whisperValidate,
  type TranscriptionResult,
  type TranscribeOptions,
} from "@pai-tools/transcribe.ts";
import path from "path";

// STA-013: Allowed base directory for audio files
const TEMP_DIR_BASE = process.env.PAI_DIR
  ? path.join(process.env.PAI_DIR, ".tmp", "discord-remote-control")
  : "/tmp/discord-remote-control";

// Re-export types for consumers
export type { TranscriptionResult, TranscribeOptions };

/**
 * Transcribe audio file using local whisper.cpp
 *
 * Supports: .ogg (Opus), .mp3, .wav, .flac, .m4a
 */
export async function transcribeAudio(
  filePath: string,
  language?: string
): Promise<TranscriptionResult> {
  console.log(`🎵 Transcribing (whisper.cpp): ${filePath}`);

  const result = await whisperTranscribe(filePath, {
    language: language || "en",
  });

  if (result.success) {
    console.log(`✅ Transcription complete (${result.duration?.toFixed(2)}s)`);
    console.log(`   Text: "${(result.text || "").substring(0, 80)}..."`);
  } else {
    console.error(`❌ Transcription failed: ${result.error}`);
  }

  return result;
}

/**
 * Transcribe voice note and get confidence metadata
 */
export async function transcribeVoiceNote(
  filePath: string,
  options?: {
    language?: string;
    includeMetadata?: boolean;
  }
): Promise<TranscriptionResult & { metadata?: Record<string, unknown> }> {
  const result = await transcribeAudio(
    filePath,
    options?.language || "en"
  );

  if (result.success && options?.includeMetadata) {
    return {
      ...result,
      metadata: {
        language: result.language,
        duration: result.duration,
        segments: result.segments?.length,
      },
    };
  }

  return result;
}

/**
 * Format transcription for Discord message
 */
export function formatTranscription(text: string): string {
  const cleaned = text
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  return cleaned;
}

/**
 * Build prompt context from voice transcription
 * Indicates to Claude that this came from voice input
 */
export function buildVoicePrompt(
  transcript: string,
  userContext?: string
): string {
  let prompt = `[Voice note transcribed]\n\n"${transcript}"`;

  if (userContext) {
    prompt += `\n\nContext: ${userContext}`;
  }

  return prompt;
}

/**
 * Validate audio file before transcription
 */
export async function validateAudioFile(
  filePath: string
): Promise<{ valid: boolean; error?: string; size?: number }> {
  // STA-013: Verify file path is within the expected temp directory
  const resolved = path.resolve(filePath);
  const tempBase = path.resolve(TEMP_DIR_BASE) + path.sep;
  if (!resolved.startsWith(tempBase)) {
    return { valid: false, error: "Audio file path outside allowed directory" };
  }

  return whisperValidate(filePath);
}

/**
 * Get audio file duration (estimated from file size)
 */
export function estimateAudioDuration(fileSizeBytes: number): number {
  const estimatedMs = fileSizeBytes / 8;
  return Math.round(estimatedMs / 1000);
}
