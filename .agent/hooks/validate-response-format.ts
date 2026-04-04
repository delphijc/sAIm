#!/usr/bin/env bun

/**
 * Validates responses against MANDATORY RESPONSE FORMAT from CLAUDE.md
 * Ensures all task-based responses include required sections and word limits
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validateResponseFormat(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for MANDATORY sections (case-insensitive)
  const requiredSections = [
    { name: 'SUMMARY', pattern: /^SUMMARY:\s*.+/im },
    { name: 'ANALYSIS', pattern: /^ANALYSIS:\s*.+/im },
    { name: 'ACTIONS', pattern: /^ACTIONS:\s*.+/im },
    { name: 'RESULTS', pattern: /^RESULTS:\s*.+/im },
    { name: 'STATUS', pattern: /^STATUS:\s*.+/im },
    { name: 'CAPTURE', pattern: /^CAPTURE:\s*.+/im },
    { name: 'NEXT', pattern: /^NEXT:\s*.+/im },
  ];

  for (const section of requiredSections) {
    if (!section.pattern.test(content)) {
      errors.push(`Missing MANDATORY section: ${section.name}`);
    }
  }

  // Check for STORY EXPLANATION with numbered list (1-8)
  const storyExplanationMatch = content.match(/^STORY\s+EXPLANATION:\s*\n([\s\S]*?)(?=^[A-Z]+:|$)/im);
  if (!storyExplanationMatch) {
    errors.push('Missing MANDATORY section: STORY EXPLANATION');
  } else {
    const storyContent = storyExplanationMatch[1];
    // Check for numbered items 1-8
    const numberedItems = storyContent.match(/^\d+\.\s+.+/gm) || [];
    if (numberedItems.length < 1) {
      errors.push('STORY EXPLANATION must contain numbered list items (1-8)');
    } else if (numberedItems.length < 8) {
      warnings.push(`STORY EXPLANATION has ${numberedItems.length} items but should have 8`);
    }
  }

  // Check for COMPLETED line with word count ≤ 50
  const completedMatch = content.match(/^COMPLETED:\s*(.+?)(?:\n|$)/im);
  if (!completedMatch) {
    errors.push('Missing MANDATORY line: COMPLETED');
  } else {
    const completedText = completedMatch[1].trim();
    const wordCount = completedText.split(/\s+/).length;
    if (wordCount > 50) {
      errors.push(`COMPLETED line exceeds 50 words (current: ${wordCount} words). Max: 50 words.`);
    }
    if (completedText.length === 0) {
      errors.push('COMPLETED line cannot be empty');
    }
  }

  // Check for voice notification curl command
  const voiceNotificationMatch = content.match(/curl\s+-X\s+POST\s+http:\/\/localhost:8888\/notify/i);
  if (!voiceNotificationMatch) {
    warnings.push('No voice notification curl command found (recommended: curl -X POST http://localhost:8888/notify...)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

async function main() {
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
    console.error('⚠️ No input received');
    process.exit(0);
  }

  let transcriptPath;
  try {
    const parsed = JSON.parse(input);
    transcriptPath = parsed.transcript_path;
  } catch (e) {
    console.error(`⚠️ Could not parse input JSON`);
    process.exit(0);
  }

  if (!transcriptPath) {
    process.exit(0);
  }

  // Read the transcript
  let transcript;
  try {
    transcript = readFileSync(transcriptPath, 'utf-8');
  } catch (e) {
    console.error(`⚠️ Error reading transcript`);
    process.exit(0);
  }

  const lines = transcript.trim().split('\n');

  // Get the last assistant response
  let lastAssistantContent = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === 'assistant' && entry.message?.content) {
        const content = entry.message.content;
        if (typeof content === 'string') {
          lastAssistantContent = content;
        } else if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === 'text' && item.text) {
              lastAssistantContent = item.text;
              break;
            }
          }
        }
        break;
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }

  if (!lastAssistantContent) {
    process.exit(0);
  }

  // Validate the response format
  const validation = validateResponseFormat(lastAssistantContent);

  if (validation.errors.length > 0 || validation.warnings.length > 0) {
    console.error('\n⚠️  RESPONSE FORMAT VALIDATION\n');

    if (validation.errors.length > 0) {
      console.error('❌ ERRORS (Response is INCOMPLETE):');
      validation.errors.forEach(err => {
        console.error(`   • ${err}`);
      });
    }

    if (validation.warnings.length > 0) {
      console.error('\n⚠️  WARNINGS (Best practices):');
      validation.warnings.forEach(warn => {
        console.error(`   • ${warn}`);
      });
    }

    console.error('\n💡 REMINDER: Task-based responses MUST include:');
    console.error('   • SUMMARY, ANALYSIS, ACTIONS, RESULTS, STATUS, CAPTURE, NEXT');
    console.error('   • STORY EXPLANATION (numbered 1-8)');
    console.error('   • COMPLETED line (max 50 words)');
    console.error('   • Voice notification curl command\n');
  } else {
    console.error('✅ Response format is VALID');
  }
}

main().catch(() => {});
