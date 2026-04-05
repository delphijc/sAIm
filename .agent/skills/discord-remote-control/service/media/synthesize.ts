/**
 * Text-to-Speech Synthesis - Phase 7
 * Generate voice responses using SAM voice server or TTS API fallback
 */

import fs from "fs/promises";
import path from "path";

const VOICE_SERVER_URL = "http://localhost:8888";
const TEMP_DIR = "/tmp/discord-remote-control/audio";

interface SynthesisResult {
  success: boolean;
  audioPath?: string;
  duration?: number; // seconds
  error?: string;
}

/**
 * Initialize audio temp directory
 */
export async function initializeAudioDir(): Promise<string> {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.log(`🎵 Audio directory initialized: ${TEMP_DIR}`);
    return TEMP_DIR;
  } catch (error) {
    console.error("Failed to initialize audio directory:", error);
    throw error;
  }
}

/**
 * Synthesize text to speech using SAM voice server
 *
 * Checks if voice server is available at localhost:8888
 * Falls back to API-based TTS if server unavailable
 */
export async function synthesizeText(
  text: string,
  options?: {
    voiceId?: string;
    speed?: number; // 0.5-2.0
    pitch?: number; // 0.5-2.0
  }
): Promise<SynthesisResult> {
  try {
    console.log(`🎙️  Synthesizing text: "${text.substring(0, 50)}..."`);

    // Try SAM voice server first
    const audioPath = await tryVoiceServer(text, options);

    if (audioPath) {
      return {
        success: true,
        audioPath,
      };
    }

    // Fallback to API-based TTS
    console.log(`⚠️  Voice server unavailable, using API fallback`);
    const apiResult = await synthesizeViaAPI(text, options);

    return apiResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Synthesis failed: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Try to use SAM voice server for TTS
 * Returns audio file path if successful, null otherwise
 */
async function tryVoiceServer(
  text: string,
  options?: {
    voiceId?: string;
    speed?: number;
    pitch?: number;
  }
): Promise<string | null> {
  try {
    // Check if voice server is available
    const healthCheck = await fetch(`${VOICE_SERVER_URL}/health`, {
      timeout: 2000,
    }).catch(() => null);

    if (!healthCheck || !healthCheck.ok) {
      console.log(`⚠️  Voice server not available`);
      return null;
    }

    console.log(`✓ Voice server available, synthesizing...`);

    // Send synthesis request
    const response = await fetch(`${VOICE_SERVER_URL}/synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voiceId: options?.voiceId || "Jessica", // Default to Jessica
        speed: options?.speed || 1.0,
        pitch: options?.pitch || 1.0,
      }),
      timeout: 30000,
    });

    if (!response.ok) {
      console.warn(
        `Voice server returned ${response.status}: ${response.statusText}`
      );
      return null;
    }

    // Save audio to temp file
    const audioBuffer = await response.arrayBuffer();
    const timestamp = Date.now();
    const audioPath = path.join(TEMP_DIR, `${timestamp}_response.mp3`);

    await fs.writeFile(audioPath, new Uint8Array(audioBuffer));

    console.log(`✅ Audio synthesized: ${audioPath}`);
    return audioPath;
  } catch (error) {
    console.log(`⚠️  Voice server error: ${error}`);
    return null;
  }
}

/**
 * Fallback TTS synthesis via API
 * Uses external TTS service (placeholder for future implementation)
 */
async function synthesizeViaAPI(
  text: string,
  options?: {
    voiceId?: string;
    speed?: number;
    pitch?: number;
  }
): Promise<SynthesisResult> {
  try {
    console.log(`🔊 Using API fallback for TTS...`);

    // TODO: Implement actual API TTS fallback (e.g., Google TTS, etc.)
    // Primary TTS is ChatterboxTTS via voice server at localhost:8888
    // For now, return a placeholder result
    console.warn(
      `⚠️  API TTS not yet implemented. Voice server required for Phase 7.`
    );

    return {
      success: false,
      error: "TTS API not configured. Please ensure voice server is running at localhost:8888",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if voice server is available
 */
export async function checkVoiceServer(): Promise<boolean> {
  try {
    const response = await fetch(`${VOICE_SERVER_URL}/health`, {
      timeout: 2000,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get voice server info (supported voices, models, etc.)
 */
export async function getVoiceServerInfo(): Promise<{
  available: boolean;
  voices?: string[];
  models?: string[];
  error?: string;
}> {
  try {
    const response = await fetch(`${VOICE_SERVER_URL}/info`, {
      timeout: 5000,
    });

    if (!response.ok) {
      return {
        available: false,
        error: `Server returned ${response.status}`,
      };
    }

    const info = await response.json();
    return {
      available: true,
      voices: info.voices,
      models: info.models,
    };
  } catch (error) {
    return {
      available: false,
      error: String(error),
    };
  }
}

/**
 * Clean up audio file
 */
export async function cleanupAudioFile(audioPath: string): Promise<boolean> {
  try {
    // Safety check: only delete files in audio temp directory
    if (!audioPath.startsWith(TEMP_DIR)) {
      console.warn(
        `⚠️  Attempted to delete file outside audio dir: ${audioPath}`
      );
      return false;
    }

    await fs.unlink(audioPath);
    console.log(`🗑️  Deleted audio: ${audioPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete audio ${audioPath}:`, error);
    return false;
  }
}

/**
 * Calculate estimated audio duration
 * Rough estimate: ~150 words per minute
 */
export function estimateAudioDuration(text: string): number {
  const wordCount = text.split(/\s+/).length;
  const wordsPerSecond = 150 / 60; // 150 WPM
  return Math.ceil(wordCount / wordsPerSecond);
}

/**
 * Check text length for TTS (some APIs have limits)
 */
export function validateTextLength(
  text: string,
  maxChars: number = 5000
): {
  valid: boolean;
  error?: string;
} {
  if (text.length === 0) {
    return { valid: false, error: "Text is empty" };
  }

  if (text.length > maxChars) {
    return {
      valid: false,
      error: `Text too long: ${text.length} chars > ${maxChars} chars`,
    };
  }

  return { valid: true };
}

/**
 * Chunk text into smaller pieces for TTS
 * Useful if text exceeds API limits
 */
export function chunkTextForTTS(text: string, chunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence + ". ";
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Get file size estimate for synthesized audio
 * Rough: MP3 at 128kbps ≈ 16KB per second
 */
export function estimateAudioFileSize(text: string): number {
  const durationSeconds = estimateAudioDuration(text);
  const bytesPerSecond = 16 * 1024; // 128kbps MP3
  return durationSeconds * bytesPerSecond;
}
