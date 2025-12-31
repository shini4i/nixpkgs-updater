import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';

import { parseInputs } from './inputs.js';
import { cloneRepository, createBranch, commitAndPush } from './git-operations.js';
import { parseNixFile, updateNixFile } from './nix-file-parser.js';
import { fetchHash } from './nix-prefetch.js';
import { createOrUpdatePR } from './github-api.js';
import { stripVersionPrefix, formatBranchName } from './version-utils.js';
import {
  NixpkgsUpdaterError,
  NixPrefetchError,
  NixFileParseError,
  GitOperationError,
  GitHubAPIError,
  InputValidationError,
} from './errors.js';

/**
 * Main entry point for the nixpkgs-updater action.
 * Orchestrates the entire update workflow.
 */
async function run(): Promise<void> {
  try {
    // Step 1: Parse and validate inputs
    const inputs = parseInputs();
    core.info(`Updating package: ${inputs.packageName} to version ${inputs.version}`);

    // Step 2: Clone target repository
    core.info(`Cloning repository: ${inputs.targetRepo}`);
    const repoPath = await cloneRepository(inputs.targetRepo, inputs.githubToken);
    core.info(`Repository cloned to: ${repoPath}`);

    // Step 3: Read and parse the Nix file
    const nixFilePath = path.join(repoPath, 'pkgs', inputs.packageName, 'default.nix');
    core.info(`Reading Nix file: ${nixFilePath}`);

    let nixContent: string;
    try {
      nixContent = await fs.readFile(nixFilePath, 'utf-8');
    } catch (error) {
      throw new NixFileParseError(
        `Failed to read Nix file at ${nixFilePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const nixData = parseNixFile(nixContent);
    core.info(`Current version: ${nixData.version}, rev: ${nixData.rev}`);

    if (nixData.revUsesVersion) {
      core.info('Detected rev uses ${version} interpolation - will skip rev update');
    }
    if (nixData.hasVendorHash) {
      core.info('Detected vendorHash (buildGoModule) - manual update may be required');
    }

    // Step 4: Fetch new hash using nix-prefetch-github
    core.info(`Fetching hash for ${nixData.owner}/${nixData.repo} at ${inputs.version}`);
    let newHash: string;
    try {
      newHash = await fetchHash(nixData.owner, nixData.repo, inputs.version);
    } catch (error) {
      throw new NixPrefetchError(
        `Failed to fetch hash: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    core.info(`New hash: ${newHash}`);

    // Step 5: Update the Nix file
    const cleanVersion = stripVersionPrefix(inputs.version);
    const updatedContent = updateNixFile(
      nixContent,
      {
        version: cleanVersion,
        rev: inputs.version, // Keep original (with or without v)
        hash: newHash,
      },
      { skipRevUpdate: nixData.revUsesVersion }
    );

    await fs.writeFile(nixFilePath, updatedContent);
    core.info(`Updated Nix file with version ${cleanVersion}`);

    // Step 6: Create branch, commit, and push
    const branchName = formatBranchName(inputs.packageName);
    core.info(`Creating branch: ${branchName}`);
    await createBranch(repoPath, branchName);

    // Build commit message based on what was updated
    const commitChanges = [`- Updated version to ${cleanVersion}`];
    if (!nixData.revUsesVersion) {
      commitChanges.push(`- Updated rev to ${inputs.version}`);
    }
    commitChanges.push('- Updated hash');

    const commitMessage = `chore(${inputs.packageName}): bump version to ${cleanVersion}

${commitChanges.join('\n')}`;

    await commitAndPush(repoPath, branchName, commitMessage);
    core.info(`Changes pushed to branch: ${branchName}`);

    // Step 7: Create or update PR
    core.info('Creating/updating pull request...');
    const pr = await createOrUpdatePR(
      inputs.targetRepo,
      inputs.githubToken,
      branchName,
      inputs.packageName,
      cleanVersion,
      {
        hasVendorHash: nixData.hasVendorHash,
        revUsesVersion: nixData.revUsesVersion,
      }
    );

    // Set outputs
    core.setOutput('pr-url', pr.url);
    core.setOutput('pr-number', pr.number);
    core.setOutput('branch-name', branchName);

    if (pr.created) {
      core.info(`Successfully created PR: ${pr.url}`);
    } else {
      core.info(`Successfully updated PR: ${pr.url}`);
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * Handles errors and sets appropriate failure messages.
 *
 * @param error - The error to handle
 */
function handleError(error: unknown): void {
  if (error instanceof InputValidationError) {
    core.setFailed(`Input validation error: ${error.message}`);
  } else if (error instanceof NixPrefetchError) {
    core.setFailed(
      `Nix prefetch failed: ${error.message}. Ensure Nix is installed (use cachix/install-nix-action).`
    );
  } else if (error instanceof NixFileParseError) {
    core.setFailed(`Failed to parse Nix file: ${error.message}. Check file format.`);
  } else if (error instanceof GitOperationError) {
    core.setFailed(`Git operation failed: ${error.message}`);
  } else if (error instanceof GitHubAPIError) {
    core.setFailed(`GitHub API error: ${error.message}. Check token permissions.`);
  } else if (error instanceof NixpkgsUpdaterError) {
    core.setFailed(`Error: ${error.message}`);
  } else if (error instanceof Error) {
    core.setFailed(`Unexpected error: ${error.message}`);
  } else {
    core.setFailed('An unexpected error occurred');
  }
}

// Run the action
void run();
