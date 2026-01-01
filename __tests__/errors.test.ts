import { describe, it, expect } from '@jest/globals';
import {
  NixpkgsUpdaterError,
  NixPrefetchError,
  NixFileParseError,
  GitOperationError,
  GitHubAPIError,
  InputValidationError,
} from '../src/errors.js';

describe('NixpkgsUpdaterError', () => {
  it('creates error with message and code', () => {
    const error = new NixpkgsUpdaterError('test message', 'TEST_CODE');

    expect(error.message).toBe('test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('NixpkgsUpdaterError');
  });

  it('is an instance of Error', () => {
    const error = new NixpkgsUpdaterError('test', 'CODE');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NixpkgsUpdaterError);
  });

  it('has stack trace', () => {
    const error = new NixpkgsUpdaterError('test', 'CODE');

    expect(error.stack).toBeDefined();
  });
});

describe('NixPrefetchError', () => {
  it('creates error with correct name and code', () => {
    const error = new NixPrefetchError('prefetch failed');

    expect(error.message).toBe('prefetch failed');
    expect(error.code).toBe('NIX_PREFETCH_ERROR');
    expect(error.name).toBe('NixPrefetchError');
  });

  it('is an instance of NixpkgsUpdaterError', () => {
    const error = new NixPrefetchError('test');

    expect(error).toBeInstanceOf(NixpkgsUpdaterError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('NixFileParseError', () => {
  it('creates error with correct name and code', () => {
    const error = new NixFileParseError('parse failed');

    expect(error.message).toBe('parse failed');
    expect(error.code).toBe('NIX_FILE_PARSE_ERROR');
    expect(error.name).toBe('NixFileParseError');
  });

  it('is an instance of NixpkgsUpdaterError', () => {
    const error = new NixFileParseError('test');

    expect(error).toBeInstanceOf(NixpkgsUpdaterError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('GitOperationError', () => {
  it('creates error with correct name and code', () => {
    const error = new GitOperationError('git failed');

    expect(error.message).toBe('git failed');
    expect(error.code).toBe('GIT_OPERATION_ERROR');
    expect(error.name).toBe('GitOperationError');
  });

  it('is an instance of NixpkgsUpdaterError', () => {
    const error = new GitOperationError('test');

    expect(error).toBeInstanceOf(NixpkgsUpdaterError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('GitHubAPIError', () => {
  it('creates error with correct name and code', () => {
    const error = new GitHubAPIError('api failed');

    expect(error.message).toBe('api failed');
    expect(error.code).toBe('GITHUB_API_ERROR');
    expect(error.name).toBe('GitHubAPIError');
  });

  it('is an instance of NixpkgsUpdaterError', () => {
    const error = new GitHubAPIError('test');

    expect(error).toBeInstanceOf(NixpkgsUpdaterError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('InputValidationError', () => {
  it('creates error with correct name and code', () => {
    const error = new InputValidationError('validation failed');

    expect(error.message).toBe('validation failed');
    expect(error.code).toBe('INPUT_VALIDATION_ERROR');
    expect(error.name).toBe('InputValidationError');
  });

  it('is an instance of NixpkgsUpdaterError', () => {
    const error = new InputValidationError('test');

    expect(error).toBeInstanceOf(NixpkgsUpdaterError);
    expect(error).toBeInstanceOf(Error);
  });
});
