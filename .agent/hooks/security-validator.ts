#!/usr/bin/env bun

import { PAI_DIR } from './lib/pai-paths';
import { join } from 'path';

/**
 * security-validator.ts - PreToolUse Security Validation Hook
 *
 * Fast pattern-based security validation for Bash commands.
 * Blocks commands matching known attack patterns before execution.
 *
 * Design Principles:
 * - Fast path: Most commands allowed with minimal processing
 * - Pre-compiled regex patterns at module load
 * - Only log/block on high-confidence attack detection
 * - Fail CLOSED on errors (security over convenience)
 *
 * CUSTOMIZATION REQUIRED:
 * This template includes basic examples. Add your own security patterns
 * based on your threat model and environment.
 */

// ============================================================================
// ATTACK PATTERNS - CUSTOMIZE THESE FOR YOUR ENVIRONMENT
// ============================================================================

// Reverse Shell Patterns (BLOCK - rarely legitimate)
const REVERSE_SHELL_PATTERNS: RegExp[] = [
  /\/dev\/(tcp|udp)\/[0-9]/,                    // Bash TCP/UDP device
  /bash\s+-i\s+>&?\s*\/dev\//,                  // Interactive bash redirect
  /\bnc\s+(-[a-z]*\s+)*\S+\s+\d+\s*[|<>]/,     // Netcat with pipe/redirect
  /\bpython[23]?\s+-c\s+.*socket/i,              // Python reverse shell
  /\bperl\s+-e\s+.*socket/i,                     // Perl reverse shell
  /\bruby\s+-e\s+.*TCPSocket/i,                  // Ruby reverse shell
  /\bsocat\s+.*TCP/i,                            // Socat tunneling
];

// Instruction Override (BLOCK - prompt injection)
const INSTRUCTION_OVERRIDE_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /disregard\s+(all\s+)?(prior|previous)\s+(instructions?|rules?)/i,
];

// Catastrophic Deletion Patterns (BLOCK - filesystem destruction)
const CATASTROPHIC_DELETION_PATTERNS: RegExp[] = [
  /\s+~\/?(\s*$|\s+)/,                              // Space then ~/ at end
  /\brm\s+(-[rfivd]+\s+)*\S+\s+~\/?/,               // rm something ~/
  /\brm\s+(-[rfivd]+\s+)*\.\/\s*$/,                 // rm -rf ./
  /\brm\s+(-[rfivd]+\s+)*\.\.\/\s*$/,               // rm -rf ../
];

// Dangerous File Operations (BLOCK - data destruction)
const DANGEROUS_FILE_OPS_PATTERNS: RegExp[] = [
  /\bchmod\s+(-R\s+)?0{3,}/,                        // chmod 000
];

