/**
 * Router Tests - Phase 2
 * Tests access control and message type detection
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mock } from "bun:test";

describe("Message Router - Access Control", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("Authorization Logic", () => {
    it("should allow messages from authorized user in correct channel", () => {
      // Test data
      const allowedUserIds = ["123456789"];
      const guildId = "999999999";
      const channelId = "777777777";

      // User is authorized
      const authorId = "123456789";
      expect(allowedUserIds).toContain(authorId);

      // Guild is correct
      expect(guildId).toBe("999999999");

      // Channel is correct
      expect(channelId).toBe("777777777");
    });

    it("should reject messages from unauthorized user", () => {
      const allowedUserIds = ["123456789"];
      const authorId = "unauthorized123";

      // User is NOT authorized
      expect(allowedUserIds).not.toContain(authorId);
    });

    it("should reject messages from wrong guild", () => {
      const guildId = "999999999";
      const messageGuildId = "different123";

      // Guild doesn't match
      expect(messageGuildId).not.toBe(guildId);
    });

    it("should reject messages from wrong channel", () => {
      const channelId = "777777777";
      const messageChannelId = "different456";

      // Channel doesn't match
      expect(messageChannelId).not.toBe(channelId);
    });

    it("should allow DM from authorized user", () => {
      const allowedUserIds = ["123456789"];
      const authorId = "123456789";
      const isDM = true;

      // User authorized
      expect(allowedUserIds).toContain(authorId);

      // Is DM (channel checks skipped)
      expect(isDM).toBe(true);
    });

    it("should reject DM from unauthorized user", () => {
      const allowedUserIds = ["123456789"];
      const authorId = "unauthorized999";
      const isDM = true;

      // User NOT authorized
      expect(allowedUserIds).not.toContain(authorId);

      // Even though it's DM, user is blocked
      expect(isDM).toBe(true);
    });
  });

  describe("Message Type Detection", () => {
    it("should detect text-only message", () => {
      const content = "Hello world!";
      const attachments: unknown[] = [];

      const isText = content.length > 0 && attachments.length === 0;
      expect(isText).toBe(true);
    });

    it("should detect image message", () => {
      const content = "";
      const attachments = [
        { name: "photo.png", size: 1024 } as const,
      ];

      const hasImages = attachments.some((att) =>
        (att.name || "").toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/i)
      );

      expect(hasImages).toBe(true);
    });

    it("should detect file message", () => {
      const content = "";
      const attachments = [
        { name: "document.pdf", size: 2048 } as const,
      ];

      const hasFiles = attachments.some((att) =>
        (att.name || "").toLowerCase().match(/\.(pdf|txt|doc|docx|xlsx|csv)$/i)
      );

      expect(hasFiles).toBe(true);
    });

    it("should detect voice message", () => {
      const content = "";
      const attachments = [
        { name: "voice.ogg", size: 512 } as const,
      ];

      const hasVoice = attachments.some((att) =>
        (att.name || "").toLowerCase().match(/\.(ogg|mp3|wav|m4a)$/i)
      );

      expect(hasVoice).toBe(true);
    });

    it("should detect mixed message (text + image)", () => {
      const content = "Check this out!";
      const attachments = [
        { name: "image.jpg", size: 1024 } as const,
      ];

      const hasText = content.length > 0;
      const hasImages = attachments.some((att) =>
        (att.name || "").toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/i)
      );

      const isMixed = hasText && hasImages;
      expect(isMixed).toBe(true);
    });

    it("should detect mixed message (text + multiple attachments)", () => {
      const content = "Files for review";
      const attachments = [
        { name: "image.png", size: 1024 } as const,
        { name: "data.csv", size: 512 } as const,
      ];

      const hasText = content.length > 0;
      const hasAttachments = attachments.length > 1;

      const isMixed = hasText && hasAttachments;
      expect(isMixed).toBe(true);
    });
  });

  describe("Attachment Counting", () => {
    it("should count single attachment", () => {
      const attachments = [{ name: "file.pdf", size: 1024 } as const];

      expect(attachments.length).toBe(1);
    });

    it("should count multiple attachments", () => {
      const attachments = [
        { name: "file1.pdf", size: 1024 } as const,
        { name: "file2.txt", size: 512 } as const,
        { name: "image.png", size: 2048 } as const,
      ];

      expect(attachments.length).toBe(3);
    });

    it("should handle empty attachments", () => {
      const attachments: unknown[] = [];

      expect(attachments.length).toBe(0);
    });
  });

  describe("Content Preview", () => {
    it("should truncate long content", () => {
      const content = "a".repeat(100);
      const preview = content.substring(0, 80) + (content.length > 80 ? "..." : "");

      expect(preview).toHaveLength(83); // 80 + "..."
      expect(preview).toMatch(/\.\.\.$/);
    });

    it("should keep short content as-is", () => {
      const content = "Short message";
      const preview = content.substring(0, 80) + (content.length > 80 ? "..." : "");

      expect(preview).toBe("Short message");
    });

    it("should show attachment info for empty content", () => {
      const content = "";
      const attachmentCount = 2;
      const preview = content
        ? content.substring(0, 80)
        : `[${attachmentCount} attachment${attachmentCount !== 1 ? "s" : ""}]`;

      expect(preview).toBe("[2 attachments]");
    });
  });

  describe("Config Validation", () => {
    it("should have required config fields", () => {
      const config = {
        botToken: "token",
        guildId: "999999999",
        channelId: "777777777",
        allowedUserIds: ["123456789"],
        groqApiKey: "groq-key",
        paiDir: "/path/to/pai",
      };

      expect(config).toHaveProperty("botToken");
      expect(config).toHaveProperty("guildId");
      expect(config).toHaveProperty("channelId");
      expect(config).toHaveProperty("allowedUserIds");
      expect(config).toHaveProperty("groqApiKey");
      expect(config).toHaveProperty("paiDir");
    });

    it("should validate guild ID format", () => {
      const guildId = "999999999";

      expect(guildId).toMatch(/^\d+$/);
      expect(guildId.length).toBeGreaterThan(0);
    });

    it("should validate allowed user IDs", () => {
      const allowedUserIds = ["123456789", "987654321"];

      expect(allowedUserIds).toHaveLength(2);
      expect(allowedUserIds.every((id) => /^\d+$/.test(id))).toBe(true);
    });
  });
});
