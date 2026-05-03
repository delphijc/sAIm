/**
 * progressive-loader.ts
 *
 * Smart context loading system implementing three-tier progressive disclosure
 * for Skills and Agents. Loads minimal files at session start, then loads
 * Reference.md files on-demand when skills/agents are activated.
 *
 * Tier 1: Always loaded at session start
 * - Skill YAML frontmatter + routing + examples only (~50-120 lines per skill)
 * - Agent YAML frontmatter + identity + competencies (~60-80 lines per agent)
 *
 * Tier 2: Loaded on-demand when skill/agent is activated
 * - Skill Reference.md (detailed methodology, patterns, troubleshooting)
 * - Agent Reference.md (detailed competencies, standards, workflows)
 *
 * Tier 3: Loaded on explicit request
 * - Full documentation files (constitution.md, hooksystem.md, etc.)
 * - Available via /help or user requests
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PAI_DIR, SKILLS_DIR, AGENTS_DIR } from './pai-paths';

/**
 * Track what context has been loaded to avoid duplicate injections
 */
interface LoadedContext {
  tier1_skills: string[]; // Minimal skill files loaded
  tier1_agents: string[]; // Minimal agent files loaded
  tier2_references: string[]; // Reference.md files loaded
  tier3_full_docs: string[]; // Full documentation loaded
  timestamp: number; // When this session started
}

let loadedContext: LoadedContext = {
  tier1_skills: [],
  tier1_agents: [],
  tier2_references: [],
  tier3_full_docs: [],
  timestamp: Date.now()
};

/**
 * Load a single file and return its content with substitutions
 */
function loadFile(filePath: string, substitutions?: Record<string, string>): string | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }

    let content = readFileSync(filePath, 'utf-8');

    // Apply variable substitutions if provided
    if (substitutions) {
      for (const [placeholder, value] of Object.entries(substitutions)) {
        content = content.replace(new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'), value);
      }
    }

    return content;
  } catch (error) {
    console.error(`❌ Error loading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Tier 1: Load minimal skill files at session start
 * Returns only YAML frontmatter + routing table + examples (~80-120 lines)
 */
export function loadMinimalSkill(skillName: string): { content: string; size: number } | null {
  const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');
  const content = loadFile(skillPath);

  if (!content || loadedContext.tier1_skills.includes(skillName)) {
    return null; // Already loaded or file not found
  }

  loadedContext.tier1_skills.push(skillName);

  return {
    content,
    size: content.length
  };
}

/**
 * Tier 1: Load minimal agent files at session start
 * Returns only YAML + identity + competencies (~60-80 lines)
 */
export function loadMinimalAgent(agentName: string): { content: string; size: number } | null {
  // Agents can be either:
  // 1. Directory-based: Agents/AgentName/AGENT.md
  // 2. File-based: Agents/AgentName.md (legacy)
  const dirPath = join(AGENTS_DIR, agentName, 'AGENT.md');
  const filePath = join(AGENTS_DIR, `${agentName}.md`);

  let content = loadFile(dirPath);
  if (!content) {
    content = loadFile(filePath);
  }

  if (!content || loadedContext.tier1_agents.includes(agentName)) {
    return null; // Already loaded or file not found
  }

  loadedContext.tier1_agents.push(agentName);

  return {
    content,
    size: content.length
  };
}

/**
 * Tier 2: Load Reference.md on-demand when skill/agent is activated
 * Called when skill is invoked or agent is delegated to
 */
export function loadSkillReference(skillName: string): { content: string; size: number } | null {
  const refPath = join(SKILLS_DIR, skillName, 'Reference.md');
  const content = loadFile(refPath);

  if (!content) {
    // Reference.md doesn't exist yet (skill not refactored), return null gracefully
    return null;
  }

  if (loadedContext.tier2_references.includes(`${skillName}:Reference`)) {
    return null; // Already loaded this session
  }

  loadedContext.tier2_references.push(`${skillName}:Reference`);

  return {
    content,
    size: content.length
  };
}

/**
 * Tier 2: Load Agent Reference.md on-demand
 * Called when agent is delegated to
 */
export function loadAgentReference(agentName: string): { content: string; size: number } | null {
  // Try directory-based first
  let refPath = join(AGENTS_DIR, agentName, 'Reference.md');

  let content = loadFile(refPath);

  if (!content) {
    // Fall back to legacy location if agent refactoring hasn't happened
    return null;
  }

  if (loadedContext.tier2_references.includes(`${agentName}:Reference`)) {
    return null; // Already loaded this session
  }

  loadedContext.tier2_references.push(`${agentName}:Reference`);

  return {
    content,
    size: content.length
  };
}

/**
 * Tier 3: Load full documentation on explicit request
 */
export function loadFullDoc(docPath: string): { content: string; size: number } | null {
  const fullPath = join(PAI_DIR, docPath);
  const content = loadFile(fullPath);

  if (!content || loadedContext.tier3_full_docs.includes(docPath)) {
    return null;
  }

  loadedContext.tier3_full_docs.push(docPath);

  return {
    content,
    size: content.length
  };
}

/**
 * Get loading statistics for debugging
 */
export function getLoadingStats(): {
  tier1_skills: number;
  tier1_agents: number;
  tier2_references: number;
  tier3_full_docs: number;
  total_tokens_estimate: number;
  uptime_ms: number;
} {
  // Rough estimate: 1 token ≈ 4 characters
  const estimateTokens = (size: number) => Math.ceil(size / 4);

  let totalSize = 0;

  // Sum loaded minimal files
  for (const skillName of loadedContext.tier1_skills) {
    const skill = loadMinimalSkill(skillName);
    if (skill) totalSize += skill.size;
  }

  for (const agentName of loadedContext.tier1_agents) {
    const agent = loadMinimalAgent(agentName);
    if (agent) totalSize += agent.size;
  }

  return {
    tier1_skills: loadedContext.tier1_skills.length,
    tier1_agents: loadedContext.tier1_agents.length,
    tier2_references: loadedContext.tier2_references.length,
    tier3_full_docs: loadedContext.tier3_full_docs.length,
    total_tokens_estimate: estimateTokens(totalSize),
    uptime_ms: Date.now() - loadedContext.timestamp
  };
}

/**
 * Check if a skill/agent reference is already loaded
 */
export function isLoaded(name: string, type: 'skill' | 'agent' | 'reference'): boolean {
  switch (type) {
    case 'skill':
      return loadedContext.tier1_skills.includes(name);
    case 'agent':
      return loadedContext.tier1_agents.includes(name);
    case 'reference':
      return loadedContext.tier2_references.some(ref => ref.startsWith(`${name}:`));
    default:
      return false;
  }
}

/**
 * Clear loaded context (for testing or session refresh)
 */
export function clearLoadedContext(): void {
  loadedContext = {
    tier1_skills: [],
    tier1_agents: [],
    tier2_references: [],
    tier3_full_docs: [],
    timestamp: Date.now()
  };
}

/**
 * Format content for injection as system-reminder
 */
export function formatAsSystemReminder(title: string, content: string): string {
  return `<system-reminder>
${title}

---
${content}
---

This context is loaded on-demand for better token efficiency.
</system-reminder>`;
}

/**
 * Format multiple pieces of content together
 */
export function formatMultipleAsSystemReminder(
  title: string,
  items: Array<{ label: string; content: string }>
): string {
  const combined = items
    .map(item => `## ${item.label}\n\n${item.content}`)
    .join('\n\n---\n\n');

  return formatAsSystemReminder(title, combined);
}
