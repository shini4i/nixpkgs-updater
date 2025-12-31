import type { NixFileData, NixUpdateData } from './types.js';
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
export declare function parseNixFile(content: string): NixFileData;
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
export declare function updateNixFile(content: string, updates: NixUpdateData): string;
