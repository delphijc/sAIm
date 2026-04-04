#!/usr/bin/env bun
/**
 * MCP Profile Switcher
 *
 * Manages MCP server profiles for optimal performance:
 * - minimal: Core MCPs only (everyday use)
 * - medium: Minimal + Jagent MCPs (development workflows)
 * - full: All MCPs enabled (maximum functionality)
 *
 * Usage:
 *   bun mcp-profile-switch.ts minimal
 *   bun mcp-profile-switch.ts medium
 *   bun mcp-profile-switch.ts full
 *   bun mcp-profile-switch.ts status
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

// MCP configuration path
const MCP_CONFIG_PATH = join(homedir(), '.claude', '.mcp.json');
const BACKUP_PATH = join(homedir(), '.claude', 'History', 'backups', 'mcp-config-backup.json');

// Profile definitions
const PROFILES = {
  minimal: {
    name: 'Minimal',
    description: 'Core MCPs only - fastest performance, everyday use',
    mcps: [
      'content',      // Daniel's content archive
      'daemon',       // Personal API
      'Foundry',      // Personal AI infrastructure
    ]
  },
  medium: {
    name: 'Medium',
    description: 'Minimal + Jagent MCPs - development workflows',
    mcps: [
      'content',
      'daemon',
      'Foundry',
      'jagents-agents',      // 10 Agile development agents
      'jagents-workflows',   // 5 orchestration workflows
      'jagents-skills',      // 9 reusable skills
      'jagents-rules',       // 6 rule validators
    ]
  },
  full: {
    name: 'Full',
    description: 'All MCPs enabled - maximum functionality',
    mcps: null  // null means include all
  }
};

/**
 * Load current MCP configuration
 */
function loadMcpConfig(): any {
  if (!existsSync(MCP_CONFIG_PATH)) {
    console.error(`${colors.red}✗${colors.reset} MCP config not found: ${MCP_CONFIG_PATH}`);
    process.exit(1);
  }

  try {
    const content = readFileSync(MCP_CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Failed to parse MCP config:`, error);
    process.exit(1);
  }
}

/**
 * Save MCP configuration
 */
function saveMcpConfig(config: any): void {
  try {
    // Create backup first
    const currentConfig = loadMcpConfig();
    writeFileSync(BACKUP_PATH, JSON.stringify(currentConfig, null, 2));

    // Write new config
    writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Failed to save MCP config:`, error);
    process.exit(1);
  }
}

/**
 * Get all MCP server names from config
 */
function getAllMcpNames(config: any): string[] {
  return Object.keys(config.mcpServers || {});
}

/**
 * Apply profile to MCP configuration
 */
function applyProfile(profileName: string): void {
  const profile = PROFILES[profileName as keyof typeof PROFILES];
  if (!profile) {
    console.error(`${colors.red}✗${colors.reset} Unknown profile: ${profileName}`);
    console.log(`\nAvailable profiles: minimal, medium, full`);
    process.exit(1);
  }

  const config = loadMcpConfig();
  const allMcps = getAllMcpNames(config);

  // Full profile = all MCPs
  if (profile.mcps === null) {
    console.log(`${colors.green}✓${colors.reset} Applying ${colors.cyan}${profile.name}${colors.reset} profile`);
    console.log(`  ${profile.description}`);
    console.log(`  ${colors.yellow}${allMcps.length}${colors.reset} MCPs enabled`);

    // No changes needed - all already enabled
    console.log(`\n${colors.green}✓${colors.reset} All MCPs already enabled`);
    listMcps(config, allMcps);
    return;
  }

  // Create new config with only specified MCPs
  const newConfig = { ...config };
  const newMcpServers: any = {};

  // Add specified MCPs
  for (const mcpName of profile.mcps) {
    if (config.mcpServers[mcpName]) {
      newMcpServers[mcpName] = config.mcpServers[mcpName];
    } else {
      console.warn(`${colors.yellow}⚠${colors.reset}  MCP not found: ${mcpName}`);
    }
  }

  newConfig.mcpServers = newMcpServers;

  // Save configuration
  saveMcpConfig(newConfig);

  console.log(`${colors.green}✓${colors.reset} Applied ${colors.cyan}${profile.name}${colors.reset} profile`);
  console.log(`  ${profile.description}`);
  console.log(`  ${colors.yellow}${profile.mcps.length}${colors.reset} MCPs enabled`);

  listMcps(newConfig, profile.mcps);

  console.log(`\n${colors.blue}ℹ${colors.reset} Restart Claude Code to load new configuration`);
}

