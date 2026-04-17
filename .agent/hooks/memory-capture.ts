#!/usr/bin/env bun

/**
 * Memory Capture Hook for Claude Code
 * Automatically extracts facts from Claude Code sessions into the memory system.
 * Triggered on Stop event to capture conversational learning.
 *
 * Processes ALL user/assistant conversation pairs in the transcript,
 * enabling cross-modality memory building (CLI, headless, Discord).
 *
 * EXTERNALIZED DEPENDENCY:
 * This hook optionally delegates memory extraction to the memory-system service.
 * The actual API call logic lives in memory-system/hooks/externalized-memory-api.ts
 * Enable/disable via ENABLE_MEMORY_HOOKS environment variable (default: false).
 */

import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import path from 'path';

// Helper to safely convert Claude content (string or array of blocks) into plain text
function contentToText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c?.text) return c.text;
        if (c?.content) return String(c.content);
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
}

interface ConversationPair {
  userMessage: string;
  assistantResponse: string;
}

/**
 * Extract all user/assistant conversation pairs from a transcript.
 * Pairs are matched chronologically: each user message is paired with the
 * next assistant response that follows it.
 */
function extractConversationPairs(lines: string[]): ConversationPair[] {
  const pairs: ConversationPair[] = [];
  let currentUserMessage = '';

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      if (entry.type === 'user' && entry.message?.content) {
        const text = contentToText(entry.message.content);
        if (text.trim()) {
          currentUserMessage = text;
        }
      }

      if (entry.type === 'assistant' && entry.message?.content && currentUserMessage) {
        const text = contentToText(entry.message.content);
        if (text.trim()) {
          pairs.push({
            userMessage: currentUserMessage,
            assistantResponse: text,
          });
          currentUserMessage = ''; // Reset for next pair
        }
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  return pairs;
}

async function main() {
  // DEBUG: Log hook invocation
  const debugLog = (msg: string) => {
    const logDir = `${process.env.HOME}/.claude/logs`;
    const logPath = path.join(logDir, `memory-capture-debug.log`);
    try {
      mkdirSync(logDir, { recursive: true });
      appendFileSync(logPath, `[${new Date().toISOString()}] [sam] ${msg}\n`);
    } catch (e) {
      // Silently fail if logging doesn't work
    }
  };

  debugLog(`🧠 memory-capture hook invoked`);
  debugLog(`   cwd: ${process.cwd()}`);
  debugLog(`   env.PAI_DIR: ${process.env.PAI_DIR}`);
  debugLog(`   env.ENABLE_MEMORY_HOOKS: ${process.env.ENABLE_MEMORY_HOOKS}`);

  // Get input
  let input = '';
  const decoder = new TextDecoder();
  const reader = Bun.stdin.stream().getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      input += decoder.decode(value, { stream: true });
    }
  } catch (e) {
    debugLog(`❌ Error reading input: ${e}`);
    console.error(`❌ Error reading input: ${e}`);
    process.exit(0);
  }

  debugLog(`   input received: ${input ? `${input.length} bytes` : 'EMPTY'}`);

  if (!input) {
    debugLog(`⚠️ No input received - exiting (this is the likely problem)`);
    console.error('❌ No input received');
    process.exit(0);
  }

  let transcriptPath;
  let sessionId;
  let project: string | undefined;
  try {
    const parsed = JSON.parse(input);
    transcriptPath = parsed.transcript_path;
    // Extract session ID from transcript path (e.g. /path/to/sessions/abc123/transcript.jsonl)
    sessionId = transcriptPath?.split('/').slice(-2)[0] || 'unknown';

    // Derive project from cwd (e.g. /Users/.../Projects/sam/... → "sam")
    if (parsed.cwd) {
      const projectsMatch = parsed.cwd.match(/\/Projects\/([^\/]+)/);
      if (projectsMatch) {
        project = projectsMatch[1];
      }
    }

    console.error(`📁 Transcript: ${transcriptPath}`);
    console.error(`📍 Session ID: ${sessionId}`);
    if (project) console.error(`📂 Project: ${project}`);
  } catch (e) {
    console.error(`❌ Error parsing input JSON: ${e}`);
    process.exit(0);
  }

  if (!transcriptPath) {
    console.error('❌ No transcript_path in input');
    process.exit(0);
  }

  // Skip if this is a subagent session (already captured by parent)
  if (sessionId.includes('subagent')) {
    console.error('⏭️ Skipping subagent session (captured by parent)');
    process.exit(0);
  }

  // Read the transcript
  let transcript;
  try {
    transcript = readFileSync(transcriptPath, 'utf-8');
    console.error(`📜 Transcript loaded: ${transcript.split('\n').length} lines`);
  } catch (e) {
    console.error(`❌ Error reading transcript: ${e}`);
    process.exit(0);
  }

  // Extract ALL conversation pairs from the transcript
  const lines = transcript.trim().split('\n');
  const pairs = extractConversationPairs(lines);

  if (pairs.length === 0) {
    console.error('⚠️ No conversation pairs found in transcript');
    process.exit(0);
  }

  console.error(`📝 Found ${pairs.length} conversation pair(s) to process`);

  // Conditionally process pairs through externalized memory system
  const enableMemoryHooks = process.env.ENABLE_MEMORY_HOOKS === 'true';
  let totalSaved = 0;

  if (enableMemoryHooks) {
    try {
      // Import externalized memory API from memory-system
      // Use fully qualified paths (import.meta.dir) to avoid cwd-dependent resolution
      // This hook can be invoked from any working directory (normal, launchd, etc.)
      const projectsRoot = path.join(import.meta.dir, "..", "..", "..");
      const memoryApiPath = path.join(projectsRoot, "memory-system", "hooks", "externalized-memory-api.ts");
      const memoryApi = await import(memoryApiPath);

      // Batch process all pairs
      totalSaved = await memoryApi.batchExtractMemories(
        pairs,
        sessionId,
        'claude-code-hook',
        project,
        (index: number, result: any) => {
          if (result.success && result.savedCount > 0) {
            console.error(`  ✅ Pair ${index + 1}: extracted ${result.savedCount} fact(s)`);
          } else if (result.error && index === 0) {
            console.error(`⚠️ Memory server unavailable (non-critical): ${result.error}`);
          }
        }
      );
    } catch (e) {
      console.error(`⚠️ Failed to load memory API module: ${e}`);
    }
  } else {
    console.error(`⏭️  Memory hook integration disabled (ENABLE_MEMORY_HOOKS=false)`);
  }

  if (totalSaved > 0) {
    console.error(`✅ Memory capture complete: ${totalSaved} total facts extracted from ${pairs.length} pair(s)`);
  } else if (enableMemoryHooks) {
    console.error(`ℹ️ Memory capture complete: no new facts extracted`);
  }
}

main().catch(() => {});
