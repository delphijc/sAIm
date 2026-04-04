/**
 * Voice Response Handler - Phase 7
 * Sends voice responses back to Discord (modality mirroring)
 * Phase 9: Integrated response chunking for long messages
 */

import { Message, AttachmentBuilder } from "discord.js";
import {
  synthesizeText,
  cleanupAudioFile,
  checkVoiceServer,
  estimateAudioDuration,
  validateTextLength,
} from "../media/synthesize.ts";
import { chunkResponse } from "./chunker.ts";

/**
 * Determine if we should respond with voice
 * Modality mirroring: if user sent voice, try to respond with voice
 */
export function shouldRespondWithVoice(messageType: string): boolean {
  return messageType === "voice";
}

/**
 * Send text response with optional voice attachment
 *
 * If user sent a voice message, tries to respond with voice (modality mirroring)
 * Phase 9: Chunks long responses at natural boundaries
 */
export async function sendVoiceResponse(
  message: Message,
  responseText: string,
  messageType: string,
  options?: {
    voiceId?: string;
    includeTranscript?: boolean; // Also include text in message?
    fileAttachments?: Array<{ path: string; name: string }>; // Optional file attachments
  }
): Promise<{
  success: boolean;
  voiceAttached: boolean;
  error?: string;
}> {
  // Validate input
  const trimmed = responseText?.trim();
  if (!trimmed) {
    return { success: false, voiceAttached: false, error: "Empty response" };
  }

  // Phase 9: Chunk long responses (declared outside try for catch fallback)
  const chunks = chunkResponse(responseText, {
    maxChars: 2000,
    strategy: "paragraph",
  });

  try {
    // Check if we should respond with voice
    const shouldVoice = shouldRespondWithVoice(messageType);

    if (!shouldVoice) {
      // Not a voice message, just send text chunks
      // Build file attachment builders if provided
      const fileBuilders = options?.fileAttachments?.map(f => ({
        attachment: f.path,
        name: f.name,
      })) || [];

      for (let i = 0; i < chunks.length; i++) {
        const replyOpts: any = { content: chunks[i] };

        // Attach files to the first message only
        if (i === 0 && fileBuilders.length > 0) {
          replyOpts.files = fileBuilders;
        }

        await message.reply(replyOpts);

        // Small delay between messages to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return {
        success: true,
        voiceAttached: false,
      };
    }

    // User sent voice - try to respond with voice (modality mirroring)
    console.log(`🎤 Attempting voice response (modality mirroring)...`);

    // For voice responses, only synthesize first chunk to avoid long audio files
    const firstChunk = chunks[0];

    // Validate first chunk for TTS
    const validation = validateTextLength(firstChunk);
    if (!validation.valid) {
      console.warn(`⚠️  First chunk too long for TTS: ${validation.error}`);
      // Send all chunks as text fallback
      for (let i = 0; i < chunks.length; i++) {
        await message.reply({
          content: chunks[i],
        });
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return {
        success: true,
        voiceAttached: false,
      };
    }

    // Check if voice server is available
    const serverAvailable = await checkVoiceServer();
    if (!serverAvailable) {
      console.warn(
        `⚠️  Voice server not available, sending text response only`
      );
      // Send all chunks as text
      for (let i = 0; i < chunks.length; i++) {
        await message.reply({
          content: chunks[i],
        });
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return {
        success: true,
        voiceAttached: false,
      };
    }

    // Synthesize first chunk to speech
    console.log(`🔊 Synthesizing first chunk to speech...`);
    const synthesis = await synthesizeText(firstChunk, {
      voiceId: options?.voiceId || "Jessica",
    });

    if (!synthesis.success) {
      console.warn(`⚠️  Synthesis failed: ${synthesis.error}`);
      // Send all chunks as text fallback
      for (let i = 0; i < chunks.length; i++) {
        await message.reply({
          content: chunks[i],
        });
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return {
        success: true,
        voiceAttached: false,
      };
    }

    // Send first message with voice attachment
    console.log(`📤 Sending voice response to Discord...`);

    const audioAttachment = new AttachmentBuilder(synthesis.audioPath!, {
      name: "response.mp3",
    });

    let messageContent = firstChunk;

    // Optionally include transcript with voice
    if (options?.includeTranscript) {
      messageContent = `**Audio Response:**\n\n${firstChunk}`;
    }

    await message.reply({
      content: messageContent,
      files: [audioAttachment],
    });

    // Clean up temp audio file
    if (synthesis.audioPath) {
      await cleanupAudioFile(synthesis.audioPath);
    }

    console.log(`✅ Voice response sent with mp3 attachment`);

    // Send remaining chunks as text
    for (let i = 1; i < chunks.length; i++) {
      await message.reply({
        content: chunks[i],
      });

      // Small delay between messages to respect rate limits
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return {
      success: true,
      voiceAttached: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error sending voice response:", errorMessage);

    // Fallback to text chunks
    try {
      for (let i = 0; i < chunks.length; i++) {
        await message.reply({
          content: chunks[i],
        });
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } catch (replyError) {
      console.error("Failed to send fallback text response:", replyError);
    }

    return {
      success: false,
      voiceAttached: false,
      error: errorMessage,
    };
  }
}

/**
 * Stream voice synthesis for long responses
 * Breaks response into chunks if needed for better UX
 */
export async function sendChunkedVoiceResponse(
  message: Message,
  responseChunks: string[],
  messageType: string,
  options?: {
    voiceId?: string;
  }
): Promise<{
  success: boolean;
  chunksProcessed: number;
  error?: string;
}> {
  const shouldVoice = shouldRespondWithVoice(messageType);

  if (!shouldVoice) {
    // Just send text chunks
    for (const chunk of responseChunks) {
      await message.reply({ content: chunk });
    }

    return {
      success: true,
      chunksProcessed: responseChunks.length,
    };
  }

  // Send voice for first chunk, text for rest (to avoid spam)
  let processed = 0;

  for (let i = 0; i < responseChunks.length; i++) {
    const chunk = responseChunks[i];

    if (i === 0) {
      // First chunk: try voice
      const result = await sendVoiceResponse(message, chunk, messageType, {
        voiceId: options?.voiceId,
        includeTranscript: false,
      });

      if (result.success) {
        processed++;
      }
    } else {
      // Subsequent chunks: text only (to prevent audio spam)
      try {
        await message.reply({ content: chunk });
        processed++;
      } catch (error) {
        console.error("Failed to send chunk:", error);
      }
    }

    // Small delay between messages
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    success: processed === responseChunks.length,
    chunksProcessed: processed,
  };
}

/**
 * Get voice response statistics
 */
export function getVoiceStats(responseText: string): {
  characters: number;
  estimatedDuration: number;
  estimatedFileSize: number;
} {
  const estimatedDuration = estimateAudioDuration(responseText);
  const estimatedFileSize = estimatedDuration * 16 * 1024; // 128kbps MP3

  return {
    characters: responseText.length,
    estimatedDuration,
    estimatedFileSize,
  };
}
