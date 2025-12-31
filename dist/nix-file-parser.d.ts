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
export declare function updateNixFile(content: string, updates: NixUpdateData, options?: UpdateOptions): string;
