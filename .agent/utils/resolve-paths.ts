/**
 * Dynamic Path Resolution System
 *
 * Provides a secure, environment-aware path resolution system
 * that works across different machines and user contexts.
 *
 * All imports in ~/Projects should use this instead of hardcoding paths.
 *
 * Usage:
 *   import { resolvePath, resolveHome } from '~/.claude/utils/resolve-paths'
 *
 *   const hookPath = resolvePath('hooks', 'self-test.ts')
 *   const dbPath = resolveHome('Projects/memory-system/memory.db')
 */

import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

/**
 * Resolution tiers (same as getPAIDir in env.ts)
 *
 * Tier 1: Explicit environment variable
 * Tier 2: HOME environment variable
 * Tier 3: Service context (USER, SUDO_USER, LOGNAME)
 * Tier 4: os.homedir()
 */

function getTier1(envVar: string): string | null {
  return process.env[envVar] || null;
}

function getTier2(envVar: string): string | null {
  const home = process.env.HOME;
  if (home && existsSync(home)) {
    return home;
  }
  return null;
}

function getTier3(): string | null {
  const user = process.env.USER || process.env.SUDO_USER || process.env.LOGNAME;
  if (!user) return null;

  // Try /Users (macOS)
  const macHome = `/Users/${user}`;
  if (existsSync(macHome)) {
    return macHome;
  }

  // Try /home (Linux)
  const linuxHome = `/home/${user}`;
  if (existsSync(linuxHome)) {
    return linuxHome;
  }

  return null;
}

function getTier4(): string | null {
  const home = homedir();
  if (home && existsSync(home)) {
    return home;
  }
  return null;
}

/**
 * Resolve a home directory path
 *
 * Examples:
 *   resolveHome('Projects/sam')           → ${HOME}/Projects/sam
 *   resolveHome('.claude/utils/env.ts')   → ${HOME}/.claude/utils/env.ts
 */
export function resolveHome(...segments: string[]): string {
  const tier1 = getTier1('HOME');
  if (tier1) return resolve(join(tier1, ...segments));

  const tier3 = getTier3();
  if (tier3) return resolve(join(tier3, ...segments));

  const tier4 = getTier4();
  if (tier4) return resolve(join(tier4, ...segments));

  throw new Error(
    `[PAI] Cannot resolve home directory. Set HOME environment variable.`
  );
}

/**
 * Resolve a path relative to PAI_DIR
 *
 * Examples:
 *   resolvePath('hooks', 'self-test.ts')     → ${PAI_DIR}/hooks/self-test.ts
 *   resolvePath('skills', 'CORE', 'SKILL.md') → ${PAI_DIR}/skills/CORE/SKILL.md
 */
export function resolvePath(...segments: string[]): string {
  const tier1 = getTier1('PAI_DIR');
  if (tier1) return resolve(join(tier1, ...segments));

  // Fallback to HOME/.claude
  const home = resolveHome();
  return resolve(join(home, '.claude', ...segments));
}

/**
 * Resolve a path with validation
 *
 * Throws if file/directory doesn't exist
 */
export function resolveRequired(...segments: string[]): string {
  const path = resolvePath(...segments);

  if (!existsSync(path)) {
    throw new Error(
      `[PAI] Required path not found: ${path}\n` +
      `PAI_DIR: ${getTier1('PAI_DIR') || '(not set)'}\n` +
      `HOME: ${getTier2('HOME') || getTier3() || getTier4()}`
    );
  }

  return path;
}

/**
 * Resolve a path gracefully (returns null if not found)
 */
export function resolveOptional(...segments: string[]): string | null {
  try {
    const path = resolvePath(...segments);
    return existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

/**
 * Get the current PAI_DIR
 */
export function getPAIDir(): string {
  return resolvePath();
}

/**
 * Get the current home directory
 */
export function getHome(): string {
  return resolveHome();
}

/**
 * Create a module import resolver for dynamic imports
 *
 * Usage:
 *   const env = await importFromPAI('utils/env.ts')
 */
export async function importFromPAI(relPath: string) {
  const fullPath = resolvePath(relPath);
  if (!existsSync(fullPath)) {
    throw new Error(
      `[PAI] Cannot import from PAI: ${relPath}\n` +
      `Expected at: ${fullPath}`
    );
  }

  // Dynamic import with file:// protocol
  return import(`file://${fullPath}`);
}

// Diagnostic: Print resolution chain
export function diagnose(): void {
  console.log('PAI Path Resolution Diagnostics');
  console.log('================================');
  console.log(`HOME (Tier 2):      ${getTier2('HOME') || '(not found)'}`);
  console.log(`SERVICE (Tier 3):   ${getTier3() || '(not found)'}`);
  console.log(`os.homedir (Tier4): ${getTier4() || '(not found)'}`);
  console.log(`PAI_DIR (Tier 1):   ${getTier1('PAI_DIR') || '(not set)'}`);
  console.log('');
  console.log(`Resolved HOME: ${getHome()}`);
  console.log(`Resolved PAI_DIR: ${getPAIDir()}`);
}
