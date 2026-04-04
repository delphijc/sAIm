#!/usr/bin/env bun
/**
 * Context Size Monitor
 *
 * Analyzes and displays current context usage to help optimize
 * conversation efficiency. Works with Claude Pro subscription.
 *
 * Usage:
 *   bun context-monitor.ts              # Show current context stats
 *   bun context-monitor.ts estimate     # Estimate token usage
 *   bun context-monitor.ts suggestions  # Get optimization suggestions
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
};

// Constants
const PAI_DIR = join(homedir(), '.claude');
const COMPACT_STATE_FILE = join(PAI_DIR, '.compact-reminder-state.json');
const SKILLS_DIR = join(PAI_DIR, 'Skills');
const AGENTS_DIR = join(PAI_DIR, 'Agents');
const MCP_CONFIG = join(PAI_DIR, '.mcp.json');

// Rough token estimation (1 token ≈ 4 characters)
const CHARS_PER_TOKEN = 4;

interface ContextStats {
  core_skill_size: number;
  total_skills: number;
  active_agents: number;
  mcp_count: number;
  estimated_base_tokens: number;
  conversation_turns: number;
  last_compact_turn: number;
  turns_since_compact: number;
}

/**
 * Estimate tokens from character count
 */
function estimateTokens(chars: number): number {
  return Math.round(chars / CHARS_PER_TOKEN);
}

/**
 * Get file size in characters
 */
function getFileSize(path: string): number {
  if (!existsSync(path)) return 0;

  try {
    const content = readFileSync(path, 'utf-8');
    return content.length;
  } catch (error) {
    return 0;
  }
}

/**
 * Count files in directory
 */
function countFiles(dir: string, extension: string = '.md'): number {
  if (!existsSync(dir)) return 0;

  try {
    const files = readdirSync(dir);
    return files.filter(f => f.endsWith(extension)).length;
  } catch (error) {
    return 0;
  }
}

/**
 * Get CORE skill size
 */
function getCoreSkillSize(): number {
  const coreSkillPath = join(SKILLS_DIR, 'CORE', 'SKILL.md');
  return getFileSize(coreSkillPath);
}

/**
 * Count total skills
 */
function countSkills(): number {
  if (!existsSync(SKILLS_DIR)) return 0;

  try {
    const skillDirs = readdirSync(SKILLS_DIR);
    let count = 0;

    for (const dir of skillDirs) {
      const skillFile = join(SKILLS_DIR, dir, 'SKILL.md');
      if (existsSync(skillFile)) {
        count++;
      }
    }

    return count;
  } catch (error) {
    return 0;
  }
}

/**
 * Count active agents
 */
function countAgents(): number {
  return countFiles(AGENTS_DIR, '.md');
}

/**
 * Count MCP servers
 */
function countMCPs(): number {
  if (!existsSync(MCP_CONFIG)) return 0;

  try {
    const config = JSON.parse(readFileSync(MCP_CONFIG, 'utf-8'));
    return Object.keys(config.mcpServers || {}).length;
  } catch (error) {
    return 0;
  }
}

/**
 * Get conversation state
 */
function getConversationState(): { turns: number; lastCompact: number } {
  if (!existsSync(COMPACT_STATE_FILE)) {
    return { turns: 0, lastCompact: 0 };
  }

  try {
    const state = JSON.parse(readFileSync(COMPACT_STATE_FILE, 'utf-8'));
    const sessions = Object.values(state.sessions || {}) as any[];

    if (sessions.length === 0) {
      return { turns: 0, lastCompact: 0 };
    }

    // Get most recent session
    const recent = sessions.sort((a, b) => b.turn_count - a.turn_count)[0];
    return {
      turns: recent.turn_count || 0,
      lastCompact: recent.last_compact_turn || 0,
    };
  } catch (error) {
    return { turns: 0, lastCompact: 0 };
  }
}

/**
 * Estimate base context size
 */
function estimateBaseContext(): number {
  let totalChars = 0;

  // CORE skill (always loaded)
  totalChars += getCoreSkillSize();

  // Estimate for MCP tool definitions (rough: 500 chars per MCP)
  const mcpCount = countMCPs();
  totalChars += mcpCount * 500;

  // Estimate for agent definitions (when active)
  const agentCount = countAgents();
  totalChars += agentCount * 300; // Rough estimate

  return totalChars;
}

