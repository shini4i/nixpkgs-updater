import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type * as execModule from '@actions/exec';
import type * as ioModule from '@actions/io';
import type * as fsModule from 'fs/promises';

// Mock dependencies before importing
const mockExec = jest.fn<typeof execModule.exec>();
const mockGetExecOutput = jest.fn<typeof execModule.getExecOutput>();
const mockMkdirP = jest.fn<typeof ioModule.mkdirP>();
const mockSetSecret = jest.fn<(secret: string) => void>();
const mockDebug = jest.fn<(message: string) => void>();
const mockWarning = jest.fn<(message: string) => void>();
const mockRm = jest.fn<typeof fsModule.rm>();

jest.unstable_mockModule('@actions/exec', () => ({
  exec: mockExec,
  getExecOutput: mockGetExecOutput,
}));

jest.unstable_mockModule('@actions/io', () => ({
  mkdirP: mockMkdirP,
}));

jest.unstable_mockModule('@actions/core', () => ({
  setSecret: mockSetSecret,
  debug: mockDebug,
  warning: mockWarning,
}));

jest.unstable_mockModule('fs/promises', () => ({
  rm: mockRm,
}));

// Import after mocking
const {
  cloneRepository,
  createBranch,
  commitAndPush,
  cleanupRepository,
  stageChanges,
  createCommit,
  pushBranch,
} = await import('../src/git-operations.js');
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

  it('logs debug message when cloning', async () => {
    await cloneRepository('owner/repo', 'token');

    expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('Cloning repository'));
  });
});

describe('createBranch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockResolvedValue(0);
  });

  it('fetches baseBranch with full refspec so origin/<baseBranch> is a tracking ref', async () => {
    await createBranch('/tmp/repo', 'feature-branch');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['fetch', '--depth', '1', 'origin', 'main:refs/remotes/origin/main'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true })
    );
  });

  it('fetches custom baseBranch with full refspec', async () => {
    await createBranch('/tmp/repo', 'feature-branch', 'develop');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['fetch', '--depth', '1', 'origin', 'develop:refs/remotes/origin/develop'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true })
    );
  });

  it('fetches update branch with full refspec so origin/<branch> is a tracking ref', async () => {
    await createBranch('/tmp/repo', 'feature-branch');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['fetch', '--depth', '1', 'origin', 'feature-branch:refs/remotes/origin/feature-branch'],
      expect.objectContaining({ ignoreReturnCode: true, silent: true })
    );
  });

  it('creates or resets local branch off origin/<baseBranch> (default main)', async () => {
    await createBranch('/tmp/repo', 'feature-branch');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['checkout', '-B', 'feature-branch', 'origin/main'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true })
    );
  });

  it('uses custom baseBranch for checkout', async () => {
    await createBranch('/tmp/repo', 'feature-branch', 'develop');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['checkout', '-B', 'feature-branch', 'origin/develop'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true })
    );
  });

  it('supports nested baseBranch refs', async () => {
    await createBranch('/tmp/repo', 'feature-branch', 'release/v2.0');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['checkout', '-B', 'feature-branch', 'origin/release/v2.0'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true })
    );
  });

  it('succeeds when update branch does not exist remotely (fetch returns non-zero)', async () => {
    mockExec
      .mockResolvedValueOnce(0) // baseBranch fetch
      .mockResolvedValueOnce(1) // update branch fetch fails (branch is new)
      .mockResolvedValueOnce(0); // checkout -B succeeds

    await expect(createBranch('/tmp/repo', 'new-branch')).resolves.toBeUndefined();
  });

  it('does not check out the remote branch directly (avoids merging divergent history)', async () => {
    await createBranch('/tmp/repo', 'feature-branch');

    expect(mockExec).not.toHaveBeenCalledWith(
      'git',
      ['checkout', 'feature-branch'],
      expect.anything()
    );
    expect(mockExec).not.toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['reset', '--hard']),
      expect.anything()
    );
  });

  it('throws GitOperationError when baseBranch fetch fails', async () => {
    mockExec.mockRejectedValueOnce(new Error('unknown revision'));

    await expect(createBranch('/tmp/repo', 'feature-branch', 'nonexistent')).rejects.toThrow(
      GitOperationError
    );
  });

  it('includes base branch name in fetch error message', async () => {
    mockExec.mockRejectedValueOnce(new Error('unknown revision'));

    await expect(createBranch('/tmp/repo', 'feature-branch', 'nonexistent')).rejects.toThrow(
      'Failed to fetch base branch nonexistent'
    );
  });

  it('throws GitOperationError when checkout fails', async () => {
    mockExec
      .mockResolvedValueOnce(0) // baseBranch fetch
      .mockResolvedValueOnce(0) // update branch fetch
      .mockRejectedValueOnce(new Error('checkout failed'));

    const promise = createBranch('/tmp/repo', 'bad-branch');
    await expect(promise).rejects.toThrow(GitOperationError);
  });

  it('includes branch name in checkout error message', async () => {
    mockExec
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce(new Error('checkout failed'));

    const promise = createBranch('/tmp/repo', 'bad-branch');
    await expect(promise).rejects.toThrow('Failed to create branch bad-branch');
  });

  it('handles non-Error exceptions during checkout', async () => {
    mockExec
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce('string error');

    const promise = createBranch('/tmp/repo', 'bad-branch');
    await expect(promise).rejects.toThrow('Failed to create branch bad-branch: string error');
  });

  it('logs debug messages', async () => {
    await createBranch('/tmp/repo', 'feature-branch', 'main');

    expect(mockDebug).toHaveBeenCalledWith(
      expect.stringContaining('Creating/resetting branch: feature-branch')
    );
  });
});

