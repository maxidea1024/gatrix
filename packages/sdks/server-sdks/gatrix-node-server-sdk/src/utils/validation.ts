/**
 * Parameter Validation Helpers
 * Used by service methods to validate required parameters from user input.
 * Use validateAll() for aggregated validation — all errors are collected
 * and thrown together so users can fix all issues in one pass.
 */

import { GatrixSDKError, ErrorCode } from './errors';

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
 * Validate multiple parameters at once and throw a single aggregated error.
 * Collects all validation failures and reports them together, so users can
 * fix all issues in one pass instead of discovering them one at a time.
 *
 * @param rules Array of validation rules to check
 * @throws {GatrixSDKError} with INVALID_PARAMETERS code listing all failures
 *
 * @example
 * validateAll([
 *   { param: 'request', value: request, type: 'required' },
 *   { param: 'request.code', value: request?.code, type: 'string' },
 *   { param: 'request.userId', value: request?.userId, type: 'string' },
 * ]);
 */
export function validateAll(rules: ValidationRule[]): void {
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

  if (errors.length > 0) {
    throw new GatrixSDKError(
      ErrorCode.INVALID_PARAMETERS,
      `Invalid parameters: ${errors.join('; ')}`
    );
  }
}
