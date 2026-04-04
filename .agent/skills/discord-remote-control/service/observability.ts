/**
 * Observability & Event Logging - Phase 8
 * Logs Discord events to SAM Observability dashboard for real-time monitoring
 */

import fs from "fs/promises";
import path from "path";
import { homedir } from "os";

interface HealthStatus {
  service: string;
  status: "healthy" | "unhealthy";
  timestamp: string;
  details?: string;
}

// Global session ID for this discord-remote-control instance
let SESSION_ID = `discord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Get path to today's Observability event file
 */
function getObservabilityEventFile(): string {
  // Hooks write to $PAI_DIR/history/raw-outputs/ - use this directly
  let historyDir: string;

  if (process.env.PAI_DIR) {
    // Hooks write to $PAI_DIR/history/raw-outputs/ - use this directly
    historyDir = path.join(process.env.PAI_DIR, "history", "raw-outputs");
  } else if (process.env.SAM_DIR) {
    // Fallback to SAM_DIR/.agent/history/raw-outputs
    historyDir = path.join(process.env.SAM_DIR, ".agent", "history", "raw-outputs");
  } else {
    // Default: assume sam project is at ~/Projects/sam
    historyDir = path.join(homedir(), "Projects", "sam", ".agent", "history", "raw-outputs");
  }

  const now = new Date();
  // Convert to PST for consistency with Observability
  const pstDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const year = pstDate.getFullYear();
  const month = String(pstDate.getMonth() + 1).padStart(2, "0");
  const day = String(pstDate.getDate()).padStart(2, "0");

  const monthDir = path.join(historyDir, `${year}-${month}`);
  return path.join(monthDir, `${year}-${month}-${day}_all-events.jsonl`);
}

/**
 * Log a Discord event to Observability dashboard
 */
export async function logDiscordEvent(
  eventType: string,
  data: Record<string, any>,
  summary?: string
): Promise<void> {
  try {
    const eventFile = getObservabilityEventFile();

    // Create HookEvent format for Observability compatibility
    const event = {
      source_app: "discord-remote-control",
      session_id: SESSION_ID,
      hook_event_type: eventType,
      payload: data,
      summary: summary || eventType,
      timestamp: Date.now(),
    };

    // Ensure directory exists
    await fs.mkdir(path.dirname(eventFile), { recursive: true });

    // Append to event file
    await fs.appendFile(eventFile, JSON.stringify(event) + "\n");
  } catch (error) {
    console.error("Failed to log event:", error);
  }
}

/**
 * Set or get the session ID
 */
export function setSessionId(sessionId: string): void {
  SESSION_ID = sessionId;
}

export function getSessionId(): string {
  return SESSION_ID;
}

/**
 * Log message received event
 */
/**
 * Sanitize content for logging — strip potential secrets and PII
 */
function sanitizeForLog(text: string): string {
  return text
    // Redact common API key patterns
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED_KEY]")
    .replace(/MTQ[A-Za-z0-9._-]{50,}/g, "[REDACTED_TOKEN]")
    .replace(/ghp_[A-Za-z0-9]{36,}/g, "[REDACTED_GH_TOKEN]")
    .replace(/xoxb-[A-Za-z0-9-]+/g, "[REDACTED_SLACK_TOKEN]")
    // Redact email-like patterns
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
}

export async function logMessageReceived(
  userId: string,
  channelId: string,
  messageType: string,
  preview: string,
  sessionId?: string
): Promise<void> {
  await logDiscordEvent("DiscordMessageReceived", {
    discord_user_id: userId,
    discord_channel_id: channelId,
    message_type: messageType,
    message_preview: sanitizeForLog(preview.substring(0, 100)),
    session_id: sessionId,
  }, `Message received: ${messageType}`);
}

/**
 * Log response sent event
 */
export async function logResponseSent(
  userId: string,
  channelId: string,
  responseType: string,
  hasAttachments: boolean,
  sessionId?: string
): Promise<void> {
  await logDiscordEvent("DiscordResponseSent", {
    discord_user_id: userId,
    discord_channel_id: channelId,
    response_type: responseType,
    has_attachments: hasAttachments,
    session_id: sessionId,
  }, `Response sent: ${responseType}${hasAttachments ? ' (with attachments)' : ''}`);
}

/**
 * Log voice synthesis event
 */
export async function logVoiceSynthesis(
  textLength: number,
  success: boolean,
  audioPath?: string
): Promise<void> {
  await logDiscordEvent("DiscordVoiceSynthesis", {
    text_length: textLength,
    success,
    audio_file: audioPath,
  }, `Voice synthesis ${success ? 'succeeded' : 'failed'}: ${textLength} chars`);
}

/**
 * Log voice transcription event
 */
export async function logVoiceTranscription(
  duration: number,
  success: boolean,
  language?: string
): Promise<void> {
  await logDiscordEvent("DiscordVoiceTranscription", {
    audio_duration: duration,
    success,
    language,
  }, `Voice transcription ${success ? 'succeeded' : 'failed'}: ${duration}ms`);
}

/**
 * Log subprocess invocation
 */
export async function logSubprocessCall(
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
  duration: number
): Promise<void> {
  await logDiscordEvent("DiscordSubprocessCall", {
    session_id: sessionId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    duration_ms: duration,
  }, `Claude subprocess: ${inputTokens}→${outputTokens} tokens in ${duration}ms`);
}

/**
 * Log error event
 */
export async function logError(
  sessionId: string,
  errorType: string,
  message: string
): Promise<void> {
  await logDiscordEvent("DiscordError", {
    session_id: sessionId,
    error_type: errorType,
    error_message: message,
  }, `Error: ${errorType}`);
}

/**
 * Check voice server health
 */
export async function checkVoiceServerHealth(): Promise<HealthStatus> {
  try {
    const response = await fetch("http://localhost:8888/health", {
      timeout: 2000,
    }).catch(() => null);

    return {
      service: "voice-server",
      status: response?.ok ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      details: response ? `HTTP ${response.status}` : "Connection timeout",
    };
  } catch (error) {
    return {
      service: "voice-server",
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      details: String(error),
    };
  }
}

/**
 * Check whisper.cpp availability
 */
export async function checkWhisperHealth(): Promise<HealthStatus> {
  try {
    const model = process.env.WHISPER_MODEL || "base";

    // Try multiple possible locations for whisper.cpp (prioritize ~/.claude/)
    const possiblePaths = [
      // Primary: ~/.claude/tools/whisper.cpp
      path.join(homedir(), ".claude", "tools", "whisper.cpp", "build", "bin", "whisper-cli"),
      // Fallback: ~/Projects/sam/.agent/tools/whisper.cpp
      path.join(homedir(), "Projects", "sam", ".agent", "tools", "whisper.cpp", "build", "bin", "whisper-cli"),
    ];

    const modelPaths = [
      path.join(homedir(), ".claude", "tools", "whisper.cpp", "models", `ggml-${model}.bin`),
      path.join(homedir(), "Projects", "sam", ".agent", "tools", "whisper.cpp", "models", `ggml-${model}.bin`),
    ];

    let cliFound = false;
    let modelFound = false;

    for (const cliPath of possiblePaths) {
      if (await fs.stat(cliPath).then(() => true).catch(() => false)) {
        cliFound = true;
        break;
      }
    }

    for (const modelPath of modelPaths) {
      if (await fs.stat(modelPath).then(() => true).catch(() => false)) {
        modelFound = true;
        break;
      }
    }

    if (!cliFound) {
      return {
        service: "whisper-cpp",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        details: "whisper-cli binary not found in standard locations",
      };
    }

    if (!modelFound) {
      return {
        service: "whisper-cpp",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        details: `Model ggml-${model}.bin not found in standard locations`,
      };
    }

    return {
      service: "whisper-cpp",
      status: "healthy",
      timestamp: new Date().toISOString(),
      details: `Model: ${model}`,
    };
  } catch (error) {
    return {
      service: "whisper-cpp",
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      details: String(error),
    };
  }
}

/**
 * Check memory database health
 */
export async function checkMemoryHealthStatus(): Promise<HealthStatus> {
  try {
    const paiDir = process.env.PAI_DIR;

    if (!paiDir) {
      return {
        service: "memory-db",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        details: "PAI_DIR not set",
      };
    }

    // Check if memory database directory exists
    const memoryDir = path.join(paiDir, "discord-remote-control");

    try {
      const stat = await fs.stat(memoryDir);
      return {
        service: "memory-db",
        status: stat.isDirectory() ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        details: `Directory accessible`,
      };
    } catch {
      return {
        service: "memory-db",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        details: "Memory database directory not found",
      };
    }
  } catch (error) {
    return {
      service: "memory-db",
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      details: String(error),
    };
  }
}

/**
 * Perform full health check
 */
export async function performHealthCheck(): Promise<HealthStatus[]> {
  const checks = await Promise.all([
    checkVoiceServerHealth(),
    checkWhisperHealth(),
    checkMemoryHealthStatus(),
  ]);

  // Log health check result
  const allHealthy = checks.every((c) => c.status === "healthy");
  await logDiscordEvent("HealthCheck", {
    all_healthy: allHealthy,
    checks: checks,
  });

  return checks;
}

/**
 * Get observability statistics
 */
export async function getObservabilityStats(): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  recentEvents: DiscordEvent[];
}> {
  try {
    const content = await fs.readFile(HISTORY_FILE, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    const eventsByType: Record<string, number> = {};
    const recentEvents: DiscordEvent[] = [];

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        eventsByType[event.event_type] =
          (eventsByType[event.event_type] || 0) + 1;
        recentEvents.push(event);
      } catch {
        // Skip malformed lines
      }
    }

    return {
      totalEvents: lines.length,
      eventsByType,
      recentEvents: recentEvents.slice(-10), // Last 10 events
    };
  } catch (error) {
    return {
      totalEvents: 0,
      eventsByType: {},
      recentEvents: [],
    };
  }
}
