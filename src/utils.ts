import * as core from '@actions/core';

/**
 * Options for the retry function.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxAttempts?: number;
  /** Base delay in milliseconds between retries (default: 1000). */
  baseDelayMs?: number;
  /** Optional function to determine if an error should trigger a retry. */
  shouldRetry?: (error: unknown) => boolean;
  /** Optional operation name for logging. */
  operationName?: string;
}

/**
 * Executes an async function with exponential backoff retry logic.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function if successful
 * @throws The last error if all retry attempts fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxAttempts: 3, operationName: 'fetchData' }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, shouldRetry, operationName } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // If this was the last attempt, don't log retry message
      if (attempt === maxAttempts) {
        break;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      const opName = operationName ?? 'operation';
      core.debug(
        `${opName} failed (attempt ${String(attempt)}/${String(maxAttempts)}), retrying in ${String(delayMs)}ms: ${error instanceof Error ? error.message : String(error)}`
      );

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Sleeps for the specified number of milliseconds.
 *
 * @param ms - Number of milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error is likely a transient network error that should be retried.
 *
 * @param error - The error to check
 * @returns True if the error appears to be a transient network issue
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  // Common transient error patterns
  const transientPatterns = [
    'econnreset',
    'econnrefused',
    'etimedout',
    'socket hang up',
    'network',
    'timeout',
    'rate limit',
    '429', // Too Many Requests
    '502', // Bad Gateway
    '503', // Service Unavailable
    '504', // Gateway Timeout
  ];

  return transientPatterns.some((pattern) => message.includes(pattern));
}
