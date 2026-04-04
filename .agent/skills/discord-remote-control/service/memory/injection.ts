/**
 * Context Injection for Claude Prompts
 * Builds multi-layer memory context: episodic + semantic
 *
 * Layer 1: Episodic (recent conversation turns)
 * Layer 2: Semantic (important topics/facts learned)
 * Result: Deduplicated context prefix for Claude prompts
 */

import { buildConversationContext, searchConversation } from "./episodic.ts";
import { hybridSearch } from "./hybrid-search.ts";

interface InjectedContext {
  episodic: string;
  semantic: string;
  combined: string;
  metadata: {
    episodicTurns: number;
    semanticMemories: number;
    totalTokensUsed: number;
  };
}

/**
 * Build complete context injection for Claude prompt
 *
 * Returns a context string to prepend to user message.
 * Handles deduplication and respects token budgets.
 */
export async function buildContextInjection(
  sessionId: string,
  userQuery: string,
  options?: {
    maxEpisodicTokens?: number;
    maxSemanticTokens?: number;
    maxTotalTokens?: number;
    /** Filter semantic memories to a specific project context */
    project?: string;
  }
): Promise<InjectedContext> {
  const maxEpisodicTokens = options?.maxEpisodicTokens || 1500;
  const maxSemanticTokens = options?.maxSemanticTokens || 2000;
  const maxTotalTokens = options?.maxTotalTokens || 3000;

  let episodic = "";
  let semantic = "";
  let totalTokens = 0;

  try {
    // Layer 1: Episodic Context (recent turns)
    console.log(`🧠 Building episodic context for session ${sessionId}`);
    episodic = await buildConversationContext(
      sessionId,
      20,
      maxEpisodicTokens
    );
    totalTokens += estimateTokens(episodic);

    // Layer 2: Semantic Context (similar topics with hybrid search)
    if (totalTokens < maxTotalTokens) {
      console.log(`🧠 Searching for relevant semantic memories (hybrid search, cross-session)...`);
      const semanticMemories = await hybridSearch(
        userQuery,
        {
          sessionId: undefined, // Search across ALL sessions for accumulated learning
          limit: 5,
        }
      );

      // Filter by project if specified — prioritize same-project memories
      const projectFilter = options?.project;
      const filteredMemories = projectFilter
        ? [
            ...semanticMemories.filter((m: any) => m.project === projectFilter),
            ...semanticMemories.filter((m: any) => m.project !== projectFilter),
          ].slice(0, semanticMemories.length)
        : semanticMemories;

      if (filteredMemories.length > 0) {
        semantic = "**Relevant Prior Learning:**\n\n";

        for (const memory of filteredMemories) {
          const confidencePct = (memory.confidence * 100).toFixed(0);
          const projectTag = (memory as any).project && (memory as any).project !== "sam"
            ? ` [${(memory as any).project}]`
            : "";
          const memoryText = `• **${memory.topic}**${projectTag}: ${memory.summary} (confidence: ${confidencePct}%)\n`;
          const memoryTokens = estimateTokens(memoryText);

          if (totalTokens + memoryTokens > maxTotalTokens) {
            semantic += "\n_...more memories available..._\n";
            break;
          }

          semantic += memoryText;
          totalTokens += memoryTokens;
        }
      }
    }

    // Combine and deduplicate
    const combined = dedupContext(episodic, semantic);

    const metadata = {
      episodicTurns: episodic.split("**You**:").length - 1,
      semanticMemories: semantic.split("•").length - 1,
      totalTokensUsed: estimateTokens(combined),
    };

    console.log(`✅ Context injection complete (${metadata.totalTokensUsed} tokens)`);

    return {
      episodic,
      semantic,
      combined,
      metadata,
    };
  } catch (error) {
    console.error("Error building context injection:", error);
    return {
      episodic: "",
      semantic: "",
      combined: "",
      metadata: {
        episodicTurns: 0,
        semanticMemories: 0,
        totalTokensUsed: 0,
      },
    };
  }
}

/**
 * Build prompt prefix from injected context
 * Formats context for prepending to user message
 */
export function formatContextForPrompt(context: InjectedContext): string {
  if (!context.combined) {
    return "";
  }

  return (
    `---
## Context from Memory
${context.combined}
---

` // Double newline before user message follows
  );
}

/**
 * Deduplicate content between episodic and semantic layers
 */
function dedupContext(episodic: string, semantic: string): string {
  if (!episodic && !semantic) return "";
  if (!semantic) return episodic;
  if (!episodic) return semantic;

  // Extract unique sentences from semantic to avoid duplication
  const episodicLines = new Set(episodic.split("\n"));
  const semanticLines = semantic
    .split("\n")
    .filter((line) => !episodicLines.has(line));

  return episodic + (semanticLines.length > 0 ? "\n" + semanticLines.join("\n") : "");
}

/**
 * Estimate tokens (rough: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Clear sensitive information from context
 * (e.g., tokens, passwords, API keys)
 */
export function sanitizeContext(context: string): string {
  // Remove common sensitive patterns
  let sanitized = context
    .replace(/token[_-]?[a-zA-Z0-9_\-\.]{20,}/gi, "[REDACTED_TOKEN]")
    .replace(/key[_-]?[a-zA-Z0-9_\-\.]{20,}/gi, "[REDACTED_KEY]")
    .replace(/password[_-]?[a-zA-Z0-9_\-\.]{8,}/gi, "[REDACTED_PASSWORD]")
    .replace(/bearer[_\s][a-zA-Z0-9_\-\.]{20,}/gi, "[REDACTED_BEARER]");

  return sanitized;
}

/**
 * Create session-specific context prompt
 */
export async function createSessionPromptPrefix(
  sessionId: string,
  userQuery: string,
  userInfo?: {
    discordUsername: string;
    discordUserId: string;
  },
  project?: string
): Promise<string> {
  const contextInjection = await buildContextInjection(sessionId, userQuery, { project });

  let prefix = "";

  // Add user context if available
  if (userInfo) {
    prefix += `**Current User**: ${userInfo.discordUsername} (ID: ${userInfo.discordUserId})\n\n`;
  }

  // Add memory context
  prefix += formatContextForPrompt(contextInjection);

  return prefix;
}
