#!/usr/bin/env bun
/**
 * PreCompact Hook - Triggered before context compression
 * Extracts context information from transcript and notifies about compression
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { sendNotification } from './lib/notification-handler';

interface VoiceConfig {
  voice_name: string;
  rate_wpm: number;
  rate_multiplier: number;
  description: string;
  type: string;
}

interface VoicesConfig {
  default_rate: number;
  voices: Record<string, VoiceConfig>;
}

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
  compact_type?: string;
}

interface TranscriptEntry {
  type: string;
  message?: {
    role?: string;
    content?: Array<{
      type: string;
      text: string;
    }>
  };
  timestamp?: string;
}

/**
 * Count messages in transcript to provide context
 */
function getTranscriptStats(transcriptPath: string): { messageCount: number; isLarge: boolean } {
  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');
    
    let userMessages = 0;
    let assistantMessages = 0;
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line) as TranscriptEntry;
          if (entry.type === 'user') {
            userMessages++;
          } else if (entry.type === 'assistant') {
            assistantMessages++;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
    
    const totalMessages = userMessages + assistantMessages;
    const isLarge = totalMessages > 50; // Consider large if more than 50 messages
    
    return { messageCount: totalMessages, isLarge };
  } catch (error) {
    return { messageCount: 0, isLarge: false };
  }
}

// Load voice configuration (local ~/.claude location)
let samVoiceConfig: VoiceConfig;
try {
  const voicesPath = join(homedir(), '.claude/voice-server/voices.json');
  const config: VoicesConfig = JSON.parse(readFileSync(voicesPath, 'utf-8'));
  samVoiceConfig = config.voices.main || {
    voice_name: "Jamie (Premium)",
    rate_wpm: 228,
    rate_multiplier: 1.3,
    description: "UK Male",
    type: "Premium"
  };
  console.error(`✅ Loaded voice config from ${voicesPath}`);
} catch (e) {
  // Fallback to hardcoded Sam voice config
  console.error('⚠️ Could not load voices.json, using fallback config');
  samVoiceConfig = {
    voice_name: "Jamie (Premium)",
    rate_wpm: 228,
    rate_multiplier: 1.3,
    description: "UK Male",
    type: "Premium"
  };
}

async function main() {
  let hookInput: HookInput | null = null;
  
  try {
    // Read the JSON input from stdin
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let input = '';
    
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 500);
    });
    
    const readPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        input += decoder.decode(value, { stream: true });
      }
    })();
    
    await Promise.race([readPromise, timeoutPromise]);
    
    if (input.trim()) {
      hookInput = JSON.parse(input) as HookInput;
    }
  } catch (error) {
    // Silently handle input errors
  }
  
  // Determine the type of compression
  const compactType = hookInput?.compact_type || 'auto';
  let message = 'Compressing context to continue';
  
  // Get transcript statistics if available
  if (hookInput && hookInput.transcript_path) {
    const stats = getTranscriptStats(hookInput.transcript_path);
    if (stats.messageCount > 0) {
      if (compactType === 'manual') {
        message = `Manually compressing ${stats.messageCount} messages`;
      } else {
        message = stats.isLarge 
          ? `Auto-compressing large context with ${stats.messageCount} messages`
          : `Compressing context with ${stats.messageCount} messages`;
      }
    }
  }
  
  // Use intelligent notification handler (voice → system fallback)
  await sendNotification({
    title: 'Sam Context',
    message,
    voiceName: samVoiceConfig.voice_name,
    rate: samVoiceConfig.rate_wpm
  });

  process.exit(0);
}

// Run the hook
main().catch(() => {
  process.exit(0);
});