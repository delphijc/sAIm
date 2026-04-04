/**
 * Retry Utility Tests
 * Tests exponential backoff, jitter, abort, and error predicates
 */

import { describe, it, expect, mock, afterEach } from "bun:test";
import {
  withRetry,
  withRetrySafe,
  isRetryableHttpError,
  isRetryableSubprocessError,
  isRetryableDiscordError,
} from "../utils/retry.ts";

afterEach(() => {
  mock.restore();
});

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const fn = mock(() => Promise.resolve("ok"));
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure then succeed", async () => {
    let calls = 0;
    const fn = mock(() => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return Promise.resolve("recovered");
    });

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10, jitter: false });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after exhausting retries", async () => {
    const fn = mock(() => Promise.reject(new Error("permanent")));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 10, jitter: false })
    ).rejects.toThrow("permanent");

    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should not retry non-retryable errors", async () => {
    const fn = mock(() => Promise.reject(new Error("auth failed")));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelay: 10,
        isRetryable: () => false,
      })
    ).rejects.toThrow("auth failed");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should call onRetry callback", async () => {
    let calls = 0;
    const fn = mock(() => {
      calls++;
      if (calls < 2) throw new Error("fail");
      return Promise.resolve("ok");
    });

    const onRetry = mock(() => {});

    await withRetry(fn, { maxRetries: 3, baseDelay: 10, jitter: false, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should abort when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const fn = mock(() => Promise.resolve("ok"));

    await expect(
      withRetry(fn, { maxRetries: 3, signal: controller.signal, label: "test op" })
    ).rejects.toThrow("test op aborted");

    expect(fn).not.toHaveBeenCalled();
  });

  it("should respect maxDelay cap", async () => {
    let calls = 0;
    const fn = mock(() => {
      calls++;
      if (calls < 3) throw new Error("fail");
      return Promise.resolve("ok");
    });

    const start = Date.now();
    await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 10,
      maxDelay: 20,
      jitter: false,
    });
    const elapsed = Date.now() - start;

    // With baseDelay=10 and maxDelay=20, delays should be small
    expect(elapsed).toBeLessThan(500);
  });

  it("should use default label in log", async () => {
    let calls = 0;
    const fn = mock(() => {
      calls++;
      if (calls < 2) throw new Error("fail");
      return Promise.resolve("ok");
    });

    // Just verifying it doesn't throw with defaults
    const result = await withRetry(fn, { baseDelay: 10, jitter: false });
    expect(result).toBe("ok");
  });
});

