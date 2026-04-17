/**
 * Memory Retrieval Module
 * Fetches conversation context from memory-system for Discord sessions
 *
 * Retrieves:
 * - Last 2 Discord user messages
 * - All corresponding assistant responses to those user messages
 *
 * Used to rebuild full conversation context for subprocess prompts
 */

const MEMORY_SERVICE_URL = process.env.MEMORY_SERVICE_URL || "http://localhost:4242";
const ENABLE_MEMORY_HOOKS = process.env.ENABLE_MEMORY_HOOKS === "true";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Retrieve the last 2 user messages and all assistant responses from memory-system
 * Returns a formatted string suitable for injection into the subprocess prompt
 */
export async function retrieveConversationContext(
  sessionId: string
): Promise<string> {
  if (!ENABLE_MEMORY_HOOKS) {
    return ""; // Memory disabled
  }

  try {
    const response = await fetch(
      `${MEMORY_SERVICE_URL}/memory/retrieve-conversation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          limit: 2, // Last 2 user messages
          includeAllAssistantResponses: true,
        }),
      }
    );

    if (!response.ok) {
      console.warn(
        `⚠️  Memory service returned ${response.status} when retrieving conversation`
      );
      return "";
    }

    const data = await response.json();
    const turns = data.turns as ConversationTurn[] | undefined;

    if (!turns || turns.length === 0) {
      return ""; // No prior conversation
    }

    // Format conversation for context injection
    let contextBlock = "## Previous Conversation\n\n";

    for (const turn of turns) {
      const roleLabel = turn.role === "user" ? "User" : "Assistant";
      contextBlock += `**${roleLabel}**: ${turn.content}\n\n`;
    }

    return contextBlock;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Failed to retrieve conversation context: ${msg}`);
    return "";
  }
}

/**
 * Health check: verify memory-system is accessible
 */
export async function checkMemoryHealthy(): Promise<boolean> {
  if (!ENABLE_MEMORY_HOOKS) {
    return true; // Memory disabled, so "healthy" (not being used)
  }

  try {
    const response = await fetch(`${MEMORY_SERVICE_URL}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}
