import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type * as execModule from '@actions/exec';
import type * as ioModule from '@actions/io';

// Mock dependencies before importing
const mockExec = jest.fn<typeof execModule.exec>();
const mockMkdirP = jest.fn<typeof ioModule.mkdirP>();
const mockSetSecret = jest.fn<(secret: string) => void>();

jest.unstable_mockModule('@actions/exec', () => ({
  exec: mockExec,
}));

jest.unstable_mockModule('@actions/io', () => ({
  mkdirP: mockMkdirP,
}));

jest.unstable_mockModule('@actions/core', () => ({
  setSecret: mockSetSecret,
}));

// Import after mocking
const { cloneRepository, createBranch, commitAndPush } = await import('../src/git-operations.js');
const { GitOperationError } = await import('../src/errors.js');

describe('cloneRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockResolvedValue(0);
    mockMkdirP.mockResolvedValue(undefined);
  });

  it('masks the token using core.setSecret', async () => {
    await cloneRepository('owner/repo', 'secret-token');

    expect(mockSetSecret).toHaveBeenCalledWith('secret-token');
  });

  it('creates temporary directory', async () => {
    await cloneRepository('owner/repo', 'token');

    expect(mockMkdirP).toHaveBeenCalledWith(expect.stringContaining('nixpkgs-updater-'));
  });

  it('clones with correct URL and silent mode', async () => {
    await cloneRepository('owner/repo', 'token123');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining([
        'clone',
        '--depth',
        '1',
        expect.stringContaining('x-access-token:token123@github.com/owner/repo.git'),
      ]),
      expect.objectContaining({ silent: true })
    );
  });

  it('configures git user after cloning', async () => {
    await cloneRepository('owner/repo', 'token');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['config', 'user.name', 'github-actions[bot]'],
      expect.objectContaining({ cwd: expect.any(String) })
    );

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com'],
      expect.objectContaining({ cwd: expect.any(String) })
    );
  });

  it('returns the temp directory path', async () => {
    const result = await cloneRepository('owner/repo', 'token');

    expect(result).toContain('nixpkgs-updater-');
  });

  it('throws GitOperationError on clone failure', async () => {
    mockExec.mockRejectedValue(new Error('Authentication failed'));

    const promise = cloneRepository('owner/repo', 'token');
    await expect(promise).rejects.toThrow(GitOperationError);
  });

  it('includes repository name in clone error message', async () => {
    mockExec.mockRejectedValue(new Error('Authentication failed'));

    const promise = cloneRepository('owner/repo', 'token');
    await expect(promise).rejects.toThrow('Failed to clone repository owner/repo');
  });

  it('handles non-Error exceptions during clone', async () => {
    mockExec.mockRejectedValue('string error');

    const promise = cloneRepository('owner/repo', 'token');
    await expect(promise).rejects.toThrow('Failed to clone repository owner/repo: string error');
  });
});

describe('createBranch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockResolvedValue(0);
  });

  it('fetches remote branch with ignoreReturnCode', async () => {
    await createBranch('/tmp/repo', 'feature-branch');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['fetch', 'origin', 'feature-branch'],
      expect.objectContaining({ ignoreReturnCode: true, silent: true })
    );
  });

  it('attempts to checkout existing branch', async () => {
    await createBranch('/tmp/repo', 'feature-branch');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['checkout', 'feature-branch'],
      expect.objectContaining({ ignoreReturnCode: true, silent: true })
    );
  });

  it('creates new branch when checkout fails', async () => {
    // First call (fetch) succeeds, second call (checkout) fails, third (checkout -b) succeeds
    mockExec
      .mockResolvedValueOnce(0) // fetch
      .mockResolvedValueOnce(1) // checkout fails (branch doesn't exist)
      .mockResolvedValueOnce(0); // checkout -b succeeds

    await createBranch('/tmp/repo', 'new-branch');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['checkout', '-b', 'new-branch'],
      expect.objectContaining({ silent: true })
    );
  });

  it('resets to origin/main when branch exists', async () => {
    // Both fetch and checkout succeed
    mockExec.mockResolvedValue(0);

    await createBranch('/tmp/repo', 'existing-branch');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['reset', '--hard', 'origin/main'],
      expect.objectContaining({ ignoreReturnCode: true, silent: true })
    );
  });

  it('throws GitOperationError when branch creation fails', async () => {
    mockExec
      .mockResolvedValueOnce(0) // fetch
      .mockResolvedValueOnce(1) // checkout fails
      .mockRejectedValueOnce(new Error('Branch creation failed')); // checkout -b fails

    const promise = createBranch('/tmp/repo', 'bad-branch');
    await expect(promise).rejects.toThrow(GitOperationError);
  });

  it('includes branch name in branch creation error message', async () => {
    mockExec
      .mockResolvedValueOnce(0) // fetch
      .mockResolvedValueOnce(1) // checkout fails
      .mockRejectedValueOnce(new Error('Branch creation failed')); // checkout -b fails

    const promise = createBranch('/tmp/repo', 'bad-branch');
    await expect(promise).rejects.toThrow('Failed to create branch bad-branch');
  });

  it('handles non-Error exceptions during branch creation', async () => {
    mockExec
      .mockResolvedValueOnce(0) // fetch
      .mockResolvedValueOnce(1) // checkout fails
      .mockRejectedValueOnce('string error'); // checkout -b fails with non-Error

    const promise = createBranch('/tmp/repo', 'bad-branch');
    await expect(promise).rejects.toThrow('Failed to create branch bad-branch: string error');
  });
});

