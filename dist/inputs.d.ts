import type { ActionInputs } from './types.js';
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
export declare function parseInputs(): ActionInputs;
