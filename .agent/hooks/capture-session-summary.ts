#!/usr/bin/env bun

/**
 * SessionEnd Hook - Captures session summary for UOCS
 *
 * Generates a session summary document when a Claude Code session ends,
 * documenting what was accomplished during the session.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { PAI_DIR, HISTORY_DIR } from './lib/pai-paths';

interface SessionData {
  conversation_id: string;
  timestamp: string;
  [key: string]: any;
}

async function main() {
  try {
    // Read input from stdin
    const input = await Bun.stdin.text();
    if (!input || input.trim() === '') {
      process.exit(0);
    }

    const data: SessionData = JSON.parse(input);

    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/:/g, '')
      .replace(/\..+/, '')
      .replace('T', '-');

    const yearMonth = timestamp.substring(0, 7);
    const sessionInfo = await analyzeSession(data.conversation_id, yearMonth);
    const filename = `${timestamp}_SESSION_${sessionInfo.focus}.md`;

    const sessionDir = join(HISTORY_DIR, 'sessions', yearMonth);
    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true });
    }

    writeFileSync(join(sessionDir, filename), formatSessionDocument(timestamp, data, sessionInfo));
    process.exit(0);
  } catch (error) {
    console.error(`[UOCS] SessionEnd hook error: ${error}`);
    process.exit(0);
  }
}

const EXT_LABELS: Record<string, string> = {
  ts: 'typescript-development',
  js: 'typescript-development',
  json: 'configuration',
  sh: 'scripting',
  py: 'python-development',
};

function topByFrequency(arr: string[]): string | undefined {
  const counts: Record<string, number> = {};
  for (const v of arr) if (v) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function deriveFocus(files: string[], commands: string[], hasBash: boolean): string {
  if (files.length > 0) {
    const exts = files.map(f => f.split('.').pop()?.toLowerCase() ?? '');
    const topExt = topByFrequency(exts);

    if (topExt && EXT_LABELS[topExt]) return EXT_LABELS[topExt];

    if (topExt === 'md') {
      const dirs = files.map(f => f.split('/').slice(-2, -1)[0]?.toLowerCase() ?? '');
      return dirs.some(d => d === 'skills') ? 'skill-development' : 'documentation';
    }

    const dirs = files.map(f => f.split('/').slice(-2, -1)[0]?.toLowerCase() ?? '');
    const topDir = topByFrequency(dirs.filter(Boolean));
    if (topDir) return topDir.replace(/[^a-z0-9]/g, '-');
  }

  if (hasBash && commands.length > 0) {
    const firstCmd = commands[0].trim().split(/\s+/)[0];
    if (firstCmd) return `shell-${firstCmd.replace(/[^a-z0-9]/g, '')}`.slice(0, 30);
  }

  return 'general-work';
}

async function analyzeSession(conversationId: string, yearMonth: string): Promise<any> {
  // Try to read raw outputs for this session
  const rawOutputsDir = join(HISTORY_DIR, 'raw-outputs', yearMonth);

  let filesChanged: string[] = [];
  let commandsExecuted: string[] = [];
  let toolsUsed: Set<string> = new Set();

  try {
    if (existsSync(rawOutputsDir)) {
      const files = readdirSync(rawOutputsDir).filter(f => f.endsWith('.jsonl'));

      for (const file of files) {
        const filePath = join(rawOutputsDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.session === conversationId) {
              toolsUsed.add(entry.tool);

              // Extract file changes
              if (entry.tool === 'Edit' || entry.tool === 'Write') {
                if (entry.input?.file_path) {
                  filesChanged.push(entry.input.file_path);
                }
              }

              // Extract bash commands
              if (entry.tool === 'Bash' && entry.input?.command) {
                commandsExecuted.push(entry.input.command);
              }
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } catch (error) {
    // Silent failure
  }

  const uniqueFiles = [...new Set(filesChanged)].slice(0, 10);
  const toolsArray = Array.from(toolsUsed);
  const focus = deriveFocus(uniqueFiles, commandsExecuted, toolsUsed.has('Bash'));

  return {
    focus,
    filesChanged: uniqueFiles,
    commandsExecuted: commandsExecuted.slice(0, 10),
    toolsUsed: toolsArray,
    duration: 0
  };
}

function formatSessionDocument(timestamp: string, data: SessionData, info: any): string {
  const date = timestamp.substring(0, 10); // YYYY-MM-DD
  const time = timestamp.substring(11).replace(/-/g, ':'); // HH:MM:SS

  return `---
capture_type: SESSION
timestamp: ${new Date().toISOString()}
session_id: ${data.conversation_id}
duration_minutes: ${info.duration}
executor: sam
---

# Session: ${info.focus}

**Date:** ${date}
**Time:** ${time}
**Session ID:** ${data.conversation_id}

---

## Session Overview

**Focus:** General development work
**Duration:** ${info.duration > 0 ? `${info.duration} minutes` : 'Unknown'}

---

## Tools Used

${info.toolsUsed.length > 0 ? info.toolsUsed.map((t: string) => `- ${t}`).join('\n') : '- None recorded'}

---

## Files Modified

${info.filesChanged.length > 0 ? info.filesChanged.map((f: string) => `- \`${f}\``).join('\n') : '- None recorded'}

**Total Files Changed:** ${info.filesChanged.length}

---

## Commands Executed

${info.commandsExecuted.length > 0 ? '```bash\n' + info.commandsExecuted.join('\n') + '\n```' : 'None recorded'}

---

## Notes

This session summary was automatically generated by the UOCS SessionEnd hook.

For detailed tool outputs, see: \`${PAI_DIR}/History/raw-outputs/${timestamp.substring(0, 7)}/\`

---

**Session Outcome:** Completed
**Generated:** ${new Date().toISOString()}
`;
}

main();