describe('stageChanges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockResolvedValue(0);
  });

  it('adds all files', async () => {
    await stageChanges('/tmp/repo');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['add', '-A'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true })
    );
  });

  it('throws GitOperationError on failure', async () => {
    mockExec.mockRejectedValue(new Error('Failed to add'));

    const promise = stageChanges('/tmp/repo');
    await expect(promise).rejects.toThrow(GitOperationError);
    await expect(stageChanges('/tmp/repo')).rejects.toThrow('Failed to stage changes');
  });
});

describe('createCommit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockResolvedValue(0);
  });

  it('commits with provided message', async () => {
    await createCommit('/tmp/repo', 'chore: update version');

    expect(mockExec).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'chore: update version'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true })
    );
  });

  it('throws GitOperationError on failure', async () => {
    mockExec.mockRejectedValue(new Error('Nothing to commit'));

    const promise = createCommit('/tmp/repo', 'msg');
    await expect(promise).rejects.toThrow(GitOperationError);
    await expect(createCommit('/tmp/repo', 'msg')).rejects.toThrow('Failed to commit changes');
  });
});

describe('pushBranch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExecOutput.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
  });

  it('pushes with force-with-lease via getExecOutput', async () => {
    await pushBranch('/tmp/repo', 'my-branch');

    expect(mockGetExecOutput).toHaveBeenCalledWith(
      'git',
      ['push', '--force-with-lease', 'origin', 'my-branch'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true, ignoreReturnCode: true })
    );
  });

  it('does not retry on failure (retrying force-with-lease is unsafe)', async () => {
    mockGetExecOutput.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'remote: Permission denied',
    });

    await expect(pushBranch('/tmp/repo', 'my-branch')).rejects.toThrow(GitOperationError);
    expect(mockGetExecOutput).toHaveBeenCalledTimes(1);
  });

  it('throws GitOperationError on non-zero exit code', async () => {
    mockGetExecOutput.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'remote: Permission denied',
    });

    await expect(pushBranch('/tmp/repo', 'my-branch')).rejects.toThrow(GitOperationError);
  });

  it('includes git stderr in the error message', async () => {
    mockGetExecOutput.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: '! [rejected] my-branch -> my-branch (stale info)',
    });

    await expect(pushBranch('/tmp/repo', 'my-branch')).rejects.toThrow(/stale info/);
  });

  it('falls back to stdout when stderr is empty', async () => {
    mockGetExecOutput.mockResolvedValue({
      exitCode: 1,
      stdout: 'something happened on stdout',
      stderr: '',
    });

    await expect(pushBranch('/tmp/repo', 'my-branch')).rejects.toThrow(
      /something happened on stdout/
    );
  });

  it('falls back to exit code when both streams are empty', async () => {
    mockGetExecOutput.mockResolvedValue({ exitCode: 128, stdout: '', stderr: '' });

    await expect(pushBranch('/tmp/repo', 'my-branch')).rejects.toThrow(/exit code 128/);
  });

  it('throws GitOperationError when getExecOutput itself rejects', async () => {
    mockGetExecOutput.mockRejectedValue(new Error('spawn failed'));

    await expect(pushBranch('/tmp/repo', 'my-branch')).rejects.toThrow(GitOperationError);
  });
});

