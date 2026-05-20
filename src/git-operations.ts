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
 * Creates or resets a local branch to the tip of the base branch.
 *
 * Uses `git checkout -B <branch> origin/<baseBranch>`, which creates the
 * branch if it doesn't exist or resets it to `origin/<baseBranch>` if it does.
 * The remote branch (if any) is fetched first so the lease check in a later
 * force-push has an up-to-date remote-tracking ref to compare against, but its
 * commits are never merged into the local branch — important for shallow
 * clones, where the remote branch's history may have no common ancestor with
 * the locally available base.
 *
 * @param repoPath - Path to the repository
 * @param branchName - Name of the branch to create or reset
 * @param baseBranch - Base branch to branch off of (default: 'main')
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
  core.debug(`Creating/resetting branch: ${branchName} (base: ${baseBranch})`);

  // Ensure origin/<baseBranch> exists as a remote-tracking ref. A --depth 1
  // clone is implicitly --single-branch and only fetches the default branch,
  // so non-default base branches must be fetched explicitly. Using a full
  // refspec ensures the remote-tracking ref is created, not just FETCH_HEAD.
  try {
    await exec.exec(
      'git',
      ['fetch', '--depth', '1', 'origin', `${baseBranch}:refs/remotes/origin/${baseBranch}`],
      {
        cwd: repoPath,
        silent: true,
      }
    );
  } catch (error) {
    throw new GitOperationError(
      `Failed to fetch base branch ${baseBranch}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Fetch the remote update branch (if any) so --force-with-lease has a
  // current remote-tracking ref to compare against. The full refspec ensures
  // origin/<branchName> is created/updated even in a --single-branch clone
  // where the configured fetch refspec only covers the default branch;
  // without it, a bare `git fetch origin <branch>` updates FETCH_HEAD only,
  // leaving the lease check with stale/missing info and causing the push to
  // be rejected with "stale info". Allowed to fail when the branch doesn't
  // exist remotely yet (first run for this package).
  await exec.exec(
    'git',
    ['fetch', '--depth', '1', 'origin', `${branchName}:refs/remotes/origin/${branchName}`],
    {
      cwd: repoPath,
      ignoreReturnCode: true,
      silent: true,
    }
  );

  // Create or reset the local branch off the base branch tip. This avoids
  // pulling in the remote branch's divergent history, which in a shallow
  // clone has no common ancestor with the locally available base.
  try {
    await exec.exec('git', ['checkout', '-B', branchName, `origin/${baseBranch}`], {
      cwd: repoPath,
      silent: true,
    });
  } catch (error) {
    throw new GitOperationError(
      `Failed to create branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`
    );
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
 * Captures git's stderr so failures surface the real reason (permissions,
 * branch protection, etc.) instead of a bare exit code.
 *
 * @param repoPath - Path to the repository
 * @param branchName - Name of the branch to push
 * @throws GitOperationError if push fails
 */
export async function pushBranch(repoPath: string, branchName: string): Promise<void> {
  core.debug(`Pushing branch ${branchName} with force-with-lease`);
  let result;
  try {
    result = await exec.getExecOutput('git', ['push', '--force-with-lease', 'origin', branchName], {
      cwd: repoPath,
      silent: true,
      ignoreReturnCode: true,
    });
  } catch (error) {
    throw new GitOperationError(
      `Failed to push to ${branchName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (result.exitCode !== 0) {
    const detail =
      result.stderr.trim() || result.stdout.trim() || `exit code ${String(result.exitCode)}`;
    throw new GitOperationError(`Failed to push to ${branchName}: ${detail}`);
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
