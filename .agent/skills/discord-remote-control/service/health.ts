/**
 * Health Check Utility - Phase 8
 * Pre-flight health checks for all external services
 */

import {
  performHealthCheck,
  logDiscordEvent,
} from "./observability.ts";

interface StartupCheckResult {
  ready: boolean;
  checks: {
    service: string;
    status: "healthy" | "unhealthy";
    details?: string;
  }[];
  warnings: string[];
}

/**
 * Perform pre-flight health checks
 * Warns if services are unavailable but doesn't block startup
 */
export async function performStartupHealthChecks(): Promise<StartupCheckResult> {
  console.log(
    "🔍 Performing pre-flight health checks...\n"
  );

  const checks = await performHealthCheck();

  const warnings: string[] = [];
  let allHealthy = true;

  for (const check of checks) {
    const icon = check.status === "healthy" ? "✅" : "⚠️ ";
    console.log(
      `${icon} ${check.service.toUpperCase()}: ${check.status}${
        check.details ? ` (${check.details})` : ""
      }`
    );

    if (check.status === "unhealthy") {
      allHealthy = false;
      warnings.push(`${check.service}: ${check.details || "unavailable"}`);
    }
  }

  console.log("");

  if (warnings.length > 0) {
    console.warn("⚠️  Some services are unavailable:");
    for (const warning of warnings) {
      console.warn(`   - ${warning}`);
    }
    console.warn(
      "\nℹ️  The Discord bot will still start, but some features may not work."
    );
    console.warn(
      "   Text messages will work, but voice features require the voice server and whisper.cpp.\n"
    );
  } else {
    console.log("✅ All services are healthy!\n");
  }

  await logDiscordEvent("StartupHealthCheck", {
    all_healthy: allHealthy,
    checks: checks,
    warnings: warnings,
  });

  return {
    ready: true, // Always ready, even if some services are down
    checks,
    warnings,
  };
}

/**
 * Verify Discord bot can connect
 */
export async function verifyDiscordConnection(client: any): Promise<boolean> {
  try {
    if (!client.user) {
      console.error("❌ Bot failed to login to Discord");
      return false;
    }

    console.log(`✅ Discord Connection: Logged in as ${client.user.tag}`);
    return true;
  } catch (error) {
    console.error("❌ Discord Connection Failed:", error);
    return false;
  }
}

/**
 * Verify required environment variables are set
 */
export async function verifyEnvironmentVariables(): Promise<boolean> {
  const required = [
    "DISCORD_BOT_TOKEN",
    "DISCORD_GUILD_ID",
    "DISCORD_CHANNEL_ID",
    "PAI_DIR",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    for (const key of missing) {
      console.error(`   - ${key}`);
    }
    return false;
  }

  console.log(`✅ Environment: All ${required.length} required variables set`);
  return true;
}
