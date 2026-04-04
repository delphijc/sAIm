/**
 * Shared Whisper.cpp Transcription Module
 * Replaces both Groq Whisper API (Discord) and Python whisper (transcribe-audio)
 *
 * Usage as module:
 *   import { transcribe, transcribeWithFormatting } from "./transcribe.ts";
 *
 * Usage as CLI:
 *   bun run transcribe.ts <audio-file> [--model base] [--ollama-model gpt-oss] [--format]
 */

import { $ } from "bun";
import { existsSync, statSync } from "fs";
import { tmpdir } from "os";
import { join, extname, basename } from "path";
import { unlink, readFile, writeFile, mkdir } from "fs/promises";

// Resolve paths relative to this file's location
const TOOLS_DIR = import.meta.dir;
const WHISPER_CPP_DIR = join(TOOLS_DIR, "whisper.cpp");
const WHISPER_CLI = join(WHISPER_CPP_DIR, "build", "bin", "whisper-cli");
const MODELS_DIR = join(WHISPER_CPP_DIR, "models");

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  duration?: number; // transcription time in seconds
  language?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
  error?: string;
}

export interface TranscribeOptions {
  model?: string; // whisper model name: tiny, base, small, medium, large
  language?: string;
  threads?: number;
  translate?: boolean; // translate to English
}

/**
 * Get the model file path for a given model name
 */
function getModelPath(model: string): string {
  return join(MODELS_DIR, `ggml-${model}.bin`);
}

/**
 * Convert audio to WAV format using ffmpeg (required for whisper.cpp)
 * Returns path to temporary WAV file
 */
async function convertToWav(inputPath: string): Promise<string> {
  const ext = extname(inputPath).toLowerCase();

  // whisper.cpp supports wav, mp3, ogg, flac natively
  if ([".wav", ".mp3", ".ogg", ".flac"].includes(ext)) {
    return inputPath; // No conversion needed
  }

  // For other formats (m4a, etc.), convert to wav
  const tmpWav = join(tmpdir(), `whisper-${Date.now()}-${basename(inputPath, ext)}.wav`);

  const result = await $`ffmpeg -i ${inputPath} -ar 16000 -ac 1 -c:a pcm_s16le ${tmpWav} -y 2>&1`.quiet();

  if (result.exitCode !== 0) {
    throw new Error(`ffmpeg conversion failed: ${result.stderr.toString()}`);
  }

  return tmpWav;
}

/**
 * Transcribe an audio file using whisper.cpp
 */
export async function transcribe(
  audioPath: string,
  options: TranscribeOptions = {}
): Promise<TranscriptionResult> {
  const model = options.model || process.env.WHISPER_MODEL || "base";
  const language = options.language || "en";
  const threads = options.threads || 4;

  // Validate whisper-cli exists
  if (!existsSync(WHISPER_CLI)) {
    return {
      success: false,
      error: `whisper-cli not found at ${WHISPER_CLI}. Run the whisper.cpp build first.`,
    };
  }

  // Validate model exists
  const modelPath = getModelPath(model);
  if (!existsSync(modelPath)) {
    return {
      success: false,
      error: `Model not found: ${modelPath}. Run: bash ${WHISPER_CPP_DIR}/models/download-ggml-model.sh ${model}`,
    };
  }

  // Validate audio file
  if (!existsSync(audioPath)) {
    return { success: false, error: `Audio file not found: ${audioPath}` };
  }

  const stat = statSync(audioPath);
  if (stat.size === 0) {
    return { success: false, error: "Audio file is empty" };
  }
  if (stat.size > 100 * 1024 * 1024) {
    return { success: false, error: `Audio file too large: ${stat.size} bytes (max 100MB)` };
  }

  let convertedPath: string | null = null;

  try {
    // Convert if needed (m4a → wav)
    const inputPath = await convertToWav(audioPath);
    if (inputPath !== audioPath) {
      convertedPath = inputPath;
    }

    const startTime = Date.now();

    // Build whisper-cli command
    const args = [
      "-m", modelPath,
      "-f", inputPath,
      "-t", String(threads),
      "-l", language,
      "--no-prints",
    ];

    if (options.translate) {
      args.push("--translate");
    }

    const result = await $`${WHISPER_CLI} ${args}`.quiet();

    const elapsed = (Date.now() - startTime) / 1000;

    if (result.exitCode !== 0) {
      return {
        success: false,
        error: `whisper-cli exited with code ${result.exitCode}: ${result.stderr.toString()}`,
      };
    }

    const rawOutput = result.stdout.toString().trim();

    // Parse timestamped output into segments and plain text
    const segments: Array<{ start: number; end: number; text: string }> = [];
    const lines = rawOutput.split("\n");

    for (const line of lines) {
      const match = line.match(
        /\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.*)/
      );
      if (match) {
        segments.push({
          start: parseTimestamp(match[1]),
          end: parseTimestamp(match[2]),
          text: match[3].trim(),
        });
      }
    }

    const text = segments.map((s) => s.text).join(" ").trim();

    return {
      success: true,
      text,
      duration: elapsed,
      language,
      segments,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Clean up converted temp file
    if (convertedPath) {
      await unlink(convertedPath).catch(() => {});
    }
  }
}

/**
 * Parse timestamp string "HH:MM:SS.mmm" to seconds
 */
