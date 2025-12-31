/**
 * Base error class for nixpkgs-updater action errors.
 */
export declare class NixpkgsUpdaterError extends Error {
    readonly code: string;
    /**
     * Creates a new NixpkgsUpdaterError.
     *
     * @param message - Error message
     * @param code - Error code for categorization
     */
    constructor(message: string, code: string);
}
/**
 * Error thrown when nix-prefetch-github fails.
 */
export declare class NixPrefetchError extends NixpkgsUpdaterError {
    constructor(message: string);
}
/**
 * Error thrown when parsing a Nix file fails.
 */
export declare class NixFileParseError extends NixpkgsUpdaterError {
    constructor(message: string);
}
/**
 * Error thrown when a Git operation fails.
 */
export declare class GitOperationError extends NixpkgsUpdaterError {
    constructor(message: string);
}
/**
 * Error thrown when a GitHub API operation fails.
 */
export declare class GitHubAPIError extends NixpkgsUpdaterError {
    constructor(message: string);
}
/**
 * Error thrown when input validation fails.
 */
export declare class InputValidationError extends NixpkgsUpdaterError {
    constructor(message: string);
}
