/**
 * Parameter Validation Helpers
 * Thin wrapper around @gatrix/shared collectValidationErrors.
 * Throws GatrixSDKError with INVALID_PARAMETERS code on validation failure.
 */

import { collectValidationErrors, ValidationRule } from '@gatrix/shared';
import { GatrixSDKError, ErrorCode } from './errors';

// Re-export ValidationRule type from shared for convenience
export type { ValidationRule } from '@gatrix/shared';

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
  const errors = collectValidationErrors(rules);
  if (errors.length > 0) {
    throw new GatrixSDKError(
      ErrorCode.INVALID_PARAMETERS,
      `Invalid parameters: ${errors.join('; ')}`
    );
  }
}
