/**
 * jay-gentic Subprocess Integration
 *
 * Spawns jay-gentic CLI as an AI backend for Discord responses
 * Mirrors the structure of subprocess.ts for Claude Code, but invokes
 * jay-gentic via stdin pipe for context injection
 *
 * Memory Integration:
 * - If ENABLE_MEMORY_HOOKS=true: Calls memory-system API (localhost:4242) for context injection
 * - If ENABLE_MEMORY_HOOKS=false: Runs standalone without memory context
 * - If memory-system is unavailable: Logs warning, continues without context
 *
 * The sam agent persona is loaded via --agent sam flag.
 * Output format: \nAI> <response>\n (prefix stripped before returning)
 */

import { spawn } from "bun";

// Configuration
const HOME = process.env.HOME || "/home";
const ENABLE_MEMORY_HOOKS = process.env.ENABLE_MEMORY_HOOKS === "true";
const MEMORY_SERVICE_URL = process.env.MEMORY_SERVICE_URL || "http://localhost:4242";

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

  // Remove markers from output text
  const cleanupPattern = /\[SAM_?ATTACH:([^:\]]+):([^\]]+)\]/g;
  const cleanedText = output.replace(cleanupPattern, "").trim();

  return { cleanedText, attachments };
}

/**
 * Token estimation helper (from subprocess.ts)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Call jay-gentic subprocess with memory context
 */
