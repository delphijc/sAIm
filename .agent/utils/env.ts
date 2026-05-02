#!/usr/bin/env bun
/**
 * PAI_DIR Resolution Utility - Four-Tier Fallback System
 *
 * Ensures consistent, defensive discovery of the PAI home directory
 * across all environments: local dev, systemd, cron, Docker, etc.
 *
 * Tier 1: Explicit PAI_DIR environment variable
 * Tier 2: HOME environment variable fallback
 * Tier 3: Service/systemd context (USER, SUDO_USER, LOGNAME)
 * Tier 4: os.homedir() with defensive error
 *
 * Usage:
 *   import { getPAIDir, getPAIPath, resolvePAIFile } from '@/utils/env.ts';
 *
 *   const paiDir = getPAIDir();                              // /Users/delphijc/.claude
 *   const hookPath = getPAIPath('hooks', 'self-test.ts');   // /Users/delphijc/.claude/hooks/self-test.ts
 *   const skillFile = resolvePAIFile('skills/CORE/SKILL.md'); // /Users/delphijc/.claude/skills/CORE/SKILL.md
 */

import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

/**
 * Tier 1: Explicit PAI_DIR environment variable
 * - Set by: settings.json hooks, service definitions, manual env setup
 * - Priority: Highest — user explicitly set this
 */
function getTier1(): string | null {
  return process.env.PAI_DIR || null;
}

/**
 * Tier 2: HOME environment variable
 * - Set by: parent shell, login session, most standard contexts
 * - Priority: High — inherited from normal shell environment
 * - Resolves to: $HOME/.claude
 */
function getTier2(): string | null {
  const home = process.env.HOME;
  if (home && home !== '/' && existsSync(home)) {
    return home;
  }
  return null;
}

/**
 * Tier 3: Service/Systemd context variables
 * - Set by: systemd service definitions, sudo contexts, cron jobs
 * - Priority: Medium — requires parsing from service env
 * - Fallback chain: USER → SUDO_USER → LOGNAME
 */
function getTier3(): string | null {
  const user = process.env.USER || process.env.SUDO_USER || process.env.LOGNAME;

  if (!user) {
    return null;
  }

  // Try /home on Linux
  const linuxHome = `/home/${user}`;
  if (existsSync(linuxHome)) {
    return linuxHome;
  }

  // Try /Users on macOS
  const macHome = `/Users/${user}`;
  if (existsSync(macHome)) {
    return macHome;
  }

  return null;
}

/**
 * Tier 4: os.homedir() with defensive error handling
 * - Set by: Node.js standard library
 * - Priority: Lowest — most indirect, but nearly always available
 * - Fails loud: Provides actionable error message
 */
function getTier4(): string | null {
  const home = homedir();
  if (home && home !== '/' && existsSync(home)) {
    return home;
  }
  return null;
}

/**
 * Main resolution function: Four-tier fallback with loud failure
 *
 * @throws Error if all tiers fail — includes actionable diagnostics
 * @returns Absolute path to PAI home directory (~/.claude)
 */
export function getPAIDir(): string {
  // Try each tier in order
  const tier1 = getTier1();
  if (tier1) {
    return tier1;
  }

  const tier2 = getTier2();
  if (tier2) {
    return join(tier2, '.claude');
  }

  const tier3 = getTier3();
  if (tier3) {
    return join(tier3, '.claude');
  }

  const tier4 = getTier4();
  if (tier4) {
    return join(tier4, '.claude');
  }

  // All tiers failed — provide diagnostic error
  const diagnostics = [
    `[PAI] Cannot determine PAI_DIR. All four resolution tiers failed:`,
    '',
    `Tier 1 (Explicit): PAI_DIR env var = ${process.env.PAI_DIR || '(not set)'}`,
    `Tier 2 (HOME):    HOME env var = ${process.env.HOME || '(not set)'}`,
    `Tier 3 (Service): USER=${process.env.USER || '(not set)'}, SUDO_USER=${process.env.SUDO_USER || '(not set)'}, LOGNAME=${process.env.LOGNAME || '(not set)'}`,
    `Tier 4 (os.homedir()): ${(() => {
      try {
        return homedir();
      } catch (e) {
        return `Error: ${(e as Error).message}`;
      }
    })()}`,
    '',
    `Fix this by setting ONE of:`,
    `  export PAI_DIR="/path/to/.claude"                    (recommended)`,
    `  export HOME="/path/to/home"`,
    `  export USER="username" (with existing /home or /Users/username)`,
    '',
    `If running in a restricted environment (cron, systemd, container):`,
    `  1. Set PAI_DIR explicitly in the service definition`,
    `  2. Or set HOME to a valid, accessible directory`,
    ``,
  ];

  throw new Error(diagnostics.join('\n'));
}

