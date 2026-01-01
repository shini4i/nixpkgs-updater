import * as exec from '@actions/exec';

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
  // First, ensure nix-prefetch-github is installed
  // This adds it to PATH so it can find other Nix tools (nix-prefetch-git, nix-build, etc.)
  await exec.exec('nix', ['profile', 'install', 'nixpkgs#nix-prefetch-github'], {
    ignoreReturnCode: true, // May already be installed
  });

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
      .filter(
        (line) =>
          line.includes('error') ||
          line.includes('Error') ||
          line.includes('failed') ||
          line.includes('Unable')
      )
      .slice(-5)
      .join('\n');
    const errorMessage = errorLines || stderrLines.slice(-10).join('\n');
    throw new Error(`nix-prefetch-github failed with exit code ${String(exitCode)}: ${errorMessage}`);
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
