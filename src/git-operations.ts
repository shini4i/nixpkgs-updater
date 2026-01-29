import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

import { GitOperationError } from './errors.js';
import { withRetry, isTransientError } from './utils.js';

/** Git bot user configuration. */
const GIT_BOT_USER = {
  name: 'github-actions[bot]',
  email: 'github-actions[bot]@users.noreply.github.com',
} as const;

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

  core.debug(`Cloning repository ${targetRepo} to ${tempDir}`);

  try {
    await withRetry(
      async () => {
        await exec.exec('git', ['clone', '--depth', '1', cloneUrl, tempDir], {
          silent: true,
        });
      },
      {
        maxAttempts: 3,
        operationName: 'git clone',
        shouldRetry: isTransientError,
      }
    );
  } catch (error) {
    throw new GitOperationError(
      `Failed to clone repository ${targetRepo}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  core.debug(`Configuring git user: ${GIT_BOT_USER.name}`);

  // Configure git user
  await exec.exec('git', ['config', 'user.name', GIT_BOT_USER.name], {
    cwd: tempDir,
    silent: true,
  });
  await exec.exec('git', ['config', 'user.email', GIT_BOT_USER.email], {
    cwd: tempDir,
    silent: true,
  });

  return tempDir;
}

/**
 * Creates or checks out a branch in the repository.
 * If the branch exists remotely, it will be checked out and reset to the base branch.
 * Otherwise, a new branch will be created.
 *
 * @param repoPath - Path to the repository
 * @param branchName - Name of the branch to create or checkout
 * @param baseBranch - Base branch to reset to if branch exists (default: 'main')
 * @throws GitOperationError if branch operations fail
 *
 * @example
 * await createBranch('/tmp/repo', 'chore/update-package-v1.0.0', 'main');
 */
export async function createBranch(
  repoPath: string,
  branchName: string,
  baseBranch = 'main'
): Promise<void> {
  core.debug(`Creating/checking out branch: ${branchName} (base: ${baseBranch})`);

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
    core.debug(`Branch ${branchName} does not exist, creating new branch`);
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
    // Branch exists, reset to base branch to ensure we have the latest
    core.debug(`Branch ${branchName} exists, resetting to origin/${baseBranch}`);
    await exec.exec('git', ['reset', '--hard', `origin/${baseBranch}`], {
      cwd: repoPath,
      ignoreReturnCode: true,
      silent: true,
    });
  }
}

/**
 * Stages all changes in the repository.
 *
 * @param repoPath - Path to the repository
 * @throws GitOperationError if staging fails
 */
export async function stageChanges(repoPath: string): Promise<void> {
  core.debug('Staging all changes');
  try {
    await exec.exec('git', ['add', '-A'], {
      cwd: repoPath,
      silent: true,
    });
  } catch (error) {
    throw new GitOperationError(
      `Failed to stage changes: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Creates a commit with the given message.
 *
 * @param repoPath - Path to the repository
 * @param message - Commit message
 * @throws GitOperationError if commit fails
 */
export async function createCommit(repoPath: string, message: string): Promise<void> {
  core.debug(`Creating commit: ${message.split('\n')[0] ?? 'empty message'}`);
  try {
    await exec.exec('git', ['commit', '-m', message], {
      cwd: repoPath,
      silent: true,
    });
  } catch (error) {
    throw new GitOperationError(
      `Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Pushes a branch to the remote repository with force-with-lease.
 *
 * @param repoPath - Path to the repository
 * @param branchName - Name of the branch to push
 * @throws GitOperationError if push fails
 */
export async function pushBranch(repoPath: string, branchName: string): Promise<void> {
  core.debug(`Pushing branch ${branchName} with force-with-lease`);
  try {
    await withRetry(
      async () => {
        await exec.exec('git', ['push', '--force-with-lease', 'origin', branchName], {
          cwd: repoPath,
          silent: true,
        });
      },
      {
        maxAttempts: 3,
        operationName: 'git push',
        shouldRetry: isTransientError,
      }
    );
  } catch (error) {
    throw new GitOperationError(
      `Failed to push to ${branchName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Commits changes and pushes to the remote repository.
 * Uses force-with-lease to safely update existing branches.
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
  await stageChanges(repoPath);
  await createCommit(repoPath, message);
  await pushBranch(repoPath, branchName);
}

/**
 * Cleans up a cloned repository by removing the temporary directory.
 *
 * @param repoPath - Path to the repository to clean up
 *
 * @example
 * await cleanupRepository('/tmp/nixpkgs-updater-abc123');
 */
export async function cleanupRepository(repoPath: string): Promise<void> {
  if (!repoPath) {
    core.debug('No repository path provided for cleanup');
    return;
  }

  core.debug(`Cleaning up repository at ${repoPath}`);

  try {
    await fs.rm(repoPath, { recursive: true, force: true });
    core.debug(`Successfully cleaned up ${repoPath}`);
  } catch (error) {
    // Log warning but don't fail the action
    core.warning(
      `Failed to clean up temporary directory ${repoPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
