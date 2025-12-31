import type { PRResult } from './types.js';
/**
 * Options for PR creation.
 */
export interface PROptions {
    /** Whether the package has a vendorHash field (buildGoModule) */
    hasVendorHash?: boolean;
    /** Whether rev uses ${version} interpolation */
    revUsesVersion?: boolean;
}
/**
 * Creates a new pull request or updates an existing one.
 *
 * @param targetRepo - Target repository in owner/repo format
 * @param token - GitHub token for authentication
 * @param branchName - Branch name for the PR
 * @param packageName - Name of the package being updated
 * @param version - New version of the package
 * @param options - Optional PR settings
 * @returns Result containing PR URL, number, and whether it was created
 * @throws GitHubAPIError if PR creation/update fails
 *
 * @example
 * const result = await createOrUpdatePR(
 *   'shini4i/nixpkgs',
 *   'ghp_token',
 *   'chore/my-package',
 *   'my-package',
 *   '1.0.0'
 * );
 */
export declare function createOrUpdatePR(targetRepo: string, token: string, branchName: string, packageName: string, version: string, options?: PROptions): Promise<PRResult>;
