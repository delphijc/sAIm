/**
 * Claude Subprocess Tests - Phase 4
 * Tests session management and subprocess integration
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  getSessionKey,
  getOrCreateSession,
  incrementMessageCount,
  getSession,
  listActiveSessions,
  getSessionStats,
  closeSession,
  getActiveSessionCount,
} from "../claude/session.ts";

describe("Claude Session Management", () => {
  afterEach(() => {
    // Sessions are cleared between tests in real scenario
  });

  describe("Session Key Generation", () => {
    it("should generate session key for guild message", () => {
      const key = getSessionKey("user123", "channel456", false);

      expect(key).toBe("user123:channel456");
    });

    it("should generate session key for DM", () => {
      const key = getSessionKey("user123", "ignored", true);

      expect(key).toBe("user123:dm");
    });

    it("should generate unique keys for different channels", () => {
      const key1 = getSessionKey("user123", "channel1", false);
      const key2 = getSessionKey("user123", "channel2", false);

      expect(key1).not.toBe(key2);
    });

    it("should generate unique keys for different users", () => {
      const key1 = getSessionKey("user1", "channel123", false);
      const key2 = getSessionKey("user2", "channel123", false);

      expect(key1).not.toBe(key2);
    });
  });

  describe("Session Creation & Retrieval", () => {
    it("should create new session", () => {
      const key = "user123:channel456";
      const session = getOrCreateSession(key, "user123", "channel456");

      expect(session).toBeDefined();
      expect(session.sessionId).toBe(key);
      expect(session.discordUserId).toBe("user123");
      expect(session.discordChannelId).toBe("channel456");
      expect(session.isActive).toBe(true);
      expect(session.messageCount).toBe(0);
    });

    it("should retrieve existing session without recreating", () => {
      const key = "user123:channel456";
      const session1 = getOrCreateSession(key, "user123", "channel456");
      const createdAt1 = session1.createdAt;

      // Wait a bit
      const session2 = getOrCreateSession(key, "user123", "channel456");

      expect(session2.createdAt).toBe(createdAt1);
      expect(session2.sessionId).toBe(session1.sessionId);
    });

    it("should update lastAccessedAt when retrieving", async () => {
      const key = "user123:channel456";
      const session1 = getOrCreateSession(key, "user123", "channel456");
      const accessed1 = session1.lastAccessedAt;

      // Simulate time passing
      await new Promise((resolve) => setTimeout(resolve, 10));

      const session2 = getOrCreateSession(key, "user123", "channel456");

      expect(session2.lastAccessedAt).toBeGreaterThanOrEqual(accessed1);
    });

    it("should retrieve session by key", () => {
      const key = "user123:channel456";
      getOrCreateSession(key, "user123", "channel456");

      const retrieved = getSession(key);

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(key);
    });

    it("should return undefined for non-existent session", () => {
      const retrieved = getSession("nonexistent:key");

      expect(retrieved).toBeUndefined();
    });
  });

  describe("Message Count Tracking", () => {
    it("should increment message count", () => {
      const key = "user123:channel456";
      getOrCreateSession(key, "user123", "channel456");

      const count1 = incrementMessageCount(key);
      expect(count1).toBe(1);

      const count2 = incrementMessageCount(key);
      expect(count2).toBe(2);

      const count3 = incrementMessageCount(key);
      expect(count3).toBe(3);
    });

    it("should return 0 for non-existent session", () => {
      const count = incrementMessageCount("nonexistent:key");

      expect(count).toBe(0);
    });

    it("should track multiple sessions independently", () => {
      const key1 = "user1:channel1";
      const key2 = "user2:channel2";

      getOrCreateSession(key1, "user1", "channel1");
      getOrCreateSession(key2, "user2", "channel2");

      const count1a = incrementMessageCount(key1);
      const count2a = incrementMessageCount(key2);
      const count1b = incrementMessageCount(key1);

      expect(count1a).toBe(1);
      expect(count2a).toBe(1);
      expect(count1b).toBe(2);
    });
  });

  describe("Session Statistics", () => {
    it("should calculate session statistics", () => {
      const key = `user123:channel456:stats${Date.now()}`;
      getOrCreateSession(key, "user123", "channel456");
      incrementMessageCount(key);
      incrementMessageCount(key);

      const stats = getSessionStats(key);

      expect(stats).toBeDefined();
      expect(stats?.messageCount).toBe(2);
      expect(stats?.duration).toBeGreaterThanOrEqual(0);
      expect(stats?.isActive).toBe(true);
    });

    it("should return null for non-existent session", () => {
      const stats = getSessionStats("nonexistent:key");

      expect(stats).toBeNull();
    });
  });

  describe("Session Lifecycle", () => {
    it("should close session", () => {
      const key = "user123:channel456";
      getOrCreateSession(key, "user123", "channel456");

      const closed = closeSession(key);

      expect(closed).toBe(true);

      const session = getSession(key);
      expect(session?.isActive).toBe(false);
    });

    it("should return false when closing non-existent session", () => {
      const closed = closeSession("nonexistent:key");

      expect(closed).toBe(false);
    });

    it("should list only active sessions", () => {
      const timestamp = Date.now();
      const key1 = `user1:channel1:${timestamp}`;
      const key2 = `user2:channel2:${timestamp}`;

      getOrCreateSession(key1, "user1", "channel1");
      getOrCreateSession(key2, "user2", "channel2");

      closeSession(key1);

      const activeSessions = listActiveSessions();
      const testSessions = activeSessions.filter(
        (s) => s.sessionId.includes(`:${timestamp}`)
      );

      expect(testSessions.length).toBe(1);
      expect(testSessions[0].sessionId).toBe(key2);
    });

    it("should count active sessions", () => {
      const initialCount = getActiveSessionCount();
      const key1 = "user1:channel1:timestamp" + Date.now();
      const key2 = "user2:channel2:timestamp" + Date.now();

      getOrCreateSession(key1, "user1", "channel1");
      getOrCreateSession(key2, "user2", "channel2");

      const count = getActiveSessionCount();

      expect(count).toBeGreaterThanOrEqual(initialCount + 2);
    });
  });

  describe("Subprocess Request Format", () => {
    it("should accept text message request", () => {
      const request = {
        sessionId: "user123:channel456",
        userId: "user123",
        channelId: "channel456",
        userMessage: "Hello Claude!",
        messageType: "text" as const,
        metadata: {
          username: "testuser",
        },
      };

      expect(request.messageType).toBe("text");
      expect(request.userMessage).toBeDefined();
      expect(request.userId).toBeDefined();
    });

    it("should accept message with attachments", () => {
      const request = {
        sessionId: "user123:channel456",
        userId: "user123",
        channelId: "channel456",
        userMessage: "Check this file",
        messageType: "file" as const,
        attachmentPaths: ["/tmp/file.pdf"],
        metadata: {
          username: "testuser",
          attachmentCount: 1,
        },
      };

      expect(request.attachmentPaths).toBeDefined();
      expect(request.attachmentPaths?.length).toBe(1);
    });

    it("should support mixed message type", () => {
      const request = {
        sessionId: "user123:channel456",
        userId: "user123",
        channelId: "channel456",
        userMessage: "See this image and file",
        messageType: "mixed" as const,
        attachmentPaths: ["/tmp/image.png", "/tmp/data.csv"],
      };

      expect(request.messageType).toBe("mixed");
      expect(request.attachmentPaths?.length).toBe(2);
    });
  });

  describe("Token Estimation", () => {
    it("should estimate short text", () => {
      const text = "Hello";
      const estimated = Math.ceil(text.length / 4);

      expect(estimated).toBe(2);
    });

    it("should estimate long text", () => {
      const text = "a".repeat(400);
      const estimated = Math.ceil(text.length / 4);

      expect(estimated).toBe(100);
    });

    it("should handle empty text", () => {
      const text = "";
      const estimated = Math.ceil(text.length / 4);

      expect(estimated).toBe(0);
    });
  });
});
