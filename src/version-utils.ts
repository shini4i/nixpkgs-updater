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
 * Formats a branch name from package name and version.
 * Sanitizes special characters to create a valid git branch name.
 *
 * @param packageName - The name of the package
 * @param version - The version string (with or without 'v' prefix)
 * @returns A formatted branch name in the format 'chore/<package>-<version>'
 *
 * @example
 * formatBranchName('my-package', 'v0.1.1') // returns 'chore/my-package-v0.1.1'
 */
export function formatBranchName(packageName: string, version: string): string {
  // Sanitize package name: allow alphanumeric, dash, underscore
  const sanitizedPkg = packageName.replace(/[^a-zA-Z0-9_-]/g, '-');

  // Sanitize version: allow alphanumeric, dash, dot
  const sanitizedVersion = version.replace(/[^a-zA-Z0-9.-]/g, '-');

  return `chore/${sanitizedPkg}-${sanitizedVersion}`;
}
