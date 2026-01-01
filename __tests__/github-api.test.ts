import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock @actions/github before importing
const mockGetOctokit = jest.fn();
const mockListPulls = jest.fn();
const mockUpdatePull = jest.fn();
const mockCreatePull = jest.fn();
const mockInfo = jest.fn();

jest.unstable_mockModule('@actions/github', () => ({
  getOctokit: mockGetOctokit,
}));

jest.unstable_mockModule('@actions/core', () => ({
  info: mockInfo,
}));

// Import after mocking
const { createOrUpdatePR } = await import('../src/github-api.js');
const { GitHubAPIError } = await import('../src/errors.js');

describe('createOrUpdatePR', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock
    mockGetOctokit.mockReturnValue({
      rest: {
        pulls: {
          list: mockListPulls,
          update: mockUpdatePull,
          create: mockCreatePull,
        },
      },
    });
  });

  it('creates a new PR when no existing PR found', async () => {
    mockListPulls.mockResolvedValue({ data: [] });
    mockCreatePull.mockResolvedValue({
      data: {
        html_url: 'https://github.com/owner/repo/pull/42',
        number: 42,
      },
    });

    const result = await createOrUpdatePR(
      'owner/repo',
      'token123',
      'chore/update-v1.0.0',
      'my-package',
      '1.0.0'
    );

    expect(result.url).toBe('https://github.com/owner/repo/pull/42');
    expect(result.number).toBe(42);
    expect(result.created).toBe(true);

    expect(mockCreatePull).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'owner',
        repo: 'repo',
        title: 'bump my-package version to 1.0.0',
        head: 'chore/update-v1.0.0',
        base: 'main',
      })
    );
  });

  it('updates existing PR when found', async () => {
    mockListPulls.mockResolvedValue({
      data: [
        {
          number: 99,
          html_url: 'https://github.com/owner/repo/pull/99',
        },
      ],
    });
    mockUpdatePull.mockResolvedValue({});

    const result = await createOrUpdatePR(
      'owner/repo',
      'token123',
      'chore/update-v1.0.0',
      'my-package',
      '1.0.0'
    );

    expect(result.url).toBe('https://github.com/owner/repo/pull/99');
    expect(result.number).toBe(99);
    expect(result.created).toBe(false);

    expect(mockUpdatePull).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'owner',
        repo: 'repo',
        pull_number: 99,
        title: 'bump my-package version to 1.0.0',
      })
    );
    expect(mockCreatePull).not.toHaveBeenCalled();
  });

  it('uses correct owner and repo from target-repo string', async () => {
    mockListPulls.mockResolvedValue({ data: [] });
    mockCreatePull.mockResolvedValue({
      data: {
        html_url: 'https://github.com/shini4i/nixpkgs/pull/1',
        number: 1,
      },
    });

    await createOrUpdatePR('shini4i/nixpkgs', 'token', 'branch', 'package', '1.0.0');

    expect(mockListPulls).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'shini4i',
        repo: 'nixpkgs',
      })
    );
  });

  it('generates correct PR body', async () => {
    mockListPulls.mockResolvedValue({ data: [] });
    mockCreatePull.mockResolvedValue({
      data: {
        html_url: 'https://github.com/owner/repo/pull/1',
        number: 1,
      },
    });

    await createOrUpdatePR('owner/repo', 'token', 'branch', 'test-package', '2.0.0');

    expect(mockCreatePull).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('test-package'),
      })
    );
    expect(mockCreatePull).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('2.0.0'),
      })
    );
  });

  it('includes vendorHash warning when hasVendorHash is true', async () => {
    mockListPulls.mockResolvedValue({ data: [] });
    mockCreatePull.mockResolvedValue({
      data: {
        html_url: 'https://github.com/owner/repo/pull/1',
        number: 1,
      },
    });

    await createOrUpdatePR('owner/repo', 'token', 'branch', 'go-package', '1.0.0', {
      hasVendorHash: true,
    });

    expect(mockCreatePull).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('vendorHash'),
      })
    );
    expect(mockCreatePull).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Action Required'),
      })
    );
    expect(mockCreatePull).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('nix build .#go-package'),
      })
    );
  });

  it('excludes rev update from changes when revUsesVersion is true', async () => {
    mockListPulls.mockResolvedValue({ data: [] });
    mockCreatePull.mockResolvedValue({
      data: {
        html_url: 'https://github.com/owner/repo/pull/1',
        number: 1,
      },
    });

    await createOrUpdatePR('owner/repo', 'token', 'branch', 'my-package', '1.0.0', {
      revUsesVersion: true,
    });

    const callArg = mockCreatePull.mock.calls[0]?.[0] as { body?: string } | undefined;
    expect(callArg?.body).not.toContain('Updated `rev` field');
    expect(callArg?.body).toContain('Updated `version` field');
    expect(callArg?.body).toContain('Updated source `hash`');
  });

  it('includes rev update in changes when revUsesVersion is false', async () => {
    mockListPulls.mockResolvedValue({ data: [] });
    mockCreatePull.mockResolvedValue({
      data: {
        html_url: 'https://github.com/owner/repo/pull/1',
        number: 1,
      },
    });

    await createOrUpdatePR('owner/repo', 'token', 'branch', 'my-package', '1.0.0', {
      revUsesVersion: false,
    });

    expect(mockCreatePull).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Updated `rev` field'),
      })
    );
  });

  it('handles both hasVendorHash and revUsesVersion options', async () => {
    mockListPulls.mockResolvedValue({ data: [] });
    mockCreatePull.mockResolvedValue({
      data: {
        html_url: 'https://github.com/owner/repo/pull/1',
        number: 1,
      },
    });

    await createOrUpdatePR('owner/repo', 'token', 'branch', 'go-package', '1.0.0', {
      hasVendorHash: true,
      revUsesVersion: true,
    });

    const callArg = mockCreatePull.mock.calls[0]?.[0] as { body?: string } | undefined;
    // Should include vendorHash warning
    expect(callArg?.body).toContain('vendorHash');
    expect(callArg?.body).toContain('Action Required');
    // Should not include rev update
    expect(callArg?.body).not.toContain('Updated `rev` field');
    // Should include version and hash updates
    expect(callArg?.body).toContain('Updated `version` field');
    expect(callArg?.body).toContain('Updated source `hash`');
  });

  it('throws GitHubAPIError for invalid target-repo format without slash', async () => {
    const promise = createOrUpdatePR('invalid-repo', 'token', 'branch', 'package', '1.0.0');
    await expect(promise).rejects.toThrow(GitHubAPIError);
    await expect(promise).rejects.toThrow('Invalid target repository format: invalid-repo');
  });

  it('throws GitHubAPIError for empty target-repo', async () => {
    const promise = createOrUpdatePR('', 'token', 'branch', 'package', '1.0.0');
    await expect(promise).rejects.toThrow(GitHubAPIError);
  });

  it('re-throws GitHubAPIError without wrapping', async () => {
    mockListPulls.mockRejectedValue(new GitHubAPIError('Original error'));

    const promise = createOrUpdatePR('owner/repo', 'token', 'branch', 'package', '1.0.0');
    await expect(promise).rejects.toThrow('Original error');
  });

  it('wraps non-GitHubAPIError exceptions', async () => {
    mockListPulls.mockRejectedValue(new Error('Network error'));

    const promise = createOrUpdatePR('owner/repo', 'token', 'branch', 'package', '1.0.0');
    await expect(promise).rejects.toThrow('Failed to create/update PR: Network error');
  });

  it('wraps non-Error exceptions', async () => {
    mockListPulls.mockRejectedValue('string error');

    const promise = createOrUpdatePR('owner/repo', 'token', 'branch', 'package', '1.0.0');
    await expect(promise).rejects.toThrow('Failed to create/update PR: string error');
  });

  it('logs info when updating existing PR', async () => {
    mockListPulls.mockResolvedValue({
      data: [
        {
          number: 99,
          html_url: 'https://github.com/owner/repo/pull/99',
        },
      ],
    });
    mockUpdatePull.mockResolvedValue({});

    await createOrUpdatePR('owner/repo', 'token', 'branch', 'my-package', '1.0.0');

    expect(mockInfo).toHaveBeenCalledWith('Found existing PR #99, updating...');
  });
});
