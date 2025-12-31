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

  // Validate version is not empty
  if (version.trim() === '') {
    throw new InputValidationError('version must not be empty');
  }

  return {
    packageName,
    version,
    targetRepo,
    githubToken,
    targetOwner,
    targetRepoName,
  };
}
