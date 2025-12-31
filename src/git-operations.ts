import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

import { GitOperationError } from './errors.js';

/**
 * Generates a unique temporary directory path.
 *
 * @returns A unique temporary directory path
 */
function getTempDir(): string {
  const uniqueId = crypto.randomBytes(8).toString('hex');
  return path.join(os.tmpdir(), `nixpkgs-updater-${uniqueId}`);
}

/**
 * Clones a GitHub repository to a temporary directory.
 *
 * @param targetRepo - Repository in owner/repo format
 * @param token - GitHub token for authentication
 * @returns Path to the cloned repository
 * @throws GitOperationError if cloning fails
 *
 * @example
 * const repoPath = await cloneRepository('owner/repo', 'ghp_token');
 */
export async function cloneRepository(targetRepo: string, token: string): Promise<string> {
  // Mask the token to prevent it from appearing in logs
  core.setSecret(token);

  const tempDir = getTempDir();
  await io.mkdirP(tempDir);

  const cloneUrl = `https://x-access-token:${token}@github.com/${targetRepo}.git`;

  try {
    await exec.exec('git', ['clone', '--depth', '1', cloneUrl, tempDir], {
      silent: true,
    });
  } catch (error) {
    throw new GitOperationError(
      `Failed to clone repository ${targetRepo}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Configure git user
  await exec.exec('git', ['config', 'user.name', 'github-actions[bot]'], {
    cwd: tempDir,
    silent: true,
  });
  await exec.exec('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com'], {
    cwd: tempDir,
    silent: true,
  });

  return tempDir;
}

/**
 * Creates or checks out a branch in the repository.
 * If the branch exists remotely, it will be checked out.
 * Otherwise, a new branch will be created.
 *
 * @param repoPath - Path to the repository
 * @param branchName - Name of the branch to create or checkout
 * @throws GitOperationError if branch operations fail
 *
 * @example
 * await createBranch('/tmp/repo', 'chore/update-package-v1.0.0');
 */
export async function createBranch(repoPath: string, branchName: string): Promise<void> {
  // Fetch to check if branch exists remotely
  await exec.exec('git', ['fetch', 'origin', branchName], {
    cwd: repoPath,
    ignoreReturnCode: true, // Branch may not exist
    silent: true,
  });

  // Try to checkout existing branch
  const checkoutResult = await exec.exec('git', ['checkout', branchName], {
    cwd: repoPath,
    ignoreReturnCode: true,
    silent: true,
  });

  if (checkoutResult !== 0) {
    // Branch doesn't exist, create it
    try {
      await exec.exec('git', ['checkout', '-b', branchName], {
        cwd: repoPath,
        silent: true,
      });
    } catch (error) {
      throw new GitOperationError(
        `Failed to create branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    // Branch exists, reset to origin/main to ensure we have the latest
    await exec.exec('git', ['reset', '--hard', 'origin/main'], {
      cwd: repoPath,
      ignoreReturnCode: true,
      silent: true,
    });
  }
}

/**
 * Commits changes and pushes to the remote repository.
 *
 * @param repoPath - Path to the repository
 * @param branchName - Name of the branch to push
 * @param message - Commit message
 * @throws GitOperationError if commit or push fails
 *
 * @example
 * await commitAndPush('/tmp/repo', 'chore/update', 'chore(package): bump version');
 */
export async function commitAndPush(
  repoPath: string,
  branchName: string,
  message: string
): Promise<void> {
  try {
    await exec.exec('git', ['add', '-A'], {
      cwd: repoPath,
      silent: true,
    });

    await exec.exec('git', ['commit', '-m', message], {
      cwd: repoPath,
      silent: true,
    });
  } catch (error) {
    throw new GitOperationError(
      `Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    // Force push to update existing branch
    await exec.exec('git', ['push', '--force', 'origin', branchName], {
      cwd: repoPath,
      silent: true,
    });
  } catch (error) {
    throw new GitOperationError(
      `Failed to push to ${branchName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
