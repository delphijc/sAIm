#!/usr/bin/env bun
/**
 * Discord Remote Control - CLI Entry Point
 * Start/stop the Discord bot service via command-line
 */

import { execSync } from "child_process";
import path from "path";
import fs from "fs/promises";

const scriptDir = path.join(import.meta.dir, "scripts");

async function start() {
  console.log("🚀 Starting Discord Remote Control service...\n");
  try {
    execSync(`bash ${path.join(scriptDir, "start.sh")}`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error("❌ Failed to start service:", error);
    process.exit(1);
  }
}

async function stop() {
  console.log("🛑 Stopping Discord Remote Control service...\n");
  try {
    execSync(`bash ${path.join(scriptDir, "stop.sh")}`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error("❌ Failed to stop service:", error);
    process.exit(1);
  }
}

async function status() {
  console.log("📊 Checking Discord Remote Control service status...\n");
  try {
    execSync(`bash ${path.join(scriptDir, "status.sh")}`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error("❌ Failed to check status:", error);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(`
Discord Remote Control - CLI

Usage:
  discord-remote-control --start   Start the Discord bot service
  discord-remote-control --stop    Stop the Discord bot service
  discord-remote-control --status  Check service status
  discord-remote-control --help    Show this help message
`);
    return;
  }

  switch (command) {
    case "--start":
      await start();
      break;
    case "--stop":
      await stop();
      break;
    case "--status":
      await status();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log("Run with --help for usage information");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
