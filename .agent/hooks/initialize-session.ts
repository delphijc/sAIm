#!/usr/bin/env bun

/**
 * initialize-session.ts
 *
 * Main session initialization hook that runs at the start of every Claude Code session.
 *
 * What it does:
 * - Checks if this is a subagent session (skips for subagents)
 * - Tests that stop-hook is properly configured
 * - Sets initial terminal tab title
 * - Sends voice notification that system is ready (if voice server is running)
 * - Calls load-core-context.ts to inject core context into the session
 *
 * Setup:
 * 1. Set environment variables in settings.json:
 *    - DA: Your AI's name (e.g., "Sam", "Nova", "Assistant")
 *    - DA_VOICE_ID: Your ChatterboxTTS voice ID (if using voice system)
 *    - PAI_DIR: Path to your PAI directory (defaults to $HOME/.claude)
 * 2. Ensure load-core-context.ts exists in hooks/ directory
 * 3. Add both hooks to SessionStart in settings.json
 */

import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { PAI_DIR } from './lib/pai-paths';
import { sendNotification } from './lib/notification-handler';

async function testStopHook() {
  const stopHookPath = join(PAI_DIR, 'hooks/stop-hook.ts');

  console.error('\n🔍 Testing stop-hook configuration...');

  // Check if stop-hook exists
  if (!existsSync(stopHookPath)) {
    console.error('❌ Stop-hook NOT FOUND at:', stopHookPath);
    return false;
  }

  // Check if stop-hook is executable
  try {
    const stats = statSync(stopHookPath);
    const isExecutable = (stats.mode & 0o111) !== 0;

    if (!isExecutable) {
      console.error('❌ Stop-hook exists but is NOT EXECUTABLE');
      return false;
    }

    console.error('✅ Stop-hook found and is executable');

    // Set initial tab title (customize with your AI's name via DA env var)
    const daName = process.env.DA || 'AI Assistant';
    const tabTitle = `${daName} Ready`;

    process.stderr.write(`\x1b]0;${tabTitle}\x07`);
    process.stderr.write(`\x1b]2;${tabTitle}\x07`);
    process.stderr.write(`\x1b]30;${tabTitle}\x07`);
    console.error(`📍 Set initial tab title: "${tabTitle}"`);

    return true;
  } catch (e) {
    console.error('❌ Error checking stop-hook:', e);
    return false;
  }
}

async function main() {
  try {
    // Check if this is a subagent session - if so, exit silently
    const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
    const isSubagent = claudeProjectDir.includes('/.claude/agents/') ||
                      process.env.CLAUDE_AGENT_TYPE !== undefined;

    if (isSubagent) {
      // This is a subagent session - exit silently without notification
      console.error('🤖 Subagent session detected - skipping session initialization');
      process.exit(0);
    }

    // Test stop-hook first (only for main sessions)
    const stopHookOk = await testStopHook();

    const daName = process.env.DA || 'AI Assistant';
    const message = `${daName} here, ready to go.`;

    if (!stopHookOk) {
      console.error('\n⚠️ STOP-HOOK ISSUE DETECTED - Tab titles may not update automatically');
    }

    // Note: PAI core context loading is handled by load-core-context.ts hook
    // which should run BEFORE this hook in settings.json SessionStart hooks

    // Use intelligent notification handler (voice → system fallback)
    await sendNotification({
      title: `${daName} Systems Initialized`,
      message,
      voiceId: process.env.DA_VOICE_ID || 'default-voice-id'
    });
    process.exit(0);
  } catch (error) {
    console.error('SessionStart hook error:', error);
    process.exit(1);
  }
}

main();
