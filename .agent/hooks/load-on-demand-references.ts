#!/usr/bin/env bun

/**
 * load-on-demand-references.ts
 *
 * Implements Tier 2 progressive disclosure by loading Reference.md files
 * on-demand when skills or agents are activated in a session.
 *
 * Triggered by: UserPromptSubmit hook
 * Detects: Skill invocation (e.g., /skillname) or agent delegation keywords
 * Action: Loads and injects Reference.md for the detected skill/agent
 *
 * This hook keeps session context minimal at startup while ensuring detailed
 * documentation is available as soon as the user needs it.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PAI_DIR, SKILLS_DIR, AGENTS_DIR } from './lib/pai-paths';
import {
  loadSkillReference,
  loadAgentReference,
  isLoaded,
  formatAsSystemReminder
} from './lib/progressive-loader';

/**
 * Parse user input to detect skill invocations or agent delegations
 */
function detectSkillAndAgentUsage(userMessage: string): {
  skills: string[];
  agents: string[];
} {
  const detected = {
    skills: new Set<string>(),
    agents: new Set<string>()
  };

  // Pattern 1: Slash commands for skills (e.g., /skillname)
  const skillMatch = userMessage.match(/\/([a-z-]+)/gi);
  if (skillMatch) {
    skillMatch.forEach(match => {
      const skillName = match.substring(1); // Remove leading /
      // Convert kebab-case to PascalCase for directory lookup
      const skillDir = skillName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
      detected.skills.add(skillDir);
    });
  }

  // Pattern 2: Agent delegation keywords
  const delegationKeywords = [
    'engineer agent',
    'architect agent',
    'designer agent',
    'pentester agent',
    'researcher agent',
    'investor agent',
    'delegate to',
    'call.*agent'
  ];

  delegationKeywords.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    if (regex.test(userMessage)) {
      // Extract agent name if mentioned
      const agentMatch = userMessage.match(
        new RegExp(`(?:${keyword})\\s+([a-z-]+)`, 'gi')
      );
      if (agentMatch) {
        agentMatch.forEach(match => {
          const parts = match.split(/\s+/);
          const agentName = parts[parts.length - 1];
          detected.agents.add(agentName);
        });
      }
    }
  });

  // Pattern 3: Task tool with agent specification
  const taskMatch = userMessage.match(
    /Task\s*\(\s*[^)]*subagent_type\s*:\s*['"]([^'"]+)['"]/gi
  );
  if (taskMatch) {
    taskMatch.forEach(match => {
      const agentMatch = match.match(/['"]([^'"]+)['"]/);
      if (agentMatch) {
        detected.agents.add(agentMatch[1]);
      }
    });
  }

  return {
    skills: Array.from(detected.skills),
    agents: Array.from(detected.agents)
  };
}

/**
 * Check if a skill directory exists
 */
function skillExists(skillName: string): boolean {
  const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');
  return existsSync(skillPath);
}

/**
 * Check if an agent exists
 */
function agentExists(agentName: string): boolean {
  // Try directory-based first
  let agentPath = join(AGENTS_DIR, agentName, 'AGENT.md');
  if (existsSync(agentPath)) return true;

  // Try file-based (legacy)
  agentPath = join(AGENTS_DIR, `${agentName}.md`);
  return existsSync(agentPath);
}

/**
 * Main hook logic
 */
async function main() {
  try {
    // Get user message from stdin
    const userInput = await new Promise<string>((resolve) => {
      let data = '';
      process.stdin.on('data', chunk => {
        data += chunk.toString();
      });
      process.stdin.on('end', () => {
        resolve(data);
      });
      // Timeout in case stdin doesn't close
      setTimeout(() => resolve(data), 100);
    });

    // Detect skills and agents referenced in the message
    const detected = detectSkillAndAgentUsage(userInput);

    const referencesToLoad: string[] = [];

    // Check each detected skill for Reference.md
    for (const skillName of detected.skills) {
      if (!skillExists(skillName)) continue;
      if (isLoaded(skillName, 'reference')) continue;

      const reference = loadSkillReference(skillName);
      if (reference) {
        referencesToLoad.push(
          formatAsSystemReminder(
            `📚 ${skillName} Reference (Tier 2 - On-Demand Load)`,
            reference.content
          )
        );
        console.error(
          `✅ Loaded ${skillName} Reference.md (${reference.size} chars)`
        );
      }
    }

    // Check each detected agent for Reference.md
    for (const agentName of detected.agents) {
      if (!agentExists(agentName)) continue;
      if (isLoaded(agentName, 'reference')) continue;

      const reference = loadAgentReference(agentName);
      if (reference) {
        referencesToLoad.push(
          formatAsSystemReminder(
            `🤖 ${agentName} Agent Reference (Tier 2 - On-Demand Load)`,
            reference.content
          )
        );
        console.error(
          `✅ Loaded ${agentName} Reference.md (${reference.size} chars)`
        );
      }
    }

    // Output all loaded references as system reminders
    if (referencesToLoad.length > 0) {
      referencesToLoad.forEach(ref => console.log(ref));
      console.error(
        `📦 Injected ${referencesToLoad.length} Reference.md file(s)`
      );
    } else if (detected.skills.length > 0 || detected.agents.length > 0) {
      console.error(
        `ℹ️  Detected ${detected.skills.length + detected.agents.length} skill/agent(s) - no Reference.md files found (not yet refactored)`
      );
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error in load-on-demand-references hook:', error);
    process.exit(1);
  }
}

main();
