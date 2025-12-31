/**
 * Strips 'v' or 'V' prefix from version string if present.
 *
 * @param version - The version string to process
 * @returns The version string without the 'v' prefix
 *
 * @example
 * stripVersionPrefix('v0.1.1') // returns '0.1.1'
 * stripVersionPrefix('0.1.1')  // returns '0.1.1'
 */
export function stripVersionPrefix(version: string): string {
  return version.replace(/^[vV]/, '');
}

/**
 * Formats a branch name from package name.
 * Sanitizes special characters to create a valid git branch name.
 * The branch name is version-independent so that subsequent version updates
 * will update the existing PR instead of creating a new one.
 *
 * @param packageName - The name of the package
 * @returns A formatted branch name in the format 'chore/<package>'
 *
 * @example
 * formatBranchName('my-package') // returns 'chore/my-package'
 */
export function formatBranchName(packageName: string): string {
  // Sanitize package name: allow alphanumeric, dash, underscore
  const sanitizedPkg = packageName.replace(/[^a-zA-Z0-9_-]/g, '-');

  return `chore/${sanitizedPkg}`;
}
