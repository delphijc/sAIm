#!/usr/bin/env bun

// StreamReader.ts - Sequential voice reading with intelligent chunking
// Usage: bun StreamReader.ts <file-path> [--rate=200] [--chunk-size=400]

interface VoiceNotification {
  message: string;
  rate: number;
  voice_enabled: boolean;
}

const VOICE_SERVER_URL = "http://localhost:8888/notify";
const DEFAULT_RATE = 200; // words per minute
const DEFAULT_CHUNK_SIZE = 400; // characters per chunk (safe for voice processing)

function stripMarkdown(text: string): string {
  return text
    // Remove headers (# ## ### etc)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic (**text** or *text* or __text__ or _text_)
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remove links but keep text [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove inline code `code` -> code
    .replace(/`([^`]+)`/g, "$1")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Match voice server's sanitization: only allow a-zA-Z0-9 space.,!?-'
    // This removes parentheses, colons, semicolons, etc.
    .replace(/[^a-zA-Z0-9\s.,!?\-']/g, "")
    // Clean up multiple spaces
    .replace(/\s+/g, " ")
    .trim()
    // Limit to 500 characters (voice server max)
    .substring(0, 500);
}

async function sendToVoice(text: string, rate: number): Promise<void> {
  // Strip markdown formatting for better voice output
  const cleanText = stripMarkdown(text);

  const payload: VoiceNotification = {
    message: cleanText,
    rate,
    voice_enabled: true,
  };

  try {
    const response = await fetch(VOICE_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voice server error ${response.status}: ${errorText}`);
    }
  } catch (error) {
    console.error(`Failed to send to voice server: ${error}`);
    console.error(`Payload: ${JSON.stringify(payload, null, 2)}`);
    throw error;
  }
}

function estimateDuration(text: string, wpm: number): number {
  // Count words (rough estimate)
  const words = text.trim().split(/\s+/).length;
  // Convert WPM to milliseconds, add buffer for processing
  const durationMs = (words / wpm) * 60 * 1000;
  const bufferMs = 1000; // Buffer between chunks for natural pacing
  return Math.ceil(durationMs + bufferMs);
}

function intelligentChunk(text: string, maxSize: number): string[] {
  const chunks: string[] = [];

  // Split by double newlines (paragraphs) first
  const paragraphs = text.split(/\n\n+/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length === 0) continue;

    if (trimmed.length <= maxSize) {
      // Paragraph fits in one chunk
      chunks.push(trimmed);
    } else {
      // Split long paragraphs by sentences
      const sentences = trimmed.match(/[^.!?]+[.!?]+/g) || [trimmed];
      let currentChunk = "";

      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();

        if ((currentChunk + " " + trimmedSentence).length <= maxSize) {
          currentChunk += (currentChunk ? " " : "") + trimmedSentence;
        } else {
          // Current chunk is full, save it and start new one
          if (currentChunk) chunks.push(currentChunk);

          // If single sentence is too long, split by commas or words
          if (trimmedSentence.length > maxSize) {
            const words = trimmedSentence.split(/\s+/);
            currentChunk = "";

            for (const word of words) {
              if ((currentChunk + " " + word).length <= maxSize) {
                currentChunk += (currentChunk ? " " : "") + word;
              } else {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = word;
              }
            }
          } else {
            currentChunk = trimmedSentence;
          }
        }
      }

      // Don't forget the last chunk
      if (currentChunk) chunks.push(currentChunk);
    }
  }

  return chunks.filter(c => c.length > 0);
}

async function streamRead(filePath: string, rate: number, chunkSize: number): Promise<void> {
  console.log(`📖 Reading: ${filePath}`);
  console.log(`🎤 Rate: ${rate} WPM`);
  console.log(`📦 Max chunk size: ${chunkSize} characters\n`);

  // Read file
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const content = await file.text();

  if (!content.trim()) {
    console.error("Error: File is empty");
    process.exit(1);
  }

  // Chunk the content
  const chunks = intelligentChunk(content, chunkSize);
  console.log(`📚 Total chunks: ${chunks.length}\n`);

  // Read each chunk sequentially
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const cleanChunk = stripMarkdown(chunk);
    const progress = `[${i + 1}/${chunks.length}]`;

    console.log(`${progress} Speaking (${cleanChunk.split(/\s+/).length} words)...`);
    console.log(`  Original: "${chunk.substring(0, 60)}${chunk.length > 60 ? "..." : ""}"`);
    console.log(`  Clean:    "${cleanChunk.substring(0, 60)}${cleanChunk.length > 60 ? "..." : ""}"\n`);

    try {
      await sendToVoice(chunk, rate);
      const duration = estimateDuration(cleanChunk, rate);
      console.log(`  ⏱️  Waiting ${(duration / 1000).toFixed(1)}s for completion...\n`);
      await Bun.sleep(duration);
    } catch (error) {
      console.error(`❌ Failed at chunk ${i + 1}: ${error}`);
      console.error(`   Problematic text: "${chunk}"`);
      process.exit(1);
    }
  }

  console.log("✅ Reading complete!");
}

function printHelp(): void {
  console.log(`
StreamReader - Sequential voice reading with intelligent chunking

USAGE:
  bun StreamReader.ts <file-path> [options]

OPTIONS:
  --rate=<wpm>         Speech rate in words per minute (default: 200)
  --chunk-size=<chars> Maximum characters per chunk (default: 400)
  --help               Show this help message

EXAMPLES:
  bun StreamReader.ts ~/devotion.md
  bun StreamReader.ts ~/devotion.md --rate=180
  bun StreamReader.ts ~/devotion.md --rate=220 --chunk-size=500

DESCRIPTION:
  Reads a text file aloud using the PAI voice server with intelligent chunking
  that respects paragraph and sentence boundaries. Provides natural pacing
  by calculating speech duration and waiting appropriately between chunks.
`);
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help")) {
  printHelp();
  process.exit(0);
}

const filePath = args[0];
let rate = DEFAULT_RATE;
let chunkSize = DEFAULT_CHUNK_SIZE;

// Parse rate option
const rateArg = args.find((arg) => arg.startsWith("--rate="));
if (rateArg) {
  rate = parseInt(rateArg.split("=")[1], 10);
  if (isNaN(rate) || rate <= 0) {
    console.error("Error: Invalid rate value");
    process.exit(1);
  }
}

// Parse chunk-size option
const chunkArg = args.find((arg) => arg.startsWith("--chunk-size="));
if (chunkArg) {
  chunkSize = parseInt(chunkArg.split("=")[1], 10);
  if (isNaN(chunkSize) || chunkSize <= 0) {
    console.error("Error: Invalid chunk-size value");
    process.exit(1);
  }
}

streamRead(filePath, rate, chunkSize).catch((error) => {
  console.error(`Fatal error: ${error}`);
  process.exit(1);
});
