/**
 * Skills API Client - Alternative Claude invocation backend
 *
 * Calls the Anthropic Messages API directly (container.skills config)
 * as an alternative to spawning a Claude Code CLI subprocess.
 *
 * Interface mirrors subprocess.ts so callers can swap backends without
 * changing their own code.
 *
 * Memory Integration:
 * - If ENABLE_MEMORY_HOOKS=true: Calls memory-system API (localhost:4242) for context injection
 * - If ENABLE_MEMORY_HOOKS=false: Runs standalone without memory context
 * - If memory-system is unavailable: Logs warning, continues without context
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SubprocessRequest, SubprocessResponse } from "./subprocess.ts";

// Configuration
const ENABLE_MEMORY_HOOKS = process.env.ENABLE_MEMORY_HOOKS === "true";
const MEMORY_SERVICE_URL = process.env.MEMORY_SERVICE_URL || "http://localhost:4242";

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
 * Call memory-system API to get context injection for a session.
 * Returns the context prefix to prepend to the prompt.
 * If memory-system is unavailable, returns empty string.
 */
async function getMemoryContext(sessionId: string, userMessage: string): Promise<string> {
  if (!ENABLE_MEMORY_HOOKS) {
    return ""; // Memory disabled
  }

  try {
    const response = await fetch(`${MEMORY_SERVICE_URL}/memory/inject-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        userMessage,
        maxTotalTokens: 2500,
      }),
    });

    if (!response.ok) {
      console.warn(`⚠️  Memory service returned ${response.status}`);
      return "";
    }

    const data = await response.json();
    return data.contextPrefix || "";
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Memory-system unavailable: ${msg}`);
    return "";
  }
}

/**
 * Record a turn to the memory-system API.
 * Non-blocking; logs warnings if memory-system is unavailable.
 */
async function recordTurnToMemory(turnData: {
  sessionId: string;
  discordUserId: string;
  discordChannelId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  if (!ENABLE_MEMORY_HOOKS) {
    return; // Memory disabled
  }

  try {
    const response = await fetch(`${MEMORY_SERVICE_URL}/memory/record-turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(turnData),
    });

    if (!response.ok) {
      console.warn(`⚠️  Memory service returned ${response.status} when recording turn`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Failed to record turn to memory-system: ${msg}`);
  }
}

/**
 * Extract and save semantic memories via memory-system API.
 * Non-blocking; logs warnings if memory-system is unavailable.
 */
async function extractMemoriesAsync(
  userMessage: string,
  assistantResponse: string,
  sessionId: string
): Promise<void> {
  if (!ENABLE_MEMORY_HOOKS) {
    return; // Memory disabled
  }

  try {
    await fetch(`${MEMORY_SERVICE_URL}/memory/extract-and-save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage,
        assistantResponse,
        sessionId,
        source: "discord-remote-control",
      }),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Memory extraction failed: ${msg}`);
  }
}

/**
 * Build the user prompt from the request, mirroring the logic in subprocess.ts
 */
async function buildPrompt(request: SubprocessRequest): Promise<string> {
  // Get memory context (if enabled)
  let contextPrefix = "";
  if (ENABLE_MEMORY_HOOKS) {
    console.log(`[Skills API] Fetching memory context...`);
    contextPrefix = await getMemoryContext(request.sessionId, request.userMessage);
    if (contextPrefix) {
      console.log(`   Memory context retrieved (${estimateTokens(contextPrefix)} tokens)`);
    }
  }

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
    if (ENABLE_MEMORY_HOOKS) {
      console.log(`   Memory hooks: ENABLED`);
    } else {
      console.log(`   Memory hooks: DISABLED (standalone mode)`);
    }

    // Record user turn IMMEDIATELY (before processing) — if memory enabled
    if (ENABLE_MEMORY_HOOKS) {
      console.log(`[Skills API] Recording user turn to memory...`);
      recordTurnToMemory({
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
      }).catch(() => {}); // Non-blocking
    }

    const prompt = await buildPrompt(request);
    const inputTokenEstimate = estimateTokens(prompt);
    console.log(`[Skills API] Prompt built (~${inputTokenEstimate} tokens)`);

    const client = _client ?? new Anthropic({
      apiKey: resolvedApiKey,
      timeout: timeoutMs,
    });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
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

    // Record assistant response to memory (if enabled)
    if (ENABLE_MEMORY_HOOKS) {
      console.log(`[Skills API] Recording assistant response to memory...`);
      recordTurnToMemory({
        sessionId: request.sessionId,
        discordUserId: request.userId,
        discordChannelId: request.channelId,
        role: "assistant",
        content: output,
        timestamp: Date.now(),
        metadata: { tokens: outputTokens },
      }).catch(() => {}); // Non-blocking

      // Extract semantic memories asynchronously (non-blocking)
      extractMemoriesAsync(request.userMessage, output, request.sessionId).catch(() => {});
    }

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
