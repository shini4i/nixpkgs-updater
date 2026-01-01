import * as exec from '@actions/exec';
import * as core from '@actions/core';

import type { PrefetchResult } from './types.js';

/**
 * Fetches the SHA256 hash of a GitHub repository at a specific revision
 * using nix-prefetch-github.
 *
 * @param owner - GitHub repository owner
 * @param repo - GitHub repository name
 * @param rev - Git reference (tag, branch, or commit)
 * @returns The SHA256 hash in SRI format (sha256-XXXX)
 * @throws Error if nix-prefetch-github fails or returns invalid output
 *
 * @example
 * const hash = await fetchHash('shini4i', 'my-package', 'v1.0.0');
 * console.log(hash); // 'sha256-abc123...'
 */
export async function fetchHash(owner: string, repo: string, rev: string): Promise<string> {
  // Install nix-prefetch-github and its dependency nix-prefetch-git
  // nix-prefetch-git is NOT part of base Nix - it's a separate package that nix-prefetch-github needs
  let installStderr = '';
  const installExitCode = await exec.exec(
    'nix',
    ['profile', 'add', 'nixpkgs#nix-prefetch-git', 'nixpkgs#nix-prefetch-github'],
    {
      ignoreReturnCode: true, // May already be installed
      listeners: {
        stderr: (data: Buffer) => {
          installStderr += data.toString();
        },
      },
    }
  );

  // Log installation issues for debugging (already-installed warnings are expected)
  if (installExitCode !== 0 && !/already.?installed/i.test(installStderr)) {
    const stderrMessage = installStderr.trim() || '(no output)';
    core.warning(
      `nix profile add reported issues (exit code ${String(installExitCode)}): ${stderrMessage}`
    );
  }

  let stdout = '';
  let stderr = '';

  const options: exec.ExecOptions = {
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      },
    },
    ignoreReturnCode: true,
  };

  const exitCode = await exec.exec('nix-prefetch-github', [owner, repo, '--rev', rev], options);

  if (exitCode !== 0) {
    // Extract the last meaningful lines from stderr (skip download progress)
    const stderrLines = stderr.split('\n');
    const errorLines = stderrLines
      .filter((line) => /error|failed|unable/i.test(line))
      .slice(-5)
      .join('\n');
    const errorMessage = errorLines || stderrLines.slice(-10).join('\n');
    throw new Error(
      `nix-prefetch-github failed with exit code ${String(exitCode)}: ${errorMessage}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`Failed to parse nix-prefetch-github output: ${stdout}`);
  }

  // Validate the parsed object has required fields
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('hash' in parsed) ||
    typeof (parsed as Record<string, unknown>).hash !== 'string' ||
    (parsed as Record<string, unknown>).hash === ''
  ) {
    throw new Error('nix-prefetch-github did not return a hash');
  }

  return (parsed as PrefetchResult).hash;
}
