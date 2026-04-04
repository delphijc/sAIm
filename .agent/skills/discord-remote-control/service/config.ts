/**
 * Configuration for Discord Remote Control Service
 * Reads from environment variables in $PAI_DIR/.env
 */

export interface DiscordConfig {
  botToken: string;
  guildId: string;
  channelId: string;
  allowedUserIds: string[];
  paiDir: string;
  // Skills API configuration
  skillsApiEnabled: boolean;
  anthropicApiKey: string;
  skillsApiTimeout: number;
}

export class ConfigError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Configuration Error:\n${errors.map(e => `  - ${e}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

/**
 * Load and validate configuration from environment variables.
 * Throws ConfigError instead of calling process.exit (STA-014).
 * Handles allowedUserIds edge cases (STA-016).
 */
export function loadConfig(): DiscordConfig {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const allowedUserIds = process.env.DISCORD_ALLOWED_USER_IDS;
  const paiDir = process.env.PAI_DIR;
  const skillsApiEnabled = process.env.PAI_USE_SKILLS_API === "true";
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const skillsApiTimeout = parseInt(process.env.PAI_SKILLS_API_TIMEOUT ?? "120000", 10);

  const errors: string[] = [];

  if (!botToken) errors.push("DISCORD_BOT_TOKEN not set");
  if (!guildId) errors.push("DISCORD_GUILD_ID not set");
  if (!channelId) errors.push("DISCORD_CHANNEL_ID not set");
  if (!allowedUserIds) errors.push("DISCORD_ALLOWED_USER_IDS not set");
  if (!paiDir) errors.push("PAI_DIR not set");

  if (errors.length > 0) {
    throw new ConfigError(errors);
  }

  // STA-016: Parse allowedUserIds with edge case handling
  const parsedIds = allowedUserIds!
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && /^\d+$/.test(id)); // Only numeric Discord snowflake IDs

  // Deduplicate
  const uniqueIds = [...new Set(parsedIds)];

  if (uniqueIds.length === 0) {
    throw new ConfigError(["DISCORD_ALLOWED_USER_IDS contains no valid user IDs"]);
  }

  return {
    botToken: botToken!,
    guildId: guildId!,
    channelId: channelId!,
    allowedUserIds: uniqueIds,
    paiDir: paiDir!,
    skillsApiEnabled,
    anthropicApiKey,
    skillsApiTimeout,
  };
}

// Lazy singleton — only created when first accessed, not at import time (STA-014)
let _config: DiscordConfig | null = null;

export function getConfig(): DiscordConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

export default { loadConfig, getConfig, ConfigError };
