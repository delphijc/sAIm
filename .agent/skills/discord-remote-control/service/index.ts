/**
 * Discord Remote Control Service - Entry Point
 * Starts bot, registers event handlers, manages lifecycle
 * Phase 8: Added health checks and observability integration
 *
 * Modes:
 *   --memory-only  Start only the HTTP memory server (port 4242)
 *                  for cross-modality memory extraction (CLI, headless, etc.)
 */

import { initializeMemory } from "./memory/db.ts";

// Check for --memory-only mode (used by start-memory.sh)
const isMemoryOnly = process.argv.includes("--memory-only");

if (isMemoryOnly) {
  // Memory-only mode: just start the HTTP memory server
  // Only requires PAI_DIR (no Discord env vars needed)
  const paiDir = process.env.PAI_DIR;
  if (!paiDir) {
    console.error("❌ PAI_DIR not set. Cannot start memory server.");
    process.exit(1);
  }

  console.log("🧠 Starting Memory Server (standalone mode)...\n");

  try {
    await initializeMemory({ paiDir });
    console.log("✅ Memory database initialized");
  } catch (error) {
    console.error("❌ Failed to initialize memory database:", error);
    process.exit(1);
  }

  const { startMemoryServer } = await import("./memory/memory-server.ts");
  await startMemoryServer();

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down memory server...");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    console.log("\n🛑 Shutting down memory server...");
    process.exit(0);
  });
} else {
  // Full Discord bot mode — lazy-load config and Discord deps
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
  console.log("🚀 Starting Discord Remote Control Service...\n");

  // Step 1: Verify environment variables
  const envValid = await verifyEnvironmentVariables();
  if (!envValid) {
    console.error("\n❌ Cannot start: Missing environment variables");
    process.exit(1);
  }

  console.log("");

  // Step 2: Perform health checks
  await performStartupHealthChecks();

  // Step 3: Initialize memory database
  try {
    await initializeMemory({ paiDir: config.paiDir });
  } catch (error) {
    console.error("❌ Failed to initialize memory database:", error);
    process.exit(1);
  }

  // Step 3b: Start memory server (in background, alongside Discord bot)
  const { startMemoryServer } = await import("./memory/memory-server.ts");
  startMemoryServer().catch((error) => {
    console.error("❌ Memory server failed to start:", error);
  });

  // Step 4: Load plugins
  const { loadPlugins } = await import("./plugins/loader.ts");
  await loadPlugins();

  // Step 5: Create Discord client
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
}
