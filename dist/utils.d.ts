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
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * Sleeps for the specified number of milliseconds.
 *
 * @param ms - Number of milliseconds to sleep
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Determines if an error is likely a transient network error that should be retried.
 *
 * @param error - The error to check
 * @returns True if the error appears to be a transient network issue
 */
export declare function isTransientError(error: unknown): boolean;
