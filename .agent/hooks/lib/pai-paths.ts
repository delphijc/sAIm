/**
 * PAI Path Resolution - Single Source of Truth
 *
 * This module provides consistent path resolution across all PAI hooks.
 * It handles PAI_DIR detection whether set explicitly or defaulting to ~/.claude
 *
 * Usage in hooks:
 *   import { PAI_DIR, HOOKS_DIR, SKILLS_DIR } from './lib/pai-paths';
 */

import { homedir } from 'os';
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';

/**
 * Load environment variables from .env file
 * Returns the PAI_DIR if found in .env, otherwise returns undefined
 */
function loadEnvFile(): string | undefined {
  const envPaths = [
    resolve(homedir(), '.env'),
    resolve(homedir(), '.claude/.env'),
    // Also check current working directory for project-specific .env
    resolve(process.cwd(), '.env'),
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      try {
        const envContent = readFileSync(envPath, 'utf-8');
        const lines = envContent.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          // Skip comments and empty lines
          if (!trimmed || trimmed.startsWith('#')) continue;

          const [key, ...valueParts] = trimmed.split('=');
          if (key === 'PAI_DIR') {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            return value;
          }
        }
      } catch (error) {
        // Silently skip if .env can't be read
      }
    }
  }

  return undefined;
}

/**
 * Smart PAI_DIR detection with fallback
 * Priority:
 * 1. PAI_DIR from .env file (highest priority for project-specific config)
 * 2. PAI_DIR environment variable
 * 3. ~/.claude (user home directory) - ALWAYS preferred as the canonical PAI location
 */
function detectPAIDir(): string {
  // Priority 1: Load from .env file (project-specific configuration takes precedence)
  const envPaiDir = loadEnvFile();
  if (envPaiDir) {
    return resolve(envPaiDir);
  }

  // Priority 2: Environment variable (system-wide setting)
  if (process.env.PAI_DIR) {
    return resolve(process.env.PAI_DIR);
  }

  // Priority 3: Always default to ~/.claude (the canonical PAI location)
  // This ensures consistent resolution regardless of git repo structure or symlinks
  return resolve(homedir(), '.claude');
}

export const PAI_DIR = detectPAIDir();
// export const SAM_DIR = PAI_DIR; // Alias removed to ensure strict adherence to PAI_DIR

/**
 * Common PAI directories
 */
export const HOOKS_DIR = join(PAI_DIR, 'hooks');
export const SKILLS_DIR = join(PAI_DIR, 'skills');
export const AGENTS_DIR = join(PAI_DIR, 'agents');
export const HISTORY_DIR = join(PAI_DIR, 'history');
export const COMMANDS_DIR = join(PAI_DIR, 'commands');
export const REFERENCE_DIR = join(HISTORY_DIR, 'Reference');
export const DEVOTIONS_DIR = join(REFERENCE_DIR, 'days');

/**
 * Validate PAI directory structure on first import
 * This fails fast with a clear error if PAI is misconfigured
 */
function validatePAIStructure(): void {
  if (!existsSync(PAI_DIR)) {
    console.error(`❌ PAI_DIR does not exist: ${PAI_DIR}`);
    console.error(`   Expected ~/.claude or set PAI_DIR environment variable`);
    process.exit(1);
  }

  if (!existsSync(HOOKS_DIR)) {
    console.error(`❌ PAI hooks directory not found: ${HOOKS_DIR}`);
    console.error(`   Your PAI_DIR may be misconfigured`);
    console.error(`   Current PAI_DIR: ${PAI_DIR}`);
    process.exit(1);
  }
}

// Run validation on module import
// This ensures any hook that imports this module will fail fast if paths are wrong
validatePAIStructure();

/**
 * Helper to get history file path with date-based organization
 */
export function getHistoryFilePath(subdir: string, filename: string): string {
  const now = new Date();
  const pstDate = new Date(now.toLocaleString('en-US', { timeZone: process.env.TIME_ZONE || 'America/Los_Angeles' }));
  const year = pstDate.getFullYear();
  const month = String(pstDate.getMonth() + 1).padStart(2, '0');

  return join(HISTORY_DIR, subdir, `${year}-${month}`, filename);
}
