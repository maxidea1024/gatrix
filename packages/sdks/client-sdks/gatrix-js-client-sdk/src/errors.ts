/**
 * Error types for Gatrix Feature SDK
 */

/**
 * Error codes for GatrixFeatureError
 */
export enum GatrixFeatureErrorCode {
  /** Flag not found in cache */
  FLAG_NOT_FOUND = 'FLAG_NOT_FOUND',
  /** Flag is disabled */
  FLAG_DISABLED = 'FLAG_DISABLED',
  /** Variant type mismatch */
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  /** No value available */
  NO_VALUE = 'NO_VALUE',
  /** No data available (offline mode without cache/bootstrap) */
  NO_DATA_AVAILABLE = 'NO_DATA_AVAILABLE',
  /** Network error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Invalid configuration */
  INVALID_CONFIG = 'INVALID_CONFIG',
  /** Parse error (JSON parsing failed) */
  PARSE_ERROR = 'PARSE_ERROR',
}

/**
 * Base error class for all Gatrix SDK errors
 */
export class GatrixError extends Error {
  constructor(message: string, options?: { cause?: Error }) {
    super(message);
    this.name = 'GatrixError';

    // Set cause manually for compatibility with ES2021 and below
    if (options?.cause) {
      (this as any).cause = options.cause;
    }

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GatrixError);
    }
  }
}

/**
 * Custom error class for Gatrix Feature SDK
 */
export class GatrixFeatureError extends GatrixError {
  readonly code: GatrixFeatureErrorCode;
  readonly flagName?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: GatrixFeatureErrorCode,
    message: string,
    options?: {
      flagName?: string;
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);

    this.name = 'GatrixFeatureError';
    this.code = code;
    this.flagName = options?.flagName;
    this.details = options?.details;

    // Set cause manually for compatibility with ES2021 and below
    if (options?.cause) {
      (this as any).cause = options.cause;
    }

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GatrixFeatureError);
    }
  }

  /**
   * Create a flag not found error
   */
  static flagNotFound(flagName: string): GatrixFeatureError {
    return new GatrixFeatureError(
      GatrixFeatureErrorCode.FLAG_NOT_FOUND,
      `Flag "${flagName}" not found`,
      { flagName }
    );
  }

  /**
   * Create a flag disabled error
   */
  static flagDisabled(flagName: string): GatrixFeatureError {
    return new GatrixFeatureError(
      GatrixFeatureErrorCode.FLAG_DISABLED,
      `Flag "${flagName}" is disabled`,
      { flagName }
    );
  }

  /**
   * Create a type mismatch error
   */
  static typeMismatch(flagName: string, expected: string, actual: string): GatrixFeatureError {
    return new GatrixFeatureError(
      GatrixFeatureErrorCode.TYPE_MISMATCH,
      `Flag "${flagName}" type mismatch: expected ${expected}, got ${actual}`,
      { flagName, details: { expected, actual } }
    );
  }

  /**
   * Create a no data available error
   */
  static noDataAvailable(): GatrixFeatureError {
    return new GatrixFeatureError(
      GatrixFeatureErrorCode.NO_DATA_AVAILABLE,
      'No flag data available (offline mode requires bootstrap or cached data)'
    );
  }

  /**
   * Create a no value error
   */
  static noValue(flagName: string): GatrixFeatureError {
    return new GatrixFeatureError(
      GatrixFeatureErrorCode.NO_VALUE,
      `Flag "${flagName}" has no value`,
      { flagName }
    );
  }

  /**
   * Create a parse error
   */
  static parseError(flagName: string, cause?: Error): GatrixFeatureError {
    return new GatrixFeatureError(
      GatrixFeatureErrorCode.PARSE_ERROR,
      `Failed to parse value for flag "${flagName}"`,
      { flagName, cause }
    );
  }
}
