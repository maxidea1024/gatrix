/**
 * Config Validation - Validates SDK configuration options
 * Ensures required fields are present and optional fields have valid values/ranges.
 */
import { GatrixClientConfig } from './types';
import { GatrixError } from './errors';

/**
 * Validate SDK configuration.
 * Throws GatrixError on invalid config.
 */
export function validateConfig(config: GatrixClientConfig): void {
  // Required string fields
  validateRequiredString(config.apiUrl, 'apiUrl');
  validateRequiredString(config.apiToken, 'apiToken');
  validateRequiredString(config.appName, 'appName');
  validateRequiredString(config.environment, 'environment');

  // apiUrl format
  if (config.apiUrl && !isValidUrl(config.apiUrl)) {
    throw new GatrixError(
      `Invalid apiUrl: "${config.apiUrl}". Must be a valid URL (e.g., https://api.example.com/api/v1)`
    );
  }

  // Features config
  const feat = config.features;
  if (feat) {
    // refreshInterval: positive number, in seconds
    if (feat.refreshInterval !== undefined) {
      validatePositiveNumber(feat.refreshInterval, 'features.refreshInterval', 1, 86400);
    }

    // metricsInterval: positive number, in seconds
    if (feat.metricsInterval !== undefined) {
      validatePositiveNumber(feat.metricsInterval, 'features.metricsInterval', 1, 86400);
    }

    // metricsIntervalInitial: non-negative number, in seconds
    if (feat.metricsIntervalInitial !== undefined) {
      validatePositiveNumber(
        feat.metricsIntervalInitial,
        'features.metricsIntervalInitial',
        0,
        3600
      );
    }

    // cacheTtlSeconds: non-negative number
    if (feat.cacheTtlSeconds !== undefined) {
      validatePositiveNumber(feat.cacheTtlSeconds, 'features.cacheTtlSeconds', 0, 2592000); // max 30 days
    }

    // fetchRetryOptions
    if (feat.fetchRetryOptions) {
      const retry = feat.fetchRetryOptions;

      if (retry.limit !== undefined) {
        validatePositiveInteger(retry.limit, 'features.fetchRetryOptions.limit', 0, 10);
      }

      if (retry.backoffLimit !== undefined) {
        validatePositiveNumber(
          retry.backoffLimit,
          'features.fetchRetryOptions.backoffLimit',
          0,
          300000
        );
      }

      if (retry.timeout !== undefined) {
        validatePositiveNumber(retry.timeout, 'features.fetchRetryOptions.timeout', 1000, 120000);
      }

      if (retry.initialBackoffMs !== undefined) {
        validatePositiveNumber(
          retry.initialBackoffMs,
          'features.fetchRetryOptions.initialBackoffMs',
          100,
          60000
        );
      }

      if (retry.maxBackoffMs !== undefined) {
        validatePositiveNumber(
          retry.maxBackoffMs,
          'features.fetchRetryOptions.maxBackoffMs',
          1000,
          600000
        );
      }

      if (
        retry.initialBackoffMs !== undefined &&
        retry.maxBackoffMs !== undefined &&
        retry.initialBackoffMs > retry.maxBackoffMs
      ) {
        throw new GatrixError(
          `Invalid config: fetchRetryOptions.initialBackoffMs (${retry.initialBackoffMs}) must be <= maxBackoffMs (${retry.maxBackoffMs})`
        );
      }

      if (retry.nonRetryableStatusCodes) {
        if (!Array.isArray(retry.nonRetryableStatusCodes)) {
          throw new GatrixError(
            'Invalid config: fetchRetryOptions.nonRetryableStatusCodes must be an array'
          );
        }
        for (const code of retry.nonRetryableStatusCodes) {
          if (!Number.isInteger(code) || code < 400 || code > 599) {
            throw new GatrixError(
              `Invalid config: fetchRetryOptions.nonRetryableStatusCodes contains invalid status code: ${code} (must be 400-599)`
            );
          }
        }
      }
    }
  }

  // cacheKeyPrefix: string, no special chars
  if (config.cacheKeyPrefix !== undefined) {
    if (typeof config.cacheKeyPrefix !== 'string') {
      throw new GatrixError('Invalid config: cacheKeyPrefix must be a string');
    }
    if (config.cacheKeyPrefix.length > 100) {
      throw new GatrixError('Invalid config: cacheKeyPrefix must be <= 100 characters');
    }
  }

  // customHeaders: must be Record<string, string>
  if (config.customHeaders !== undefined) {
    if (typeof config.customHeaders !== 'object' || config.customHeaders === null) {
      throw new GatrixError('Invalid config: customHeaders must be an object');
    }
    for (const [key, value] of Object.entries(config.customHeaders)) {
      if (typeof value !== 'string') {
        throw new GatrixError(
          `Invalid config: customHeaders["${key}"] must be a string, got ${typeof value}`
        );
      }
    }
  }
}

// ==================== Helper Functions ====================

function validateRequiredString(value: unknown, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new GatrixError(`${fieldName} is required`);
  }
  if (typeof value !== 'string') {
    throw new GatrixError(`${fieldName} must be a string, got ${typeof value}`);
  }
  if (value.trim() !== value) {
    throw new GatrixError(`${fieldName} must not have leading or trailing whitespace`);
  }
}

function validatePositiveNumber(value: unknown, fieldName: string, min: number, max: number): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new GatrixError(`Invalid config: ${fieldName} must be a number, got ${typeof value}`);
  }
  if (value < min || value > max) {
    throw new GatrixError(
      `Invalid config: ${fieldName} must be between ${min} and ${max}, got ${value}`
    );
  }
}

function validatePositiveInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): void {
  validatePositiveNumber(value, fieldName, min, max);
  if (!Number.isInteger(value)) {
    throw new GatrixError(`Invalid config: ${fieldName} must be an integer, got ${value}`);
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
