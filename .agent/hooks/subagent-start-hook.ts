#!/usr/bin/env bun

import { readFileSync, existsSync } from 'fs';
import { sendNotification } from './lib/notification-handler';

// Voice mappings for different agent types (mirrors subagent-stop-hook.ts)
const AGENT_VOICE_IDS: Record<string, string> = {
  researcher: 'AXdMgz6evoL7OPd7eU12',
  pentester: 'hmMWXCj9K7N5mCPcRkfC',
  engineer: 'kmSVBPu7loj4ayNinwWM',
  designer: 'ZF6FPAbjXT4488VcRRnw',
  architect: 'muZKMsIDGYtIkjjiUS82',
  writer: 'gfRt6Z3Z8aTbpLfexQ7N',
  main: 'jqcCZkN6Knx8BJ5TBdYR',
  default: 'jqcCZkN6Knx8BJ5TBdYR'
};

/**
 * Extract agent type and task description from the transcript.
 * On SubagentStart, the transcript contains the Agent tool_use with prompt and subagent_type.
 */
function extractAgentInfo(transcriptPath: string): { agentType: string; taskDescription: string } | null {
  if (!existsSync(transcriptPath)) {
    console.error(`❌ Transcript file doesn't exist: ${transcriptPath}`);
    return null;
  }

  try {
    const transcript = readFileSync(transcriptPath, 'utf-8');
    const lines = transcript.trim().split('\n');

    // Search from the end backwards for the Agent tool_use that spawned this subagent
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);

        if (entry.type === 'assistant' && entry.message?.content) {
          for (const content of entry.message.content) {
            if (content.type === 'tool_use' && content.name === 'Agent') {
              const agentType = content.input?.subagent_type || 'general-purpose';
              const description = content.input?.description || '';
              const prompt = content.input?.prompt || '';

              // Use description if available (short 3-5 word summary), otherwise extract from prompt
              const taskDescription = description || prompt.substring(0, 80).replace(/\n/g, ' ').trim();

              return { agentType: agentType.toLowerCase(), taskDescription };
            }
          }
        }
      } catch {
        // Invalid JSON line, skip
      }
    }
  } catch (e) {
    console.error(`Error reading transcript: ${e}`);
  }

  return null;
}

async function main() {
  console.error('🚀 SubagentStart hook started');

  // Read input from stdin with timeout
  let input = '';
  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();

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
  } catch (e) {
    console.error('Failed to read input:', e);
    process.exit(0);
  }

  if (!input) {
    console.log('No input received');
    process.exit(0);
  }

  let transcriptPath: string;
  try {
    const parsed = JSON.parse(input);
    transcriptPath = parsed.transcript_path;
  } catch (e) {
    console.error('Invalid input JSON:', e);
    process.exit(0);
  }

  if (!transcriptPath) {
    console.log('No transcript path provided');
    process.exit(0);
  }

  // Extract agent type and task from the transcript
  const agentInfo = extractAgentInfo(transcriptPath);

  if (!agentInfo) {
    console.log('Could not extract agent info from transcript');
    process.exit(0);
  }

  const { agentType, taskDescription } = agentInfo;
  const agentName = agentType.charAt(0).toUpperCase() + agentType.slice(1);

  // Build the announcement message
  const message = `${agentName} starting: ${taskDescription}`;

  // Send notification with the agent's voice
  const result = await sendNotification({
    title: `${agentName} Agent Starting`,
    message,
    voiceId: AGENT_VOICE_IDS[agentType] || AGENT_VOICE_IDS.default,
    agentType
  });

  console.log(`🚀 Sent via ${result.method}: [${agentName}] ${message}`);
}

main().catch(console.error);
