/**
 * Sentence Boundary Detection Tests - ENH-003
 *
 * Validates that voice responses are properly truncated at natural
 * sentence boundaries to prevent mid-sentence cuts.
 */

import { describe, it, expect } from "bun:test";
import {
  truncateAtSentenceBoundary,
  endsAtSentenceBoundary,
  findNextSentenceBoundary,
  splitAtSentenceBoundaries,
  estimateSentenceCount,
} from "../utils/sentence-boundary";

describe("Sentence Boundary Detection", () => {
  describe("truncateAtSentenceBoundary", () => {
    it("should not truncate text shorter than maxLen", () => {
      const text = "This is a short sentence.";
      const result = truncateAtSentenceBoundary(text, 100);
      expect(result).toBe(text);
    });

    it("should truncate at period followed by space", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      const result = truncateAtSentenceBoundary(text, 30);
      expect(result).toBe("First sentence.");
    });

    it("should handle exclamation marks", () => {
      const text = "What an amazing day! This is wonderful. More text.";
      const result = truncateAtSentenceBoundary(text, 30);
      expect(result).toBe("What an amazing day!");
    });

    it("should handle question marks", () => {
      const text = "Do you like this? I think so. Let's continue.";
      const result = truncateAtSentenceBoundary(text, 20);
      expect(result).toBe("Do you like this?");
    });

    it("should handle ellipsis", () => {
      const text = "And then... something unexpected happened. The end.";
      const result = truncateAtSentenceBoundary(text, 50);
      expect(result).toMatch(/[.!?]$/); // Should end at punctuation
    });

    it("should handle em-dashes", () => {
      const text = "Wait — is this real? Of course it is. Continue.";
      const result = truncateAtSentenceBoundary(text, 25);
      expect(result).toBe("Wait — is this real?");
    });

    it("should handle newlines as boundaries", () => {
      const text = "First paragraph.\nSecond paragraph.\nThird paragraph.";
      const result = truncateAtSentenceBoundary(text, 30);
      expect(result).toBe("First paragraph.");
    });

    it("should fall back to word boundary if no sentence ending", () => {
      const text = "This is a very long line of text without proper punctuation at the expected boundary";
      const result = truncateAtSentenceBoundary(text, 40);
      // Should not end mid-word
      expect(!result.endsWith(" ") || result.trim() === result).toBe(true);
      expect(result.length).toBeLessThanOrEqual(40);
    });

    it("should preserve minimum 30% of maxLen", () => {
      const text = "Short. Rest is the longer portion that should be truncated.";
      const result = truncateAtSentenceBoundary(text, 50);
      expect(result.length).toBeGreaterThan(15); // At least 30% of 50
    });

    it("should handle text with multiple spaces", () => {
      const text = "First sentence.   Second sentence.   Third.";
      const result = truncateAtSentenceBoundary(text, 30);
      expect(result).toBe("First sentence.");
    });

    it("should truncate long voice response naturally", () => {
      const text = `This is a comprehensive response about machine learning. Machine learning is a subset of artificial intelligence. It enables systems to learn and improve from experience. Natural language processing is a key component. The applications are endless. Future possibilities are exciting.`;
      const result = truncateAtSentenceBoundary(text, 150);
      // Should end at a sentence boundary
      expect(result).toMatch(/[.!?]$/);
      expect(result.length).toBeLessThanOrEqual(150);
    });

    it("should handle quoted text", () => {
      const text = `He said "I'm here." She replied "Great!" The end.`;
      const result = truncateAtSentenceBoundary(text, 30);
      // Should truncate naturally despite quotes
      expect(result).toMatch(/[.!?]$/);
    });
  });

  describe("endsAtSentenceBoundary", () => {
    it("should detect period at end", () => {
      expect(endsAtSentenceBoundary("This is a sentence.")).toBe(true);
    });

    it("should detect exclamation mark at end", () => {
      expect(endsAtSentenceBoundary("What an idea!")).toBe(true);
    });

    it("should detect question mark at end", () => {
      expect(endsAtSentenceBoundary("Really?")).toBe(true);
    });

    it("should detect ellipsis at end", () => {
      expect(endsAtSentenceBoundary("And then...")).toBe(true);
    });

    it("should detect em-dash at end", () => {
      expect(endsAtSentenceBoundary("Wait—")).toBe(true);
    });

    it("should handle trailing whitespace", () => {
      expect(endsAtSentenceBoundary("This is it.   ")).toBe(true);
    });

    it("should return false for incomplete text", () => {
      expect(endsAtSentenceBoundary("This is incomplete")).toBe(false);
    });

    it("should return false for mid-sentence text", () => {
      expect(endsAtSentenceBoundary("She said hello to")).toBe(false);
    });
  });

  describe("findNextSentenceBoundary", () => {
    it("should find next period", () => {
      const text = "First sentence. Second sentence.";
      const pos = findNextSentenceBoundary(text, 0);
      expect(pos).toBe(15); // Position after the period
    });

    it("should find from start position", () => {
      const text = "One. Two. Three.";
      const pos = findNextSentenceBoundary(text, 5);
      expect(pos).toBe(9); // Should find "Two." not "One."
    });

    it("should return -1 if no boundary found", () => {
      const text = "No punctuation here";
      const pos = findNextSentenceBoundary(text, 0);
      expect(pos).toBe(-1);
    });
  });

  describe("splitAtSentenceBoundaries", () => {
    it("should split at sentence boundaries", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      const chunks = splitAtSentenceBoundaries(text, 25);
      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe("First sentence.");
      expect(chunks[1]).toBe("Second sentence.");
      expect(chunks[2]).toBe("Third sentence.");
    });

    it("should respect max length", () => {
      const text = "A. B. C. D. E. F.";
      const chunks = splitAtSentenceBoundaries(text, 10);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(10);
      }
    });

    it("should not create empty chunks", () => {
      const text = "Short. Another.";
      const chunks = splitAtSentenceBoundaries(text, 20);
      expect(chunks.every(c => c.length > 0)).toBe(true);
    });

    it("should handle long sentences", () => {
      const text = "This is a very long sentence that exceeds the limit but still needs to be handled gracefully. And here is another.";
      const chunks = splitAtSentenceBoundaries(text, 100);
      expect(chunks.length).toBeGreaterThan(0);
      // Chunks should respect max length
      expect(chunks.every(c => c.length <= 100)).toBe(true);
    });
  });

  describe("estimateSentenceCount", () => {
    it("should count sentences accurately", () => {
      const text = "First. Second! Third?";
      expect(estimateSentenceCount(text)).toBe(3);
    });

    it("should return 0 for text without punctuation", () => {
      const text = "No punctuation here";
      expect(estimateSentenceCount(text)).toBe(0);
    });

    it("should handle ellipsis as punctuation", () => {
      const text = "Wait... okay then.";
      expect(estimateSentenceCount(text)).toBeGreaterThan(0);
    });
  });

  describe("Real-world voice response scenarios", () => {
    it("should handle Claude API response", () => {
      const response = `I'd be happy to help! Let me break this down for you. The key concept here is understanding how systems work together. This involves multiple components that interact seamlessly. The results can be quite impressive when done right. Would you like me to elaborate further?`;

      const voiceText = truncateAtSentenceBoundary(response, 1500);
      expect(endsAtSentenceBoundary(voiceText)).toBe(true);
      expect(voiceText).toContain("!");
    });

    it("should handle technical explanation", () => {
      const response = `TypeScript provides type safety through compile-time checking. This prevents errors before runtime. The compiler ensures all types match. Functions have explicit signatures. Variables are properly typed. This improves code reliability. Would you like an example?`;

      const voiceText = truncateAtSentenceBoundary(response, 200);
      expect(endsAtSentenceBoundary(voiceText)).toBe(true);
      expect(voiceText).toContain(".");
    });

    it("should handle response with dialogue", () => {
      const response = `"Have you considered this approach?" I asked. She replied, "That sounds interesting." We discussed it further. "Let's try it," she suggested. I agreed enthusiastically.`;

      const voiceText = truncateAtSentenceBoundary(response, 150);
      expect(endsAtSentenceBoundary(voiceText)).toBe(true);
    });

    it("should preserve coherence when truncating long response", () => {
      const response = `The implementation required careful planning. We analyzed requirements thoroughly. The architecture was well-structured. All components communicated effectively. Testing was comprehensive. The deployment went smoothly. Users were satisfied with the results. The project succeeded beyond expectations. Future enhancements are planned.`;

      const voiceText = truncateAtSentenceBoundary(response, 300);
      expect(voiceText.length).toBeLessThanOrEqual(300);
      expect(endsAtSentenceBoundary(voiceText)).toBe(true);
      // Should contain multiple complete sentences
      expect((voiceText.match(/[.!?]/g) || []).length).toBeGreaterThanOrEqual(2);
    });
  });
});
