#!/usr/bin/env bun

/**
 * Session Pattern Tracking Hook (Phase 3)
 *
 * Triggered on Stop event (session end) to:
 * 1. Collect session metadata (projects, tools, memories used)
 * 2. Save session to memory-system database
 * 3. Analyze patterns from recent sessions
 * 4. Store patterns for proactive suggestions
 *
 * This hook enables the memory system to detect usage patterns and provide
 * intelligent proactive suggestions in future sessions.
 */

import { readFileSync, existsSync } from "fs";
import path from "path";

interface ToolEntry {
  tool: string;
  timestamp?: number;
  input?: Record<string, unknown>;
  output?: unknown;
}

interface SessionEndEvent {
  sessionId: string;
  conversation_id?: string;
  timestamp: number;
}

/**
 * Extract projects, tools, and files from raw tool outputs
 */
function analyzeSessionToolUsage(
  conversationId: string,
  yearMonth: string,
  historyDir: string
): {
  projects: string[];
  toolsCalled: string[];
  filesModified: string[];
} {
  const projects = new Set<string>();
  const toolsCalled = new Set<string>();
  const filesModified = new Set<string>();

  try {
    const rawOutputsDir = path.join(historyDir, "raw-outputs", yearMonth);

    if (!existsSync(rawOutputsDir)) {
      return {
        projects: Array.from(projects),
        toolsCalled: Array.from(toolsCalled),
        filesModified: Array.from(filesModified),
      };
    }

    // Read raw outputs for this session
    const files = Bun.globSync("*.jsonl", { cwd: rawOutputsDir });

    for (const file of files) {
      const filePath = path.join(rawOutputsDir, file);
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as ToolEntry & {
            session: string;
            tool: string;
          };

          if (entry.session === conversationId) {
            // Track tool usage
            toolsCalled.add(entry.tool);

            // Extract file paths from Read/Write/Edit/Glob operations
            if (
              (entry.tool === "Read" || entry.tool === "Glob") &&
              entry.input?.file_path
            ) {
              const filePath = String(entry.input.file_path);
              // Try to infer project from path
              const projectMatch = filePath.match(/\/Projects\/([^/]+)\//);
              if (projectMatch) {
                projects.add(projectMatch[1]);
              }
            }

            if (
              (entry.tool === "Edit" || entry.tool === "Write") &&
              entry.input?.file_path
            ) {
              const filePath = String(entry.input.file_path);
              filesModified.add(filePath);
              const projectMatch = filePath.match(/\/Projects\/([^/]+)\//);
              if (projectMatch) {
                projects.add(projectMatch[1]);
              }
            }
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  } catch (error) {
    console.error(`Error analyzing session: ${error}`);
  }

  return {
    projects: Array.from(projects),
    toolsCalled: Array.from(toolsCalled),
    filesModified: Array.from(filesModified),
  };
}

/**
 * Save session and analyze patterns
 */
async function recordSessionAndPatterns(event: SessionEndEvent): Promise<void> {
  const memoryServiceUrl = process.env.MEMORY_SERVICE_URL || "http://localhost:4242";
  const conversationId = event.conversation_id || event.sessionId;

  const now = new Date();
  const yearMonth = now.toISOString().substring(0, 7);

  const historyDir = path.join(
    process.env.HOME || "~",
    ".claude",
    "projects",
    process.env.PAI_PROJECT_ID || "default_project",
    "History"
  );

  // Analyze session usage
  const { projects, toolsCalled } = analyzeSessionToolUsage(
    conversationId,
    yearMonth,
    historyDir
  );

  try {
    // Call memory-system API to record session and analyze patterns
    const response = await fetch(`${memoryServiceUrl}/memory/session/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: conversationId,
        sessionStart: event.timestamp - 30 * 60 * 1000, // Rough estimate: 30 min session
        sessionEnd: event.timestamp,
        projects,
        toolsCalled,
        // Note: memories retrieved/used would need to be tracked separately
        // This is a placeholder structure
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn(
        `[Phase 3] Failed to record session: ${response.status} - ${error}`
      );
      return;
    }

    const result = (await response.json()) as any;

    if (result.patterns && result.patterns.length > 0) {
      console.log(
        `[Phase 3] Detected ${result.patterns.length} patterns from this session`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      console.warn(
        `[Phase 3] Memory service timeout - skipping session pattern analysis`
      );
    } else {
      console.warn(
        `[Phase 3] Error recording session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

async function main() {
  // Parse input from stdin
  let input = "";

  // Read all stdin data with proper error handling
  const chunks: Uint8Array[] = [];
  const reader = Bun.stdin.stream().getReader?.();

  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } catch {
      // Silence stream read errors
    }
  }

  if (chunks.length > 0) {
    input = new TextDecoder().decode(Buffer.concat(chunks.map(c => Buffer.from(c))));
  } else {
    // Fallback to synchronous read
    try {
      const buffer = Buffer.allocUnsafe(4096);
      const bytesRead = Bun.stdin.readSync(buffer);
      input = buffer.toString("utf-8", 0, bytesRead);
    } catch {
      // Silent fallback
    }
  }

  if (!input || input.trim() === "") {
    process.exit(0);
  }

  try {
    const event: SessionEndEvent = JSON.parse(input);
    await recordSessionAndPatterns(event);
  } catch (error) {
    // Silently fail - don't break session shutdown
    console.error(`[Phase 3] Hook error: ${error}`);
  }

  process.exit(0);
}

main().catch(() => {
  process.exit(0);
});
