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
export declare function cloneRepository(targetRepo: string, token: string): Promise<string>;
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
export declare function createBranch(repoPath: string, branchName: string): Promise<void>;
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
export declare function commitAndPush(repoPath: string, branchName: string, message: string): Promise<void>;
