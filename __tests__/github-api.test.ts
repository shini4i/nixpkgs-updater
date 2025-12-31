import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock @actions/github before importing
const mockGetOctokit = jest.fn();
const mockListPulls = jest.fn();
const mockUpdatePull = jest.fn();
const mockCreatePull = jest.fn();

jest.unstable_mockModule('@actions/github', () => ({
  getOctokit: mockGetOctokit,
}));

// Import after mocking
const { createOrUpdatePR } = await import('../src/github-api.js');

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
});
