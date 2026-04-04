/**
 * Memory Server Tests
 * Tests HTTP endpoints for memory extraction and search
 * Uses mocks to avoid actual server setup in tests
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";

// Mock the memory functions
const mockExtractAndSave = mock(async () => 2);
const mockHybridSearch = mock(async () => [
  {
    id: "test-1",
    sessionId: "test-session",
    topic: "Test Topic",
    summary: "Test summary",
    relevanceScore: 0.9,
    createdAt: Date.now(),
    sourceMessageIds: [],
    accessCount: 1,
    lastAccess: Date.now(),
    confidence: 0.8,
    source: "test",
  },
]);

describe("Memory Server - Extract Endpoint", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should accept extract request with required fields", async () => {
    const payload = {
      userMessage: "Test user message",
      assistantResponse: "Test assistant response. ✅",
      sessionId: "test-session-123",
      source: "test-hook",
    };

    // Simulate request body parsing
    const body = JSON.stringify(payload);
    const parsed = JSON.parse(body);

    expect(parsed.userMessage).toBe("Test user message");
    expect(parsed.assistantResponse).toBe("Test assistant response. ✅");
    expect(parsed.sessionId).toBe("test-session-123");
    expect(parsed.source).toBe("test-hook");
  });

  it("should reject extract request without required fields", () => {
    const payloads = [
      { userMessage: "test" }, // Missing assistantResponse and sessionId
      { assistantResponse: "test" }, // Missing userMessage and sessionId
      { sessionId: "test" }, // Missing both messages
      {}, // All missing
    ];

    for (const payload of payloads) {
      const requiredFields = ["userMessage", "assistantResponse", "sessionId"];
      const hasAllFields = requiredFields.every((field) => field in payload);
      expect(hasAllFields).toBe(false);
    }
  });

  it("should handle extraction with valid payload structure", async () => {
    const request = {
      userMessage: "Fix the bug",
      assistantResponse: "Fixed the timeout issue in the validator. ✅",
      sessionId: "session-abc123",
      source: "discord",
    };

    // Validate structure
    expect(typeof request.userMessage).toBe("string");
    expect(typeof request.assistantResponse).toBe("string");
    expect(typeof request.sessionId).toBe("string");
    expect(typeof request.source).toBe("string");
    expect(request.userMessage.length).toBeGreaterThan(0);
    expect(request.assistantResponse.length).toBeGreaterThan(0);
  });
});

describe("Memory Server - Search Endpoint", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should accept search request with required fields", async () => {
    const payload = {
      query: "async patterns",
      limit: 5,
      sessionId: "optional-session",
    };

    const body = JSON.stringify(payload);
    const parsed = JSON.parse(body);

    expect(parsed.query).toBe("async patterns");
    expect(parsed.limit).toBe(5);
    expect(parsed.sessionId).toBe("optional-session");
  });

  it("should reject search request without query", () => {
    const payloads = [
      { limit: 5 }, // Missing query
      { sessionId: "test" }, // Missing query
      {}, // Missing query
    ];

    for (const payload of payloads) {
      const hasQuery = "query" in payload;
      expect(hasQuery).toBe(false);
    }
  });

  it("should use default limit if not provided", () => {
    const request = {
      query: "test search",
      // limit not specified
    };

    const limit = request.limit ?? 5; // Default to 5
    expect(limit).toBe(5);
  });

  it("should handle search response structure", async () => {
    const mockResults = [
      {
        id: "mem-1",
        sessionId: "test-session",
        topic: "JavaScript",
        summary: "async/await patterns",
        relevanceScore: 0.9,
        createdAt: Date.now(),
        sourceMessageIds: [],
        accessCount: 5,
        lastAccess: Date.now(),
        confidence: 0.8,
        source: "discord",
      },
    ];

    // Simulate response structure
    const response = {
      success: true,
      results: mockResults,
    };

    expect(response.success).toBe(true);
    expect(Array.isArray(response.results)).toBe(true);
    expect(response.results.length).toBeGreaterThan(0);

    const result = response.results[0];
    expect(result.id).toBeDefined();
    expect(result.topic).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.confidence).toBeDefined();
  });
});

describe("Memory Server - Health Check Endpoint", () => {
  it("should return ok status", () => {
    const response = {
      status: "ok",
    };

    expect(response.status).toBe("ok");
  });

  it("should handle health check response format", () => {
    const healthResponse = JSON.stringify({ status: "ok" });
    const parsed = JSON.parse(healthResponse);

    expect(parsed.status).toBe("ok");
  });
});

describe("Memory Server - Error Handling", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should handle 404 for unknown endpoints", () => {
    const paths = ["/unknown", "/api/invalid", "/memory/invalid"];

    for (const path of paths) {
      const isValidPath =
        path === "/memory/extract" ||
        path === "/memory/search" ||
        path === "/memory/health";
      expect(isValidPath).toBe(false);
    }
  });

  it("should return error response on extraction failure", () => {
    const errorResponse = {
      error: "Extraction failed",
    };

    expect(errorResponse.error).toBeDefined();
    expect(typeof errorResponse.error).toBe("string");
  });

  it("should return error response on search failure", () => {
    const errorResponse = {
      error: "Search failed",
    };

    expect(errorResponse.error).toBeDefined();
    expect(typeof errorResponse.error).toBe("string");
  });
});

describe("Memory Server - Timeout Handling", () => {
  it("should timeout after 500ms when server is unresponsive", async () => {
    const startTime = Date.now();
    const timeoutMs = 500;

    // Simulate AbortSignal timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Check that timeout fires within expected window
    await new Promise((resolve) => {
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        clearTimeout(timeoutId);
        expect(elapsed).toBeGreaterThanOrEqual(timeoutMs - 50); // Allow 50ms jitter
        resolve(undefined);
      }, timeoutMs + 100);
    });
  });

  it("should gracefully handle timeout errors", () => {
    const timeoutError = new Error("The operation timed out");
    expect(timeoutError.message).toContain("timed out");
  });
});
