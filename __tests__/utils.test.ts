import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock @actions/core before importing
const mockDebug = jest.fn<(message: string) => void>();

jest.unstable_mockModule('@actions/core', () => ({
  debug: mockDebug,
}));

// Import after mocking
const { withRetry, sleep, isTransientError } = await import('../src/utils.js');

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns result on first successful attempt', async () => {
    const fn = jest.fn<() => Promise<string>>().mockResolvedValue('success');

    const resultPromise = withRetry(fn);
    jest.runAllTimers();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const fn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce('success');

    const resultPromise = withRetry(fn);

    // Fast-forward through retry delay
    await jest.runAllTimersAsync();

    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries exhausted', async () => {
    // Use real timers for error-path test with minimal delays
    jest.useRealTimers();

    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('Persistent failure'));

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(
      'Persistent failure'
    );
    expect(fn).toHaveBeenCalledTimes(3);

    // Restore fake timers for other tests
    jest.useFakeTimers();
  });

  it('uses custom maxAttempts option', async () => {
    // Use real timers for error-path test with minimal delays
    jest.useRealTimers();

    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('Failure'));

    await expect(withRetry(fn, { maxAttempts: 5, baseDelayMs: 1 })).rejects.toThrow('Failure');
    expect(fn).toHaveBeenCalledTimes(5);

    // Restore fake timers for other tests
    jest.useFakeTimers();
  });

  it('respects shouldRetry predicate - does not retry when false', async () => {
    const error = new Error('Non-retryable error');
    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(error);
    const shouldRetry = jest.fn<(error: unknown) => boolean>().mockReturnValue(false);

    const resultPromise = withRetry(fn, { shouldRetry });

    await expect(resultPromise).rejects.toThrow('Non-retryable error');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(error);
  });

  it('respects shouldRetry predicate - retries when true', async () => {
    const error = new Error('Retryable error');
    const fn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('success');
    const shouldRetry = jest.fn<(error: unknown) => boolean>().mockReturnValue(true);

    const resultPromise = withRetry(fn, { shouldRetry });

    await jest.runAllTimersAsync();

    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('logs debug messages with operation name on retry', async () => {
    const fn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce('success');

    const resultPromise = withRetry(fn, { operationName: 'test operation' });

    await jest.runAllTimersAsync();

    await resultPromise;

    expect(mockDebug).toHaveBeenCalledWith(
      expect.stringContaining('test operation failed (attempt 1/3)')
    );
  });

  it('uses exponential backoff for delays', async () => {
    const fn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Failure 1'))
      .mockRejectedValueOnce(new Error('Failure 2'))
      .mockResolvedValueOnce('success');

    const resultPromise = withRetry(fn, { baseDelayMs: 100 });

    // First delay: 100ms (100 * 2^0)
    await jest.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second delay: 200ms (100 * 2^1)
    await jest.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await resultPromise;
    expect(result).toBe('success');
  });
});

describe('sleep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves after the specified time', async () => {
    const sleepPromise = sleep(1000);

    jest.advanceTimersByTime(999);
    // Promise should still be pending

    jest.advanceTimersByTime(1);
    await sleepPromise; // Should resolve now
  });
});

describe('isTransientError', () => {
  it('returns false for non-Error values', () => {
    expect(isTransientError('string error')).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError(42)).toBe(false);
  });

  it('returns true for connection reset errors', () => {
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true);
    expect(isTransientError(new Error('Connection ECONNRESET during request'))).toBe(true);
  });

  it('returns true for connection refused errors', () => {
    expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true);
  });

  it('returns true for timeout errors', () => {
    expect(isTransientError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isTransientError(new Error('Request timeout'))).toBe(true);
  });

  it('returns true for socket hang up errors', () => {
    expect(isTransientError(new Error('socket hang up'))).toBe(true);
  });

  it('returns true for network errors', () => {
    expect(isTransientError(new Error('network error'))).toBe(true);
  });

  it('returns true for rate limit errors', () => {
    expect(isTransientError(new Error('rate limit exceeded'))).toBe(true);
    expect(isTransientError(new Error('HTTP 429 Too Many Requests'))).toBe(true);
  });

  it('returns true for HTTP 502 errors', () => {
    expect(isTransientError(new Error('HTTP 502 Bad Gateway'))).toBe(true);
  });

  it('returns true for HTTP 503 errors', () => {
    expect(isTransientError(new Error('HTTP 503 Service Unavailable'))).toBe(true);
  });

  it('returns true for HTTP 504 errors', () => {
    expect(isTransientError(new Error('HTTP 504 Gateway Timeout'))).toBe(true);
  });

  it('returns false for non-transient errors', () => {
    expect(isTransientError(new Error('Permission denied'))).toBe(false);
    expect(isTransientError(new Error('File not found'))).toBe(false);
    expect(isTransientError(new Error('Invalid input'))).toBe(false);
    expect(isTransientError(new Error('HTTP 404 Not Found'))).toBe(false);
    expect(isTransientError(new Error('HTTP 401 Unauthorized'))).toBe(false);
  });
});
