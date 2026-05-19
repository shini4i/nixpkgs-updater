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
export declare function createBranch(repoPath: string, branchName: string, baseBranch?: string): Promise<void>;
/**
 * Stages all changes in the repository.
 *
 * @param repoPath - Path to the repository
 * @throws GitOperationError if staging fails
 */
export declare function stageChanges(repoPath: string): Promise<void>;
/**
 * Creates a commit with the given message.
 *
 * @param repoPath - Path to the repository
 * @param message - Commit message
 * @throws GitOperationError if commit fails
 */
export declare function createCommit(repoPath: string, message: string): Promise<void>;
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
export declare function pushBranch(repoPath: string, branchName: string): Promise<void>;
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
export declare function commitAndPush(repoPath: string, branchName: string, message: string): Promise<void>;
/**
 * Cleans up a cloned repository by removing the temporary directory.
 *
 * @param repoPath - Path to the repository to clean up
 *
 * @example
 * await cleanupRepository('/tmp/nixpkgs-updater-abc123');
 */
export declare function cleanupRepository(repoPath: string): Promise<void>;
