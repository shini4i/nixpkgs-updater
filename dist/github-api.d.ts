import type { PRResult } from './types.js';
/**
 * Creates a new pull request or updates an existing one.
 *
 * @param targetRepo - Target repository in owner/repo format
 * @param token - GitHub token for authentication
 * @param branchName - Branch name for the PR
 * @param packageName - Name of the package being updated
 * @param version - New version of the package
 * @returns Result containing PR URL, number, and whether it was created
 * @throws GitHubAPIError if PR creation/update fails
 *
 * @example
 * const result = await createOrUpdatePR(
 *   'shini4i/nixpkgs',
 *   'ghp_token',
 *   'chore/my-package-v1.0.0',
 *   'my-package',
 *   '1.0.0'
 * );
 */
export declare function createOrUpdatePR(targetRepo: string, token: string, branchName: string, packageName: string, version: string): Promise<PRResult>;
