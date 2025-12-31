/**
 * Base error class for nixpkgs-updater action errors.
 */
export class NixpkgsUpdaterError extends Error {
  /**
   * Creates a new NixpkgsUpdaterError.
   *
   * @param message - Error message
   * @param code - Error code for categorization
   */
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'NixpkgsUpdaterError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when nix-prefetch-github fails.
 */
export class NixPrefetchError extends NixpkgsUpdaterError {
  constructor(message: string) {
    super(message, 'NIX_PREFETCH_ERROR');
    this.name = 'NixPrefetchError';
  }
}

/**
 * Error thrown when parsing a Nix file fails.
 */
export class NixFileParseError extends NixpkgsUpdaterError {
  constructor(message: string) {
    super(message, 'NIX_FILE_PARSE_ERROR');
    this.name = 'NixFileParseError';
  }
}

/**
 * Error thrown when a Git operation fails.
 */
export class GitOperationError extends NixpkgsUpdaterError {
  constructor(message: string) {
    super(message, 'GIT_OPERATION_ERROR');
    this.name = 'GitOperationError';
  }
}

/**
 * Error thrown when a GitHub API operation fails.
 */
export class GitHubAPIError extends NixpkgsUpdaterError {
  constructor(message: string) {
    super(message, 'GITHUB_API_ERROR');
    this.name = 'GitHubAPIError';
  }
}

/**
 * Error thrown when input validation fails.
 */
export class InputValidationError extends NixpkgsUpdaterError {
  constructor(message: string) {
    super(message, 'INPUT_VALIDATION_ERROR');
    this.name = 'InputValidationError';
  }
}
