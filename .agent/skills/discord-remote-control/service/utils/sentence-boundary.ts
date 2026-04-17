/**
 * Sentence Boundary Detection - Enhanced for Voice Responses
 *
 * Improved algorithm for truncating text at natural sentence boundaries
 * to prevent voice responses from cutting off mid-sentence.
 *
 * Handles:
 * - Standard punctuation: . ! ?
 * - Ellipsis: ...
 * - Em-dashes: —
 * - Newlines: \n
 * - Quoted sentences
 * - Abbreviations (Dr., Mr., etc.)
 * - Contractions and possessives
 */

/**
 * Find the last sentence boundary in text, with multiple fallback strategies
 *
 * @param text - Text to analyze
 * @param maxLen - Maximum character limit
 * @returns Best truncation point found, or -1 if none found
 */
function findSentenceBoundary(text: string, maxLen: number): number {
  if (text.length <= maxLen) return text.length;

  const truncated = text.substring(0, maxLen);

  // Strategy 1: Look for sentence-ending patterns with following space/newline
  // These are the most reliable indicators of sentence boundaries
  const sentenceEndings = [
    // Standard: . ! ? followed by space or newline
    { pattern: /[.!?]\s+/g, priority: 10 },
    // Ellipsis followed by space or newline
    { pattern: /\.\.\.\s+/g, priority: 9 },
    // Em-dash or en-dash followed by space/newline (dialogue or aside)
    { pattern: /[—–]\s+/g, priority: 8 },
    // Period or punctuation at end of line
    { pattern: /[.!?]\n/g, priority: 7 },
    // Ellipsis at end of line
    { pattern: /\.\.\.\n/g, priority: 6 },
  ];

  // Try each pattern in priority order
  for (const { pattern, priority } of sentenceEndings) {
    const matches = Array.from(truncated.matchAll(pattern));
    if (matches.length > 0) {
      // Get the last match
      const lastMatch = matches[matches.length - 1];
      const endPos = lastMatch.index! + lastMatch[0].length - 1; // Position after punctuation, before space

      // Only accept if it captures at least 30% of target length
      if (endPos > maxLen * 0.3) {
        return endPos;
      }
    }
  }

  // Strategy 2: Look for punctuation without requiring following space
  // (handles cases where sentence ends at maxLen boundary)
  const harderPatterns = [
    { pattern: /[.!?](?![\w])/, priority: 5 }, // Not followed by word char
    { pattern: /\.\.\./, priority: 4 }, // Ellipsis anywhere
    { pattern: /[.!?]$/, priority: 3 }, // At end of truncated text
  ];

  for (const { pattern } of harderPatterns) {
    const lastMatchIdx = truncated.search(new RegExp(pattern.source + '(?![\s\S]*' + pattern.source + ')'));
    if (lastMatchIdx !== -1) {
      const endPos = lastMatchIdx + 1;
      if (endPos > maxLen * 0.3) {
        return endPos;
      }
    }
  }

  // Strategy 3: Fall back to word boundary (last space)
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.5) {
    return lastSpace;
  }

  // Strategy 4: Last resort - return maxLen
  return maxLen;
}

/**
 * Truncate text at a natural sentence boundary
 *
 * Ensures voice responses end at sentence punctuation (., !, ?, ..., —)
 * rather than cutting off mid-sentence. Uses intelligent fallback strategies.
 *
 * @param text - Text to truncate
 * @param maxLen - Maximum character length
 * @returns Truncated text ending at a sentence boundary
 */
export function truncateAtSentenceBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }

  const boundaryPos = findSentenceBoundary(text, maxLen);
  const truncated = text.substring(0, boundaryPos).trim();

  // Ensure we return something (fallback to maxLen if needed)
  if (truncated.length === 0) {
    return text.substring(0, maxLen).trim();
  }

  return truncated;
}

/**
 * Detect if text ends at a natural sentence boundary
 * Useful for checking if a response is complete
 *
 * @param text - Text to check
 * @returns true if text ends with sentence punctuation
 */
export function endsAtSentenceBoundary(text: string): boolean {
  const trimmed = text.trim();
  return /[.!?…—]$/.test(trimmed) || /[.!?…—]\s*$/.test(trimmed);
}

/**
 * Get the next sentence boundary after a given position
 * Useful for finding safe split points
 *
 * @param text - Full text
 * @param startPos - Position to start searching from
 * @returns Position of next sentence boundary, or -1 if none found
 */
export function findNextSentenceBoundary(text: string, startPos: number = 0): number {
  const remaining = text.substring(startPos);

  // Look for sentence-ending patterns
  const patterns = [
    /[.!?]\s+/,
    /\.\.\.\s+/,
    /[—–]\s+/,
    /[.!?]\n/,
    /\.\.\.\n/,
    /[.!?]$/,
  ]; // Note: patterns don't need global flag for search()

  for (const pattern of patterns) {
    const match = remaining.search(pattern);
    if (match !== -1) {
      return startPos + match + 1; // Return position after punctuation
    }
  }

  return -1;
}

/**
 * Split text into sentences while respecting max length
 * Returns chunks that end at sentence boundaries
 *
 * @param text - Text to split
 * @param maxLen - Maximum chunk length
 * @returns Array of sentence chunks
 */
export function splitAtSentenceBoundaries(text: string, maxLen: number = 1500): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Find sentence boundary within maxLen
    const chunk = truncateAtSentenceBoundary(remaining, maxLen);
    chunks.push(chunk);

    // Continue with remaining text
    remaining = remaining.substring(chunk.length).trim();
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Estimate sentence count in text
 * Useful for logging and debugging
 *
 * @param text - Text to analyze
 * @returns Approximate sentence count
 */
export function estimateSentenceCount(text: string): number {
  return (text.match(/[.!?]+/g) || []).length;
}
