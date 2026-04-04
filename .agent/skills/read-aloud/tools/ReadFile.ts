#!/usr/bin/env bun

// ReadFile.ts - Simple client for server-side streaming voice reading
// Usage: bun ReadFile.ts <file-path> [--chunk-size=400]

const VOICE_SERVER_URL = "http://localhost:8888/stream";
const DEFAULT_CHUNK_SIZE = 400;

async function readFileAloud(filePath: string, chunkSize: number): Promise<void> {
  console.log(`📖 Reading: ${filePath}`);
  console.log(`📦 Chunk size: ${chunkSize} characters\n`);

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

  console.log(`📄 File size: ${content.length} characters`);
  console.log(`🎤 Sending to voice server for streaming...\n`);

  // Send entire content to server for streaming
  try {
    const response = await fetch(VOICE_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: content,
        chunk_size: chunkSize,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Voice server error: ${error.message}`);
    }

    const result = await response.json();
    console.log(`\n✅ ${result.message} (${result.chunks} chunks)`);
    console.log(`🎙️  Server is now reading aloud. Audio playback happening on server...`);
  } catch (error) {
    console.error(`❌ Failed to stream: ${error}`);
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
ReadFile - Server-side streaming voice reading

USAGE:
  bun ReadFile.ts <file-path> [options]

OPTIONS:
  --chunk-size=<chars> Maximum characters per chunk (default: 400)
  --help               Show this help message

EXAMPLES:
  bun ReadFile.ts ~/devotion.md
  bun ReadFile.ts ~/devotion.md --chunk-size=500

DESCRIPTION:
  Reads a text file aloud by sending it to the voice server's /stream endpoint.
  The server handles all markdown stripping, chunking, and sequential playback.
  This eliminates client-side delays for seamless reading.
`);
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help")) {
  printHelp();
  process.exit(0);
}

const filePath = args[0];
let chunkSize = DEFAULT_CHUNK_SIZE;

// Parse chunk-size option
const chunkArg = args.find((arg) => arg.startsWith("--chunk-size="));
if (chunkArg) {
  chunkSize = parseInt(chunkArg.split("=")[1], 10);
  if (isNaN(chunkSize) || chunkSize <= 0) {
    console.error("Error: Invalid chunk-size value");
    process.exit(1);
  }
}

readFileAloud(filePath, chunkSize).catch((error) => {
  console.error(`Fatal error: ${error}`);
  process.exit(1);
});