describe('commitAndPush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockResolvedValue(0);
  });

  it('adds all files', async () => {
    await commitAndPush('/tmp/repo', 'my-branch', 'test commit');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['add', '-A'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true })
    );
  });

  it('commits with provided message', async () => {
    await commitAndPush('/tmp/repo', 'my-branch', 'chore: update version');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'chore: update version'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true })
    );
  });

  it('force pushes to remote', async () => {
    await commitAndPush('/tmp/repo', 'my-branch', 'test commit');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['push', '--force', 'origin', 'my-branch'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true })
    );
  });

  it('throws GitOperationError on commit failure', async () => {
    mockExec
      .mockResolvedValueOnce(0) // add succeeds
      .mockRejectedValueOnce(new Error('Nothing to commit')); // commit fails

    const promise = commitAndPush('/tmp/repo', 'branch', 'msg');
    await expect(promise).rejects.toThrow(GitOperationError);
  });

  it('includes descriptive message on commit failure', async () => {
    mockExec
      .mockResolvedValueOnce(0) // add succeeds
      .mockRejectedValueOnce(new Error('Nothing to commit')); // commit fails

    const promise = commitAndPush('/tmp/repo', 'branch', 'msg');
    await expect(promise).rejects.toThrow('Failed to commit changes');
  });

  it('throws GitOperationError on push failure', async () => {
    mockExec
      .mockResolvedValueOnce(0) // add succeeds
      .mockResolvedValueOnce(0) // commit succeeds
      .mockRejectedValueOnce(new Error('Push rejected')); // push fails

    const promise = commitAndPush('/tmp/repo', 'branch', 'msg');
    await expect(promise).rejects.toThrow(GitOperationError);
  });

  it('includes branch name in push error message', async () => {
    mockExec
      .mockResolvedValueOnce(0) // add succeeds
      .mockResolvedValueOnce(0) // commit succeeds
      .mockRejectedValueOnce(new Error('Push rejected')); // push fails

    const promise = commitAndPush('/tmp/repo', 'branch', 'msg');
    await expect(promise).rejects.toThrow('Failed to push to branch');
  });

  it('handles non-Error exceptions during commit', async () => {
    mockExec
      .mockResolvedValueOnce(0) // add succeeds
      .mockRejectedValueOnce('string error'); // commit fails with non-Error

    const promise = commitAndPush('/tmp/repo', 'branch', 'msg');
    await expect(promise).rejects.toThrow('Failed to commit changes: string error');
  });

  it('handles non-Error exceptions during push', async () => {
    mockExec
      .mockResolvedValueOnce(0) // add succeeds
      .mockResolvedValueOnce(0) // commit succeeds
      .mockRejectedValueOnce('string error'); // push fails with non-Error

    const promise = commitAndPush('/tmp/repo', 'branch', 'msg');
    await expect(promise).rejects.toThrow('Failed to push to branch: string error');
  });
});
