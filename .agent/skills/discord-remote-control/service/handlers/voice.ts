/**
 * Voice Handler - Phase 6 (Updated: whisper.cpp)
 * Handles voice messages (download, transcribe via whisper.cpp, process)
 * Phase 8: Added observability event logging
 */

import { Message } from "discord.js";
import {
  transcribeVoiceNote,
  formatTranscription,
  buildVoicePrompt,
  validateAudioFile,
} from "../media/transcribe.ts";
import {
  downloadAttachment,
  cleanupTempFile,
} from "../media/download.ts";
import { callClaude as callClaudeSubprocess } from "../claude/router.ts";
import { formatResponse } from "../claude/subprocess.ts";
import {
  getOrCreateSession,
  getSessionKey,
  incrementMessageCount,
} from "../claude/session.ts";
import {
  logMessageReceived,
  logVoiceTranscription,
  logSubprocessCall,
  logResponseSent,
  logError,
} from "../observability.ts";
import { sendVoiceResponse } from "../response/voice.ts";
import { notifyVoiceServer } from "../response/notify.ts";

interface DiscordConfig {
  botToken: string;
  guildId: string;
  channelId: string;
  allowedUserIds: string[];
  paiDir: string;
}

/**
 * Handle voice message attachment
 * Downloads .ogg file, transcribes via whisper.cpp, passes text to Claude
 */
export async function handleVoiceMessage(
  message: Message,
  config: DiscordConfig
): Promise<void> {
  const voiceMessage = message.attachments.find((att) =>
    (att.name || "").toLowerCase().endsWith(".ogg")
  );

  if (!voiceMessage) {
    console.warn("[VOICE HANDLER] No voice message found despite type detection");
    await message.reply("No voice message found.");
    return;
  }

  console.log(`[VOICE HANDLER] Processing: ${voiceMessage.name}`);

  let downloadedFile = null;

  try {
    // Step 1: Download voice note
    console.log(`Downloading voice note...`);
    downloadedFile = await downloadAttachment(voiceMessage);

    if (!downloadedFile) {
      await message.reply("Failed to download voice message. Please try again.");
      return;
    }

    // Step 2: Validate audio file
    console.log(`Validating audio...`);
    const validation = await validateAudioFile(downloadedFile.localPath);

    if (!validation.valid) {
      console.error("Audio validation failed:", validation.error);
      await message.reply("The audio file couldn't be processed. Please try sending it again.");
      return;
    }

    // Step 3: Transcribe with local whisper.cpp
    console.log(`Transcribing with whisper.cpp...`);

    const transcription = await transcribeVoiceNote(downloadedFile.localPath, {
      language: "en",
      includeMetadata: true,
    });

    if (!transcription.success) {
      const sessionKey = getSessionKey(message.author.id, message.channelId, message.channel.isDMBased());
      await logVoiceTranscription(sessionKey, 0, false);
      await logError(sessionKey, "transcription_failed", transcription.error || "Unknown error");
      console.error("Transcription failed:", transcription.error);
      await message.reply(
        "I couldn't transcribe your voice message. Please try again or send it as text."
      );
      return;
    }

    // Log successful transcription
    const sessionKey = getSessionKey(message.author.id, message.channelId, message.channel.isDMBased());
    await logMessageReceived(
      message.author.id,
      message.channelId,
      "voice",
      transcription.text || "",
      sessionKey
    );
    await logVoiceTranscription(
      sessionKey,
      transcription.duration || 0,
      true,
      "en"
    );

    // Step 4: Format transcript
    const transcript = formatTranscription(transcription.text || "");

    console.log(`Transcript: "${transcript.substring(0, 100)}..."`);

    // Step 5: Build voice prompt for Claude
    const userPrompt = buildVoicePrompt(transcript, message.content || undefined);

    // Step 6: Set up session
    const session = getOrCreateSession(
      sessionKey,
      message.author.id,
      message.channelId
    );
    const messageNum = incrementMessageCount(sessionKey);

    console.log(`Session: ${sessionKey} (message #${messageNum})`);

    // Step 7: Call Claude subprocess
    const response = await callClaudeSubprocess({
      sessionId: sessionKey,
      userId: message.author.id,
      channelId: message.channelId,
      userMessage: userPrompt,
      messageType: "voice",
      metadata: {
        username: message.author.username,
        attachmentCount: 1,
      },
    });

    if (!response.success) {
      await logError(sessionKey, "subprocess_failed", response.error || "Unknown error");
      await message.reply(
        "Sorry, I wasn't able to process your voice message. Please try again."
      );
      return;
    }

    // Log subprocess call
    await logSubprocessCall(
      sessionKey,
      response.tokens.input,
      response.tokens.output,
      response.duration
    );

    // Step 8: Send response using voice response handler (modality mirroring)
    const formatted = formatResponse(response.content);
    const voiceResult = await sendVoiceResponse(
      message,
      formatted,
      "voice",
      {
        voiceId: "Jessica",
        includeTranscript: false,
      }
    );

    // Log response sent
    await logResponseSent(
      message.author.id,
      message.channelId,
      voiceResult.voiceAttached ? "voice" : "text",
      voiceResult.voiceAttached,
      sessionKey
    );

    // Notify voice server for audible feedback (fire-and-forget)
    notifyVoiceServer(formatted).catch((err) =>
      console.warn(`⚠️  Voice notification failed: ${err}`)
    );

    console.log(
      `Voice response sent (${response.tokens.output} output tokens, ${response.duration}ms)`
    );

    // Step 9: Clean up temp file
    if (downloadedFile) {
      await cleanupTempFile(downloadedFile.localPath);
    }
  } catch (error) {
    console.error("Error in voice handler:", error);
    const sessionKey = getSessionKey(message.author.id, message.channelId, message.channel.isDMBased());
    await logError(sessionKey, "voice_handler_error", String(error));
    await message.reply(
      "Sorry, I encountered an error processing your voice message."
    );

    // Cleanup on error
    if (downloadedFile) {
      await cleanupTempFile(downloadedFile.localPath);
    }
  }
}

/**
 * Handle voice message with additional context
 */
export async function handleVoiceWithContext(
  message: Message,
  config: DiscordConfig,
  additionalContext?: string
): Promise<void> {
  await handleVoiceMessage(message, config);
}
