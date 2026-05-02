#!/usr/bin/env bun

/**
 * Pre-Commit Hook: Validate Hardcoded Paths
 *
 * Prevents commits containing hardcoded home directory paths.
 * Runs on staged files before commit.
 *
 * Usage: Called automatically by git pre-commit hook
 *
 * Rules:
 *   Forbidden: absolute paths like user home directories
 *   Forbidden: Hardcoded paths in TypeScript/JS/TOML/JSON imports
 *   Allowed: ${HOME}, $HOME, ${PAI_DIR}, process.env.*
 *   Allowed: Comments documenting paths (not actual code)
 */

import { execSync } from 'child_process';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const FORBIDDEN_PATTERNS = [
  // Absolute user paths (never in code)
  /(?<!\/\/).*(?<!["'])\/(Users|home|root)\/[a-zA-Z0-9_\-]+(?!\/[\.\w]*)/,

  // TypeScript imports with hardcoded paths
  /from ["']\/Users\/[^"']*["']/,
  /from ["']\/home\/[^"']*["']/,

  // JSON/TOML config with hardcoded paths (non-comments)
  /:\s*["']\/Users\/[^"']*["']/,
  /=\s*["']\/Users\/[^"']*["']/,
];

const ALLOWED_PATTERNS = [
  /\$\{?HOME\}?/,
  /\$\{?PAI_DIR\}?/,
  /\$\{?PAI_HOME\}?/,
  /process\.env\./,
  /\/\/.*/, // Comments
];

function isAllowedReference(line: string): boolean {
  // Lines with environment variables are OK
  if (ALLOWED_PATTERNS.some(pattern => pattern.test(line))) {
    return true;
  }

  // Documentation comments are OK
  if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
    return true;
  }

  // Error messages and console.log are OK (not actual code execution)
  if (line.includes('console.') || line.includes('error(')) {
    return true;
  }

  return false;
}

function validateFile(filePath: string, content: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for forbidden patterns
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line) && !isAllowedReference(line)) {
        result.valid = false;
        result.errors.push(
          `${filePath}:${lineNum} - Hardcoded path detected:\n  ${line.trim()}`
        );
      }
    }

    // Warn about potential issues
    if (line.includes('/Users/') || line.includes('/home/') || line.includes('/root/')) {
      if (!isAllowedReference(line)) {
        result.warnings.push(
          `${filePath}:${lineNum} - Check for hardcoded path:\n  ${line.trim()}`
        );
      }
    }
  });

  return result;
}

async function main() {
  try {
    // Get staged files
    const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
    }).trim().split('\n').filter(Boolean);

    let hasErrors = false;
    let hasWarnings = false;

    for (const file of stagedFiles) {
      // Skip binary files and non-code files
      if (!file.match(/\.(ts|js|json|toml|yaml|yml|sh)$/)) {
        continue;
      }

      try {
        const content = execSync(`git show :${file}`, {
          encoding: 'utf-8',
        });

        const result = validateFile(file, content);

        if (!result.valid) {
          console.error(`\n❌ ${file}: Hardcoded paths detected`);
          result.errors.forEach(err => console.error(`   ${err}`));
          hasErrors = true;
        }

        if (result.warnings.length > 0) {
          console.warn(`\n⚠️  ${file}: Review these lines`);
          result.warnings.forEach(warn => console.warn(`   ${warn}`));
          hasWarnings = true;
        }
      } catch (e) {
        // File might not exist in staging, skip
      }
    }

    if (hasErrors) {
      console.error(
        `\n❌ Commit blocked: Hardcoded paths detected\n` +
        `\nFix: Replace hardcoded paths with environment variables:\n` +
        `  • Use \${HOME} or process.env.HOME in TypeScript\n` +
        `  • Use $HOME or $\{HOME\} in shell scripts\n` +
        `  • Use \${PAI_DIR} for ~/.claude references\n` +
        `\nThen run: git add <files> && git commit`
      );
      process.exit(1);
    }

    if (hasWarnings) {
      console.warn(`\n⚠️  Review warnings above before committing`);
    }

    console.log('✅ No hardcoded paths detected');
    process.exit(0);
  } catch (error) {
    console.error('Error validating paths:', error);
    process.exit(1);
  }
}

main();
