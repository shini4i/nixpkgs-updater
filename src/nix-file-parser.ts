import type { NixFileData, NixUpdateData } from './types.js';

/**
 * Regular expression patterns for extracting data from Nix files.
 * Supports both legacy `sha256` and modern `hash` (SRI format) fields.
 * Uses word boundaries to avoid matching similar fields like outputHash, cargoHash, etc.
 */
const PATTERNS = {
  owner: /\bowner\s*=\s*"([^"]+)"/,
  repo: /\brepo\s*=\s*"([^"]+)"/,
  version: /\bversion\s*=\s*"([^"]+)"/,
  rev: /\brev\s*=\s*"([^"]+)"/,
  // Match only standalone 'hash' or 'sha256' field names (not outputHash, cargoHash, etc.)
  hash: /\b(hash|sha256)\s*=\s*"([^"]+)"/,
  // Detect vendorHash presence (buildGoModule) - excludes comments by matching from line start
  vendorHash: /^[^#\n]*\bvendorHash\s*=/m,
} as const;

/**
 * Validates a GitHub owner/username format.
 * GitHub usernames: 1-39 characters, alphanumeric or hyphens, cannot start/end with hyphen.
 *
 * @param owner - The owner string to validate
 * @throws Error if the owner format is invalid
 */
function validateGitHubOwner(owner: string): void {
  // GitHub username rules: alphanumeric and hyphens, 1-39 chars, no leading/trailing hyphens
  const ownerPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
  if (!ownerPattern.test(owner)) {
    throw new Error(
      `Invalid GitHub owner format: "${owner}". Must be 1-39 alphanumeric characters or hyphens, cannot start/end with hyphen.`
    );
  }
}

/**
 * Validates a GitHub repository name format.
 * GitHub repos: alphanumeric, hyphens, underscores, periods; cannot end with .git.
 *
 * @param repo - The repository name to validate
 * @throws Error if the repository format is invalid
 */
function validateGitHubRepo(repo: string): void {
  // GitHub repo rules: alphanumeric, hyphens, underscores, periods; 1-100 chars; no .git suffix
  const repoPattern = /^[a-zA-Z0-9._-]+$/;
  if (!repoPattern.test(repo) || repo.endsWith('.git') || repo.length > 100) {
    throw new Error(
      `Invalid GitHub repository format: "${repo}". Must contain only alphanumeric characters, hyphens, underscores, or periods. Cannot end with .git.`
    );
  }
}

/**
 * Extracts a value from Nix file content using a regex pattern.
 *
 * @param content - The Nix file content
 * @param pattern - The regex pattern to match
 * @param name - The name of the field (for error messages)
 * @param groupIndex - The capture group index to extract (default: 1)
 * @returns The extracted value
 * @throws Error if the pattern is not found
 */
function extractValue(content: string, pattern: RegExp, name: string, groupIndex = 1): string {
  const match = content.match(pattern);
  if (match?.[groupIndex] === undefined) {
    throw new Error(`Could not find ${name} in Nix file`);
  }
  return match[groupIndex];
}

/**
 * Parses a Nix package file and extracts relevant data.
 *
 * @param content - The content of the Nix file
 * @returns The extracted data from the Nix file
 * @throws Error if required fields are missing
 *
 * @example
 * const data = parseNixFile(fs.readFileSync('default.nix', 'utf-8'));
 * console.log(data.owner, data.repo, data.version);
 */
export function parseNixFile(content: string): NixFileData {
  const owner = extractValue(content, PATTERNS.owner, 'owner');
  const repo = extractValue(content, PATTERNS.repo, 'repo');

  // Validate owner and repo to prevent command injection or unexpected repository access
  validateGitHubOwner(owner);
  validateGitHubRepo(repo);

  const rev = extractValue(content, PATTERNS.rev, 'rev');

  // Detect if rev uses ${version} interpolation (e.g., "v${version}")
  const revUsesVersion = rev.includes('${version}');

  // Detect if file contains vendorHash (buildGoModule packages)
  const hasVendorHash = PATTERNS.vendorHash.test(content);

  return {
    owner,
    repo,
    version: extractValue(content, PATTERNS.version, 'version'),
    rev,
    // Hash pattern has 2 groups: (1) field name, (2) value - we want the value
    hash: extractValue(content, PATTERNS.hash, 'hash or sha256', 2),
    revUsesVersion,
    hasVendorHash,
  };
}

/**
 * Options for updating a Nix file.
 */
export interface UpdateOptions {
  /** Skip updating the rev field (when rev uses ${version} interpolation) */
  skipRevUpdate?: boolean;
}

/**
 * Updates a Nix package file with new version, rev, and hash values.
 * Automatically detects whether the file uses `hash` (SRI format) or legacy `sha256`.
 *
 * @param content - The original content of the Nix file
 * @param updates - The new values to apply
 * @param options - Optional settings for the update
 * @returns The updated Nix file content
 *
 * @example
 * const updated = updateNixFile(originalContent, {
 *   version: '1.0.0',
 *   rev: 'v1.0.0',
 *   hash: 'sha256-...',
 * });
 *
 * @example
 * // Skip rev update when rev uses ${version}
 * const updated = updateNixFile(content, updates, { skipRevUpdate: true });
 */
export function updateNixFile(
  content: string,
  updates: NixUpdateData,
  options: UpdateOptions = {}
): string {
  let updated = content;

  // Update version field (word boundary to avoid matching e.g. nixVersion)
  updated = updated.replace(/(\bversion\s*=\s*)"[^"]+"/, `$1"${updates.version}"`);

  // Update rev field (word boundary to avoid matching e.g. prevRev)
  // Skip if rev uses ${version} interpolation - it will auto-update with version
  if (options.skipRevUpdate !== true) {
    updated = updated.replace(/(\brev\s*=\s*)"[^"]+"/, `$1"${updates.rev}"`);
  }

  // Update hash field - use word boundary to avoid matching outputHash, cargoHash, etc.
  // Try 'hash' first (modern SRI format), then fall back to 'sha256' (legacy)
  if (/\bhash\s*=\s*"[^"]+"/.test(updated)) {
    updated = updated.replace(/(\bhash\s*=\s*)"[^"]+"/, `$1"${updates.hash}"`);
  } else {
    updated = updated.replace(/(\bsha256\s*=\s*)"[^"]+"/, `$1"${updates.hash}"`);
  }

  return updated;
}
