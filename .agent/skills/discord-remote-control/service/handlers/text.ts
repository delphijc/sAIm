/**
 * Text Message Handler - Phase 4
 * Handles plain text messages and routes to Claude subprocess
 * Phase 8: Added observability event logging
 */

import { Message } from "discord.js";
import { callClaude as callClaudeSubprocess } from "../claude/router.ts";
import { formatResponse } from "../claude/subprocess.ts";
import {
  getOrCreateSession,
  getSessionKey,
  incrementMessageCount,
  setLastAssistantMessage,
} from "../claude/session.ts";
import { logMessageReceived, logResponseSent, logSubprocessCall, logError } from "../observability.ts";
import { sendVoiceResponse } from "../response/voice.ts";
import { enqueueVoiceNotification, getVoiceQueueStatus } from "../response/voice-queue.ts";
import { captureDiscordConversation } from "../capture/discord-conversation.ts";

interface DiscordConfig {
  botToken: string;
  guildId: string;
  channelId: string;
  allowedUserIds: string[];
  paiDir: string;
}

/**
 * Handle incoming text message
 * Phase 4: Routes to Claude subprocess with memory injection
 */
export async function handleTextMessage(
  message: Message,
  config: DiscordConfig
): Promise<void> {
  console.log(
    `[TEXT HANDLER] Processing: "${message.content.substring(0, 50)}..."`
  );

  try {
    // Set up session
    const isDM = message.channel.isDMBased();
    const sessionKey = getSessionKey(message.author.id, message.channelId, isDM);
    const session = getOrCreateSession(
      sessionKey,
      message.author.id,
      message.channelId
    );
    const messageNum = incrementMessageCount(sessionKey);

    console.log(`📊 Session: ${sessionKey} (message #${messageNum})`);

    // Log message received
    await logMessageReceived(
      message.author.id,
      message.channelId,
      "text",
      message.content,
      sessionKey
    );

    // Call Claude subprocess
    const response = await callClaudeSubprocess({
      sessionId: sessionKey,
      userId: message.author.id,
      channelId: message.channelId,
      userMessage: message.content,
      messageType: "text",
      metadata: {
        username: message.author.username,
      },
    });

    if (!response.success) {
      await logError(sessionKey, "subprocess_failed", response.error || "Unknown error");
      await message.reply(
        `[DEBUG] Subprocess failed: ${response.error || "Unknown error"}`
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

    // Format and send response
    const formatted = formatResponse(response.content);

    if (!formatted || formatted.trim().length === 0) {
      console.warn(`⚠️  Claude returned empty response after ${response.duration}ms`);
      await message.reply(
        `[DEBUG] Claude returned empty response (${response.duration}ms, exit 0, ${response.tokens.output} tokens)`
      );
      return;
    }

    // Phase 7: Use voice response handler for modality mirroring
    // Phase 10: Pass file attachments from subprocess to Discord
    await sendVoiceResponse(message, formatted, "text", {
      voiceId: "Jessica",
      includeTranscript: false,
      ...(response.fileAttachments && { fileAttachments: response.fileAttachments }),
    });

    // Store the assistant message in session for context on next user message
    setLastAssistantMessage(sessionKey, formatted);

    // Log response sent
    await logResponseSent(
      message.author.id,
      message.channelId,
      "text",
      false,
      sessionKey
    );

    // Capture conversation for episodic memory (Phase 1)
    // Non-blocking: log warning if capture fails, don't interrupt message handling
    try {
      await captureDiscordConversation(
        message.content,
        formatted,
        {
          sessionId: sessionKey,
          userId: message.author.id,
          channelId: message.channelId,
          username: message.author.username,
          messageId: message.id,
          threadId: message.thread?.id,
        }
      );
    } catch (captureError) {
      console.warn(`⚠️  Failed to capture Discord conversation: ${captureError}`);
    }

    // Enqueue voice notification for sequential playback
    // Uses voice queue to prevent messages from overlapping/squashing
    enqueueVoiceNotification(formatted, sessionKey).catch((err) =>
      console.warn(`⚠️  Voice notification queueing failed: ${err}`)
    );

    console.log(
      `✅ Text response sent (${response.tokens.output} output tokens, ${response.duration}ms)`
    );
  } catch (error) {
    console.error("Error in text handler:", error);
    const sessionKey = getSessionKey(message.author.id, message.channelId, message.channel.isDMBased());
    await logError(sessionKey, "text_handler_error", String(error));
    await message.reply(
      "Sorry, I encountered an error processing your message."
    );
  }
}

