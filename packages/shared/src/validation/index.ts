/**
 * Parameter Validation Utilities
 *
 * Shared validation logic used by both server and client SDKs.
 * This module provides error collection only (no throw) — each SDK wraps
 * this with its own error type (GatrixSDKError, GatrixFeatureError, etc.).
 */

/**
 * Validation rule definition for aggregated validation.
 * Each rule specifies a parameter name, its value, and the validation type.
 */
export interface ValidationRule {
  param: string;
  value: unknown;
  type: 'required' | 'string' | 'number' | 'boolean' | 'array';
}

/**
 * Collect validation errors from a set of rules without throwing.
 * Returns an array of error messages. Empty array means all rules passed.
 *
 * Each SDK should wrap this with its own error type:
 * @example
 * // In server SDK:
 * export function validateAll(rules: ValidationRule[]): void {
 *   const errors = collectValidationErrors(rules);
 *   if (errors.length > 0) {
 *     throw new GatrixSDKError(ErrorCode.INVALID_PARAMETERS, `Invalid parameters: ${errors.join('; ')}`);
 *   }
 * }
 *
 * @param rules Array of validation rules to check
 * @returns Array of error message strings (empty if all valid)
 */
export function collectValidationErrors(rules: ValidationRule[]): string[] {
  const errors: string[] = [];

  for (const rule of rules) {
    const { param, value, type } = rule;

    if (type === 'required') {
      if (value === null || value === undefined) {
        errors.push(`'${param}' is required`);
      }
    } else if (type === 'string') {
      if (value === null || value === undefined) {
        errors.push(`'${param}' is required`);
      } else if (typeof value !== 'string') {
        errors.push(`'${param}' must be a string`);
      } else if (value.trim().length === 0) {
        errors.push(`'${param}' must not be empty`);
      }
    } else if (type === 'array') {
      if (value === null || value === undefined) {
        errors.push(`'${param}' is required`);
      } else if (!Array.isArray(value)) {
        errors.push(`'${param}' must be an array`);
      } else if (value.length === 0) {
        errors.push(`'${param}' must not be empty`);
      }
    } else if (type === 'number') {
      if (value === null || value === undefined) {
        errors.push(`'${param}' is required`);
      } else if (typeof value !== 'number' || Number.isNaN(value)) {
        errors.push(`'${param}' must be a valid number`);
      }
    } else if (type === 'boolean') {
      if (value === null || value === undefined) {
        errors.push(`'${param}' is required`);
      } else if (typeof value !== 'boolean') {
        errors.push(`'${param}' must be a boolean`);
      }
    }
  }

  return errors;
}
