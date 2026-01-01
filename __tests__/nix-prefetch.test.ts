import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type * as execModule from '@actions/exec';

// Mock @actions/exec before importing the module under test
const mockExec = jest.fn<typeof execModule.exec>();

jest.unstable_mockModule('@actions/exec', () => ({
  exec: mockExec,
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

    mockExec.mockImplementation((_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from(mockOutput));
      return Promise.resolve(0);
    });

    const hash = await fetchHash('shini4i', 'test-repo', 'v0.1.0');
    expect(hash).toBe('sha256-TESTHASH123456789=');
  });

  it('calls nix run with nix-prefetch-github', async () => {
    const mockOutput = JSON.stringify({
      owner: 'owner',
      repo: 'repo',
      rev: 'v1.0.0',
      hash: 'sha256-HASH=',
    });

    mockExec.mockImplementation((_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from(mockOutput));
      return Promise.resolve(0);
    });

    await fetchHash('owner', 'repo', 'v1.0.0');

    expect(mockExec).toHaveBeenCalledWith(
      'nix',
      ['shell', 'nixpkgs#nix-prefetch-github', '-c', 'nix-prefetch-github', 'owner', 'repo', '--rev', 'v1.0.0'],
      expect.objectContaining({
        ignoreReturnCode: true,
      })
    );
  });

  it('throws error on non-zero exit code', async () => {
    mockExec.mockImplementation((_cmd, _args, options) => {
      options?.listeners?.stderr?.(Buffer.from('Error: tag not found'));
      return Promise.resolve(1);
    });

    await expect(fetchHash('owner', 'repo', 'invalid-tag')).rejects.toThrow(
      'nix-prefetch-github failed with exit code 1'
    );
  });

  it('throws error on invalid JSON output', async () => {
    mockExec.mockImplementation((_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from('not valid json'));
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

    mockExec.mockImplementation((_cmd, _args, options) => {
      options?.listeners?.stdout?.(Buffer.from(mockOutput));
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
});
