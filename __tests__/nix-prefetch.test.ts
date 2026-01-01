import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type * as execModule from '@actions/exec';

// Mock @actions/exec before importing the module under test
const mockExec = jest.fn<typeof execModule.exec>();
const mockWarning = jest.fn();

jest.unstable_mockModule('@actions/exec', () => ({
  exec: mockExec,
}));

jest.unstable_mockModule('@actions/core', () => ({
  warning: mockWarning,
}));

// Import after mocking
const { fetchHash } = await import('../src/nix-prefetch.js');

describe('fetchHash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns hash from nix-prefetch-github output', async () => {
    const mockOutput = JSON.stringify({
      owner: 'shini4i',
      repo: 'test-repo',
      rev: 'abc123',
      hash: 'sha256-TESTHASH123456789=',
    });

    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from(mockOutput));
      }
      return Promise.resolve(0);
    });

    const hash = await fetchHash('shini4i', 'test-repo', 'v0.1.0');
    expect(hash).toBe('sha256-TESTHASH123456789=');
  });

  it('installs and calls nix-prefetch-github', async () => {
    const mockOutput = JSON.stringify({
      owner: 'owner',
      repo: 'repo',
      rev: 'v1.0.0',
      hash: 'sha256-HASH=',
    });

    mockExec.mockImplementation((cmd, _args, options) => {
      // Only output JSON for the actual nix-prefetch-github call
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from(mockOutput));
      }
      return Promise.resolve(0);
    });

    await fetchHash('owner', 'repo', 'v1.0.0');

    // Should first install nix-prefetch-git and nix-prefetch-github
    expect(mockExec).toHaveBeenCalledWith(
      'nix',
      ['profile', 'add', 'nixpkgs#nix-prefetch-git', 'nixpkgs#nix-prefetch-github'],
      expect.objectContaining({
        ignoreReturnCode: true,
      })
    );

    // Then call nix-prefetch-github directly
    expect(mockExec).toHaveBeenCalledWith(
      'nix-prefetch-github',
      ['owner', 'repo', '--rev', 'v1.0.0'],
      expect.objectContaining({
        ignoreReturnCode: true,
      })
    );
  });

  it('throws error on non-zero exit code', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stderr?.(Buffer.from('Error: tag not found'));
        return Promise.resolve(1);
      }
      return Promise.resolve(0); // install succeeds
    });

    await expect(fetchHash('owner', 'repo', 'invalid-tag')).rejects.toThrow(
      'nix-prefetch-github failed with exit code 1'
    );
  });

  it('throws error on invalid JSON output', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from('not valid json'));
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow(
      'Failed to parse nix-prefetch-github output'
    );
  });

  it('throws error when hash is missing from output', async () => {
    const mockOutput = JSON.stringify({
      owner: 'owner',
      repo: 'repo',
      rev: 'v1.0.0',
      // hash is missing
    });

    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from(mockOutput));
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow(
      'nix-prefetch-github did not return a hash'
    );
  });

  it('handles empty stdout', async () => {
    mockExec.mockImplementation(() => {
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow(
      'Failed to parse nix-prefetch-github output'
    );
  });

  it('extracts error lines containing "error" from stderr', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stderr?.(
          Buffer.from('download progress...\nerror: tag not found\nmore output')
        );
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow('error: tag not found');
  });

  it('extracts error lines containing "Error" from stderr', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stderr?.(Buffer.from('progress...\nError: Something went wrong\nend'));
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow(
      'Error: Something went wrong'
    );
  });

  it('extracts error lines containing "failed" from stderr', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stderr?.(Buffer.from('starting...\nOperation failed\ndone'));
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow('Operation failed');
  });

  it('extracts error lines containing "Unable" from stderr', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stderr?.(Buffer.from('info...\nUnable to find revision\nfinished'));
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow('Unable to find revision');
  });

  it('falls back to last 10 lines when no error keywords found', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stderr?.(Buffer.from('line1\nline2\nline3'));
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow('line1\nline2\nline3');
  });

  it('throws error when hash is empty string', async () => {
    const mockOutput = JSON.stringify({
      owner: 'owner',
      repo: 'repo',
      rev: 'v1.0.0',
      hash: '',
    });

    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from(mockOutput));
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow(
      'nix-prefetch-github did not return a hash'
    );
  });

  it('throws error when hash is not a string', async () => {
    const mockOutput = JSON.stringify({
      owner: 'owner',
      repo: 'repo',
      rev: 'v1.0.0',
      hash: 123,
    });

    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from(mockOutput));
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow(
      'nix-prefetch-github did not return a hash'
    );
  });

  it('throws error when parsed output is null', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from('null'));
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow(
      'nix-prefetch-github did not return a hash'
    );
  });

  it('throws error when parsed output is not an object', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from('"just a string"'));
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow(
      'nix-prefetch-github did not return a hash'
    );
  });

  it('logs warning when installation fails with non-already-installed error', async () => {
    const mockOutput = JSON.stringify({
      owner: 'owner',
      repo: 'repo',
      rev: 'v1.0.0',
      hash: 'sha256-HASH=',
    });

    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix') {
        options?.listeners?.stderr?.(Buffer.from('network error: connection refused'));
        return Promise.resolve(1);
      }
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from(mockOutput));
      }
      return Promise.resolve(0);
    });

    await fetchHash('owner', 'repo', 'v1.0.0');

    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('nix profile add reported issues')
    );
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('network error'));
  });

  it('does not log warning when installation fails with already-installed error', async () => {
    const mockOutput = JSON.stringify({
      owner: 'owner',
      repo: 'repo',
      rev: 'v1.0.0',
      hash: 'sha256-HASH=',
    });

    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix') {
        options?.listeners?.stderr?.(Buffer.from('error: package already installed'));
        return Promise.resolve(1);
      }
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from(mockOutput));
      }
      return Promise.resolve(0);
    });

    await fetchHash('owner', 'repo', 'v1.0.0');

    expect(mockWarning).not.toHaveBeenCalled();
  });

  it('does not log warning for Already installed (case-insensitive)', async () => {
    const mockOutput = JSON.stringify({
      owner: 'owner',
      repo: 'repo',
      rev: 'v1.0.0',
      hash: 'sha256-HASH=',
    });

    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix') {
        options?.listeners?.stderr?.(Buffer.from('error: flake is Already Installed'));
        return Promise.resolve(1);
      }
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from(mockOutput));
      }
      return Promise.resolve(0);
    });

    await fetchHash('owner', 'repo', 'v1.0.0');

    expect(mockWarning).not.toHaveBeenCalled();
  });

  it('logs warning with "(no output)" when installation fails with empty stderr', async () => {
    const mockOutput = JSON.stringify({
      owner: 'owner',
      repo: 'repo',
      rev: 'v1.0.0',
      hash: 'sha256-HASH=',
    });

    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix') {
        return Promise.resolve(1); // Fail without stderr
      }
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from(mockOutput));
      }
      return Promise.resolve(0);
    });

    await fetchHash('owner', 'repo', 'v1.0.0');

    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('(no output)'));
  });

  it('does not log warning when installation succeeds', async () => {
    const mockOutput = JSON.stringify({
      owner: 'owner',
      repo: 'repo',
      rev: 'v1.0.0',
      hash: 'sha256-HASH=',
    });

    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stdout?.(Buffer.from(mockOutput));
      }
      return Promise.resolve(0);
    });

    await fetchHash('owner', 'repo', 'v1.0.0');

    expect(mockWarning).not.toHaveBeenCalled();
  });

  it('extracts error lines with uppercase ERROR (case-insensitive)', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stderr?.(Buffer.from('progress...\nERROR: SOMETHING BROKE\nend'));
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow('ERROR: SOMETHING BROKE');
  });

  it('extracts error lines with uppercase FAILED (case-insensitive)', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stderr?.(Buffer.from('starting...\nOPERATION FAILED\ndone'));
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow('OPERATION FAILED');
  });

  it('extracts error lines with uppercase UNABLE (case-insensitive)', async () => {
    mockExec.mockImplementation((cmd, _args, options) => {
      if (cmd === 'nix-prefetch-github') {
        options?.listeners?.stderr?.(Buffer.from('info...\nUNABLE TO CONNECT\nfinished'));
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });

    await expect(fetchHash('owner', 'repo', 'v1.0.0')).rejects.toThrow('UNABLE TO CONNECT');
  });
});