/**
 * List MCPs in configuration
 */
function listMcps(config: any, enabledMcps: string[]): void {
  console.log(`\n${colors.cyan}Enabled MCPs:${colors.reset}`);

  for (const mcpName of enabledMcps) {
    const mcp = config.mcpServers[mcpName];
    if (mcp) {
      const desc = mcp.description || 'No description';
      console.log(`  ${colors.green}✓${colors.reset} ${mcpName}: ${desc}`);
    }
  }
}

/**
 * Show current profile status
 */
function showStatus(): void {
  const config = loadMcpConfig();
  const enabledMcps = getAllMcpNames(config);

  console.log(`${colors.cyan}Current MCP Configuration:${colors.reset}`);
  console.log(`  Total MCPs: ${colors.yellow}${enabledMcps.length}${colors.reset}`);

  // Detect which profile is active
  let activeProfile = 'custom';
  for (const [name, profile] of Object.entries(PROFILES)) {
    if (profile.mcps === null && enabledMcps.length === getAllMcpNames(config).length) {
      activeProfile = name;
      break;
    } else if (profile.mcps &&
               profile.mcps.length === enabledMcps.length &&
               profile.mcps.every(mcp => enabledMcps.includes(mcp))) {
      activeProfile = name;
      break;
    }
  }

  console.log(`  Active Profile: ${colors.cyan}${activeProfile}${colors.reset}`);

  console.log(`\n${colors.cyan}Available Profiles:${colors.reset}`);
  for (const [name, profile] of Object.entries(PROFILES)) {
    const indicator = name === activeProfile ? colors.green + '→ ' : '  ';
    const mcpCount = profile.mcps === null ? 'all' : profile.mcps.length;
    console.log(`${indicator}${colors.yellow}${name}${colors.reset}: ${profile.description} (${mcpCount} MCPs)`);
  }

  console.log(`\n${colors.cyan}Enabled MCPs:${colors.reset}`);
  listMcps(config, enabledMcps);

  console.log(`\n${colors.blue}Usage:${colors.reset}`);
  console.log(`  bun mcp-profile-switch.ts minimal`);
  console.log(`  bun mcp-profile-switch.ts medium`);
  console.log(`  bun mcp-profile-switch.ts full`);
}

/**
 * Show usage information
 */
function showUsage(): void {
  console.log(`${colors.cyan}MCP Profile Switcher${colors.reset}`);
  console.log(`\nUsage: bun mcp-profile-switch.ts <profile>`);
  console.log(`\nProfiles:`);

  for (const [name, profile] of Object.entries(PROFILES)) {
    const mcpCount = profile.mcps === null ? 'all' : `${profile.mcps.length}`;
    console.log(`  ${colors.yellow}${name.padEnd(10)}${colors.reset} ${profile.description} (${mcpCount} MCPs)`);
  }

  console.log(`\nCommands:`);
  console.log(`  ${colors.yellow}status${colors.reset}     Show current profile and enabled MCPs`);
  console.log(`  ${colors.yellow}help${colors.reset}       Show this help message`);
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
  showUsage();
  process.exit(0);
}

const command = args[0].toLowerCase();

switch (command) {
  case 'status':
    showStatus();
    break;
  case 'minimal':
  case 'medium':
  case 'full':
    applyProfile(command);
    break;
  default:
    console.error(`${colors.red}✗${colors.reset} Unknown command: ${command}`);
    showUsage();
    process.exit(1);
}
