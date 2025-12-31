/**
 * Data extracted from a Nix package file.
 */
export interface NixFileData {
  /** GitHub owner/organization */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** Package version */
  version: string;
  /** Git reference (tag, branch, or commit) */
  rev: string;
  /** SHA256 hash of the source archive */
  sha256: string;
}

/**
 * Data for updating a Nix package file.
 */
export interface NixUpdateData {
  /** New package version */
  version: string;
  /** New git reference */
  rev: string;
  /** New SHA256 hash */
  sha256: string;
}

/**
 * Action input parameters.
 */
export interface ActionInputs {
  /** Name of the package directory in pkgs/<package-name> */
  packageName: string;
  /** New version to update to */
  version: string;
  /** Target nixpkgs repository in owner/repo format */
  targetRepo: string;
  /** GitHub token with push access */
  githubToken: string;
  /** Parsed target repository owner */
  targetOwner: string;
  /** Parsed target repository name */
  targetRepoName: string;
}

/**
 * Result of nix-prefetch-github command.
 */
export interface PrefetchResult {
  /** GitHub owner */
  owner: string;
  /** GitHub repository */
  repo: string;
  /** Git reference */
  rev: string;
  /** SHA256 hash in SRI format */
  hash: string;
}

/**
 * Result of PR creation or update.
 */
export interface PRResult {
  /** URL of the pull request */
  url: string;
  /** PR number */
  number: number;
  /** Whether the PR was created (true) or updated (false) */
  created: boolean;
}