function parseTimestamp(ts: string): number {
  const parts = ts.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Transcribe and format using Ollama (replaces Python Transcribe.py)
 * Used by transcribe-audio skill
 */
export async function transcribeWithFormatting(
  audioPath: string,
  options: TranscribeOptions & {
    ollamaModel?: string;
    templatePath?: string;
    outputPath?: string;
  } = {}
): Promise<TranscriptionResult & { formattedPath?: string }> {
  // Step 1: Transcribe with whisper.cpp
  const result = await transcribe(audioPath, options);

  if (!result.success || !result.text) {
    return result;
  }

  // Step 2: Format with Ollama (if available)
  const ollamaModel = options.ollamaModel || process.env.OLLAMA_MODEL || "gpt-oss";

  // Load template
  let template = "Format nicely with headers.";
  if (options.templatePath && existsSync(options.templatePath)) {
    template = await readFile(options.templatePath, "utf-8");
  } else {
    // Default template location
    const defaultTemplate = join(
      import.meta.dir,
      "..",
      "..",
      ".claude",
      "skills",
      "transcribe-audio",
      "tools",
      "MarkdownTemplate.md"
    );
    if (existsSync(defaultTemplate)) {
      template = await readFile(defaultTemplate, "utf-8");
    }
  }

  try {
    const formatted = await formatWithOllama(result.text, template, ollamaModel);

    // Determine output path
    let outputPath = options.outputPath;
    if (!outputPath) {
      const paiDir = process.env.PAI_DIR || join(import.meta.dir, "..", "..");
      const historyDir = join(paiDir, ".agent", "History", "TranscribedAudio");
      await mkdir(historyDir, { recursive: true });
      const baseName = basename(audioPath, extname(audioPath));
      outputPath = join(historyDir, `${baseName}.md`);
    }

    await writeFile(outputPath, formatted, "utf-8");

    return {
      ...result,
      formattedPath: outputPath,
    };
  } catch (error) {
    console.error(`Ollama formatting failed: ${error}. Returning raw transcript.`);
    return result;
  }
}

/**
 * Call Ollama HTTP API to format transcript
 */
async function formatWithOllama(
  transcript: string,
  template: string,
  model: string
): Promise<string> {
  const systemPrompt = `You are an expert editor and knowledge manager. Your task is to take a raw transcript and format it into a structured Markdown document based on a provided template.

Follow these rules:
1. Speaker Diarization: Label speakers consistently (e.g., **[Speaker Name]**:). If unknown, use logical labels like **[Speaker 1]**.
2. Formatting: Output exclusively in Markdown. Add timestamps [MM:SS] occasionally if implied by context.
3. Clean Verbatim: Remove filler words (ums, ahs) but keep technical jargon.
4. Structure:
    - Title
    - Key Insights (The "Wisdom")
    - Processed Transcript (Break into paragraphs)
    - Actionable Items & Frameworks
    - Related Concepts

Fill in the provided template.`;

  const userPrompt = `TEMPLATE:\n${template}\n\nRAW TRANSCRIPT:\n${transcript}\n\nPlease output ONLY the fully filled markdown file.`;

  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content || "";
}

/**
 * Validate audio file (shared validation logic)
 */
export async function validateAudioFile(
  filePath: string
): Promise<{ valid: boolean; error?: string; size?: number }> {
  if (!existsSync(filePath)) {
    return { valid: false, error: `File not found: ${filePath}` };
  }

  const stat = statSync(filePath);

  if (stat.size === 0) {
    return { valid: false, error: "File is empty" };
  }

  if (stat.size > 100 * 1024 * 1024) {
    return {
      valid: false,
      error: `File too large: ${stat.size} bytes > 100MB`,
    };
  }

  return { valid: true, size: stat.size };
}

// --- CLI Mode ---
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: bun run transcribe.ts <audio-file> [options]

Options:
  --model <name>         Whisper model (tiny|base|small|medium|large) [env: WHISPER_MODEL, default: base]
  --language <code>      Language code [default: en]
  --ollama-model <name>  Ollama model for formatting [env: OLLAMA_MODEL, default: gpt-oss]
  --format               Enable Ollama formatting (transcribe-audio mode)
  --template <path>      Custom template file for formatting
  --output <path>        Output file path
  --translate            Translate to English
  -h, --help             Show this help`);
    process.exit(0);
  }

  const audioFile = args[0];
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const doFormat = args.includes("--format");
  const model = getArg("--model");
  const language = getArg("--language");
  const ollamaModel = getArg("--ollama-model");
  const templatePath = getArg("--template");
  const outputPath = getArg("--output");
  const translate = args.includes("--translate");

  if (doFormat) {
    const result = await transcribeWithFormatting(audioFile, {
      model,
      language,
      translate,
      ollamaModel,
      templatePath,
      outputPath,
    });

    if (result.success) {
      console.log(`Transcription complete (${result.duration?.toFixed(2)}s)`);
      if ("formattedPath" in result && result.formattedPath) {
        console.log(`Formatted output saved to: ${result.formattedPath}`);
      } else {
        console.log(result.text);
      }
    } else {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  } else {
    const result = await transcribe(audioFile, { model, language, translate });

    if (result.success) {
      console.log(result.text);
    } else {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  }
}
