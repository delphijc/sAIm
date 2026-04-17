/**
 * Discord Remote Control Service - Entry Point
 * Starts bot, registers event handlers, manages lifecycle
 *
 * STANDALONE MODE ONLY
 * The memory-system is now a separate, independent project
 * See: https://github.com/your-org/memory-system
 *
 * This service:
 * - Connects to Discord via discord.js
 * - Routes messages to Claude Code subprocess via Agent SDK
 * - Stores conversation history locally (SQLite at $PAI_DIR/discord-remote-control/)
 * - Runs on macOS (launchd) and Linux (systemd)
 */

const { getConfig } = await import("./config.ts");
const config = getConfig();
const { createBot } = await import("./bot.ts");
const { handleMessage } = await import("./router.ts");
const {
  performStartupHealthChecks,
  verifyDiscordConnection,
  verifyEnvironmentVariables,
} = await import("./health.ts");
const {
  startSessionCleanupTimer,
  stopSessionCleanupTimer,
} = await import("./claude/session.ts");

// Startup sequence
console.log("🚀 Starting Discord Remote Control Service (Standalone)...\n");

// Step 1: Verify environment variables
const envValid = await verifyEnvironmentVariables();
if (!envValid) {
  console.error("\n❌ Cannot start: Missing environment variables");
  process.exit(1);
}

console.log("");

// Step 2: Perform health checks
await performStartupHealthChecks();

// Step 3: Load plugins
const { loadPlugins } = await import("./plugins/loader.ts");
await loadPlugins();

// Step 4: Create Discord client
const bot = createBot();

// Step 5: Handle ready event with connection verification
bot.once("ready", async () => {
  const connected = await verifyDiscordConnection(bot);
  if (!connected) {
    console.error("\n❌ Failed to verify Discord connection");
    process.exit(1);
  }
  startSessionCleanupTimer();
  console.log("✅ All systems ready!\n");
  console.log("📡 Service running. Press Ctrl+C to stop.\n");
});

// Event: Message Create (handles all incoming messages)
bot.on("messageCreate", async (message) => {
  try {
    // Ignore bot's own messages
    if (message.author.bot) return;

    // Route message to appropriate handler
    await handleMessage(message, config);
  } catch (error) {
    console.error("❌ Error processing message:", error);
    if (message.inGuild()) {
      try {
        await message.reply({
          content: "Sorry, an error occurred while processing your message.",
        });
      } catch (replyError) {
        console.error("Failed to send error message:", replyError);
      }
    }
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  try {
    const { pluginRegistry } = await import("./plugins/registry.ts");
    await pluginRegistry.unloadAll();
    stopSessionCleanupTimer();
    await bot.destroy();
    console.log("✅ Bot disconnected");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

// Login to Discord
await bot.login(config.botToken);