describe('commitAndPush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.mockResolvedValue(0);
    mockGetExecOutput.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
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

  it('pushes with force-with-lease (safe force push)', async () => {
    await commitAndPush('/tmp/repo', 'my-branch', 'test commit');

    expect(mockGetExecOutput).toHaveBeenCalledWith(
      'git',
      ['push', '--force-with-lease', 'origin', 'my-branch'],
      expect.objectContaining({ cwd: '/tmp/repo', silent: true, ignoreReturnCode: true })
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
    mockExec.mockResolvedValueOnce(0).mockRejectedValueOnce(new Error('Nothing to commit'));

    const promise = commitAndPush('/tmp/repo', 'branch', 'msg');
    await expect(promise).rejects.toThrow('Failed to commit changes');
  });

  it('throws GitOperationError on push failure', async () => {
    mockGetExecOutput.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'remote: Permission denied',
    });

    const promise = commitAndPush('/tmp/repo', 'branch', 'msg');
    await expect(promise).rejects.toThrow(GitOperationError);
  });

  it('includes branch name and git stderr in push error message', async () => {
    mockGetExecOutput.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'remote: Permission denied',
    });

    const promise = commitAndPush('/tmp/repo', 'branch', 'msg');
    await expect(promise).rejects.toThrow(/Failed to push to branch.*Permission denied/);
  });

  it('handles non-Error exceptions during commit', async () => {
    mockExec.mockResolvedValueOnce(0).mockRejectedValueOnce('string error');

    const promise = commitAndPush('/tmp/repo', 'branch', 'msg');
    await expect(promise).rejects.toThrow('Failed to commit changes: string error');
  });
});

describe('cleanupRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRm.mockResolvedValue(undefined);
  });

  it('removes the repository directory recursively', async () => {
    await cleanupRepository('/tmp/nixpkgs-updater-abc123');

    expect(mockRm).toHaveBeenCalledWith('/tmp/nixpkgs-updater-abc123', {
      recursive: true,
      force: true,
    });
  });

  it('logs debug message on cleanup', async () => {
    await cleanupRepository('/tmp/nixpkgs-updater-abc123');

    expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('Cleaning up repository'));
  });

  it('logs debug message on successful cleanup', async () => {
    await cleanupRepository('/tmp/nixpkgs-updater-abc123');

    expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('Successfully cleaned up'));
  });

  it('logs warning but does not throw on cleanup failure', async () => {
    mockRm.mockRejectedValue(new Error('Permission denied'));

    await cleanupRepository('/tmp/nixpkgs-updater-abc123');

    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('Failed to clean up'));
  });

  it('does nothing when repoPath is empty', async () => {
    await cleanupRepository('');

    expect(mockRm).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalledWith('No repository path provided for cleanup');
  });
});