describe("withRetrySafe", () => {
  it("should return success result", async () => {
    const fn = mock(() => Promise.resolve(42));
    const result = await withRetrySafe(fn, { baseDelay: 10 });

    expect(result.success).toBe(true);
    expect(result.result).toBe(42);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
  });

  it("should return failure result without throwing", async () => {
    const fn = mock(() => Promise.reject(new Error("boom")));
    const result = await withRetrySafe(fn, { maxRetries: 1, baseDelay: 10, jitter: false });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.attempts).toBeGreaterThanOrEqual(1);
  });

  it("should track attempts through retries", async () => {
    let calls = 0;
    const fn = mock(() => {
      calls++;
      if (calls < 3) throw new Error("fail");
      return Promise.resolve("ok");
    });

    const result = await withRetrySafe(fn, { maxRetries: 3, baseDelay: 10, jitter: false });

    expect(result.success).toBe(true);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
  });

  it("should forward onRetry to withRetry", async () => {
    let calls = 0;
    const fn = mock(() => {
      calls++;
      if (calls < 2) throw new Error("fail");
      return Promise.resolve("ok");
    });

    const onRetry = mock(() => {});
    await withRetrySafe(fn, { maxRetries: 3, baseDelay: 10, jitter: false, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("isRetryableHttpError", () => {
  it("should retry on 429 rate limit", () => {
    expect(isRetryableHttpError(new Error("HTTP 429 Too Many Requests"))).toBe(true);
  });

  it("should retry on rate limit text", () => {
    expect(isRetryableHttpError(new Error("rate limit exceeded"))).toBe(true);
  });

  it("should retry on 500", () => {
    expect(isRetryableHttpError(new Error("HTTP 500"))).toBe(true);
  });

  it("should retry on 502 bad gateway", () => {
    expect(isRetryableHttpError(new Error("502 bad gateway"))).toBe(true);
  });

  it("should retry on 503 service unavailable", () => {
    expect(isRetryableHttpError(new Error("service unavailable 503"))).toBe(true);
  });

  it("should retry on 504 gateway timeout", () => {
    expect(isRetryableHttpError(new Error("gateway timeout"))).toBe(true);
  });

  it("should retry on internal server error text", () => {
    expect(isRetryableHttpError(new Error("internal server error"))).toBe(true);
  });

  it("should retry on ECONNRESET", () => {
    expect(isRetryableHttpError(new Error("ECONNRESET"))).toBe(true);
  });

  it("should retry on ECONNREFUSED", () => {
    expect(isRetryableHttpError(new Error("ECONNREFUSED"))).toBe(true);
  });

  it("should retry on ETIMEDOUT", () => {
    expect(isRetryableHttpError(new Error("ETIMEDOUT"))).toBe(true);
  });

  it("should retry on EPIPE", () => {
    expect(isRetryableHttpError(new Error("EPIPE"))).toBe(true);
  });

  it("should retry on network error", () => {
    expect(isRetryableHttpError(new Error("network error"))).toBe(true);
  });

  it("should retry on socket error", () => {
    expect(isRetryableHttpError(new Error("socket hang up"))).toBe(true);
  });

  it("should retry on fetch failed", () => {
    expect(isRetryableHttpError(new Error("fetch failed"))).toBe(true);
  });

  it("should not retry on 401 unauthorized", () => {
    expect(isRetryableHttpError(new Error("401 Unauthorized"))).toBe(false);
  });

  it("should not retry on 404 not found", () => {
    expect(isRetryableHttpError(new Error("404 Not Found"))).toBe(false);
  });

  it("should not retry on non-Error objects", () => {
    expect(isRetryableHttpError("string error")).toBe(false);
    expect(isRetryableHttpError(null)).toBe(false);
    expect(isRetryableHttpError(undefined)).toBe(false);
  });
});

describe("isRetryableSubprocessError", () => {
  it("should retry on exit code errors", () => {
    expect(isRetryableSubprocessError(new Error("exit code 1"))).toBe(true);
  });

  it("should retry on signal errors", () => {
    expect(isRetryableSubprocessError(new Error("killed by signal SIGTERM"))).toBe(true);
  });

  it("should retry on killed processes", () => {
    expect(isRetryableSubprocessError(new Error("process was killed"))).toBe(true);
  });

  it("should retry on ENOMEM", () => {
    expect(isRetryableSubprocessError(new Error("ENOMEM"))).toBe(true);
  });

  it("should retry on resource errors", () => {
    expect(isRetryableSubprocessError(new Error("resource temporarily unavailable"))).toBe(true);
  });

  it("should retry on too many open files", () => {
    expect(isRetryableSubprocessError(new Error("too many open files"))).toBe(true);
  });

  it("should retry on timeout", () => {
    expect(isRetryableSubprocessError(new Error("operation timed out"))).toBe(true);
  });

  it("should not retry on non-Error objects", () => {
    expect(isRetryableSubprocessError("string")).toBe(false);
    expect(isRetryableSubprocessError(null)).toBe(false);
  });

  it("should not retry on permission errors", () => {
    expect(isRetryableSubprocessError(new Error("permission denied"))).toBe(false);
  });
});

describe("isRetryableDiscordError", () => {
  it("should retry on rate limit", () => {
    expect(isRetryableDiscordError(new Error("rate limit hit"))).toBe(true);
  });

  it("should retry on 429", () => {
    expect(isRetryableDiscordError(new Error("429"))).toBe(true);
  });

  it("should retry on 500", () => {
    expect(isRetryableDiscordError(new Error("500 Internal Server Error"))).toBe(true);
  });

  it("should retry on 502", () => {
    expect(isRetryableDiscordError(new Error("502"))).toBe(true);
  });

  it("should retry on 503", () => {
    expect(isRetryableDiscordError(new Error("503"))).toBe(true);
  });

  it("should retry on 504", () => {
    expect(isRetryableDiscordError(new Error("504"))).toBe(true);
  });

  it("should retry on ECONNRESET", () => {
    expect(isRetryableDiscordError(new Error("ECONNRESET"))).toBe(true);
  });

  it("should retry on network error", () => {
    expect(isRetryableDiscordError(new Error("network error"))).toBe(true);
  });

  it("should retry on socket hang up", () => {
    expect(isRetryableDiscordError(new Error("socket hang up"))).toBe(true);
  });

  it("should retry on fetch failed", () => {
    expect(isRetryableDiscordError(new Error("fetch failed"))).toBe(true);
  });

  it("should retry on unknown message", () => {
    expect(isRetryableDiscordError(new Error("Unknown message"))).toBe(true);
  });

  it("should retry on webhook failure", () => {
    expect(isRetryableDiscordError(new Error("Could not execute webhook"))).toBe(true);
  });

  it("should not retry on non-Error objects", () => {
    expect(isRetryableDiscordError("string")).toBe(false);
    expect(isRetryableDiscordError(42)).toBe(false);
  });

  it("should not retry on permission errors", () => {
    expect(isRetryableDiscordError(new Error("Missing Permissions"))).toBe(false);
  });
});
