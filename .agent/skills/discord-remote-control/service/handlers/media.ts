/**
 * Media Handler - Phase 5
 * Handles images and files (download from CDN, pass to Claude)
 * Phase 7: Integrated voice response handler for modality support
 */

import { Message } from "discord.js";
import {
  downloadAttachments,
  cleanupTempFiles,
  isAttachmentSupported,
  getFileInfo,
} from "../media/download.ts";
import { callClaude as callClaudeSubprocess } from "../claude/router.ts";
import { formatResponse } from "../claude/subprocess.ts";
import {
  getOrCreateSession,
  getSessionKey,
  incrementMessageCount,
} from "../claude/session.ts";
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
 * Handle image attachments
 * Downloads images to temp, passes paths to Claude
 */
export async function handleImageMessage(
  message: Message,
  config: DiscordConfig
): Promise<void> {
  const imageAttachments = message.attachments.filter(
    (att) =>
      att.contentType?.startsWith("image/") || att.name?.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i)
  );

  console.log(`[IMAGE HANDLER] Processing ${imageAttachments.size} image(s)`);

  try {
    // Download images
    const downloaded = await downloadAttachments(Array.from(imageAttachments.values()));

    if (downloaded.length === 0) {
      await message.reply("❌ Failed to download images. Please try again.");
      return;
    }

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

    // Build prompt with image context
    let userPrompt = message.content || `[${downloaded.length} image(s) attached]`;

    if (!message.content) {
      userPrompt = `Please analyze these ${downloaded.length} image(s): ${downloaded
        .map((d) => d.originalName)
        .join(", ")}`;
    }

    // Add file paths for Claude to reference
    userPrompt += `\n\n**Image files:**\n${downloaded
      .map((d) => `- \`${d.localPath}\` (${d.originalName})`)
      .join("\n")}`;

    // Call Claude subprocess
    const response = await callClaudeSubprocess({
      sessionId: sessionKey,
      userId: message.author.id,
      channelId: message.channelId,
      userMessage: userPrompt,
      messageType: "image",
      attachmentPaths: downloaded.map((d) => d.localPath),
      metadata: {
        username: message.author.username,
        attachmentCount: downloaded.length,
      },
    });

    if (!response.success) {
      console.error("Image subprocess failed:", response.error);
      await message.reply(
        "Sorry, I wasn't able to process your images. Please try again."
      );
      return;
    }

    // Send response using voice response handler (supports modality mirroring)
    // Phase 10: Pass file attachments from subprocess to Discord
    const formatted = formatResponse(response.content);
    await sendVoiceResponse(message, formatted, "image", {
      voiceId: "Jessica",
      includeTranscript: false,
      ...(response.fileAttachments && { fileAttachments: response.fileAttachments }),
    });

    // Notify voice server for audible feedback (fire-and-forget)
    notifyVoiceServer(formatted).catch((err) =>
      console.warn(`⚠️  Voice notification failed: ${err}`)
    );

    // Cleanup temp files
    await cleanupTempFiles(downloaded.map((d) => d.localPath));

    console.log(
      `✅ Image response sent (${response.tokens.output} output tokens, ${response.duration}ms)`
    );
  } catch (error) {
    console.error("Error in image handler:", error);
    await message.reply("Sorry, I encountered an error processing your images.");
  }
}

/**
 * Handle file attachments
 * Downloads files to temp, passes paths to Claude
 */
export async function handleFileMessage(
  message: Message,
  config: DiscordConfig
): Promise<void> {
  const fileAttachments = message.attachments.filter((att) => {
    const info = getFileInfo(att);
    return info.type !== "unknown";
  });

  console.log(`[FILE HANDLER] Processing ${fileAttachments.size} file(s)`);

  try {
    // Download files
    const downloaded = await downloadAttachments(Array.from(fileAttachments.values()));

    if (downloaded.length === 0) {
      await message.reply("❌ Failed to download files. Please try again.");
      return;
    }

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

    // Build prompt with file context
    let userPrompt = message.content || `[${downloaded.length} file(s) attached]`;

    if (!message.content) {
      userPrompt = `Please process these ${downloaded.length} file(s): ${downloaded
        .map((d) => d.originalName)
        .join(", ")}`;
    }

    // Add file paths for Claude to reference
    userPrompt += `\n\n**Files:**\n${downloaded
      .map(
        (d) =>
          `- \`${d.localPath}\` (${d.originalName}, ${d.type}, ${(d.size / 1024).toFixed(2)}KB)`
      )
      .join("\n")}`;

    // Call Claude subprocess
    const response = await callClaudeSubprocess({
      sessionId: sessionKey,
      userId: message.author.id,
      channelId: message.channelId,
      userMessage: userPrompt,
      messageType: "file",
      attachmentPaths: downloaded.map((d) => d.localPath),
      metadata: {
        username: message.author.username,
        attachmentCount: downloaded.length,
      },
    });

    if (!response.success) {
      console.error("File subprocess failed:", response.error);
      await message.reply(
        "Sorry, I wasn't able to process your files. Please try again."
      );
      return;
    }

    // Send response using voice response handler (supports modality mirroring)
    // Phase 10: Pass file attachments from subprocess to Discord
    const formatted = formatResponse(response.content);
    await sendVoiceResponse(message, formatted, "file", {
      voiceId: "Jessica",
      includeTranscript: false,
      ...(response.fileAttachments && { fileAttachments: response.fileAttachments }),
    });

    // Notify voice server for audible feedback (fire-and-forget)
    notifyVoiceServer(formatted).catch((err) =>
      console.warn(`⚠️  Voice notification failed: ${err}`)
    );

    // Cleanup temp files
    await cleanupTempFiles(downloaded.map((d) => d.localPath));

    console.log(
      `✅ File response sent (${response.tokens.output} output tokens, ${response.duration}ms)`
    );
  } catch (error) {
    console.error("Error in file handler:", error);
    await message.reply(
      "Sorry, I encountered an error processing your files."
    );
  }
}

/**
 * Handle mixed messages (text + images/files)
 */
export async function handleMixedMessage(
  message: Message,
  config: DiscordConfig
): Promise<void> {
  const attachments = Array.from(message.attachments.values());

  console.log(
    `[MIXED HANDLER] Processing text + ${attachments.length} attachment(s)`
  );

  try {
    // Download all attachments
    const downloaded = await downloadAttachments(attachments);

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

    // Build prompt with text and file context
    let userPrompt = message.content;

    if (downloaded.length > 0) {
      userPrompt += `\n\n**Attachments (${downloaded.length}):**\n${downloaded
        .map(
          (d) =>
            `- \`${d.localPath}\` (${d.originalName}, ${d.type}, ${(d.size / 1024).toFixed(2)}KB)`
        )
        .join("\n")}`;
    }

    // Call Claude subprocess
    const response = await callClaudeSubprocess({
      sessionId: sessionKey,
      userId: message.author.id,
      channelId: message.channelId,
      userMessage: userPrompt,
      messageType: "mixed",
      attachmentPaths: downloaded.map((d) => d.localPath),
      metadata: {
        username: message.author.username,
        attachmentCount: downloaded.length,
      },
    });

    if (!response.success) {
      console.error("Mixed subprocess failed:", response.error);
      await message.reply(
        "Sorry, I wasn't able to process your message. Please try again."
      );
      return;
    }

    // Send response using voice response handler (supports modality mirroring)
    // Phase 10: Pass file attachments from subprocess to Discord
    const formatted = formatResponse(response.content);
    await sendVoiceResponse(message, formatted, "mixed", {
      voiceId: "Jessica",
      includeTranscript: false,
      ...(response.fileAttachments && { fileAttachments: response.fileAttachments }),
    });

    // Notify voice server for audible feedback (fire-and-forget)
    notifyVoiceServer(formatted).catch((err) =>
      console.warn(`⚠️  Voice notification failed: ${err}`)
    );

    // Cleanup temp files
    await cleanupTempFiles(downloaded.map((d) => d.localPath));

    console.log(
      `✅ Mixed response sent (${response.tokens.output} output tokens, ${response.duration}ms)`
    );
  } catch (error) {
    console.error("Error in mixed handler:", error);
    await message.reply("Sorry, I encountered an error processing your message.");
  }
}