/**
 * Resolve a path relative to PAI directory
 *
 * @param segments Path segments (e.g., 'hooks', 'self-test.ts')
 * @returns Absolute path to the resource
 *
 * @example
 *   getPAIPath('hooks', 'self-test.ts')
 *   // => /Users/delphijc/.claude/hooks/self-test.ts
 */
export function getPAIPath(...segments: string[]): string {
  return join(getPAIDir(), ...segments);
}

/**
 * Resolve a file path relative to PAI directory with validation
 *
 * @param filePath Relative path (e.g., 'skills/CORE/SKILL.md')
 * @returns Absolute path to the file
 * @throws Error if file does not exist
 *
 * @example
 *   resolvePAIFile('skills/CORE/SKILL.md')
 *   // => /Users/delphijc/.claude/skills/CORE/SKILL.md
 */
export function resolvePAIFile(filePath: string): string {
  const fullPath = getPAIPath(filePath);

  if (!existsSync(fullPath)) {
    throw new Error(
      `[PAI] File not found: ${fullPath}\n` +
        `Check that PAI_DIR is correct: ${getPAIDir()}\n` +
        `Relative path: ${filePath}`
    );
  }

  return fullPath;
}

/**
 * Get PAI directory without throwing (graceful)
 *
 * Useful for optional PAI features that can degrade gracefully
 * if PAI_DIR cannot be determined.
 *
 * @returns PAI directory or null if all tiers fail
 */
export function getPAIDirOptional(): string | null {
  try {
    return getPAIDir();
  } catch {
    return null;
  }
}

/**
 * Validate that PAI directory is accessible
 *
 * Useful for startup checks and diagnostics
 *
 * @returns { valid: boolean, reason?: string }
 */
export function validatePAIDir(): { valid: boolean; reason?: string } {
  try {
    const dir = getPAIDir();

    if (!existsSync(dir)) {
      return {
        valid: false,
        reason: `PAI directory does not exist: ${dir}`,
      };
    }

    // Check that critical subdirectories exist
    const required = ['hooks', 'skills', 'agents'];
    for (const subdir of required) {
      const path = join(dir, subdir);
      if (!existsSync(path)) {
        return {
          valid: false,
          reason: `Missing required directory: ${path}`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: (error as Error).message,
    };
  }
}

// Export for CLI use
if (import.meta.main) {
  console.log('PAI_DIR Resolution Diagnostic');
  console.log('==============================');
  console.log(`Tier 1 (Explicit): ${getTier1() || '(not found)'}`);
  console.log(`Tier 2 (HOME):     ${getTier2() || '(not found)'}`);
  console.log(`Tier 3 (Service):  ${getTier3() || '(not found)'}`);
  console.log(`Tier 4 (os.homedir): ${getTier4() || '(not found)'}`);
  console.log('');

  const validation = validatePAIDir();
  if (validation.valid) {
    console.log(`✓ PAI_DIR resolved: ${getPAIDir()}`);
  } else {
    console.error(`✗ Validation failed: ${validation.reason}`);
    process.exit(1);
  }
}
