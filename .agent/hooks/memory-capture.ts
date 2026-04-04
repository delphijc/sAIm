#!/usr/bin/env bun

/**
 * Memory Capture Hook for Claude Code
 * Automatically extracts facts from Claude Code sessions into the memory system.
 * Triggered on Stop event to capture conversational learning.
 *
 * Processes ALL user/assistant conversation pairs in the transcript,
 * enabling cross-modality memory building (CLI, headless, Discord).
 */

import { readFileSync } from 'fs';

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
    console.error(`❌ Error reading input: ${e}`);
    process.exit(0);
  }

  if (!input) {
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

  // Send each pair to the memory server for extraction
  let totalSaved = 0;

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s per pair

      const response = await fetch('http://localhost:4242/memory/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: pair.userMessage,
          assistantResponse: pair.assistantResponse,
          sessionId,
          source: 'claude-code-hook',
          project,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const result = await response.json();
      if (result.success && result.savedCount > 0) {
        totalSaved += result.savedCount;
        console.error(`  ✅ Pair ${i + 1}: extracted ${result.savedCount} fact(s)`);
      }
    } catch (e) {
      // Silent failure per-pair - memory server may be offline
      if (i === 0) {
        // Only log once if the server is down
        console.error(`⚠️ Memory server unavailable (non-critical): ${e}`);
        break; // Don't try remaining pairs if server is down
      }
    }
  }

  if (totalSaved > 0) {
    console.error(`✅ Memory capture complete: ${totalSaved} total facts extracted from ${pairs.length} pair(s)`);
  } else {
    console.error(`ℹ️ Memory capture complete: no new facts extracted`);
  }
}

main().catch(() => {});
