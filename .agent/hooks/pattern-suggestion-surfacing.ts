#!/usr/bin/env bun

/**
 * Pattern Suggestion Surfacing Hook (Phase 3 - Query-Time)
 *
 * Triggered on PostToolUse to detect when tool patterns apply and
 * suggest related facts or approaches based on detected patterns.
 *
 * For example:
 * - If you just read a file in project X, and pattern shows facts A,B,C are usually needed → suggest them
 * - If you're using multiple tools that match a successful pattern → show the pattern confidence
 * - If you're querying at a time that historically succeeds → acknowledge the pattern
 */

import path from "path";

interface ToolUseEvent {
  tool_name: string;
  tool_input?: Record<string, unknown>;
  tool_response?: any;
  conversation_id?: string;
  timestamp?: string;
}

interface PatternSuggestion {
  type: string;
  confidence: number;
  description: string;
  suggestion: string;
}

/**
 * Determine project from file path if available
 */
function extractProjectFromFilePath(filePath?: string): string | null {
  if (!filePath || typeof filePath !== "string") return null;
  const match = filePath.match(/\/Projects\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Check if current tool usage matches known patterns
 */
async function getPatternSuggestions(
  toolName: string,
  toolInput: Record<string, unknown> | undefined,
  projectId: string | null
): Promise<PatternSuggestion[]> {
  if (!projectId) {
    return []; // Can't suggest without project context
  }

  const memoryServiceUrl = process.env.MEMORY_SERVICE_URL || "http://localhost:4242";
  const suggestions: PatternSuggestion[] = [];

  try {
    const response = await fetch(
      `${memoryServiceUrl}/memory/patterns/suggestions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          limit: 3,
          context: { toolName },
        }),
        signal: AbortSignal.timeout(1500),
      }
    );

    if (response.ok) {
      const data = (await response.json()) as any;
      if (data.success && Array.isArray(data.suggestions)) {
        return data.suggestions.slice(0, 2); // Limit to 2 suggestions
      }
    }
  } catch (error) {
    // Silently fail - don't interrupt tool flow
    if (!(error instanceof Error && error.message.includes("timeout"))) {
      // Log non-timeout errors only
    }
  }

  return suggestions;
}

/**
 * Format suggestions for display in stdout
 */
function formatSuggestionsForDisplay(
  suggestions: PatternSuggestion[],
  toolName: string
): string {
  if (suggestions.length === 0) return "";

  const suggestionLines = suggestions
    .map((s) => {
      const confidence = Math.round(s.confidence * 100);
      return `  💡 **[${confidence}%]** ${s.suggestion}`;
    })
    .join("\n");

  return `
## 🎯 Pattern Suggestions (Based on your ${toolName} usage)

${suggestionLines}

*Tip: These suggestions are powered by Phase 3 pattern analysis. Run \`/accept-pattern\` to lock in suggestions for future sessions.*
`;
}

async function main() {
  try {
    // Read input from stdin
    const input = await Bun.stdin.text();
    if (!input || input.trim() === "") {
      process.exit(0);
    }

    const event: ToolUseEvent = JSON.parse(input);

    // Only suggest for tools that might benefit from pattern matching
    const suggestibleTools = ["Read", "Grep", "Glob", "Bash", "Edit"];
    if (!suggestibleTools.includes(event.tool_name)) {
      process.exit(0);
    }

    // Extract project context from file paths if available
    let projectId: string | null = null;

    // Try to get project from tool input
    if (event.tool_input) {
      if (event.tool_input.file_path) {
        projectId = extractProjectFromFilePath(
          String(event.tool_input.file_path)
        );
      } else if (event.tool_input.path) {
        projectId = extractProjectFromFilePath(String(event.tool_input.path));
      }
    }

    // Fall back to environment variable
    if (!projectId) {
      projectId = process.env.CLAUDE_PROJECT_NAME || null;
    }

    if (!projectId) {
      process.exit(0); // No project context
    }

    // Get pattern suggestions
    const suggestions = await getPatternSuggestions(
      event.tool_name,
      event.tool_input,
      projectId
    );

    // Format and output suggestions
    const output = formatSuggestionsForDisplay(suggestions, event.tool_name);
    if (output.trim()) {
      console.log(output);
    }

    process.exit(0);
  } catch (error) {
    // Silently fail - don't break tool execution
    process.exit(0);
  }
}

main();
