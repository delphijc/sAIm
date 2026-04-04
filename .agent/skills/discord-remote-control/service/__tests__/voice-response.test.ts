/**
 * Voice Response Handler Tests - Phase 9
 * Tests sendVoiceResponse, sendChunkedVoiceResponse, getVoiceStats
 * with mocked Discord.js Message and synthesize modules
 */

import { describe, it, expect, mock, afterEach, beforeEach } from "bun:test";

// Mock synthesize module at top level
mock.module("../media/synthesize.ts", () => ({
  synthesizeText: mock(() =>
    Promise.resolve({ success: true, audioPath: "/tmp/test.wav" })
  ),
  cleanupAudioFile: mock(() => Promise.resolve()),
  checkVoiceServer: mock(() => Promise.resolve(true)),
  estimateAudioDuration: mock((text: string) => text.length / 15),
  validateTextLength: mock(() => ({ valid: true })),
}));

// Mock chunker to pass through
mock.module("./chunker.ts", () => ({
  chunkResponse: mock((text: string, opts?: any) => {
    const max = opts?.maxChars || 2000;
    if (text.length <= max) return [text];
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += max) {
      chunks.push(text.slice(i, i + max));
    }
    return chunks;
  }),
}));

// Mock retry to just call through
mock.module("../utils/retry.ts", () => ({
  withRetry: mock(async (fn: () => Promise<any>) => fn()),
  isRetryableDiscordError: mock(() => true),
}));

// Import after mocks
import {
  shouldRespondWithVoice,
  sendVoiceResponse,
  sendChunkedVoiceResponse,
  getVoiceStats,
} from "../response/voice.ts";

function createMockMessage() {
  return {
    reply: mock(() =>
      Promise.resolve({
        id: "msg-123",
        content: "reply",
      })
    ),
  } as any;
}

afterEach(() => {
  mock.restore();
});

describe("shouldRespondWithVoice", () => {
  it("should return true for voice message type", () => {
    expect(shouldRespondWithVoice("voice")).toBe(true);
  });

  it("should return false for text message type", () => {
    expect(shouldRespondWithVoice("text")).toBe(false);
  });

  it("should return false for image message type", () => {
    expect(shouldRespondWithVoice("image")).toBe(false);
  });

  it("should return false for file message type", () => {
    expect(shouldRespondWithVoice("file")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(shouldRespondWithVoice("")).toBe(false);
  });
});

describe("sendVoiceResponse - text mode", () => {
  it("should send text response for non-voice message type", async () => {
    const msg = createMockMessage();
    const result = await sendVoiceResponse(msg, "Hello world", "text");

    expect(result.success).toBe(true);
    expect(result.voiceAttached).toBe(false);
    expect(msg.reply).toHaveBeenCalledTimes(1);
  });

  it("should handle empty response text", async () => {
    const msg = createMockMessage();
    const result = await sendVoiceResponse(msg, "", "text");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Empty response");
  });

  it("should handle whitespace-only response", async () => {
    const msg = createMockMessage();
    const result = await sendVoiceResponse(msg, "   ", "text");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Empty response");
  });

  it("should chunk long text responses", async () => {
    const msg = createMockMessage();
    const longText = "A".repeat(3000);
    const result = await sendVoiceResponse(msg, longText, "text");

    expect(result.success).toBe(true);
    expect(result.voiceAttached).toBe(false);
    expect(msg.reply.mock.calls.length).toBeGreaterThan(1);
  });
});

describe("sendVoiceResponse - voice mode", () => {
  it("should attempt voice synthesis for voice message type", async () => {
    const msg = createMockMessage();
    const result = await sendVoiceResponse(msg, "Hello", "voice");

    expect(result.success).toBe(true);
    expect(result.voiceAttached).toBe(true);
  });

  it("should include transcript when option set", async () => {
    const msg = createMockMessage();
    await sendVoiceResponse(msg, "Hello", "voice", {
      includeTranscript: true,
    });

    const callArgs = msg.reply.mock.calls[0][0];
    expect(callArgs.content).toContain("Audio Response:");
  });

  it("should use provided voiceId", async () => {
    const msg = createMockMessage();
    const result = await sendVoiceResponse(msg, "Test", "voice", {
      voiceId: "Samantha",
    });

    expect(result.success).toBe(true);
  });
});

describe("sendVoiceResponse - error handling", () => {
  it("should fall back to text on reply error", async () => {
    let callCount = 0;
    const msg = {
      reply: mock(() => {
        callCount++;
        if (callCount === 1) throw new Error("Discord error");
        return Promise.resolve({ id: "msg-fallback" });
      }),
    } as any;

    // The error in the main try block triggers the catch fallback
    const result = await sendVoiceResponse(msg, "Test", "text");

    // When first reply fails, catch block tries again
    expect(result.success).toBe(false);
  });
});

describe("sendChunkedVoiceResponse", () => {
  it("should send text chunks for non-voice type", async () => {
    const msg = createMockMessage();
    const result = await sendChunkedVoiceResponse(
      msg,
      ["chunk1", "chunk2"],
      "text"
    );

    expect(result.success).toBe(true);
    expect(result.chunksProcessed).toBe(2);
  });

  it("should use voice for first chunk when voice type", async () => {
    const msg = createMockMessage();
    const result = await sendChunkedVoiceResponse(
      msg,
      ["first chunk", "second chunk"],
      "voice"
    );

    expect(result.chunksProcessed).toBeGreaterThanOrEqual(1);
  });

  it("should handle single chunk", async () => {
    const msg = createMockMessage();
    const result = await sendChunkedVoiceResponse(
      msg,
      ["only chunk"],
      "text"
    );

    expect(result.success).toBe(true);
    expect(result.chunksProcessed).toBe(1);
  });
});

describe("getVoiceStats", () => {
  it("should return character count", () => {
    const stats = getVoiceStats("Hello world");
    expect(stats.characters).toBe(11);
  });

  it("should estimate duration", () => {
    const stats = getVoiceStats("Some text here");
    expect(stats.estimatedDuration).toBeGreaterThan(0);
  });

  it("should estimate file size", () => {
    const stats = getVoiceStats("Some text");
    expect(stats.estimatedFileSize).toBeGreaterThan(0);
  });

  it("should handle empty string", () => {
    const stats = getVoiceStats("");
    expect(stats.characters).toBe(0);
  });

  it("should scale with text length", () => {
    const short = getVoiceStats("Hi");
    const long = getVoiceStats("This is a much longer piece of text for testing");

    expect(long.estimatedDuration).toBeGreaterThan(short.estimatedDuration);
    expect(long.estimatedFileSize).toBeGreaterThan(short.estimatedFileSize);
  });
});
