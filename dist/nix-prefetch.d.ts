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
export declare function fetchHash(owner: string, repo: string, rev: string): Promise<string>;
