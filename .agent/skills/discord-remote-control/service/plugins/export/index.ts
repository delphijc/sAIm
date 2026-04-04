/**
 * Export Plugin for Discord Remote Control
 *
 * Exports conversation history from the SQLite memory database to JSON,
 * Markdown, or HTML formats. Supports configurable date ranges.
 *
 * Commands:
 *   !export                                    - Markdown export, last-7-days (default)
 *   !export format:json                        - JSON format, last-7-days
 *   !export format:html range:last-30-days     - HTML, last 30 days
 *   !export format:markdown range:all          - Markdown, all time
 *   !export sessions                           - List available sessions with metadata
 *   /export format:json range:last-24-hours    - Slash prefix also supported
 */

import { mkdirSync, existsSync } from "fs";
import { writeFileSync } from "node:fs";
import { join } from "path";
import type { Message } from "discord.js";
import type { Plugin, PluginResult, DiscordConfig, MessageContext } from "../types.ts";
import { generateExport, generateSessionList, type ExportOptions } from "./engine.ts";
import { getRawDb } from "../../memory/db.ts";

// ============================================================================
// Constants
// ============================================================================

const EXPORT_TRIGGER = /^[!/]export\b/i;
const EXPORT_DIR = "/tmp/sam-exports";
const VALID_FORMATS = new Set(["json", "markdown", "html"]);

// ============================================================================
// Command Parsing
// ============================================================================

export interface ParsedExportCommand {
  subcommand: "export" | "sessions";
  format: "json" | "markdown" | "html";
  range: string;
  error?: string;
}

/**
 * Parse an export command string into structured options.
 *
 * Examples:
 *   "!export"                           → { format: 'markdown', range: 'last-7-days' }
 *   "!export format:json"               → { format: 'json', range: 'last-7-days' }
 *   "!export format:html range:last-30-days"
 *   "!export sessions"
 */
export function parseExportCommand(content: string): ParsedExportCommand {
  // Strip the trigger prefix
  const body = content.replace(EXPORT_TRIGGER, "").trim();

  // sessions subcommand
  if (/^sessions?\b/i.test(body)) {
    return { subcommand: "sessions", format: "markdown", range: "last-30-days" };
  }

  // Defaults
  let format: "json" | "markdown" | "html" = "markdown";
  let range = "last-7-days";
  let error: string | undefined;

  // Parse key:value tokens (case-insensitive keys)
  const tokens = body.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const colonIdx = token.indexOf(":");
    if (colonIdx === -1) continue;

    const key = token.slice(0, colonIdx).toLowerCase();
    const val = token.slice(colonIdx + 1).toLowerCase();

    if (key === "format") {
      if (VALID_FORMATS.has(val)) {
        format = val as "json" | "markdown" | "html";
      } else {
        error = `Unknown format \`${val}\`. Valid formats: json, markdown, html`;
      }
    } else if (key === "range") {
      range = val;
    }
  }

  return { subcommand: "export", format, range, error };
}

// ============================================================================
// File Helpers
// ============================================================================

function ensureExportDir(): void {
  if (!existsSync(EXPORT_DIR)) {
    mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function writeExportFile(filename: string, content: string): string {
  ensureExportDir();
  const filePath = join(EXPORT_DIR, filename);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ============================================================================
// Plugin Implementation
// ============================================================================

const exportPlugin: Plugin = {
  name: "export",
  description: "Export conversation history as JSON, Markdown, or HTML",
  version: "1.0.0",
  priority: 15,

  canHandle(message: Message, context: MessageContext): boolean {
    if (context.messageType !== "text") return false;
    return EXPORT_TRIGGER.test(message.content.trim());
  },

  async handle(
    message: Message,
    config: DiscordConfig,
    context: MessageContext
  ): Promise<PluginResult> {
    const content = message.content.trim();
    const parsed = parseExportCommand(content);

    // Format error (unknown format value)
    if (parsed.error) {
      await message.reply(`Export error: ${parsed.error}`);
      return { handled: true, responseSent: true };
    }

    // Session listing
    if (parsed.subcommand === "sessions") {
      let db;
      try {
        db = getRawDb();
      } catch {
        await message.reply("Memory database is not available. Start the bot first.");
        return { handled: true, responseSent: true };
      }

      const listing = generateSessionList(db, "last-30-days", undefined);
      await message.reply(listing);
      return { handled: true, responseSent: true };
    }

    // Export generation
    let db;
    try {
      db = getRawDb();
    } catch {
      await message.reply("Memory database is not available. Start the bot first.");
      return { handled: true, responseSent: true };
    }

    const options: ExportOptions = {
      format: parsed.format,
      range: parsed.range,
      includeMetadata: true,
    };

    let result;
    try {
      result = generateExport(db, options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ExportPlugin] Export generation failed:", err);
      await message.reply(`Export failed: ${msg}`);
      return { handled: true, responseSent: true };
    }

    let filePath: string;
    try {
      filePath = writeExportFile(result.filename, result.content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ExportPlugin] Failed to write export file:", err);
      await message.reply(`Export failed (could not write file): ${msg}`);
      return { handled: true, responseSent: true };
    }

    const summary =
      `Export ready: **${result.filename}**\n` +
      `Sessions: ${result.sessionCount} | Turns: ${result.turnCount} | ` +
      `Range: ${result.dateRange.start.toLocaleDateString()} — ${result.dateRange.end.toLocaleDateString()}`;

    return {
      handled: true,
      responseSent: false,
      response: summary,
      fileAttachments: [{ path: filePath, name: result.filename }],
    };
  },

  async onLoad(): Promise<void> {
    ensureExportDir();
    console.log(`[ExportPlugin] Loaded. Export directory: ${EXPORT_DIR}`);
  },

  async onUnload(): Promise<void> {
    console.log("[ExportPlugin] Unloaded");
  },
};

export default exportPlugin;
