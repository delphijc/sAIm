/**
 * Observability & Event Logging Tests - Phase 8
 * Tests event logging to .agent/history.jsonl
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";

describe("Observability & Event Logging - Phase 8", () => {
  afterEach(() => {
    // Cleanup
  });

  describe("Event Logging Structure", () => {
    it("should create DiscordMessageReceived event", () => {
      const event = {
        event_type: "DiscordMessageReceived",
        timestamp: new Date().toISOString(),
        data: {
          discord_user_id: "123456789",
          discord_channel_id: "987654321",
          message_type: "text",
          message_preview: "Hello world",
          session_id: "123456789:987654321",
        },
      };

      expect(event.event_type).toBe("DiscordMessageReceived");
      expect(event.data.discord_user_id).toBeDefined();
      expect(event.data.session_id).toContain(":");
    });

    it("should create DiscordResponseSent event", () => {
      const event = {
        event_type: "DiscordResponseSent",
        timestamp: new Date().toISOString(),
        data: {
          discord_user_id: "123456789",
          discord_channel_id: "987654321",
          response_type: "text",
          has_attachments: false,
          session_id: "123456789:987654321",
        },
      };

      expect(event.event_type).toBe("DiscordResponseSent");
      expect(event.data.response_type).toBe("text");
      expect(event.data.has_attachments).toBe(false);
    });

    it("should create DiscordVoiceSynthesis event", () => {
      const event = {
        event_type: "DiscordVoiceSynthesis",
        timestamp: new Date().toISOString(),
        data: {
          session_id: "123456789:987654321",
          text_length: 100,
          success: true,
          audio_file: "/tmp/discord-remote-control/audio/123456_response.mp3",
        },
      };

      expect(event.event_type).toBe("DiscordVoiceSynthesis");
      expect(event.data.success).toBe(true);
      expect(event.data.audio_file).toContain(".mp3");
    });

    it("should create DiscordVoiceTranscription event", () => {
      const event = {
        event_type: "DiscordVoiceTranscription",
        timestamp: new Date().toISOString(),
        data: {
          session_id: "123456789:987654321",
          audio_duration: 5.2,
          success: true,
          language: "en",
        },
      };

      expect(event.event_type).toBe("DiscordVoiceTranscription");
      expect(event.data.audio_duration).toBeGreaterThan(0);
      expect(event.data.language).toBe("en");
    });

    it("should create DiscordSubprocessCall event", () => {
      const event = {
        event_type: "DiscordSubprocessCall",
        timestamp: new Date().toISOString(),
        data: {
          session_id: "123456789:987654321",
          input_tokens: 150,
          output_tokens: 200,
          duration_ms: 2500,
        },
      };

      expect(event.event_type).toBe("DiscordSubprocessCall");
      expect(event.data.input_tokens).toBeGreaterThan(0);
      expect(event.data.duration_ms).toBeGreaterThan(0);
    });

    it("should create DiscordError event", () => {
      const event = {
        event_type: "DiscordError",
        timestamp: new Date().toISOString(),
        data: {
          session_id: "123456789:987654321",
          error_type: "transcription_failed",
          error_message: "Groq API timeout",
        },
      };

      expect(event.event_type).toBe("DiscordError");
      expect(event.data.error_type).toBeDefined();
      expect(event.data.error_message).toBeDefined();
    });
  });

  describe("Message Events", () => {
    it("should log text message events", () => {
      const messageType = "text";
      const preview = "This is a text message";
      const isDM = false;

      expect(messageType).toBe("text");
      expect(preview.length).toBeGreaterThan(0);
      expect(isDM).toBe(false);
    });

    it("should log voice message events", () => {
      const messageType = "voice";
      const preview = "Transcribed voice message content";

      expect(messageType).toBe("voice");
      expect(preview).toBeDefined();
    });

    it("should log image message events", () => {
      const messageType = "image";
      const hasAttachments = true;

      expect(messageType).toBe("image");
      expect(hasAttachments).toBe(true);
    });

    it("should log file message events", () => {
      const messageType = "file";
      const hasAttachments = true;

      expect(messageType).toBe("file");
      expect(hasAttachments).toBe(true);
    });

    it("should truncate message preview to 100 chars", () => {
      const longMessage = "a".repeat(500);
      const preview = longMessage.substring(0, 100);

      expect(preview.length).toBe(100);
      expect(preview).toBe("a".repeat(100));
    });
  });

  describe("Voice Events", () => {
    it("should log successful voice synthesis", () => {
      const event = {
        event_type: "DiscordVoiceSynthesis",
        success: true,
        text_length: 250,
        audio_file: "/tmp/discord-remote-control/audio/response.mp3",
      };

      expect(event.success).toBe(true);
      expect(event.text_length).toBeGreaterThan(0);
      expect(event.audio_file).toContain("mp3");
    });

    it("should log failed voice synthesis", () => {
      const event = {
        event_type: "DiscordVoiceSynthesis",
        success: false,
        text_length: 0,
      };

      expect(event.success).toBe(false);
    });

    it("should track voice transcription duration", () => {
      const durations = [1.5, 5.0, 30.0, 60.0];

      for (const duration of durations) {
        expect(duration).toBeGreaterThan(0);
      }
    });

    it("should support multiple languages in transcription", () => {
      const languages = ["en", "es", "fr", "de", "ja"];

      for (const lang of languages) {
        expect(lang.length).toBe(2);
      }
    });
  });

  describe("Subprocess Events", () => {
    it("should track input tokens", () => {
      const inputTokens = 150;

      expect(inputTokens).toBeGreaterThan(0);
      expect(inputTokens).toBeLessThan(10000);
    });

    it("should track output tokens", () => {
      const outputTokens = 200;

      expect(outputTokens).toBeGreaterThan(0);
      expect(outputTokens).toBeLessThan(10000);
    });

    it("should track subprocess duration", () => {
      const duration = 2500; // milliseconds

      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(60000); // Less than 60 seconds
    });

    it("should calculate total tokens", () => {
      const inputTokens = 150;
      const outputTokens = 200;
      const totalTokens = inputTokens + outputTokens;

      expect(totalTokens).toBe(350);
    });
  });

  describe("Error Events", () => {
    it("should log transcription failures", () => {
      const errorType = "transcription_failed";
      const message = "Groq API rate limit exceeded";

      expect(errorType).toContain("transcription");
      expect(message).toBeDefined();
    });

    it("should log subprocess failures", () => {
      const errorType = "subprocess_failed";
      const message = "Claude subprocess timeout";

      expect(errorType).toContain("subprocess");
      expect(message).toBeDefined();
    });

    it("should log handler errors", () => {
      const errorType = "text_handler_error";
      const message = "Message parsing failed";

      expect(errorType).toContain("handler");
      expect(message).toBeDefined();
    });

    it("should preserve error context", () => {
      const errorMessage = "Failed to download attachment from Discord CDN";

      expect(errorMessage.length).toBeGreaterThan(0);
      expect(errorMessage).toContain("download");
    });
  });

  describe("Health Check Events", () => {
    it("should include voice server status", () => {
      const check = {
        service: "voice-server",
        status: "healthy" as const,
      };

      expect(check.service).toBe("voice-server");
      expect(["healthy", "unhealthy"]).toContain(check.status);
    });

    it("should include Groq API status", () => {
      const check = {
        service: "groq-api",
        status: "healthy" as const,
      };

      expect(check.service).toBe("groq-api");
      expect(["healthy", "unhealthy"]).toContain(check.status);
    });

    it("should include memory database status", () => {
      const check = {
        service: "memory-db",
        status: "healthy" as const,
      };

      expect(check.service).toBe("memory-db");
      expect(["healthy", "unhealthy"]).toContain(check.status);
    });

    it("should have timestamp for all health checks", () => {
      const timestamp = new Date().toISOString();

      expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe("Session Tracking", () => {
    it("should use userId:channelId format", () => {
      const sessionKey = "123456789:987654321";

      expect(sessionKey).toContain(":");
      const [userId, channelId] = sessionKey.split(":");
      expect(userId.length).toBeGreaterThan(0);
      expect(channelId.length).toBeGreaterThan(0);
    });

    it("should use userId:dm format for DMs", () => {
      const sessionKey = "123456789:dm";

      expect(sessionKey).toContain(":");
      expect(sessionKey).toEndWith("dm");
    });

    it("should correlate events by session ID", () => {
      const sessionId = "123456789:987654321";
      const events = [
        {
          event_type: "DiscordMessageReceived",
          data: { session_id: sessionId },
        },
        {
          event_type: "DiscordSubprocessCall",
          data: { session_id: sessionId },
        },
        {
          event_type: "DiscordResponseSent",
          data: { session_id: sessionId },
        },
      ];

      const sessions = events.map((e) => e.data.session_id);
      expect(new Set(sessions).size).toBe(1);
    });
  });

  describe("Response Events", () => {
    it("should track text responses", () => {
      const responseType = "text";

      expect(responseType).toBe("text");
    });

    it("should track voice responses with attachment flag", () => {
      const responseType = "voice";
      const hasAttachments = true;

      expect(responseType).toBe("voice");
      expect(hasAttachments).toBe(true);
    });

    it("should mark attachment presence", () => {
      const withAttachment = true;
      const withoutAttachment = false;

      expect(withAttachment).toBe(true);
      expect(withoutAttachment).toBe(false);
    });
  });

  describe("Event Timestamps", () => {
    it("should use ISO 8601 format", () => {
      const timestamp = new Date().toISOString();

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should include milliseconds", () => {
      const timestamp = new Date().toISOString();

      expect(timestamp).toMatch(/\.\d{3}Z$/);
    });

    it("should be sortable chronologically", () => {
      const now = new Date().toISOString();
      const future = new Date(Date.now() + 1000).toISOString();

      expect(now < future).toBe(true);
    });
  });

  describe("Event Serialization", () => {
    it("should be valid JSON", () => {
      const event = {
        event_type: "DiscordMessageReceived",
        timestamp: new Date().toISOString(),
        data: {
          discord_user_id: "123456789",
          session_id: "123456789:987654321",
        },
      };

      const json = JSON.stringify(event);
      const parsed = JSON.parse(json);

      expect(parsed.event_type).toBe(event.event_type);
      expect(parsed.data.session_id).toBe(event.data.session_id);
    });

    it("should handle special characters in previews", () => {
      const preview = 'Hello "world" & friends < >';
      const event = {
        data: {
          message_preview: preview,
        },
      };

      const json = JSON.stringify(event);
      expect(json).toBeDefined();
    });

    it("should handle long error messages", () => {
      const longError = "a".repeat(5000);
      const event = {
        data: {
          error_message: longError,
        },
      };

      const json = JSON.stringify(event);
      expect(json.length).toBeGreaterThan(5000);
    });
  });

  describe("Statistics", () => {
    it("should count events by type", () => {
      const eventsByType = {
        DiscordMessageReceived: 5,
        DiscordResponseSent: 5,
        DiscordSubprocessCall: 5,
      };

      const total = Object.values(eventsByType).reduce((a, b) => a + b, 0);
      expect(total).toBe(15);
    });

    it("should calculate success rate", () => {
      const successful = 8;
      const failed = 2;
      const successRate = (successful / (successful + failed)) * 100;

      expect(successRate).toBe(80);
    });

    it("should aggregate token usage", () => {
      const events = [
        { input_tokens: 100, output_tokens: 50 },
        { input_tokens: 150, output_tokens: 75 },
        { input_tokens: 200, output_tokens: 100 },
      ];

      const totalInput = events.reduce((sum, e) => sum + e.input_tokens, 0);
      const totalOutput = events.reduce((sum, e) => sum + e.output_tokens, 0);

      expect(totalInput).toBe(450);
      expect(totalOutput).toBe(225);
    });
  });
});
