import * as exec from '@actions/exec';
import * as core from '@actions/core';

import { withRetry, isTransientError } from './utils.js';

/**
 * Type guard to validate if an object is a valid prefetch result with a hash field.
 *
 * @param obj - The object to validate
 * @returns True if the object has a valid hash field
 */
function isPrefetchResult(obj: unknown): obj is { hash: string } {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const record = obj as Record<string, unknown>;
  return typeof record.hash === 'string' && record.hash !== '';
}

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
  core.debug(`Fetching hash for ${owner}/${repo} at rev ${rev}`);

  // Install nix-prefetch-github and its dependency nix-prefetch-git
  // nix-prefetch-git is NOT part of base Nix - it's a separate package that nix-prefetch-github needs
  let installStderr = '';
  core.debug('Installing nix-prefetch-git and nix-prefetch-github');
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

  core.debug('Running nix-prefetch-github');

  const result = await withRetry(
    async () => {
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

      return stdout;
    },
    {
      maxAttempts: 3,
      operationName: 'nix-prefetch-github',
      shouldRetry: isTransientError,
    }
  );

  core.debug('Parsing nix-prefetch-github output');

  let parsed: unknown;
  try {
    parsed = JSON.parse(result);
  } catch {
    throw new Error(`Failed to parse nix-prefetch-github output: ${result}`);
  }

  // Validate the parsed object has required fields
  if (!isPrefetchResult(parsed)) {
    throw new Error(
      `nix-prefetch-github returned invalid output: expected object with non-empty "hash" string field`
    );
  }

  core.debug(`Successfully fetched hash: ${parsed.hash.substring(0, 20)}...`);

  return parsed.hash;
}
