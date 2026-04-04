#!/usr/bin/env bun

/**
 * open-file Tool
 * Opens files in their default viewer or editor using the macOS `open` command
 *
 * Usage: bun open-file.ts <filepath>
 * Example: bun open-file.ts ~/Projects/sam/20260104SundayService.md
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

function main() {
  const args = process.argv.slice(2);

  // Show help if no arguments
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
open-file Tool - Opens files in their default viewer or editor

Usage: bun open-file.ts <filepath>

Arguments:
  <filepath>  Path to the file to open
  --help      Show this help message

Examples:
  bun open-file.ts ./document.md
  bun open-file.ts ~/Projects/sam/file.pdf
  bun open-file.ts ~/Downloads/spreadsheet.xlsx
    `);
    process.exit(0);
  }

  const filepath = args[0];

  // Resolve the file path
  let resolvedPath: string;
  try {
    if (filepath.startsWith("~")) {
      resolvedPath = path.join(process.env.HOME || "/", filepath.slice(2));
    } else {
      resolvedPath = path.resolve(filepath);
    }
  } catch (err) {
    console.error(`Error resolving path: ${filepath}`);
    process.exit(1);
  }

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // Execute the open command
  try {
    execSync(`open "${resolvedPath}"`, { stdio: "inherit" });
    console.log(`✓ Opened: ${resolvedPath}`);
    process.exit(0);
  } catch (err) {
    console.error(`Error opening file: ${err}`);
    process.exit(1);
  }
}

main();
