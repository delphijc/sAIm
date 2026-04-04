/**
 * Message Router - Phase 2
 * Routes incoming messages to appropriate handlers with access control
 */

import { Message } from "discord.js";
import { handleTextMessage } from "./handlers/text.ts";
import { handleImageMessage, handleFileMessage, handleMixedMessage } from "./handlers/media.ts";
import { handleVoiceMessage } from "./handlers/voice.ts";
import { logDiscordEvent } from "./observability.ts";
import { pluginRegistry } from "./plugins/registry.ts";
import type { MessageContext as PluginMessageContext } from "./plugins/types.ts";

// ============================================================================
// RATE LIMITING
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 5;   // max messages per window

/** Sliding window rate limiter per user */
const userMessageTimestamps = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = userMessageTimestamps.get(userId) || [];

  // Remove timestamps outside the window
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX_MESSAGES) {
    userMessageTimestamps.set(userId, recent);
    return true;
  }

  recent.push(now);
  userMessageTimestamps.set(userId, recent);
  return false;
}

interface DiscordConfig {
  botToken: string;
  guildId: string;
  channelId: string;
  allowedUserIds: string[];
  paiDir: string;
}

interface MessageContext {
  isDM: boolean;
  messageType: "text" | "image" | "file" | "voice" | "mixed";
  hasAttachments: boolean;
  attachmentCount: number;
  contentPreview: string;
}

/**
 * Analyze incoming message and determine context
 */
function analyzeMessage(message: Message): MessageContext {
  const isDM = message.channel.isDMBased();

  let messageType: "text" | "image" | "file" | "voice" | "mixed" = "text";
  let hasAttachments = false;
  let attachmentCount = 0;

  // Check for attachments
  if (message.attachments.size > 0) {
    hasAttachments = true;
    attachmentCount = message.attachments.size;

    // Detect attachment types
    const attachments = Array.from(message.attachments.values());
    const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    const voiceExts = [".ogg", ".mp3", ".wav", ".m4a"];
    const documentExts = [".pdf", ".txt", ".doc", ".docx", ".xlsx", ".csv"];

    let hasImages = false;
    let hasVoice = false;
    let hasFiles = false;

    for (const attachment of attachments) {
      const ext = (attachment.name || "").toLowerCase();
      if (imageExts.some((e) => ext.endsWith(e))) {
        hasImages = true;
      } else if (voiceExts.some((e) => ext.endsWith(e))) {
        hasVoice = true;
      } else {
        hasFiles = true;
      }
    }

    // Determine primary message type
    if (hasVoice && (hasImages || hasFiles || message.content)) {
      messageType = "mixed";
    } else if (hasVoice) {
      messageType = "voice";
    } else if (hasImages && (hasFiles || message.content)) {
      messageType = "mixed";
    } else if (hasImages) {
      messageType = "image";
    } else if (hasFiles && message.content) {
      messageType = "mixed";
    } else if (hasFiles) {
      messageType = "file";
    }
  }

  const contentPreview = message.content
    ? message.content.substring(0, 80) + (message.content.length > 80 ? "..." : "")
    : `[${attachmentCount} attachment${attachmentCount !== 1 ? "s" : ""}]`;

  return {
    isDM,
    messageType,
    hasAttachments,
    attachmentCount,
    contentPreview,
  };
}

/**
 * Main message handler with access control and routing
 */
export async function handleMessage(
  message: Message,
  config: DiscordConfig
): Promise<void> {
  const context = analyzeMessage(message);

  // Log all incoming messages (for observability)
  const channelInfo = context.isDM ? "DM" : `#${message.channel.isDMBased() ? "unknown" : message.channelId}`;
  console.log(
    `📨 [${context.messageType.toUpperCase()}] ${message.author.username} (${channelInfo}): ${context.contentPreview}`
  );

  // ======== ACCESS CONTROL ========
  // Check if user is authorized
  if (!config.allowedUserIds.includes(message.author.id)) {
    console.log(`🚫 BLOCKED: User ${message.author.id} not in allowlist`);
    await logDiscordEvent("DiscordAccessDenied", {
      reason: "user_not_in_allowlist",
      userId: message.author.id,
      username: message.author.username,
    });
    return; // Silent rejection
  }

  // Check if channel is authorized
  if (!context.isDM) {
    // Guild message - check guild and channel
    if (!message.guildId || message.guildId !== config.guildId) {
      console.log(`🚫 BLOCKED: Wrong guild (${message.guildId} != ${config.guildId})`);
      return; // Silent rejection
    }

    if (message.channelId !== config.channelId) {
      console.log(
        `🚫 BLOCKED: Wrong channel (${message.channelId} != ${config.channelId})`
      );
      return; // Silent rejection
    }
  }

  // ======== AUTHORIZATION PASSED ========

  // Rate limit check
  if (isRateLimited(message.author.id)) {
    console.log(`Rate limited: ${message.author.username} (${message.author.id})`);
    await logDiscordEvent("DiscordRateLimited", {
      userId: message.author.id,
      username: message.author.username,
    });
    await message.reply("You're sending messages too quickly. Please wait a moment.");
    return;
  }

  console.log(`AUTHORIZED: ${message.author.username}`);

  // Show typing indicator
  try {
    await message.channel.sendTyping();
    console.log(`⌨️  Typing indicator sent`);
  } catch (error) {
    console.error("Failed to send typing indicator:", error);
  }

  // ======== PLUGIN DISPATCH ========
  // Plugins get first crack at the message before default handlers
  try {
    const pluginContext: PluginMessageContext = {
      isDM: context.isDM,
      messageType: context.messageType,
      hasAttachments: context.hasAttachments,
      attachmentCount: context.attachmentCount,
      contentPreview: context.contentPreview,
    };

    const pluginResult = await pluginRegistry.tryHandle(message, config as any, pluginContext);
    if (pluginResult?.handled) {
      console.log(`🔌 Message handled by plugin`);
      if (pluginResult.response && !pluginResult.responseSent) {
        // Send response with optional file attachments
        if (pluginResult.fileAttachments && pluginResult.fileAttachments.length > 0) {
          await message.reply({
            content: pluginResult.response,
            files: pluginResult.fileAttachments.map(f => ({
              attachment: f.path,
              name: f.name,
            })),
          });
        } else {
          await message.reply(pluginResult.response);
        }
      } else if (!pluginResult.responseSent && pluginResult.fileAttachments && pluginResult.fileAttachments.length > 0) {
        // File attachments only, no text response
        await message.channel.send({
          files: pluginResult.fileAttachments.map(f => ({
            attachment: f.path,
            name: f.name,
          })),
        });
      }
      return;
    }
  } catch (error) {
    console.error("Error in plugin dispatch:", error);
    // Fall through to default handlers on plugin error
  }

  // ======== DEFAULT MESSAGE ROUTING ========
  try {
    switch (context.messageType) {
      case "text":
        await handleTextMessage(message, config);
        break;

      case "image":
        await handleImageMessage(message, config);
        break;

      case "file":
        await handleFileMessage(message, config);
        break;

      case "voice":
        await handleVoiceMessage(message, config);
        break;

      case "mixed":
        await handleMixedMessage(message, config);
        break;

      default:
        console.warn(`Unknown message type: ${context.messageType}`);
    }
  } catch (error) {
    console.error("Error routing message:", error);
    await logDiscordEvent("DiscordError", {
      type: "routing_error",
      messageType: context.messageType,
      error: String(error),
    });
    try {
      await message.reply({
        content: "Sorry, I encountered an error processing your message.",
      });
    } catch (replyError) {
      console.error("Failed to send error reply:", replyError);
    }
  }
}
