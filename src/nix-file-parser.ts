import type { NixFileData, NixUpdateData } from './types.js';

/**
 * Regular expression patterns for extracting data from Nix files.
 */
const PATTERNS = {
  owner: /owner\s*=\s*"([^"]+)"/,
  repo: /repo\s*=\s*"([^"]+)"/,
  version: /version\s*=\s*"([^"]+)"/,
  rev: /rev\s*=\s*"([^"]+)"/,
  sha256: /sha256\s*=\s*"([^"]+)"/,
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
 * @returns The extracted value
 * @throws Error if the pattern is not found
 */
function extractValue(content: string, pattern: RegExp, name: string): string {
  const match = content.match(pattern);
  if (match?.[1] === undefined) {
    throw new Error(`Could not find ${name} in Nix file`);
  }
  return match[1];
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

  return {
    owner,
    repo,
    version: extractValue(content, PATTERNS.version, 'version'),
    rev: extractValue(content, PATTERNS.rev, 'rev'),
    sha256: extractValue(content, PATTERNS.sha256, 'sha256'),
  };
}

/**
 * Updates a Nix package file with new version, rev, and sha256 values.
 *
 * @param content - The original content of the Nix file
 * @param updates - The new values to apply
 * @returns The updated Nix file content
 *
 * @example
 * const updated = updateNixFile(originalContent, {
 *   version: '1.0.0',
 *   rev: 'v1.0.0',
 *   sha256: 'sha256-...',
 * });
 */
export function updateNixFile(content: string, updates: NixUpdateData): string {
  let updated = content;

  // Update version field
  updated = updated.replace(/(version\s*=\s*)"[^"]+"/, `$1"${updates.version}"`);

  // Update rev field
  updated = updated.replace(/(rev\s*=\s*)"[^"]+"/, `$1"${updates.rev}"`);

  // Update sha256 field
  updated = updated.replace(/(sha256\s*=\s*)"[^"]+"/, `$1"${updates.sha256}"`);

  return updated;
}
