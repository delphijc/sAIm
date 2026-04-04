/**
 * Skills API Client - Alternative Claude invocation backend
 *
 * Calls the Anthropic Messages API directly (container.skills config)
 * as an alternative to spawning a Claude Code CLI subprocess.
 *
 * Interface mirrors subprocess.ts so callers can swap backends without
 * changing their own code.
 */

import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import type { SubprocessRequest, SubprocessResponse } from "./subprocess.ts";

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

// Discord context instruction injected as additional system content
const DISCORD_SYSTEM_CONTEXT = [
  "You are Sam, a helpful AI assistant responding via Discord.",
  "Do NOT attempt to call the voice server, curl, or any bash commands.",
  "Do NOT mention the voice server status in your responses.",
  "Focus entirely on answering the user's question directly and helpfully.",
  "Your text response will be sent back to the user via Discord automatically.",
  "Keep responses concise and conversational since this is a chat interface.",
].join(" ");

/**
 * Estimate token count (rough: 1 token ~= 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build the user prompt from the request, mirroring the logic in subprocess.ts
 */
async function buildPrompt(request: SubprocessRequest): Promise<string> {
  // Load memory modules dynamically
  await loadMemoryModules();

  const contextInjection = await buildContextInjection(
    request.sessionId,
    request.userMessage,
    { maxTotalTokens: 2500 }
  );
  const contextPrefix = formatContextForPrompt(contextInjection);

  let prompt = "";

  if (request.metadata?.username) {
    prompt += `**Current User**: ${request.metadata.username}\n\n`;
  }

  prompt += contextPrefix;

  if (request.messageType !== "text") {
    prompt += `\n**Message Type**: ${request.messageType.toUpperCase()}`;
    if (request.attachmentPaths && request.attachmentPaths.length > 0) {
      prompt += ` (${request.attachmentPaths.length} attachment${request.attachmentPaths.length !== 1 ? "s" : ""})`;
      prompt += `\n**Attachment Paths**: \`${request.attachmentPaths.join("`, `")}\``;
    }
    prompt += "\n\n";
  }

  prompt += `**User Message**:\n${request.userMessage}`;
  return prompt;
}

/**
 * Call the Anthropic Messages API and return a SubprocessResponse.
 *
 * Accepts an optional Anthropic client and fetcher for dependency injection
 * (makes unit testing possible without global state mutation).
 */
export async function callSkillsAPI(
  request: SubprocessRequest,
  apiKey?: string,
  timeoutMs: number = 120_000,
  _client?: Anthropic  // Optional: injected in tests
): Promise<SubprocessResponse> {
  const startTime = Date.now();

  const resolvedApiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
  if (!resolvedApiKey) {
    return {
      success: false,
      content: "",
      tokens: { input: 0, output: 0 },
      duration: Date.now() - startTime,
      error: "ANTHROPIC_API_KEY is not set",
    };
  }

  try {
    console.log(`[Skills API] Calling Anthropic API for session ${request.sessionId}`);

    // Load memory modules for recordTurn
    await loadMemoryModules();

    // Record user turn IMMEDIATELY (before processing)
    // This ensures the prompt is persisted even if the API call or service crashes.
    console.log(`[Skills API] Pre-recording user turn to memory...`);
    await recordTurn({
      sessionId: request.sessionId,
      discordUserId: request.userId,
      discordChannelId: request.channelId,
      role: "user",
      content: request.userMessage,
      timestamp: Date.now(),
      metadata: {
        messageType: request.messageType,
        attachmentCount: request.attachmentPaths?.length ?? 0,
        tokens: estimateTokens(request.userMessage),
      },
    });

    const prompt = await buildPrompt(request);
    const inputTokenEstimate = estimateTokens(prompt);
    console.log(`[Skills API] Prompt built (~${inputTokenEstimate} tokens)`);

    const client = _client ?? new Anthropic({
      apiKey: resolvedApiKey,
      timeout: timeoutMs,
    });

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: DISCORD_SYSTEM_CONTEXT,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text content from the response
    const textBlocks = response.content.filter((block) => block.type === "text");
    const output = textBlocks.map((block) => (block as { type: "text"; text: string }).text).join("\n");

    const outputTokens = response.usage?.output_tokens ?? estimateTokens(output);
    const inputTokens = response.usage?.input_tokens ?? inputTokenEstimate;

    // Record assistant response to memory
    // (User turn was already recorded before processing)
    await recordTurn({
      sessionId: request.sessionId,
      discordUserId: request.userId,
      discordChannelId: request.channelId,
      role: "assistant",
      content: output,
      timestamp: Date.now(),
      metadata: { tokens: outputTokens },
    });

    // Extract semantic memories asynchronously (non-blocking)
    extractAndSaveMemories(
      request.userMessage,
      output,
      request.sessionId,
      "discord"
    ).catch((err) => console.error("[Skills API] Memory extraction failed:", err));

    const duration = Date.now() - startTime;
    console.log(`[Skills API] Response complete (${duration}ms, ${outputTokens} output tokens)`);

    return {
      success: true,
      content: output,
      tokens: {
        input: inputTokens,
        output: outputTokens,
      },
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Skills API] Call failed: ${errorMessage}`);

    return {
      success: false,
      content: "",
      tokens: { input: 0, output: 0 },
      duration,
      error: errorMessage,
    };
  }
}
