/**
 * Claude Code Subprocess Integration - Phase 4
 * Spawns Claude subprocess with full SAM access for intelligent responses
 *
 * This module bridges Discord messages to Claude Code by:
 * 1. Building a prompt from user message + memory context
 * 2. Spawning a Claude subprocess with SAM environment
 * 3. Streaming response back to Discord
 * 4. Recording the conversation turn to memory
 */

import { spawn } from "bun";
import path from "path";

// Dynamic imports using home directory
const HOME = process.env.HOME || "/home";
const SKILLS_PATH = path.join(HOME, ".claude/skills/discord-remote-control/service");

let buildContextInjection: any;
let formatContextForPrompt: any;
let recordTurn: any;
let extractAndSaveMemories: any;

// Lazy-load memory modules on first use
async function loadMemoryModules() {
  if (!buildContextInjection) {
    const injection = await import(path.join(SKILLS_PATH, "memory/injection.ts"));
    buildContextInjection = injection.buildContextInjection;
    formatContextForPrompt = injection.formatContextForPrompt;
  }
  if (!recordTurn) {
    const episodic = await import(path.join(SKILLS_PATH, "memory/episodic.ts"));
    recordTurn = episodic.recordTurn;
  }
  if (!extractAndSaveMemories) {
    const extraction = await import(path.join(SKILLS_PATH, "memory/extraction.ts"));
    extractAndSaveMemories = extraction.extractAndSaveMemories;
  }
}

export interface SubprocessRequest {
  sessionId: string;
  userId: string;
  channelId: string;
  userMessage: string;
  messageType: "text" | "image" | "file" | "voice" | "mixed";
  attachmentPaths?: string[];
  metadata?: {
    username?: string;
    attachmentCount?: number;
  };
}

export interface SubprocessResponse {
  success: boolean;
  content: string;
  tokens: {
    input: number;
    output: number;
  };
  duration: number; // milliseconds
  error?: string;
  fileAttachments?: Array<{ path: string; name: string }>;
}

/**
 * Parse file attachment markers from subprocess output.
 * Format: [SAM_ATTACH:/absolute/path/to/file.ext:display_name.ext]
 *
 * Returns the cleaned text (markers removed) and extracted attachments.
 */
export function parseFileAttachments(output: string): {
  cleanedText: string;
  attachments: Array<{ path: string; name: string }>;
} {
  const attachments: Array<{ path: string; name: string }> = [];
  const markerPattern = /\[SAM_?ATTACH:([^:\]]+):([^\]]+)\]/g;

  let match;
  while ((match = markerPattern.exec(output)) !== null) {
    attachments.push({
      path: match[1].trim(),
      name: match[2].trim(),
    });
  }

  // Remove markers from output text (fresh regex since exec consumed the previous one)
  const cleanupPattern = /\[SAM_?ATTACH:([^:\]]+):([^\]]+)\]/g;
  const cleanedText = output.replace(cleanupPattern, "").trim();

  return { cleanedText, attachments };
}

/**
 * Call Claude subprocess with memory context
 *
 * Spawns `claude` CLI with:
 * - Full SAM config and skills access
 * - Memory injection (episodic + semantic)
 * - User message and attachments
 * - Returns streaming response
 */
