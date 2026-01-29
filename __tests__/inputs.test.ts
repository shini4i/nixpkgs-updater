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
    expect(result.baseBranch).toBe('main');
  });

  it('uses default base-branch when not specified', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'ghp_token123',
    });

    const result = parseInputs();

    expect(result.baseBranch).toBe('main');
  });

  it('uses custom base-branch when specified', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'ghp_token123',
      'base-branch': 'develop',
    });

    const result = parseInputs();

    expect(result.baseBranch).toBe('develop');
  });

  it('accepts base-branch with slashes (feature branches)', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'ghp_token123',
      'base-branch': 'release/v2.0',
    });

    const result = parseInputs();

    expect(result.baseBranch).toBe('release/v2.0');
  });

  it('accepts base-branch with hyphens and underscores', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'ghp_token123',
      'base-branch': 'my-feature_branch',
    });

    const result = parseInputs();

    expect(result.baseBranch).toBe('my-feature_branch');
  });

  it('accepts base-branch with dots (version branches)', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'ghp_token123',
      'base-branch': 'release-1.0',
    });

    const result = parseInputs();

    expect(result.baseBranch).toBe('release-1.0');
  });

  it('throws error for base-branch with shell metacharacters', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'ghp_token123',
      'base-branch': 'main; rm -rf /',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Invalid base-branch format');
  });

  it('throws error for base-branch with spaces', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'ghp_token123',
      'base-branch': 'my branch',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Invalid base-branch format');
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

  it('accepts package-name with dots', () => {
    setupMockInputs({
      'package-name': 'my.package.name',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    const result = parseInputs();
    expect(result.packageName).toBe('my.package.name');
  });

  it('throws error for package-name with shell metacharacters', () => {
    setupMockInputs({
      'package-name': 'my-package; echo hello',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Invalid package-name format');
  });

  it('throws error for package-name with backticks', () => {
    setupMockInputs({
      'package-name': '`whoami`',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Invalid package-name format');
  });

  it('throws error for package-name with $() command substitution', () => {
    setupMockInputs({
      'package-name': '$(echo test)',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Invalid package-name format');
  });

  it('throws error for package-name with quotes', () => {
    setupMockInputs({
      'package-name': 'my-package"test',
      version: 'v1.0.0',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Invalid package-name format');
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

  it('throws error for version with shell metacharacters', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0; rm -rf /',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Invalid version format');
  });

  it('throws error for version with backticks', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: '`whoami`',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Invalid version format');
  });

  it('throws error for version with $() command substitution', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: '$(cat /etc/passwd)',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    expect(() => parseInputs()).toThrow(InputValidationError);
    expect(() => parseInputs()).toThrow('Invalid version format');
  });

  it('accepts version with plus sign (semver build metadata)', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0+build.123',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    const result = parseInputs();
    expect(result.version).toBe('v1.0.0+build.123');
  });

  it('accepts version with underscore', () => {
    setupMockInputs({
      'package-name': 'my-package',
      version: 'v1.0.0_rc1',
      'target-repo': 'owner/repo',
      'github-token': 'token',
    });

    const result = parseInputs();
    expect(result.version).toBe('v1.0.0_rc1');
  });
});
