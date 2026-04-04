/**
 * Credential Sanitizer for Hook Event Payloads
 *
 * Redacts known credential patterns from strings before they are
 * persisted to JSONL logs, SQLite databases, or session summaries.
 *
 * Patterns cover: Anthropic OAuth tokens, Discord bot tokens,
 * common API key formats, and .env file content patterns.
 */

const CREDENTIAL_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // Anthropic OAuth tokens (access + refresh)
  { pattern: /sk-ant-o[art]t\d{2}-[A-Za-z0-9_-]{20,}/g, replacement: '[REDACTED_ANTHROPIC_TOKEN]' },

  // Discord bot tokens (base64-encoded user ID.timestamp.hmac)
  { pattern: /[MN][A-Za-z0-9]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/g, replacement: '[REDACTED_DISCORD_TOKEN]' },

  // Generic API keys (sk-..., key-..., api-... patterns with 20+ chars)
  { pattern: /\b(sk|key|api)-[A-Za-z0-9_-]{20,}/g, replacement: '[REDACTED_API_KEY]' },

  // Bearer tokens in headers
  { pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/g, replacement: 'Bearer [REDACTED]' },

  // .env file lines with secrets (KEY=value where value looks like a token)
  { pattern: /(_TOKEN|_KEY|_SECRET|_PASSWORD|_API_KEY)=["']?[A-Za-z0-9_.\-/+]{16,}["']?/g, replacement: '$1=[REDACTED]' },
];

/**
 * Sanitize a string by replacing credential patterns with redaction markers.
 */
export function sanitizeString(input: string): string {
  let result = input;
  for (const { pattern, replacement } of CREDENTIAL_PATTERNS) {
    // Reset lastIndex for global regexps
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Deep-sanitize an object by recursively sanitizing all string values.
 * Returns a new object (does not mutate the input).
 */
export function sanitizePayload<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePayload(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = sanitizePayload(value);
    }
    return result as T;
  }
  return obj;
}