export async function callJayGenticSubprocess(
  request: SubprocessRequest
): Promise<SubprocessResponse> {
  const startTime = Date.now();

  try {
    console.log(`🧠 Calling jay-gentic subprocess for session ${request.sessionId}`);
    console.log(`   Message type: ${request.messageType}`);
    if (ENABLE_MEMORY_HOOKS) {
      console.log(`   Memory hooks: ENABLED`);
    } else {
      console.log(`   Memory hooks: DISABLED (standalone mode)`);
    }

    // NOTE: Memory context injection disabled for jg-subprocess.
    // Jay-gentic backend uses a different architecture and is typically used as a fallback.
    // If memory integration is needed for this backend, implement via HTTP API like subprocess.ts.
    let contextPrefix = "";

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

    // Add Discord context preamble (same as Claude Code's --append-system-prompt)
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

    // Prepend discord context to the prompt
    prompt = `${discordContext}\n\n---\n\n${prompt}`;

    console.log(`📝 Prompt built (${estimateTokens(prompt)} tokens)`);

    // Step 3: Spawn jay-gentic subprocess
    console.log(`⚙️  Spawning jay-gentic subprocess...`);

    // Send observability event for task start
    const observabilityUrl = process.env.OBSERVABILITY_URL || "http://localhost:5172";
    const taskStartEvent = {
      source_app: "jay-gentic",
      session_id: request.sessionId,
      hook_event_type: "TaskStarted",
      payload: {
        task_name: `Discord message from ${request.metadata?.username || 'user'}`,
        message_type: request.messageType,
        engine: "jay-gentic",
      },
      summary: `Task started: Discord ${request.messageType} message`,
      timestamp: Date.now(),
    };

    fetch(`${observabilityUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskStartEvent),
    }).catch(() => {
      // Silently fail if observability is unavailable
    });

    // Send subprocess_start event as well (for legacy tracking)
    const observabilityEvent = {
      type: "subprocess_start",
      engine: "jay-gentic",
      sessionId: request.sessionId,
      userId: request.userId,
      timestamp: Date.now(),
      messageType: request.messageType,
      promptTokens: estimateTokens(prompt),
    };

    fetch(`${observabilityUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(observabilityEvent),
    }).catch(() => {
      // Silently fail if observability is unavailable
    });

    // Ensure PATH includes the homebrew bin where jay-gentic wrapper is
    const env = { ...process.env };
    env.PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";

    const proc = spawn(["jay-gentic", "--agent", "sam", "--no-stream"], {
      stdin: Buffer.from(prompt),
      stdout: "pipe",
      stderr: "pipe",
      env,
    });

    // Collect output — jay-gentic outputs: \nAI> <response>\n
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

    // Strip the \nAI> prefix from output
    let output = rawOutput.replace(/^\n*AI>\s*/, "").trim();

    if (exitCode !== 0) {
      console.error(`📋 jay-gentic stderr:`, errorOutput || "(no stderr captured)");
      console.error(`📋 jay-gentic stdout:`, rawOutput || "(no stdout captured)");
      console.error(`📋 jay-gentic exit code:`, exitCode);
      throw new Error(
        `jay-gentic subprocess exited with code ${exitCode}: ${errorOutput || "(no error output)"}`
      );
    }

    // Step 4: Record the assistant response to memory
    console.log(`💾 Recording assistant response to memory...`);
    const tokens = estimateTokens(output);

    // NOTE: Memory recording disabled for jg-subprocess.
    // Jay-gentic backend uses a different architecture.
    // Memory integration can be added later via HTTP API if needed.

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
      } catch (err) {
        console.warn(`⚠️  Error validating attachment ${att.name}:`, err);
      }
    }

    // Calculate duration
    const duration = Date.now() - startTime;

    // NOTE: Observability logging disabled for jg-subprocess (legacy backend).
    // Keeping observability events but without logSubprocessCall dependency.

    // Send observability event for task completion
    const taskCompleteEvent = {
      source_app: "jay-gentic",
      session_id: request.sessionId,
      hook_event_type: "TaskCompleted",
      payload: {
        task_name: `Discord message from ${request.metadata?.username || 'user'}`,
        duration_ms: duration,
        engine: "jay-gentic",
        input_tokens: estimateTokens(prompt),
        output_tokens: tokens,
      },
      summary: `Task completed: Discord ${request.messageType} message (${duration}ms, ${tokens} tokens)`,
      timestamp: Date.now(),
    };

    fetch(`${observabilityUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskCompleteEvent),
    }).catch(() => {
      // Silently fail if observability is unavailable
    });

    // Send subprocess_complete event as well (for legacy tracking)
    const completeEvent = {
      type: "subprocess_complete",
      engine: "jay-gentic",
      sessionId: request.sessionId,
      userId: request.userId,
      timestamp: Date.now(),
      duration,
      success: true,
      outputTokens: tokens,
      inputTokens: estimateTokens(prompt),
    };

    fetch(`${observabilityUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completeEvent),
    }).catch(() => {
      // Silently fail if observability is unavailable
    });

    // Return response
    return {
      success: true,
      content: cleanedText,
      tokens: {
        input: estimateTokens(prompt),
        output: tokens,
      },
      duration,
      fileAttachments: validAttachments.length > 0 ? validAttachments : undefined,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`❌ jay-gentic subprocess error: ${errorMessage}`);

    // NOTE: Direct observability logging disabled for jg-subprocess.
    // Keeping observability events via HTTP API instead.

    // Send observability event for task failure
    const taskFailEvent = {
      source_app: "jay-gentic",
      session_id: request.sessionId,
      hook_event_type: "TaskFailed",
      payload: {
        task_name: `Discord message from ${request.metadata?.username || 'user'}`,
        duration_ms: duration,
        engine: "jay-gentic",
        error: errorMessage,
      },
      summary: `Task failed: ${errorMessage}`,
      timestamp: Date.now(),
    };

    fetch(`${observabilityUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskFailEvent),
    }).catch(() => {
      // Silently fail if observability is unavailable
    });

    // Send subprocess_error event as well (for legacy tracking)
    const errorEvent = {
      type: "subprocess_error",
      engine: "jay-gentic",
      sessionId: request.sessionId,
      userId: request.userId,
      timestamp: Date.now(),
      duration,
      error: errorMessage,
    };

    fetch(`${observabilityUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(errorEvent),
    }).catch(() => {
      // Silently fail if observability is unavailable
    });

    return {
      success: false,
      content: "",
      tokens: { input: 0, output: 0 },
      duration,
      error: errorMessage,
    };
  }
}
