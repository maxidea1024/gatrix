/**
 * Custom Error Classes
 */

export enum ErrorCode {
  INVALID_CONFIG = "INVALID_CONFIG",
  AUTH_FAILED = "AUTH_FAILED",
  API_ERROR = "API_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  CACHE_ERROR = "CACHE_ERROR",
  QUEUE_ERROR = "QUEUE_ERROR",
  SERVICE_DISCOVERY_ERROR = "SERVICE_DISCOVERY_ERROR",
  NOT_INITIALIZED = "NOT_INITIALIZED",
  COUPON_ERROR = "COUPON_ERROR",
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
}

/**
 * Feature flag specific error codes
 */
export enum FeatureFlagErrorCode {
  FLAG_NOT_FOUND = "FLAG_NOT_FOUND",
  FLAG_DISABLED = "FLAG_DISABLED",
  NO_PAYLOAD = "NO_PAYLOAD",
  INVALID_PAYLOAD_TYPE = "INVALID_PAYLOAD_TYPE",
}

/**
 * Coupon-specific error codes
 * These codes match backend CouponErrorCode for easy identification
 */
export enum CouponRedeemErrorCode {
  // Validation errors (400)
  INVALID_PARAMETERS = "COUPON_INVALID_PARAMETERS",

  // Not found errors (404)
  CODE_NOT_FOUND = "COUPON_CODE_NOT_FOUND",

  // Conflict errors (409)
  ALREADY_USED = "COUPON_ALREADY_USED",
  USER_LIMIT_EXCEEDED = "COUPON_USER_LIMIT_EXCEEDED",

  // Unprocessable errors (422)
  NOT_ACTIVE = "COUPON_NOT_ACTIVE",
  NOT_STARTED = "COUPON_NOT_STARTED",
  EXPIRED = "COUPON_EXPIRED",
  INVALID_WORLD = "COUPON_INVALID_WORLD",
  INVALID_PLATFORM = "COUPON_INVALID_PLATFORM",
  INVALID_CHANNEL = "COUPON_INVALID_CHANNEL",
  INVALID_SUBCHANNEL = "COUPON_INVALID_SUBCHANNEL",
  INVALID_USER = "COUPON_INVALID_USER",
}

export class GatrixSDKError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode?: number;
  public readonly details?: any;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode?: number,
    details?: any,
  ) {
    super(message);
    this.name = "GatrixSDKError";
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
 * Coupon-specific error class for easy error handling
 */
export class CouponRedeemError extends Error {
  public readonly code: CouponRedeemErrorCode;
  public readonly statusCode: number;

  constructor(
    code: CouponRedeemErrorCode,
    message: string,
    statusCode: number,
  ) {
    super(message);
    this.name = "CouponRedeemError";
    this.code = code;
    this.statusCode = statusCode;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CouponRedeemError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Feature flag specific error class
 * Thrown by strict variation methods (*OrThrow)
 */
export class FeatureFlagError extends Error {
  public readonly code: FeatureFlagErrorCode;
  public readonly flagName: string;
  public readonly environment?: string;

  constructor(
    code: FeatureFlagErrorCode,
    message: string,
    flagName: string,
    environment?: string,
  ) {
    super(message);
    this.name = "FeatureFlagError";
    this.code = code;
    this.flagName = flagName;
    this.environment = environment;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FeatureFlagError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      flagName: this.flagName,
      environment: this.environment,
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
  details?: any,
): GatrixSDKError {
  return new GatrixSDKError(code, message, statusCode, details);
}

/**
 * Check if error is a GatrixSDKError
 */
export function isGatrixSDKError(error: any): error is GatrixSDKError {
  return error instanceof GatrixSDKError;
}

/**
 * Check if error is a CouponRedeemError
 */
export function isCouponRedeemError(error: any): error is CouponRedeemError {
  return error instanceof CouponRedeemError;
}

/**
 * Check if error is a FeatureFlagError
 */
export function isFeatureFlagError(error: any): error is FeatureFlagError {
  return error instanceof FeatureFlagError;
}
