/**
 * Response Chunker - Phase 9
 * Chunks long responses at paragraph/sentence/word boundaries
 * Respects Discord's 2000 character limit per message
 */

interface ChunkOptions {
  maxChars?: number; // Default: 2000 (Discord limit)
  strategy?: "paragraph" | "sentence" | "word"; // Default: paragraph
  delayMs?: number; // Delay between messages (ms)
  includeLineNumbers?: boolean; // Include chunk numbers
}

/**
 * Chunk text into Discord-safe pieces
 * Respects 2000 character limit and tries chunking at natural boundaries
 */
export function chunkResponse(
  text: string,
  options?: ChunkOptions
): string[] {
  const maxChars = options?.maxChars || 2000;
  const strategy = options?.strategy || "paragraph";

  if (text.length <= maxChars) {
    return [text];
  }

  const chunks = ((): string[] => {
    switch (strategy) {
      case "paragraph":
        return chunkByParagraph(text, maxChars);
      case "sentence":
        return chunkBySentence(text, maxChars);
      case "word":
        return chunkByWord(text, maxChars);
      default:
        return chunkByWord(text, maxChars);
    }
  })();

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Chunk by paragraph (double newline)
 * Best for formatted text with clear sections
 */
function chunkByParagraph(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    // Add extra newline between paragraphs
    const separator = currentChunk ? "\n\n" : "";

    if ((currentChunk + separator + para).length <= maxChars) {
      currentChunk += separator + para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // If single paragraph is too long, split by sentence
      if (para.length > maxChars) {
        chunks.push(...chunkBySentence(para, maxChars));
        currentChunk = "";
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Chunk by sentence
 * Works well for prose and narrative text
 */
function chunkBySentence(text: string, maxChars: number): string[] {
  // Split on sentence boundaries: . ! ? followed by space
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + " " + sentence).length <= maxChars) {
      currentChunk = (currentChunk + " " + sentence).trim();
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // If single sentence is too long, split by word
      if (sentence.length > maxChars) {
        chunks.push(...chunkByWord(sentence, maxChars));
        currentChunk = "";
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Chunk by word
 * Fallback when text doesn't have natural boundaries
 */
function chunkByWord(text: string, maxChars: number): string[] {
  const words = text.split(/(\s+)/); // Keep whitespace
  const chunks: string[] = [];
  let currentChunk = "";

  for (const word of words) {
    // Test if adding this word exceeds limit
    const testChunk = currentChunk + word;

    if (testChunk.length <= maxChars) {
      currentChunk = testChunk;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      // If single word (non-whitespace) is too long, force it in
      if (word.trim().length > maxChars) {
        // Split very long words (e.g., URLs)
        for (let i = 0; i < word.length; i += maxChars) {
          chunks.push(word.substring(i, i + maxChars));
        }
        currentChunk = "";
      } else {
        currentChunk = word;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Get chunk count and size summary
 */
export function getChunkStats(text: string, maxChars: number = 2000): {
  chunks: number;
  totalChars: number;
  avgChunkSize: number;
  maxChunkSize: number;
  minChunkSize: number;
} {
  const chunks = chunkResponse(text, { maxChars });

  const sizes = chunks.map((c) => c.length);

  return {
    chunks: chunks.length,
    totalChars: text.length,
    avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / chunks.length),
    maxChunkSize: Math.max(...sizes),
    minChunkSize: Math.min(...sizes),
  };
}

/**
 * Format chunks with headers
 * Useful for showing progress
 */
export function formatChunks(
  chunks: string[],
  options?: {
    showHeader?: boolean;
    headerFormat?: (current: number, total: number) => string;
  }
): string[] {
  if (!options?.showHeader || chunks.length <= 1) {
    return chunks;
  }

  const defaultHeader = (current: number, total: number) =>
    `**[Message ${current}/${total}]**\n`;

  const headerFn = options.headerFormat || defaultHeader;

  return chunks.map((chunk, index) => {
    const header = headerFn(index + 1, chunks.length);
    return header + chunk;
  });
}
