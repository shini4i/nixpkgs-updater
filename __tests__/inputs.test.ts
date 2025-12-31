import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock @actions/core before importing
const mockGetInput = jest.fn<(name: string, options?: { required?: boolean }) => string>();

jest.unstable_mockModule('@actions/core', () => ({
  getInput: mockGetInput,
}));

// Import after mocking
const { parseInputs } = await import('../src/inputs.js');
const { InputValidationError } = await import('../src/errors.js');

describe('parseInputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupMockInputs(inputs: Record<string, string>): void {
    mockGetInput.mockImplementation((name: string) => {
      return inputs[name] ?? '';
    });
  }

  it('parses valid inputs correctly', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'ghp_token123',
    });

    const result = parseInputs();

    expect(result.packageName).toBe('my-package');
    expect(result.version).toBe('v1.0.0');
    expect(result.targetRepo).toBe('owner/repo');
    expect(result.githubToken).toBe('ghp_token123');
    expect(result.targetOwner).toBe('owner');
    expect(result.targetRepoName).toBe('repo');
  });

  it('throws error for invalid target-repo format without slash', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'invalid-format',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Expected owner/repo');
  });

  it('throws error for target-repo with multiple slashes', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'owner/repo/extra',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
  });

  it('throws error for target-repo with empty owner', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': '/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Owner and repo must not be empty');
  });

  it('throws error for target-repo with empty repo', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'owner/',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Owner and repo must not be empty');
  });

  it('throws error for package-name with forward slash (path traversal)', () => {
    setupMockInputs({
      'package-name': 'package/path',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Must not contain path separators');
  });

  it('throws error for package-name with dot-dot (path traversal)', () => {
    setupMockInputs({
      'package-name': '../evil',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Must not contain path separators');
  });

  it('throws error for empty package-name', () => {
    setupMockInputs({
      'package-name': '',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('package-name must not be empty');
  });

  it('throws error for whitespace-only package-name', () => {
    setupMockInputs({
      'package-name': '   ',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('package-name must not be empty');
  });

  it('throws error for empty version', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: '',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('version must not be empty');
  });

  it('throws error for whitespace-only version', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: '   ',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('version must not be empty');
  });

  it('accepts package-name with hyphens and underscores', () => {
    setupMockInputs({
      'package-name': 'my-package_name',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    const result = parseInputs();
    expect(result.packageName).toBe('my-package_name');
  });

  it('accepts version without v prefix', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: '1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    const result = parseInputs();
    expect(result.version).toBe('1.0.0');
  });
});
