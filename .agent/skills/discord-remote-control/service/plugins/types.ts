/**
 * Plugin System Types
 *
 * Defines the contract that all Discord message handler plugins must implement.
 * Plugins get first crack at messages before the default Claude subprocess handler.
 */

import type { Message } from "discord.js";

export interface DiscordConfig {
  botToken: string;
  guildId: string;
  channelId: string;
  allowedUserIds: string[];
  paiDir: string;
  skillsApiEnabled: boolean;
  anthropicApiKey: string;
  skillsApiTimeout: number;
}

export interface MessageContext {
  isDM: boolean;
  messageType: "text" | "image" | "file" | "voice" | "mixed";
  hasAttachments: boolean;
  attachmentCount: number;
  contentPreview: string;
}

/**
 * Result returned by a plugin after handling a message.
 */
export interface PluginResult {
  /** Whether the plugin handled the message (true = skip default handler) */
  handled: boolean;
  /** Optional response text to send back to Discord */
  response?: string;
  /** Whether response was already sent by the plugin itself */
  responseSent?: boolean;
  /** Optional file paths to attach to the Discord response */
  fileAttachments?: Array<{ path: string; name: string }>;
}

/**
 * The interface every plugin must implement.
 */
export interface Plugin {
  /** Unique plugin identifier */
  name: string;

  /** Human-readable description */
  description: string;

  /** Semver version string */
  version: string;

  /**
   * Priority (lower = checked first). Default: 100.
   * Core plugins use 0-49, user plugins use 50-99, default handler is 1000.
   */
  priority: number;

  /**
   * Determine if this plugin should handle the incoming message.
   * Must be fast — no I/O or LLM calls here.
   */
  canHandle(message: Message, context: MessageContext): boolean;

  /**
   * Handle the message. Called only if canHandle() returned true.
   * The plugin is responsible for sending the response to Discord.
   */
  handle(message: Message, config: DiscordConfig, context: MessageContext): Promise<PluginResult>;

  /** Called once when the plugin is loaded into the registry */
  onLoad?(): Promise<void>;

  /** Called when the plugin is unloaded or the service shuts down */
  onUnload?(): Promise<void>;
}
