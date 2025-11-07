/**
 * Custom Error Classes
 */

export enum ErrorCode {
  INVALID_CONFIG = 'INVALID_CONFIG',
  AUTH_FAILED = 'AUTH_FAILED',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',
  SERVICE_DISCOVERY_ERROR = 'SERVICE_DISCOVERY_ERROR',
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  COUPON_ERROR = 'COUPON_ERROR',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
}

export class GatrixSDKError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode?: number;
  public readonly details?: any;

  constructor(code: ErrorCode, message: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'GatrixSDKError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GatrixSDKError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Helper function to create SDK errors
 */
export function createError(
  code: ErrorCode,
  message: string,
  statusCode?: number,
  details?: any
): GatrixSDKError {
  return new GatrixSDKError(code, message, statusCode, details);
}

/**
 * Check if error is a GatrixSDKError
 */
export function isGatrixSDKError(error: any): error is GatrixSDKError {
  return error instanceof GatrixSDKError;
}

