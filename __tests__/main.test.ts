import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock all dependencies before importing
const mockSetFailed = jest.fn<(message: string) => void>();
const mockSetOutput = jest.fn<(name: string, value: unknown) => void>();
const mockInfo = jest.fn<(message: string) => void>();
const mockDebug = jest.fn<(message: string) => void>();

jest.unstable_mockModule('@actions/core', () => ({
  setFailed: mockSetFailed,
  setOutput: mockSetOutput,
  info: mockInfo,
  debug: mockDebug,
}));

// Import error classes for testing
const {
  NixpkgsUpdaterError,
  NixPrefetchError,
  NixFileParseError,
  GitOperationError,
  GitHubAPIError,
  InputValidationError,
} = await import('../src/errors.js');

// Import handleError after mocking
const { handleError } = await import('../src/main.js');

describe('handleError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles InputValidationError with correct message', () => {
    const error = new InputValidationError('Invalid package name');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith('Input validation error: Invalid package name');
  });

  it('handles NixPrefetchError with correct message and hint', () => {
    const error = new NixPrefetchError('Command not found');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith(
      'Nix prefetch failed: Command not found. Ensure Nix is installed (use cachix/install-nix-action).'
    );
  });

  it('handles NixFileParseError with correct message and hint', () => {
    const error = new NixFileParseError('Could not find owner');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith(
      'Failed to parse Nix file: Could not find owner. Check file format.'
    );
  });

  it('handles GitOperationError with correct message', () => {
    const error = new GitOperationError('Failed to clone repository');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith('Git operation failed: Failed to clone repository');
  });

  it('handles GitHubAPIError with correct message and hint', () => {
    const error = new GitHubAPIError('404 Not Found');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith(
      'GitHub API error: 404 Not Found. Check token permissions.'
    );
  });

  it('handles generic NixpkgsUpdaterError with message', () => {
    const error = new NixpkgsUpdaterError('Something went wrong', 'GENERIC_ERROR');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith('Error: Something went wrong');
  });

  it('handles standard Error with unexpected error message', () => {
    const error = new Error('Some unexpected error');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith('Unexpected error: Some unexpected error');
  });

  it('handles unknown error types with generic message', () => {
    handleError('string error');

    expect(mockSetFailed).toHaveBeenCalledWith('An unexpected error occurred');
  });

  it('handles null error with generic message', () => {
    handleError(null);

    expect(mockSetFailed).toHaveBeenCalledWith('An unexpected error occurred');
  });

  it('handles undefined error with generic message', () => {
    handleError(undefined);

    expect(mockSetFailed).toHaveBeenCalledWith('An unexpected error occurred');
  });

  it('handles number error with generic message', () => {
    handleError(42);

    expect(mockSetFailed).toHaveBeenCalledWith('An unexpected error occurred');
  });

  it('prioritizes most specific error type (InputValidationError over NixpkgsUpdaterError)', () => {
    // InputValidationError extends NixpkgsUpdaterError, so it should match first
    const error = new InputValidationError('Test');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith('Input validation error: Test');
  });

  it('prioritizes most specific error type (NixPrefetchError over NixpkgsUpdaterError)', () => {
    const error = new NixPrefetchError('Test');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('Nix prefetch failed: Test')
    );
  });

  it('prioritizes most specific error type (NixFileParseError over NixpkgsUpdaterError)', () => {
    const error = new NixFileParseError('Test');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('Failed to parse Nix file'));
  });

  it('prioritizes most specific error type (GitOperationError over NixpkgsUpdaterError)', () => {
    const error = new GitOperationError('Test');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('Git operation failed'));
  });

  it('prioritizes most specific error type (GitHubAPIError over NixpkgsUpdaterError)', () => {
    const error = new GitHubAPIError('Test');

    handleError(error);

    expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('GitHub API error'));
  });
});
