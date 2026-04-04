/**
 * Discord.js Client Setup
 * Initializes bot with required intents and event handlers
 */

import { Client, GatewayIntentBits, Partials } from "discord.js";
import { getConfig } from "./config.ts";
const config = getConfig();

export function createBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, // Required to read message content
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel], // Required for DM handling
  });

  // Event: Bot Ready
  client.once("ready", () => {
    if (client.user) {
      console.log(`✅ Bot logged in as ${client.user.tag}`);
      console.log(`📡 Listening for messages in:`);
      console.log(`   - Guild ID: ${config.guildId}`);
      console.log(`   - Channel ID: ${config.channelId}`);
      console.log(`   - DMs from allowed users: ${config.allowedUserIds.join(", ")}`);
    }
  });

  // Event: Error handling
  client.on("error", (error) => {
    console.error("❌ Discord Client Error:", error);
  });

  client.on("warn", (warning) => {
    console.warn("⚠️  Discord Client Warning:", warning);
  });

  return client;
}
