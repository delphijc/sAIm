#!/usr/bin/env bun
/**
 * Voice Notification Reminder Hook
 *
 * Triggered at SessionStart to ensure Sam provides audible feedback after every response.
 * This is a critical protocol defined in CLAUDE.md that must be followed consistently.
 *
 * What this hook does:
 * - Reminds Sam of the voice notification rule
 * - Provides command reference for easy use
 * - Ensures the protocol is active for this session
 */

import { PAI_DIR } from './lib/pai-paths';

const DA = process.env.DA || 'Sam';

async function main() {
  try {
    // Log the reminder to stderr so it appears in session output
    console.error(`\n🔊 Voice Notification Protocol Active`);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`📋 CRITICAL RULE: Provide audible feedback after EVERY response`);
    console.error(`🎤 Command: ~/.claude/Tools/VoiceNotify "Brief summary"`);
    console.error(`⚡ Quick usage: VoiceNotify "Your message here"`);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Verify voice server is accessible
    try {
      const healthResponse = await fetch('http://localhost:8888/health', {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });

      if (healthResponse.ok) {
        console.error(`✅ Voice server is running and ready`);
      } else {
        console.error(`⚠️  Voice server responded but may have issues`);
      }
    } catch (error) {
      // Voice server might not be running yet, but launchctl will start it
      console.error(`ℹ️  Voice server will be available via launchctl`);
    }

    console.error(`\n`);
    process.exit(0);
  } catch (error) {
    console.error('Voice notification reminder hook error:', error);
    process.exit(0); // Don't break session on hook error
  }
}

main();