export async function callClaudeSubprocess(
  request: SubprocessRequest
): Promise<SubprocessResponse> {
  const startTime = Date.now();

  try {
    // Load memory modules dynamically
    await loadMemoryModules();

    console.log(`🧠 Calling Claude subprocess for session ${request.sessionId}`);
    console.log(`   Message type: ${request.messageType}`);

    // Step 0: Record user turn IMMEDIATELY (before processing)
    // This ensures the prompt is persisted even if the subprocess or service crashes.
    // On recovery, an unanswered user message signals interrupted work.
    console.log(`💾 Pre-recording user turn to memory...`);
    await recordTurn({
      sessionId: request.sessionId,
      discordUserId: request.userId,
      discordChannelId: request.channelId,
      role: "user",
      content: request.userMessage,
      timestamp: Date.now(),
      metadata: {
        messageType: request.messageType,
        attachmentCount: request.attachmentPaths?.length || 0,
        tokens: estimateTokens(request.userMessage),
      },
    });

    // Step 1: Build context from memory
    console.log(`📚 Injecting memory context...`);
    const contextInjection = await buildContextInjection(
      request.sessionId,
      request.userMessage,
      {
        maxTotalTokens: 2500, // Reserve 1500 tokens for response
      }
    );

    const contextPrefix = formatContextForPrompt(contextInjection);

    // Step 2: Build the full prompt
    let prompt = "";

    // Add user context if available
    if (request.metadata?.username) {
      prompt += `**Current User**: ${request.metadata.username}\n\n`;
    }

    // Add memory context
    prompt += contextPrefix;

    // Add message type marker
    if (request.messageType !== "text") {
      prompt += `\n**Message Type**: ${request.messageType.toUpperCase()}`;
      if (request.attachmentPaths && request.attachmentPaths.length > 0) {
        prompt += ` (${request.attachmentPaths.length} attachment${request.attachmentPaths.length !== 1 ? "s" : ""})`;
        prompt += `\n**Attachment Paths**: \`${request.attachmentPaths.join("`, `")}\``;
      }
      prompt += "\n\n";
    }

    // Add the user message
    prompt += `**User Message**:\n${request.userMessage}`;

    console.log(`📝 Prompt built (${estimateTokens(prompt)} tokens)`);

    // Step 3: Spawn Claude subprocess
    console.log(`⚙️  Spawning Claude subprocess...`);

    const claudePath = await findClaudeCommand();
    if (!claudePath) {
      throw new Error("Claude command not found. Is Claude Code installed?");
    }

    // Run Claude with the prompt — full SAM environment
    // Strip CLAUDECODE so nested subprocess is allowed
    const env = { ...process.env };
    delete env.CLAUDECODE;

    // Override: prevent CLAUDE.md voice protocol from hijacking Discord responses
    const discordContext = [
      "You are Sam, a helpful AI assistant responding via Discord.",
      "Focus entirely on answering the user's question directly and helpfully.",
      "Your text response will be sent back to the user via Discord automatically.",
      "Keep responses concise and conversational since this is a chat interface.",
      "FILE ATTACHMENTS: If you create a file that should be sent to the user via Discord,",
      "include a marker at the END of your response in this exact format:",
      "[SAM_ATTACH:/absolute/path/to/file.ext:display_name.ext]",
      "You can include multiple markers for multiple files. The markers will be stripped",
      "from the visible response and the files will be attached to the Discord message.",
    ].join(" ");

    // Note: Opus 4.6 uses adaptive thinking only (manual extended thinking deprecated).
    // If refactoring to direct SDK calls, use: thinking: {type: "adaptive", effort: "medium"}
    //
    // WORKAROUND (2026-03-25): Claude Code 2.1.83 has a regression where --print mode
    // returns an empty result field even when assistant produces text. We use
    // --output-format stream-json --verbose to capture text from assistant messages directly.
    const settingsPath = path.join(HOME, ".claude/settings.json");
    const proc = spawn([claudePath, "--print", "--model", "claude-opus-4-6", "--output-format", "stream-json", "--verbose", "--settings", settingsPath, "--append-system-prompt", discordContext], {
      stdin: Buffer.from(prompt),
      stdout: "pipe",
      stderr: "pipe",
      env,
    });

    // Collect output — parse stream-json to extract assistant text
    let rawOutput = "";
    let errorOutput = "";

    if (proc.stdout) {
      for await (const chunk of proc.stdout) {
        rawOutput += new TextDecoder().decode(chunk);
      }
    }

    if (proc.stderr) {
      for await (const chunk of proc.stderr) {
        errorOutput += new TextDecoder().decode(chunk);
      }
    }

    const exitCode = await proc.exited;

    // Extract text content from stream-json assistant messages
    let output = "";
    for (const line of rawOutput.split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text") {
              output += block.text;
            }
          }
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    if (exitCode !== 0) {
      // Log detailed error info for debugging
      console.error(`📋 Subprocess stderr:`, errorOutput || "(no stderr captured)");
      console.error(`📋 Subprocess stdout:`, output || "(no stdout captured)");
      console.error(`📋 Subprocess exit code:`, exitCode);
      throw new Error(
        `Claude subprocess exited with code ${exitCode}: ${errorOutput || "(no error output)"}`
      );
    }

    // Step 4: Record the assistant response to memory
    // (User turn was already recorded in Step 0 before processing)
    console.log(`💾 Recording assistant response to memory...`);
    const tokens = estimateTokens(output);

    await recordTurn({
      sessionId: request.sessionId,
      discordUserId: request.userId,
      discordChannelId: request.channelId,
      role: "assistant",
      content: output,
      timestamp: Date.now(),
      metadata: {
        tokens,
      },
    });

    // Step 5: Extract and save semantic memories from this exchange
    // Runs async but doesn't block the response
    extractAndSaveMemories(
      request.userMessage,
      output,
      request.sessionId,
      'discord'
    ).catch((err) => console.error("Memory extraction failed:", err));

    // Step 6: Parse file attachment markers from output
    const { cleanedText, attachments } = parseFileAttachments(output);

    // Validate that attached files actually exist
    const validAttachments: Array<{ path: string; name: string }> = [];
    for (const att of attachments) {
      try {
        const file = Bun.file(att.path);
        if (await file.exists()) {
          validAttachments.push(att);
          console.log(`📎 File attachment validated: ${att.name} (${att.path})`);
        } else {
          console.warn(`⚠️  Attachment file not found: ${att.path}`);
        }
      } catch {
        console.warn(`⚠️  Error checking attachment: ${att.path}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ Claude response complete (${duration}ms, ${tokens} output tokens, ${validAttachments.length} attachments)`
    );

    return {
      success: true,
      content: cleanedText || output,
      tokens: {
        input: estimateTokens(prompt),
        output: tokens,
      },
      duration,
      ...(validAttachments.length > 0 && { fileAttachments: validAttachments }),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`❌ Claude subprocess failed: ${errorMessage}`);

    return {
      success: false,
      content: "",
      tokens: {
        input: 0,
        output: 0,
      },
      duration,
      error: errorMessage,
    };
  }
}

/**
 * Find the Claude command in the system
 */
async function findClaudeCommand(): Promise<string | null> {
  // Check if claude is in PATH
  try {
    const proc = spawn(["which", "claude"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    let output = "";
    if (proc.stdout) {
      output = await Bun.readableStreamToText(proc.stdout);
    }
    const exitCode = await proc.exited;

    if (exitCode === 0 && output.trim()) {
      return output.trim();
    }
  } catch {
    // which command failed, try common paths
  }

  // Try common installation paths
  const home = process.env.HOME || "/home";
  const commonPaths = [
    "/usr/local/bin/claude",
    "/home/linuxbrew/.linuxbrew/bin/claude",
    path.join(home, ".local/bin/claude"),
    path.join(home, ".bun/bin/claude"),
  ];

  for (const p of commonPaths) {
    try {
      const file = Bun.file(p);
      if (await file.exists()) {
        return p;
      }
    } catch {
      // Path doesn't exist
    }
  }

  return null;
}

/**
 * Estimate token count (rough: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build a user-friendly response from Claude output
 * Handles formatting and chunk preparation for Discord
 */
export function formatResponse(output: string): string {
  return output
    .trim()
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

/**
 * Sanitize user input by detecting and flagging prompt injection attempts.
 * Returns the sanitized message and whether injection was detected.
 */
export function sanitizeUserInput(input: string): { sanitized: string; injectionDetected: boolean } {
  const PROMPT_INJECTION_PATTERNS: RegExp[] = [
    /ignore\s+(all\s+)?previous\s+instructions?/i,
    /disregard\s+(all\s+)?(prior|previous)\s+(instructions?|rules?|context)/i,
    /you\s+are\s+now\s+(a|an|in)\s+/i,
    /system\s*:\s*/i,
    /\[INST\]/i,
    /<<\s*SYS\s*>>/i,
    /\bact\s+as\s+(if\s+)?(you\s+)?(are|were)\s+/i,
    /new\s+instructions?\s*:/i,
    /override\s+(all\s+)?safety/i,
    /bypass\s+(all\s+)?restrictions?/i,
  ];

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { sanitized: input, injectionDetected: true };
    }
  }
  return { sanitized: input, injectionDetected: false };
}
