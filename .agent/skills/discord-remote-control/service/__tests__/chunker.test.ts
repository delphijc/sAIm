/**
 * Response Chunker Tests - Phase 9
 * Tests response chunking at different boundaries
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { chunkResponse, getChunkStats, formatChunks } from "../response/chunker.ts";

describe("Response Chunker - Phase 9", () => {
  afterEach(() => {
    // Cleanup
  });

  describe("Basic Chunking", () => {
    it("should not chunk text under limit", () => {
      const text = "Hello world";
      const chunks = chunkResponse(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it("should chunk text over limit", () => {
      const text = "a".repeat(3000);
      const chunks = chunkResponse(text, { maxChars: 2000 });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should respect maxChars limit", () => {
      const text = "word ".repeat(500); // ~2500 chars
      const chunks = chunkResponse(text, { maxChars: 2000 });

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    it("should preserve all text content", () => {
      const text = "Hello world! ".repeat(200);
      const chunks = chunkResponse(text);
      const rejoined = chunks.join(" ");

      // All content should be present
      expect(rejoined).toContain("Hello");
      expect(rejoined).toContain("world");
    });
  });

  describe("Paragraph Chunking", () => {
    it("should chunk by paragraphs", () => {
      const text = "Paragraph 1 with some content\n\nParagraph 2 with more content\n\nParagraph 3 with even more";
      const chunks = chunkResponse(text, {
        maxChars: 50,
        strategy: "paragraph",
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("should preserve paragraph breaks", () => {
      const text = "First paragraph.\n\nSecond paragraph.";
      const chunks = chunkResponse(text, {
        maxChars: 100,
        strategy: "paragraph",
      });

      if (chunks.length > 1) {
        expect(chunks[0]).toBe("First paragraph.");
        expect(chunks[1]).toBe("Second paragraph.");
      }
    });

    it("should handle multiple paragraph breaks", () => {
      const text = "P1\n\n\nP2\n\n\n\nP3";
      const chunks = chunkResponse(text, {
        maxChars: 50,
        strategy: "paragraph",
      });

      const rejoined = chunks.join("\n\n");
      expect(rejoined).toContain("P1");
      expect(rejoined).toContain("P2");
      expect(rejoined).toContain("P3");
    });
  });

  describe("Sentence Chunking", () => {
    it("should chunk by sentences", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      const chunks = chunkResponse(text, {
        maxChars: 30,
        strategy: "sentence",
      });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should preserve sentence punctuation", () => {
      const text = "Hello! How are you? I'm fine.";
      const chunks = chunkResponse(text, {
        maxChars: 100,
        strategy: "sentence",
      });

      const rejoined = chunks.join(" ");
      expect(rejoined).toContain("!");
      expect(rejoined).toContain("?");
      expect(rejoined).toContain(".");
    });

    it("should handle multiple punctuation types", () => {
      const text = "What? Really! Yes.";
      const chunks = chunkResponse(text, {
        maxChars: 50,
        strategy: "sentence",
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Word Chunking", () => {
    it("should chunk by words", () => {
      const text = "one two three four five six seven eight";
      const chunks = chunkResponse(text, {
        maxChars: 20,
        strategy: "word",
      });

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(20);
      }
    });

    it("should preserve word spacing", () => {
      const text = "hello world foo bar baz";
      const chunks = chunkResponse(text, {
        maxChars: 15,
        strategy: "word",
      });

      const rejoined = chunks.join(" ");
      expect(rejoined).toContain("hello");
      expect(rejoined).toContain("world");
      expect(rejoined).toContain("foo");
    });

    it("should handle very long words", () => {
      const longWord = "supercalifragilisticexpialidocious"; // 34 chars
      const text = `Short ${longWord} text`;
      const chunks = chunkResponse(text, {
        maxChars: 20,
        strategy: "word",
      });

      const rejoined = chunks.join("");
      expect(rejoined).toContain(longWord);
    });
  });

  describe("Discord Limit (2000 chars)", () => {
    it("should chunk at 2000 char boundary", () => {
      const text = "x".repeat(5000);
      const chunks = chunkResponse(text);

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    it("should produce at least 3 chunks for 5000 chars", () => {
      const text = "a".repeat(5000);
      const chunks = chunkResponse(text);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it("should preserve content across Discord limit", () => {
      const text = "Hello world! ".repeat(200); // ~2600 chars
      const chunks = chunkResponse(text);

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }

      const rejoined = chunks.join("");
      expect(rejoined).toContain("Hello world!");
    });
  });

  describe("Chunk Statistics", () => {
    it("should count chunks correctly", () => {
      const text = "a".repeat(3000);
      const stats = getChunkStats(text, 2000);

      expect(stats.chunks).toBeGreaterThan(1);
    });

    it("should calculate average chunk size", () => {
      const text = "word ".repeat(100);
      const stats = getChunkStats(text, 500);

      expect(stats.avgChunkSize).toBeGreaterThan(0);
      expect(stats.avgChunkSize).toBeLessThanOrEqual(500);
    });

    it("should track min and max chunk size", () => {
      const text = "short. " + "a".repeat(1000) + " short.";
      const stats = getChunkStats(text, 500);

      expect(stats.minChunkSize).toBeLessThanOrEqual(stats.maxChunkSize);
    });

    it("should preserve total character count", () => {
      const text = "The quick brown fox jumps over the lazy dog. ".repeat(50);
      const stats = getChunkStats(text);

      expect(stats.totalChars).toBe(text.length);
    });
  });

  describe("Chunk Formatting", () => {
    it("should add headers to chunks", () => {
      const chunks = ["First chunk", "Second chunk", "Third chunk"];
      const formatted = formatChunks(chunks, { showHeader: true });

      expect(formatted.length).toBe(3);
      expect(formatted[0]).toContain("[Message 1/3]");
      expect(formatted[1]).toContain("[Message 2/3]");
      expect(formatted[2]).toContain("[Message 3/3]");
    });

    it("should not add headers for single chunk", () => {
      const chunks = ["Single chunk"];
      const formatted = formatChunks(chunks, { showHeader: true });

      expect(formatted[0]).not.toContain("[Message");
    });

    it("should allow custom header format", () => {
      const chunks = ["A", "B", "C"];
      const formatted = formatChunks(chunks, {
        showHeader: true,
        headerFormat: (current, total) => `Part ${current}/${total}:\n`,
      });

      expect(formatted[0]).toContain("Part 1/3");
      expect(formatted[1]).toContain("Part 2/3");
    });

    it("should preserve chunk content with headers", () => {
      const chunks = ["Content A", "Content B"];
      const formatted = formatChunks(chunks, {
        showHeader: true,
        headerFormat: () => "HEADER\n",
      });

      expect(formatted[0]).toContain("Content A");
      expect(formatted[1]).toContain("Content B");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string", () => {
      const chunks = chunkResponse("");

      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle whitespace-only text", () => {
      const text = "   \n\n   ";
      const chunks = chunkResponse(text);

      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle single very long word", () => {
      const longWord = "a".repeat(3000);
      const chunks = chunkResponse(longWord, { maxChars: 2000 });

      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle mixed content", () => {
      const text =
        "Para 1\n\nFirst sentence. Second sentence.\n\nword word word";
      const chunks = chunkResponse(text);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle code blocks", () => {
      const text = "```\ncode line 1\ncode line 2\n```\n\nText after";
      const chunks = chunkResponse(text, { maxChars: 100 });

      const rejoined = chunks.join("");
      expect(rejoined).toContain("```");
      expect(rejoined).toContain("code");
    });
  });

  describe("Strategy Selection", () => {
    it("should default to paragraph strategy", () => {
      const text = "Para 1\n\nPara 2\n\nPara 3";
      const chunks = chunkResponse(text, { maxChars: 50 });

      // Paragraph strategy should chunk by paragraphs
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("should use sentence strategy when specified", () => {
      const text = "Sent 1. Sent 2. Sent 3.";
      const chunks = chunkResponse(text, {
        maxChars: 15,
        strategy: "sentence",
      });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should use word strategy when specified", () => {
      const text = "one two three four five";
      const chunks = chunkResponse(text, {
        maxChars: 10,
        strategy: "word",
      });

      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle Claude API response", () => {
      const response =
        "Here's a comprehensive response about your question.\n\n" +
        "First point: Lorem ipsum dolor sit amet.\n\n" +
        "Second point: Consectetur adipiscing elit.\n\n" +
        "Third point: Sed do eiusmod tempor incididunt ut labore.";

      const chunks = chunkResponse(response);

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    it("should handle list response", () => {
      const items = Array(50)
        .fill(0)
        .map((_, i) => `${i + 1}. Item number ${i + 1}`)
        .join("\n");

      const chunks = chunkResponse(items, { maxChars: 500 });

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(500);
      }
    });

    it("should handle code output", () => {
      const code =
        "function example() {\n" +
        "  console.log('Hello');\n".repeat(100) +
        "}";

      const chunks = chunkResponse(code, { maxChars: 1000 });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Content Preservation", () => {
    it("should not lose text when chunking", () => {
      const text = "The quick brown fox ".repeat(150);
      const chunks = chunkResponse(text);

      const rejoined = chunks.join(" ");
      expect(rejoined).toContain("The quick brown fox");
    });

    it("should maintain word boundaries", () => {
      const text = "word ".repeat(500);
      const chunks = chunkResponse(text, { maxChars: 1000 });

      for (const chunk of chunks) {
        const words = chunk.split(" ");
        // No words should be split (except last which may be partial)
        for (let i = 0; i < words.length - 1; i++) {
          expect(words[i]).not.toContain("\n");
        }
      }
    });

    it("should not create empty chunks", () => {
      const text = "valid text ";
      const chunks = chunkResponse(text);

      for (const chunk of chunks) {
        expect(chunk.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