/**
 * Gather context statistics
 */
function gatherStats(): ContextStats {
  const coreSize = getCoreSkillSize();
  const baseChars = estimateBaseContext();
  const conv = getConversationState();

  return {
    core_skill_size: coreSize,
    total_skills: countSkills(),
    active_agents: countAgents(),
    mcp_count: countMCPs(),
    estimated_base_tokens: estimateTokens(baseChars),
    conversation_turns: conv.turns,
    last_compact_turn: conv.lastCompact,
    turns_since_compact: conv.turns - conv.lastCompact,
  };
}

/**
 * Show context statistics
 */
function showStats(): void {
  const stats = gatherStats();

  console.log();
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  PAI Context Usage Monitor${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log();

  console.log(`${colors.blue}Base Context (Always Loaded):${colors.reset}`);
  console.log(`  CORE Skill: ${colors.yellow}${(stats.core_skill_size / 1024).toFixed(1)}KB${colors.reset} (~${estimateTokens(stats.core_skill_size)} tokens)`);
  console.log(`  Active MCPs: ${colors.yellow}${stats.mcp_count}${colors.reset} servers (~${stats.mcp_count * 125} tokens)`);
  console.log(`  Agent Definitions: ${colors.yellow}${stats.active_agents}${colors.reset} agents (~${stats.active_agents * 75} tokens)`);
  console.log(`  ${colors.dim}Estimated Base: ${colors.yellow}~${stats.estimated_base_tokens}${colors.reset}${colors.dim} tokens${colors.reset}`);
  console.log();

  console.log(`${colors.blue}Available Resources:${colors.reset}`);
  console.log(`  Total Skills: ${colors.yellow}${stats.total_skills}${colors.reset}`);
  console.log(`  Skill Loading: ${colors.cyan}Progressive disclosure${colors.reset} (on-demand)`);
  console.log();

  console.log(`${colors.blue}Current Session:${colors.reset}`);
  console.log(`  Conversation Turns: ${colors.yellow}${stats.conversation_turns}${colors.reset}`);
  console.log(`  Turns Since /compact: ${colors.yellow}${stats.turns_since_compact}${colors.reset}`);

  if (stats.turns_since_compact > 15) {
    console.log(`  ${colors.red}⚠${colors.reset}  Consider using ${colors.cyan}/compact${colors.reset} to truncate history`);
  } else if (stats.turns_since_compact > 10) {
    console.log(`  ${colors.yellow}⚡${colors.reset} Context getting large, /compact soon recommended`);
  } else {
    console.log(`  ${colors.green}✓${colors.reset} Context size healthy`);
  }

  console.log();
}

/**
 * Show token usage estimate
 */
function showEstimate(): void {
  const stats = gatherStats();

  console.log();
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Token Usage Estimate${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log();

  const baseTokens = stats.estimated_base_tokens;
  const conversationEstimate = stats.turns_since_compact * 1000; // Rough: 1K tokens per turn
  const totalEstimate = baseTokens + conversationEstimate;

  console.log(`${colors.blue}Token Breakdown:${colors.reset}`);
  console.log(`  Base Context: ${colors.yellow}~${baseTokens}${colors.reset} tokens`);
  console.log(`    • CORE skill: ~${estimateTokens(stats.core_skill_size)} tokens`);
  console.log(`    • MCPs: ~${stats.mcp_count * 125} tokens`);
  console.log(`    • Agents: ~${stats.active_agents * 75} tokens`);
  console.log();
  console.log(`  Conversation History: ${colors.yellow}~${conversationEstimate}${colors.reset} tokens`);
  console.log(`    • ${stats.turns_since_compact} turns × ~1,000 tokens/turn`);
  console.log();
  console.log(`  ${colors.cyan}Total Estimated: ${colors.yellow}~${totalEstimate}${colors.reset}${colors.cyan} tokens${colors.reset}`);
  console.log();

  // Context window info
  const contextLimit = 200000; // Claude's context window
  const percentage = (totalEstimate / contextLimit * 100).toFixed(1);

  console.log(`${colors.blue}Context Window:${colors.reset}`);
  console.log(`  Limit: ${colors.yellow}200,000${colors.reset} tokens`);
  console.log(`  Usage: ${colors.yellow}~${percentage}%${colors.reset}`);

  if (parseFloat(percentage) > 50) {
    console.log(`  ${colors.red}⚠${colors.reset}  High context usage - consider /compact`);
  } else if (parseFloat(percentage) > 30) {
    console.log(`  ${colors.yellow}⚡${colors.reset} Moderate usage - /compact recommended soon`);
  } else {
    console.log(`  ${colors.green}✓${colors.reset} Healthy context usage`);
  }

  console.log();
}

/**
 * Show optimization suggestions
 */
function showSuggestions(): void {
  const stats = gatherStats();
  const suggestions: string[] = [];

  // Check conversation length
  if (stats.turns_since_compact > 15) {
    suggestions.push(`${colors.red}HIGH PRIORITY:${colors.reset} Use ${colors.cyan}/compact${colors.reset} to truncate conversation history (${stats.turns_since_compact} turns)`);
  } else if (stats.turns_since_compact > 10) {
    suggestions.push(`${colors.yellow}RECOMMENDED:${colors.reset} Consider ${colors.cyan}/compact${colors.reset} soon (${stats.turns_since_compact} turns)`);
  }

  // Check MCP count
  if (stats.mcp_count > 10) {
    suggestions.push(`${colors.yellow}OPTIMIZE:${colors.reset} You have ${stats.mcp_count} MCPs enabled. Consider using MCP profiles:`);
    suggestions.push(`  • ${colors.cyan}bun ~/.claude/Tools/mcp-profile-switch.ts minimal${colors.reset} (3 MCPs)`);
    suggestions.push(`  • ${colors.cyan}bun ~/.claude/Tools/mcp-profile-switch.ts medium${colors.reset} (7 MCPs)`);
  }

  // CORE skill size
  if (stats.core_skill_size > 20000) {
    suggestions.push(`${colors.dim}INFO:${colors.reset} CORE skill is large (${(stats.core_skill_size / 1024).toFixed(1)}KB). This is loaded in every conversation.`);
  }

  console.log();
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Context Optimization Suggestions${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log();

  if (suggestions.length === 0) {
    console.log(`  ${colors.green}✓ Context usage is optimized!${colors.reset}`);
    console.log();
    console.log(`  ${colors.dim}Your current configuration is efficient:${colors.reset}`);
    console.log(`    • Conversation length: ${stats.turns_since_compact} turns`);
    console.log(`    • MCP count: ${stats.mcp_count} servers`);
    console.log(`    • Base context: ~${stats.estimated_base_tokens} tokens`);
  } else {
    for (const suggestion of suggestions) {
      console.log(`  ${suggestion}`);
    }
  }

  console.log();
  console.log(`${colors.dim}Best Practices:${colors.reset}`);
  console.log(`  • Use ${colors.cyan}/compact${colors.reset} after multi-agent research operations`);
  console.log(`  • Switch to minimal MCP profile for everyday use`);
  console.log(`  • Let progressive disclosure load skills on-demand`);
  console.log();
}

/**
 * Show usage
 */
function showUsage(): void {
  console.log(`${colors.cyan}Context Size Monitor${colors.reset}`);
  console.log();
  console.log('Usage: bun context-monitor.ts [command]');
  console.log();
  console.log('Commands:');
  console.log(`  ${colors.yellow}(none)${colors.reset}        Show current context statistics`);
  console.log(`  ${colors.yellow}estimate${colors.reset}      Estimate token usage`);
  console.log(`  ${colors.yellow}suggestions${colors.reset}   Get optimization suggestions`);
  console.log(`  ${colors.yellow}help${colors.reset}          Show this help message`);
  console.log();
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'stats';

  switch (command.toLowerCase()) {
    case 'estimate':
      showEstimate();
      break;

    case 'suggestions':
    case 'suggest':
      showSuggestions();
      break;

    case 'help':
    case '--help':
    case '-h':
      showUsage();
      break;

    case 'stats':
    default:
      showStats();
      break;
  }
}

main();
