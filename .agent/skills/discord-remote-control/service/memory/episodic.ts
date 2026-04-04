/**
 * Episodic Memory Management
 * Stores and retrieves timestamped conversation turns with decay
 */

import {
  saveConversationMemory,
  getSessionConversations,
  getMemoryInstance,
} from "./db.ts";

export interface EpisodicMemory {
  sessionId: string;
  discordUserId: string;
  discordChannelId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata?: {
    messageType?: string;
    attachmentCount?: number;
    tokens?: number;
  };
}

/**
 * Save a conversation turn to episodic memory
 */
export async function recordTurn(memory: EpisodicMemory): Promise<string> {
  const turnId = await saveConversationMemory({
    sessionId: memory.sessionId,
    discordUserId: memory.discordUserId,
    discordChannelId: memory.discordChannelId,
    role: memory.role,
    content: memory.content,
    timestamp: memory.timestamp,
    metadata: memory.metadata,
  });

  console.log(
    `📝 Recorded ${memory.role} turn (${memory.content.substring(0, 30)}...)`
  );
  return turnId;
}

/**
 * Retrieve recent conversation history
 */
export async function getRecentTurns(
  sessionId: string,
  count: number = 10
): Promise<EpisodicMemory[]> {
  const turns = await getSessionConversations(sessionId, count);

  // Reverse to get chronological order (newest last)
  return turns.reverse() as EpisodicMemory[];
}

/**
 * Get conversation context for injecting into prompts
 * Returns formatted string suitable for prepending to user message
 */
export async function buildConversationContext(
  sessionId: string,
  maxTurns: number = 10,
  maxTokens: number = 2000
): Promise<string> {
  try {
    const turns = await getRecentTurns(sessionId, maxTurns);

    if (turns.length === 0) {
      return ""; // No prior context
    }

    let contextStr = "**Recent Conversation Context:**\n\n";
    let tokenCount = 0;
    const tokensPerChar = 0.25; // Rough estimate: 4 chars per token

    for (const turn of turns) {
      const turnText = `**${turn.role === "user" ? "You" : "Sam"}**: ${turn.content}\n`;
      const estimatedTokens = turnText.length * tokensPerChar;

      if (tokenCount + estimatedTokens > maxTokens) {
        contextStr += "\n_...earlier context omitted..._\n";
        break;
      }

      contextStr += turnText;
      tokenCount += estimatedTokens;
    }

    return contextStr;
  } catch (error) {
    console.error("Error building conversation context:", error);
    return ""; // Graceful fallback
  }
}

/**
 * Search for specific topics in conversation history
 */
export async function searchConversation(
  sessionId: string,
  query: string
): Promise<EpisodicMemory[]> {
  const memory = getMemoryInstance();

  const results = memory.query("conversations", {
    sessionId,
    filter: {
      content: { $contains: query },
    },
  });

  return results as EpisodicMemory[];
}

/**
 * Calculate conversation statistics
 */
export async function getConversationStats(
  sessionId: string
): Promise<{
  totalTurns: number;
  userTurns: number;
  assistantTurns: number;
  avgUserMessageLength: number;
  avgAssistantMessageLength: number;
  timeSpan: number; // milliseconds
}> {
  const turns = await getRecentTurns(sessionId, 1000); // Get all available

  const userTurns = turns.filter((t) => t.role === "user");
  const assistantTurns = turns.filter((t) => t.role === "assistant");

  const avgUserLength =
    userTurns.length > 0
      ? userTurns.reduce((sum, t) => sum + t.content.length, 0) / userTurns.length
      : 0;

  const avgAssistantLength =
    assistantTurns.length > 0
      ? assistantTurns.reduce((sum, t) => sum + t.content.length, 0) /
        assistantTurns.length
      : 0;

  const timeSpan =
    turns.length > 1
      ? turns[turns.length - 1].timestamp - turns[0].timestamp
      : 0;

  return {
    totalTurns: turns.length,
    userTurns: userTurns.length,
    assistantTurns: assistantTurns.length,
    avgUserMessageLength: Math.round(avgUserLength),
    avgAssistantMessageLength: Math.round(avgAssistantLength),
    timeSpan,
  };
}

/**
 * Clear old conversation turns (beyond retention period)
 */
export async function pruneOldTurns(
  sessionId: string,
  retentionDays: number = 30
): Promise<number> {
  const memory = getMemoryInstance();
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  // Get old turns to count them
  const oldTurns = memory.query("conversations", {
    sessionId,
    filter: {
      timestamp: { $lt: cutoffTime },
    },
  });

  if (oldTurns.length > 0) {
    // Delete old conversation turns directly
    memory.deleteOld("conversations", sessionId, cutoffTime);
    console.log(
      `📋 Pruned ${oldTurns.length} conversation turns older than ${retentionDays} days`
    );
  }

  return oldTurns.length;
}
