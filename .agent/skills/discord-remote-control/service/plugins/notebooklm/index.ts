/**
 * NotebookLM Plugin for Discord Remote Control
 *
 * Provides Discord-based access to Google NotebookLM via the `nlm` CLI tool.
 * Supports notebook management, source management, note management, audio
 * overviews, and AI chat/generation features.
 *
 * Commands:
 *   !nlm help                             - Show help
 *   !nlm list                             - List all notebooks
 *   !nlm create "Title"                   - Create a new notebook
 *   !nlm delete <id>                      - Delete a notebook
 *   !nlm sources <id>                     - List sources in notebook
 *   !nlm add <id> <url-or-text>           - Add source to notebook
 *   !nlm notes <id>                       - List notes
 *   !nlm note <id> "Title" [content]      - Create new note
 *   !nlm audio create <id> [instructions] - Generate audio overview
 *   !nlm audio list <id>                  - List audio overviews
 *   !nlm audio download <id>              - Download and upload audio to Discord
 *   !nlm chat <id> <prompt>               - Chat with notebook
 *   !nlm guide <id>                       - Generate notebook guide
 *   !nlm outline <id>                     - Generate content outline
 *   !nlm use <id>                         - Set active notebook for this user
 *   !nlm status                           - Show active notebook
 */

import { unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { Message } from "discord.js";
import type { Plugin, PluginResult, DiscordConfig, MessageContext } from "../types.ts";

// ============================================================================
// Constants
// ============================================================================

const NLM_TRIGGER = /^!(nlm|notebook)\b/i;

/** Discord message character limit */
const DISCORD_MAX_CHARS = 2000;

/** Max characters to show for a single nlm output chunk */
const OUTPUT_MAX_CHARS = 1800;

/** Temporary directory for audio downloads */
const TMP_DIR = "/tmp";

// ============================================================================
// Per-user active notebook tracking
// ============================================================================

/** Maps userId -> active notebook ID */
const activeNotebooks = new Map<string, string>();

// ============================================================================
// nlm CLI runner
// ============================================================================

interface NlmResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Run an nlm CLI command and capture stdout/stderr.
 * Uses Bun.spawn for async, non-blocking execution.
 */
async function runNlm(args: string[]): Promise<NlmResult> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(["nlm", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (err) {
    // nlm binary not found or spawn failed
    return {
      ok: false,
      stdout: "",
      stderr: `Failed to launch nlm: ${String(err)}`,
    };
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    ok: exitCode === 0,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Truncate a string to fit within Discord's message limit with an ellipsis
 * and optional footer explaining truncation.
 */
function truncate(text: string, maxLen: number = OUTPUT_MAX_CHARS): string {
  if (text.length <= maxLen) return text;
  const suffix = "\n\n*(output truncated)*";
  return text.slice(0, maxLen - suffix.length) + suffix;
}

/**
 * Resolve notebook ID: use provided ID, or fall back to user's active notebook.
 * Returns null if neither is available.
 */
function resolveNotebookId(userId: string, provided?: string): string | null {
  if (provided && provided.trim()) return provided.trim();
  return activeNotebooks.get(userId) ?? null;
}

/**
 * Format a successful nlm result for Discord, falling back gracefully when
 * stdout is empty.
 */
function formatOutput(result: NlmResult, emptyMessage = "*(no output)*"): string {
  if (!result.ok) {
    const detail = result.stderr || result.stdout || "Unknown error.";
    if (detail.toLowerCase().includes("not logged in") ||
        detail.toLowerCase().includes("authentication") ||
        detail.toLowerCase().includes("auth")) {
      return (
        "**Authentication required.**\n" +
        "Run `nlm` in a terminal on this machine to complete browser-based login, then retry."
      );
    }
    if (detail.toLowerCase().includes("not found") ||
        detail.toLowerCase().includes("no such file") ||
        detail.toLowerCase().includes("command not found")) {
      return (
        "**`nlm` not found in PATH.**\n" +
        "Ensure the nlm CLI is installed and accessible."
      );
    }
    return `**Error:**\n\`\`\`\n${truncate(detail)}\n\`\`\``;
  }
  const out = result.stdout || emptyMessage;
  return truncate(out);
}

/**
 * Download a Discord attachment to a temp file and return the local path.
 */
async function downloadAttachment(url: string, filename: string): Promise<string> {
  const dest = `${TMP_DIR}/nlm_attach_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download attachment: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  await Bun.write(dest, buffer);
  return dest;
}

/**
 * Clean up a temp file, ignoring errors (e.g. already deleted).
 */
async function cleanupTemp(path: string): Promise<void> {
  try {
    if (existsSync(path)) await unlink(path);
  } catch {
    // ignore
  }
}

// ============================================================================
// Command parsers
// ============================================================================

/**
 * Parse a string that may be bare or quoted (single or double).
 * Returns [parsedValue, remainingText].
 *
 * Example: `"My Notebook" extra` -> ["My Notebook", "extra"]
 */
function parseQuotedOrWord(input: string): [string, string] {
  input = input.trim();
  if (input.startsWith('"') || input.startsWith("'")) {
    const quote = input[0];
    const end = input.indexOf(quote, 1);
    if (end !== -1) {
      return [input.slice(1, end), input.slice(end + 1).trim()];
    }
  }
  const space = input.indexOf(" ");
  if (space === -1) return [input, ""];
  return [input.slice(0, space), input.slice(space + 1).trim()];
}

// ============================================================================
// Sub-command handlers
// ============================================================================

async function cmdHelp(message: Message): Promise<PluginResult> {
  await message.reply(
    "**NotebookLM Commands (`!nlm` or `!notebook`):**\n" +
    "`!nlm list` — List all notebooks\n" +
    "`!nlm create \"Title\"` — Create a new notebook\n" +
    "`!nlm delete <id>` — Delete a notebook\n" +
    "`!nlm sources [id]` — List sources in notebook\n" +
    "`!nlm add [id] <url-or-text>` — Add source (attach a file to upload it)\n" +
    "`!nlm notes [id]` — List notes\n" +
    "`!nlm note [id] \"Title\" [content]` — Create a new note\n" +
    "`!nlm audio create [id] [instructions]` — Generate audio overview\n" +
    "`!nlm audio list [id]` — List audio overviews\n" +
    "`!nlm audio download <audio-id>` — Download audio and upload to Discord\n" +
    "`!nlm chat [id] <prompt>` — Chat with notebook\n" +
    "`!nlm guide [id]` — Generate notebook guide\n" +
    "`!nlm outline [id]` — Generate content outline\n" +
    "`!nlm use <id>` — Set active notebook (shorthand for all commands)\n" +
    "`!nlm status` — Show active notebook\n" +
    "`!nlm help` — This message\n\n" +
    "*Tip: Set an active notebook with `!nlm use <id>` to omit the ID from most commands.*"
  );
  return { handled: true, responseSent: true };
}

async function cmdStatus(message: Message): Promise<PluginResult> {
  const active = activeNotebooks.get(message.author.id);
  if (!active) {
    await message.reply("No active notebook set. Use `!nlm use <id>` to set one.");
  } else {
    await message.reply(`Active notebook: \`${active}\``);
  }
  return { handled: true, responseSent: true };
}

async function cmdUse(message: Message, args: string): Promise<PluginResult> {
  const id = args.trim();
  if (!id) {
    await message.reply("Usage: `!nlm use <notebook-id>`");
    return { handled: true, responseSent: true };
  }
  activeNotebooks.set(message.author.id, id);
  await message.reply(`Active notebook set to \`${id}\`.`);
  return { handled: true, responseSent: true };
}

async function cmdList(message: Message): Promise<PluginResult> {
  const result = await runNlm(["list"]);
  await message.reply(formatOutput(result, "No notebooks found."));
  return { handled: true, responseSent: true };
}

async function cmdCreate(message: Message, args: string): Promise<PluginResult> {
  const [title] = parseQuotedOrWord(args);
  if (!title) {
    await message.reply('Usage: `!nlm create "Notebook Title"`');
    return { handled: true, responseSent: true };
  }
  const result = await runNlm(["create", title]);
  await message.reply(formatOutput(result, "Notebook created."));
  return { handled: true, responseSent: true };
}

async function cmdDelete(message: Message, args: string): Promise<PluginResult> {
  const id = resolveNotebookId(message.author.id, args.trim());
  if (!id) {
    await message.reply("Please provide a notebook ID or set one with `!nlm use <id>`.");
    return { handled: true, responseSent: true };
  }
  const result = await runNlm(["rm", id]);
  // If deleted the active notebook, clear it
  if (result.ok && activeNotebooks.get(message.author.id) === id) {
    activeNotebooks.delete(message.author.id);
  }
  await message.reply(formatOutput(result, "Notebook deleted."));
  return { handled: true, responseSent: true };
}

async function cmdSources(message: Message, args: string): Promise<PluginResult> {
  const id = resolveNotebookId(message.author.id, args.trim());
  if (!id) {
    await message.reply("Please provide a notebook ID or set one with `!nlm use <id>`.");
    return { handled: true, responseSent: true };
  }
  const result = await runNlm(["sources", id]);
  await message.reply(formatOutput(result, "No sources found."));
  return { handled: true, responseSent: true };
}

/**
 * Add a source to a notebook.
 *
 * Supported forms:
 *   !nlm add [id] <url-or-text>
 *   !nlm add [id]              (with file attachment)
 */
async function cmdAdd(
  message: Message,
  args: string,
  context: MessageContext
): Promise<PluginResult> {
  const parts = args.trim().split(/\s+/);

  // Determine if first token looks like a notebook id (non-URL, non-quoted)
  // Strategy: if we have an active notebook and args is clearly just a URL/text, use active.
  // Otherwise, first token is the notebook id.
  let notebookId: string | null = null;
  let sourceArg = "";

  // Heuristic: if first word starts with http(s) or is quoted, treat the whole args as source
  const firstWord = parts[0] || "";
  if (!firstWord || firstWord.match(/^https?:\/\//)) {
    notebookId = activeNotebooks.get(message.author.id) ?? null;
    sourceArg = args.trim();
  } else {
    // First word is likely the notebook ID
    notebookId = firstWord;
    sourceArg = parts.slice(1).join(" ").trim();
  }

  // Allow active notebook fallback when sourceArg is empty (attachment case)
  if (!notebookId) {
    notebookId = activeNotebooks.get(message.author.id) ?? null;
  }

  if (!notebookId) {
    await message.reply(
      "Please provide a notebook ID or set one with `!nlm use <id>`.\n" +
      "Usage: `!nlm add [id] <url-or-text>`"
    );
    return { handled: true, responseSent: true };
  }

  // Handle file attachment
  if (context.hasAttachments && message.attachments.size > 0) {
    const attachment = message.attachments.first()!;
    let tempPath: string | null = null;
    try {
      await message.reply(`Downloading attachment **${attachment.name}** and adding as source...`);
      tempPath = await downloadAttachment(attachment.url, attachment.name || "upload");
      const result = await runNlm(["add", notebookId, tempPath]);
      await message.reply(formatOutput(result, "Source added."));
    } catch (err) {
      await message.reply(`**Error adding attachment:** ${String(err)}`);
    } finally {
      if (tempPath) await cleanupTemp(tempPath);
    }
    return { handled: true, responseSent: true };
  }

  if (!sourceArg) {
    await message.reply(
      "Please provide a URL, text, or attach a file.\n" +
      "Usage: `!nlm add [id] <url-or-text>`"
    );
    return { handled: true, responseSent: true };
  }

  const result = await runNlm(["add", notebookId, sourceArg]);
  await message.reply(formatOutput(result, "Source added."));
  return { handled: true, responseSent: true };
}

async function cmdNotes(message: Message, args: string): Promise<PluginResult> {
  const id = resolveNotebookId(message.author.id, args.trim());
  if (!id) {
    await message.reply("Please provide a notebook ID or set one with `!nlm use <id>`.");
    return { handled: true, responseSent: true };
  }
  const result = await runNlm(["notes", id]);
  await message.reply(formatOutput(result, "No notes found."));
  return { handled: true, responseSent: true };
}

/**
 * Create a new note.
 * Syntax: !nlm note [id] "Title" [content]
 */
async function cmdNote(message: Message, args: string): Promise<PluginResult> {
  // Parse: [id] "Title" [content]
  // First token: either notebook id or quoted title
  let remaining = args.trim();
  let notebookId: string | null = null;

  const firstChar = remaining[0];
  if (firstChar !== '"' && firstChar !== "'") {
    // First token is notebook id
    const [maybeId, rest] = parseQuotedOrWord(remaining);
    notebookId = maybeId || null;
    remaining = rest;
  }

  notebookId = notebookId || (activeNotebooks.get(message.author.id) ?? null);

  if (!notebookId) {
    await message.reply(
      "Please provide a notebook ID or set one with `!nlm use <id>`.\n" +
      'Usage: `!nlm note [id] "Title" [content]`'
    );
    return { handled: true, responseSent: true };
  }

  const [title, content] = parseQuotedOrWord(remaining);
  if (!title) {
    await message.reply('Usage: `!nlm note [id] "Title" [content]`');
    return { handled: true, responseSent: true };
  }

  const result = await runNlm(["new-note", notebookId, title]);
  await message.reply(formatOutput(result, "Note created."));
  return { handled: true, responseSent: true };
}

// ============================================================================
// Audio sub-commands
// ============================================================================

async function cmdAudioCreate(message: Message, args: string): Promise<PluginResult> {
  // args: [id] [instructions...]
  const parts = args.trim().split(/\s+/);
  let notebookId: string | null = null;
  let instructions = "";

  if (parts.length > 0 && parts[0]) {
    // If there are multiple words, first is id, rest is instructions
    // If only one word, it's the id (no instructions)
    notebookId = parts[0];
    instructions = parts.slice(1).join(" ");
  }

  notebookId = notebookId || (activeNotebooks.get(message.author.id) ?? null);

  if (!notebookId) {
    await message.reply("Please provide a notebook ID or set one with `!nlm use <id>`.");
    return { handled: true, responseSent: true };
  }

  await message.reply("Generating audio overview... This may take a moment.");

  const nlmArgs = instructions
    ? ["audio-create", notebookId, instructions]
    : ["audio-create", notebookId, ""];

  const result = await runNlm(nlmArgs.filter(Boolean));
  await message.reply(formatOutput(result, "Audio overview generation started."));
  return { handled: true, responseSent: true };
}

async function cmdAudioList(message: Message, args: string): Promise<PluginResult> {
  const id = resolveNotebookId(message.author.id, args.trim());
  if (!id) {
    await message.reply("Please provide a notebook ID or set one with `!nlm use <id>`.");
    return { handled: true, responseSent: true };
  }
  const result = await runNlm(["audio-list", id]);
  await message.reply(formatOutput(result, "No audio overviews found."));
  return { handled: true, responseSent: true };
}

/**
 * Download an audio overview and upload it directly to Discord.
 * Syntax: !nlm audio download <audio-id>
 */
async function cmdAudioDownload(message: Message, args: string): Promise<PluginResult> {
  const audioId = args.trim();
  if (!audioId) {
    await message.reply("Usage: `!nlm audio download <audio-id>`");
    return { handled: true, responseSent: true };
  }

  const timestamp = Date.now();
  const tempPath = `${TMP_DIR}/nlm_audio_${timestamp}.wav`;

  try {
    await message.reply(`Downloading audio overview \`${audioId}\`...`);

    const result = await runNlm(["audio-download", audioId, tempPath, "--direct-rpc"]);

    if (!result.ok) {
      await message.reply(formatOutput(result));
      return { handled: true, responseSent: true };
    }

    // Check the file actually exists before attempting upload
    if (!existsSync(tempPath)) {
      await message.reply(
        "**Error:** Audio download reported success but no file was created.\n" +
        `Expected: \`${tempPath}\``
      );
      return { handled: true, responseSent: true };
    }

    await message.channel.send({
      content: `Audio overview \`${audioId}\`:`,
      files: [{ attachment: tempPath, name: `nlm_audio_${audioId}_${timestamp}.wav` }],
    });
  } catch (err) {
    await message.reply(`**Error during audio download/upload:** ${String(err)}`);
  } finally {
    await cleanupTemp(tempPath);
  }

  return { handled: true, responseSent: true };
}

// ============================================================================
// Generation sub-commands
// ============================================================================

async function cmdChat(message: Message, args: string): Promise<PluginResult> {
  // args: [id] <prompt...>
  // Heuristic: if first word does not contain spaces and active notebook exists,
  // first word could still be the id. We always treat first word as id when provided.
  const parts = args.trim().split(/\s+/);
  let notebookId: string | null = null;
  let prompt = "";

  if (parts.length >= 2) {
    notebookId = parts[0];
    prompt = parts.slice(1).join(" ");
  } else if (parts.length === 1 && parts[0]) {
    // Only one word — ambiguous. Use active notebook, treat word as start of prompt.
    notebookId = activeNotebooks.get(message.author.id) ?? null;
    prompt = parts[0];
  }

  notebookId = notebookId || (activeNotebooks.get(message.author.id) ?? null);

  if (!notebookId) {
    await message.reply(
      "Please provide a notebook ID or set one with `!nlm use <id>`.\n" +
      "Usage: `!nlm chat [id] <prompt>`"
    );
    return { handled: true, responseSent: true };
  }

  if (!prompt) {
    await message.reply("Please provide a prompt. Usage: `!nlm chat [id] <prompt>`");
    return { handled: true, responseSent: true };
  }

  try {
    await message.channel.sendTyping();
  } catch { /* ignore */ }

  const result = await runNlm(["generate-chat", notebookId, prompt]);
  await message.reply(formatOutput(result, "*(no response)*"));
  return { handled: true, responseSent: true };
}

async function cmdGuide(message: Message, args: string): Promise<PluginResult> {
  const id = resolveNotebookId(message.author.id, args.trim());
  if (!id) {
    await message.reply("Please provide a notebook ID or set one with `!nlm use <id>`.");
    return { handled: true, responseSent: true };
  }

  try {
    await message.channel.sendTyping();
  } catch { /* ignore */ }

  const result = await runNlm(["generate-guide", id]);
  await message.reply(formatOutput(result, "*(no guide generated)*"));
  return { handled: true, responseSent: true };
}

async function cmdOutline(message: Message, args: string): Promise<PluginResult> {
  const id = resolveNotebookId(message.author.id, args.trim());
  if (!id) {
    await message.reply("Please provide a notebook ID or set one with `!nlm use <id>`.");
    return { handled: true, responseSent: true };
  }

  try {
    await message.channel.sendTyping();
  } catch { /* ignore */ }

  const result = await runNlm(["generate-outline", id]);
  await message.reply(formatOutput(result, "*(no outline generated)*"));
  return { handled: true, responseSent: true };
}

// ============================================================================
// Plugin Implementation
// ============================================================================

const notebooklmPlugin: Plugin = {
  name: "notebooklm",
  description: "Google NotebookLM integration via nlm CLI — notebooks, sources, notes, audio, and AI chat",
  version: "1.0.0",
  priority: 30,

  canHandle(message: Message, context: MessageContext): boolean {
    // Only handle text messages (or mixed messages that have a command prefix)
    if (context.messageType !== "text" && context.messageType !== "mixed") return false;
    return NLM_TRIGGER.test(message.content.trim());
  },

  async handle(
    message: Message,
    config: DiscordConfig,
    context: MessageContext
  ): Promise<PluginResult> {
    const raw = message.content.trim();

    // Strip the trigger prefix (!nlm or !notebook) to get the subcommand + args
    const withoutTrigger = raw.replace(NLM_TRIGGER, "").trim();

    // Split into subcommand and the rest
    const spaceIdx = withoutTrigger.indexOf(" ");
    const subcommand = (spaceIdx === -1
      ? withoutTrigger
      : withoutTrigger.slice(0, spaceIdx)
    ).toLowerCase();
    const args = spaceIdx === -1 ? "" : withoutTrigger.slice(spaceIdx + 1).trim();

    switch (subcommand) {
      case "":
      case "help":
        return await cmdHelp(message);

      case "status":
        return await cmdStatus(message);

      case "use":
        return await cmdUse(message, args);

      case "list":
      case "ls":
        return await cmdList(message);

      case "create":
        return await cmdCreate(message, args);

      case "delete":
      case "rm":
      case "remove":
        return await cmdDelete(message, args);

      case "sources":
        return await cmdSources(message, args);

      case "add":
        return await cmdAdd(message, args, context);

      case "notes":
        return await cmdNotes(message, args);

      case "note":
        return await cmdNote(message, args);

      case "audio": {
        // Sub-sub-command: audio create | audio list | audio download
        const audioSpaceIdx = args.indexOf(" ");
        const audioSub = (audioSpaceIdx === -1
          ? args
          : args.slice(0, audioSpaceIdx)
        ).toLowerCase();
        const audioArgs = audioSpaceIdx === -1 ? "" : args.slice(audioSpaceIdx + 1).trim();

        switch (audioSub) {
          case "create":
            return await cmdAudioCreate(message, audioArgs);
          case "list":
          case "ls":
            return await cmdAudioList(message, audioArgs);
          case "download":
          case "dl":
            return await cmdAudioDownload(message, audioArgs);
          default:
            await message.reply(
              "Unknown audio subcommand. Available: `audio create`, `audio list`, `audio download`"
            );
            return { handled: true, responseSent: true };
        }
      }

      case "chat":
        return await cmdChat(message, args);

      case "guide":
        return await cmdGuide(message, args);

      case "outline":
        return await cmdOutline(message, args);

      default:
        await message.reply(
          `Unknown command: \`!nlm ${subcommand}\`. Try \`!nlm help\` for a list of commands.`
        );
        return { handled: true, responseSent: true };
    }
  },

  async onLoad(): Promise<void> {
    console.log("[NotebookLMPlugin] Loaded — checking nlm availability...");
    const result = await runNlm(["--help"]);
    if (!result.ok && result.stderr.toLowerCase().includes("not found")) {
      console.warn("[NotebookLMPlugin] WARNING: nlm CLI not found in PATH. Plugin loaded but commands will fail.");
    } else {
      console.log("[NotebookLMPlugin] nlm CLI is available.");
    }
  },

  async onUnload(): Promise<void> {
    activeNotebooks.clear();
    console.log("[NotebookLMPlugin] Unloaded, active notebook state cleared.");
  },
};

// ============================================================================
// Export
// ============================================================================

export default notebooklmPlugin;