// Credential Exfiltration Patterns (BLOCK - token/secret theft)
const CREDENTIAL_EXFIL_PATTERNS: RegExp[] = [
  /\bcat\s+.*\.env\b.*\|\s*/,                        // cat .env | ...
  /\bcat\s+.*\.credentials/,                          // cat .credentials*
  /\bcat\s+.*\btoken\b/i,                            // cat *token*
  /\bcurl\s+.*\$\(/,                                 // curl with command substitution
  /\bcurl\s+.*`[^`]+`/,                              // curl with backtick substitution
  /\bcurl\s+.*-d\s+.*\$\{?\w*(TOKEN|KEY|SECRET)/i,   // curl posting secrets
  /\benv\b\s*\|/,                                    // env | (pipe env to something)
  /\bprintenv\b.*\|/,                                // printenv | pipe
  /\bset\b\s*\|.*\b(curl|nc|wget)\b/,               // set | curl/nc/wget
  /\$\{?\w*(DISCORD_BOT_TOKEN|GROQ_API_KEY|ANTHROPIC_API_KEY)/i, // Direct secret expansion in commands
  /\bwget\s+.*--(post-data|body)\s*=?\s*.*\$\(/,     // wget exfiltration
  /\bwget\s+.*`[^`]+`/,                              // wget with backtick substitution
];

// Discord-Specific Attack Patterns (BLOCK - PAI/Discord targeted attacks)
const DISCORD_SPECIFIC_PATTERNS: RegExp[] = [
  // Sensitive file access (even without piping)
  /\b(cat|head|tail|less|more|strings)\s+.*\.(env|credentials\.json|secret)/i,
  /\b(cat|head|tail|less|more|strings)\s+.*\/\.claude\//,  // .claude directory access
  // Base64/encoding exfiltration
  /\bbase64\b.*\|\s*(bash|sh|zsh)\b/,               // base64 decode to shell
  /\b(cat|head|tail)\s+.*\|\s*base64\b/,            // file to base64 encoding
  // DNS exfiltration
  /\b(dig|nslookup|host)\s+.*\$\(/,                 // DNS with command substitution
  /\b(dig|nslookup|host)\s+.*`[^`]+`/,              // DNS with backtick substitution
  // Netcat data send (standalone, no pipe needed)
  /\bnc\s+(-[a-z]*\s+)*\S+\s+\d+\s*</,             // nc host port < file
  /\bnc\s+(-[a-z]*\s+)*\S+\s+\d+\s*<<<\s*\$/,      // nc host port <<< $VAR
  // Python/Node HTTP exfiltration
  /\bpython[23]?\s+-c\s+.*\b(urllib|requests|http\.client)\b/i,
  /\bnode\s+-e\s+.*\b(https?\.request|fetch)\b/i,
];

// Evasion Detection Patterns (BLOCK - obfuscation techniques)
const EVASION_PATTERNS: RegExp[] = [
  // Quote-insertion evasion: c''at, r''m, cu''rl, etc.
  /\b[a-z]+''+[a-z]+\b/i,                           // Single-quote insertion (c''at)
  /\b[a-z]+""+[a-z]+\b/i,                           // Double-quote insertion (c""at)
  // Backslash evasion: c\at, r\m, cu\rl
  /\b(c\\a\\?t|r\\m|cu\\rl|w\\get|n\\c|ba\\sh)\b/i,
  // Hex/octal escape evasion: $'\x63\x61\x74' = cat
  /\$'(\\x[0-9a-f]{2}|\\[0-7]{3})+'/i,
  // Variable-based command construction
  /\b\w+=\w+.*;\s*\$\w+/,                           // a=cat; $a file
];

// OPTIONAL: Operations that require confirmation instead of blocking
const DANGEROUS_GIT_PATTERNS: RegExp[] = [
  /\bgit\s+push\s+.*(-f\b|--force)/i,               // git push --force
  /\bgit\s+reset\s+--hard/i,                        // git reset --hard
  // Add your own git safety patterns here
];

// Combined patterns for fast iteration
const ALL_BLOCK_PATTERNS: { category: string; patterns: RegExp[] }[] = [
  { category: 'reverse_shell', patterns: REVERSE_SHELL_PATTERNS },
  { category: 'instruction_override', patterns: INSTRUCTION_OVERRIDE_PATTERNS },
  { category: 'catastrophic_deletion', patterns: CATASTROPHIC_DELETION_PATTERNS },
  { category: 'dangerous_file_ops', patterns: DANGEROUS_FILE_OPS_PATTERNS },
  { category: 'credential_exfiltration', patterns: CREDENTIAL_EXFIL_PATTERNS },
  { category: 'discord_specific_attack', patterns: DISCORD_SPECIFIC_PATTERNS },
  { category: 'evasion_technique', patterns: EVASION_PATTERNS },
];

const CONFIRM_PATTERNS: { category: string; patterns: RegExp[] }[] = [
  { category: 'dangerous_git', patterns: DANGEROUS_GIT_PATTERNS },
];

// ============================================================================
// TYPES
// ============================================================================

interface HookInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown> | string;
}

interface HookOutput {
  permissionDecision: 'allow' | 'deny';
  additionalContext?: string;
  feedback?: string;
}

// ============================================================================
// DETECTION LOGIC
// ============================================================================

interface DetectionResult {
  blocked: boolean;
  requiresConfirmation?: boolean;
  category?: string;
  pattern?: string;
}

function detectAttack(content: string): DetectionResult {
  // First check for hard blocks
  for (const { category, patterns } of ALL_BLOCK_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return { blocked: true, category, pattern: pattern.source };
      }
    }
  }

  // Then check for confirmation-required patterns
  for (const { category, patterns } of CONFIRM_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return { blocked: false, requiresConfirmation: true, category, pattern: pattern.source };
      }
    }
  }

  return { blocked: false };
}

// ============================================================================
// ASYNC LOGGING (fire-and-forget on block only)
// ============================================================================

function logSecurityEvent(event: Record<string, unknown>): void {
  // Fire-and-forget - don't await, don't block
  const logPath = join(PAI_DIR, 'history/security/security-events.jsonl');
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n';

  Bun.write(logPath, entry, { createPath: true }).catch(() => {
    // Silently fail - logging should never break the hook
  });
}

// ============================================================================
// MAIN HOOK LOGIC
// ============================================================================

async function main(): Promise<void> {
  let input: HookInput;

  try {
    // Stdin read with reasonable timeout (500ms)
    const text = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 500))
    ]);

    if (!text.trim()) {
      // Empty input is not a security threat — allow
      console.log(JSON.stringify({ permissionDecision: 'allow' }));
      return;
    }

    input = JSON.parse(text);
  } catch (err) {
    // Timeout or parse error — fail CLOSED
    const reason = err instanceof Error ? err.message : 'unknown';
    logSecurityEvent({
      type: 'fail_closed',
      reason,
      detail: 'Security validator could not read/parse input; denying by default',
    });
    console.log(JSON.stringify({
      permissionDecision: 'deny',
      additionalContext: `Security validator failed (${reason}) — denying for safety`,
    }));
    process.exit(2);
    return; // unreachable but satisfies TS
  }

  // Only validate Bash commands
  if (input.tool_name !== 'Bash') {
    console.log(JSON.stringify({ permissionDecision: 'allow' }));
    return;
  }

  // Extract command string
  const command = typeof input.tool_input === 'string'
    ? input.tool_input
    : (input.tool_input?.command as string) || '';

  if (!command) {
    console.log(JSON.stringify({ permissionDecision: 'allow' }));
    return;
  }

  // Check all patterns
  const result = detectAttack(command);

  if (result.blocked) {
    // Log and block
    logSecurityEvent({
      type: 'attack_blocked',
      category: result.category,
      pattern: result.pattern,
      command: command.slice(0, 200), // Truncate for log
      session_id: input.session_id,
    });

    const output: HookOutput = {
      permissionDecision: 'deny',
      additionalContext: `🚨 SECURITY: Blocked ${result.category} pattern`,
      feedback: `This command matched a security pattern (${result.category}). If this is legitimate, please rephrase the command.`,
    };

    console.log(JSON.stringify(output));
    process.exit(2); // Exit 2 = blocking error
  }

  if (result.requiresConfirmation) {
    // Log warning and require confirmation
    logSecurityEvent({
      type: 'confirmation_required',
      category: result.category,
      pattern: result.pattern,
      command: command.slice(0, 200),
      session_id: input.session_id,
    });

    const output: HookOutput = {
      permissionDecision: 'deny',
      additionalContext: `⚠️ DANGEROUS: ${result.category} operation requires confirmation`,
      feedback: `This is a dangerous operation (${command.slice(0, 50)}...). This can cause data loss. If you're sure, explicitly confirm this command.`,
    };

    console.log(JSON.stringify(output));
    process.exit(2); // Exit 2 = requires user confirmation
  }

  // Allow - no logging, immediate exit
  console.log(JSON.stringify({ permissionDecision: 'allow' }));
}

// ============================================================================
// RUN
// ============================================================================

main().catch((err) => {
  // On any error, fail CLOSED
  const reason = err instanceof Error ? err.message : 'unknown';
  logSecurityEvent({
    type: 'fail_closed',
    reason,
    detail: 'Unhandled error in security validator; denying by default',
  });
  console.log(JSON.stringify({
    permissionDecision: 'deny',
    additionalContext: `Security validator error (${reason}) — denying for safety`,
  }));
  process.exit(2);
});
