/**
 * Retry Utility - Resilience Layer
 * Exponential backoff with jitter for transient failure recovery
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default: 1000) */
  baseDelay?: number;
  /** Maximum delay cap in ms (default: 30000) */
  maxDelay?: number;
  /** Multiplier for exponential growth (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Function to determine if an error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Called before each retry attempt */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
  /** Abort signal to cancel retries */
  signal?: AbortSignal;
  /** Label for logging (default: "operation") */
  label?: string;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: unknown;
  attempts: number;
  totalDuration: number;
}

/**
 * Execute a function with exponential backoff retry logic
 *
 * Usage:
 *   const result = await withRetry(() => fetchData(), { maxRetries: 3, label: "API call" });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true,
    isRetryable = () => true,
    onRetry,
    signal,
    label = "operation",
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check abort signal
    if (signal?.aborted) {
      throw new Error(`${label} aborted`);
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we're on the last attempt
      if (attempt >= maxRetries) {
        break;
      }

      // Don't retry non-retryable errors
      if (!isRetryable(error)) {
        break;
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      // Add jitter (0-100% of calculated delay)
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      delay = Math.round(delay);

      // Notify about retry
      const nextAttempt = attempt + 1;
      console.warn(
        `⚡ [${label}] Attempt ${nextAttempt}/${maxRetries + 1} failed, retrying in ${delay}ms...`
      );

      if (onRetry) {
        onRetry(error, nextAttempt, delay);
      }

      // Wait before retrying
      await sleep(delay, signal);
    }
  }

  throw lastError;
}

/**
 * Execute with retry and return a result object instead of throwing
 */
export async function withRetrySafe<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  const wrappedOnRetry = options.onRetry;
  const trackingOptions: RetryOptions = {
    ...options,
    onRetry: (error, attempt, delay) => {
      attempts = attempt;
      wrappedOnRetry?.(error, attempt, delay);
    },
  };

  try {
    const result = await withRetry(fn, trackingOptions);
    return {
      success: true,
      result,
      attempts: attempts + 1,
      totalDuration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error,
      attempts: attempts + 1,
      totalDuration: Date.now() - startTime,
    };
  }
}

/**
 * Predicate: Is this an HTTP error worth retrying?
 * Retries on: 429 (rate limit), 500, 502, 503, 504 (server errors)
 */
export function isRetryableHttpError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Rate limiting
    if (message.includes("429") || message.includes("rate limit")) {
      return true;
    }

    // Server errors
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504") ||
      message.includes("internal server error") ||
      message.includes("bad gateway") ||
      message.includes("service unavailable") ||
      message.includes("gateway timeout")
    ) {
      return true;
    }

    // Network errors
    if (
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("epipe") ||
      message.includes("network") ||
      message.includes("socket") ||
      message.includes("fetch failed")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Predicate: Is this a subprocess error worth retrying?
 * Retries on: non-zero exit codes that indicate transient issues
 */
export function isRetryableSubprocessError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Process crashed or was killed
    if (
      message.includes("exit code") ||
      message.includes("signal") ||
      message.includes("killed")
    ) {
      return true;
    }

    // Resource issues
    if (
      message.includes("enomem") ||
      message.includes("resource") ||
      message.includes("too many open files")
    ) {
      return true;
    }

    // Timeout
    if (message.includes("timeout") || message.includes("timed out")) {
      return true;
    }
  }

  return false;
}

/**
 * Predicate: Is this a Discord API error worth retrying?
 */
export function isRetryableDiscordError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Rate limiting (Discord returns 429)
    if (message.includes("rate limit") || message.includes("429")) {
      return true;
    }

    // Server errors
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504")
    ) {
      return true;
    }

    // Network issues
    if (
      message.includes("econnreset") ||
      message.includes("network") ||
      message.includes("socket hang up") ||
      message.includes("fetch failed")
    ) {
      return true;
    }

    // Discord-specific transient errors
    if (
      message.includes("unknown message") ||
      message.includes("could not execute webhook")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Sleep with abort signal support
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
