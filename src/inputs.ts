import * as core from '@actions/core';

import type { ActionInputs } from './types.js';
import { InputValidationError } from './errors.js';

/**
 * Parses and validates action input parameters.
 *
 * @returns Validated action inputs
 * @throws InputValidationError if inputs are invalid
 *
 * @example
 * const inputs = parseInputs();
 * console.log(inputs.packageName, inputs.version);
 */
export function parseInputs(): ActionInputs {
  const packageName = core.getInput('package-name', { required: true });
  const version = core.getInput('version', { required: true });
  const targetRepo = core.getInput('target-repo', { required: true });
  const githubToken = core.getInput('github-token', { required: true });
  const baseBranch = core.getInput('base-branch') || 'main';

  // Validate target-repo format
  const parts = targetRepo.split('/');
  if (parts.length !== 2) {
    throw new InputValidationError(
      `Invalid target-repo format: ${targetRepo}. Expected owner/repo`
    );
  }

  const [targetOwner, targetRepoName] = parts;

  if (
    targetOwner === undefined ||
    targetOwner === '' ||
    targetRepoName === undefined ||
    targetRepoName === ''
  ) {
    throw new InputValidationError(
      `Invalid target-repo format: ${targetRepo}. Owner and repo must not be empty`
    );
  }

  // Validate package-name (no path traversal)
  if (packageName.includes('/') || packageName.includes('..')) {
    throw new InputValidationError(
      `Invalid package-name: ${packageName}. Must not contain path separators`
    );
  }

  // Validate package-name is not empty
  if (packageName.trim() === '') {
    throw new InputValidationError('package-name must not be empty');
  }

  // Validate package-name format (alphanumeric, dots, hyphens, underscores)
  // This prevents shell/Nix injection when package-name is used in commands or PR body
  const packageNamePattern = /^[a-zA-Z0-9._-]+$/;
  if (!packageNamePattern.test(packageName)) {
    throw new InputValidationError(
      `Invalid package-name format: "${packageName}". Must contain only alphanumeric characters, dots, hyphens, or underscores.`
    );
  }

  // Validate version is not empty
  if (version.trim() === '') {
    throw new InputValidationError('version must not be empty');
  }

  // Validate version format (alphanumeric, dots, hyphens, underscores, plus signs)
  // This prevents Nix string evaluation injection when version is interpolated in Nix expressions
  const versionPattern = /^[a-zA-Z0-9._+-]+$/;
  if (!versionPattern.test(version)) {
    throw new InputValidationError(
      `Invalid version format: "${version}". Must contain only alphanumeric characters, dots, hyphens, underscores, or plus signs.`
    );
  }

  // Validate base-branch format following git ref naming rules
  // First check for valid characters (alphanumeric, dots, hyphens, underscores, slashes)
  const branchCharPattern = /^[a-zA-Z0-9._\-/]+$/;
  if (!branchCharPattern.test(baseBranch)) {
    throw new InputValidationError(
      `Invalid base-branch format: "${baseBranch}". Must contain only alphanumeric characters, dots, hyphens, underscores, or slashes.`
    );
  }

  // Additional git ref validations per git-check-ref-format rules
  if (
    baseBranch.includes('..') ||
    baseBranch.includes('//') ||
    baseBranch.startsWith('.') ||
    baseBranch.startsWith('/') ||
    baseBranch.startsWith('-') ||
    baseBranch.endsWith('.') ||
    baseBranch.endsWith('/') ||
    baseBranch.includes('@{') ||
    baseBranch.endsWith('.lock') ||
    baseBranch.includes('/.') ||
    baseBranch.includes('.lock/')
  ) {
    throw new InputValidationError(
      `Invalid base-branch format: "${baseBranch}". Branch names must not contain "..", "//", "@{", must not start with "-", must not start or end with "." or "/", and must not end with ".lock". Path components cannot start with "." or end with ".lock".`
    );
  }

  return {
    packageName,
    version,
    targetRepo,
    githubToken,
    baseBranch,
  };
}
