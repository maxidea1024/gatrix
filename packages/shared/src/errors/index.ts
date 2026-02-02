/**
 * Standardized Error Codes for Gatrix API
 *
 * These codes are used across backend and frontend for consistent error handling.
 * Backend sends: { success: false, error: { code: ErrorCodes.XXX, message: '...' } }
 * Frontend can use these codes for conditional error handling.
 */
export const ErrorCodes = {
  // General errors
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  RESOURCE_LOCKED: "RESOURCE_LOCKED",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",

  // Change Request errors
  CR_NOT_FOUND: "CR_NOT_FOUND",
  CR_INVALID_STATUS: "CR_INVALID_STATUS",
  CR_ALREADY_APPROVED: "CR_ALREADY_APPROVED",
  CR_SELF_APPROVAL_NOT_ALLOWED: "CR_SELF_APPROVAL_NOT_ALLOWED",
  CR_INSUFFICIENT_PERMISSIONS: "CR_INSUFFICIENT_PERMISSIONS",
  CR_EXECUTION_FAILED: "CR_EXECUTION_FAILED",
  CR_DATA_CONFLICT: "CR_DATA_CONFLICT",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Authentication & Authorization
  AUTH_TOKEN_REQUIRED: "AUTH_TOKEN_REQUIRED",
  AUTH_TOKEN_MISSING: "AUTH_TOKEN_MISSING",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_PERMISSION_DENIED: "AUTH_PERMISSION_DENIED",
  AUTH_INSUFFICIENT_PERMISSIONS: "AUTH_INSUFFICIENT_PERMISSIONS",

  // User-related errors
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS",
  USER_SUSPENDED: "USER_SUSPENDED",
  USER_DELETED: "USER_DELETED",

  // Environment-related errors
  ENV_NOT_FOUND: "ENV_NOT_FOUND",
  ENV_INVALID: "ENV_INVALID",
  ENV_ACCESS_DENIED: "ENV_ACCESS_DENIED",
  ENV_REQUIRED: "ENV_REQUIRED",

  // Resource CRUD errors
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  RESOURCE_CREATE_FAILED: "RESOURCE_CREATE_FAILED",
  RESOURCE_UPDATE_FAILED: "RESOURCE_UPDATE_FAILED",
  RESOURCE_DELETE_FAILED: "RESOURCE_DELETE_FAILED",
  RESOURCE_FETCH_FAILED: "RESOURCE_FETCH_FAILED",

  // API Token errors
  API_TOKEN_NOT_FOUND: "API_TOKEN_NOT_FOUND",
  API_TOKEN_GENERATION_FAILED: "API_TOKEN_GENERATION_FAILED",
  API_TOKEN_REVOKED: "API_TOKEN_REVOKED",

  // Mail errors
  MAIL_NOT_FOUND: "MAIL_NOT_FOUND",
  MAIL_SEND_FAILED: "MAIL_SEND_FAILED",
  MAIL_ALREADY_SENT: "MAIL_ALREADY_SENT",

  // Survey errors
  SURVEY_NOT_FOUND: "SURVEY_NOT_FOUND",
  SURVEY_ALREADY_EXISTS: "SURVEY_ALREADY_EXISTS",

  // Coupon errors
  COUPON_NOT_FOUND: "COUPON_NOT_FOUND",
  COUPON_ALREADY_EXISTS: "COUPON_ALREADY_EXISTS",
  COUPON_EXPIRED: "COUPON_EXPIRED",
  COUPON_LIMIT_REACHED: "COUPON_LIMIT_REACHED",

  // Chat/Channel errors
  CHANNEL_NOT_FOUND: "CHANNEL_NOT_FOUND",
  CHANNEL_MEMBER_EXISTS: "CHANNEL_MEMBER_EXISTS",
  ALREADY_MEMBER: "ALREADY_MEMBER",
  INVITATION_PENDING: "INVITATION_PENDING",
  ALREADY_INVITED: "ALREADY_INVITED",

  // Client Version errors
  CLIENT_VERSION_NOT_FOUND: "CLIENT_VERSION_NOT_FOUND",
  CLIENT_VERSION_ALREADY_EXISTS: "CLIENT_VERSION_ALREADY_EXISTS",

  // Service Notice errors
  SERVICE_NOTICE_NOT_FOUND: "SERVICE_NOTICE_NOT_FOUND",

  // Banner errors
  BANNER_NOT_FOUND: "BANNER_NOT_FOUND",

  // Remote Config errors
  REMOTE_CONFIG_NOT_FOUND: "REMOTE_CONFIG_NOT_FOUND",
  REMOTE_CONFIG_KEY_EXISTS: "REMOTE_CONFIG_KEY_EXISTS",

  // Store Product errors
  STORE_PRODUCT_NOT_FOUND: "STORE_PRODUCT_NOT_FOUND",
  STORE_PRODUCT_ALREADY_EXISTS: "STORE_PRODUCT_ALREADY_EXISTS",

  // Job/Queue errors
  JOB_NOT_FOUND: "JOB_NOT_FOUND",
  JOB_ALREADY_RUNNING: "JOB_ALREADY_RUNNING",
  JOB_FAILED: "JOB_FAILED",

  // Rate limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",

  // File/Upload errors
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  UPLOAD_FAILED: "UPLOAD_FAILED",

  // Database errors
  DATABASE_ERROR: "DATABASE_ERROR",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  FOREIGN_KEY_VIOLATION: "FOREIGN_KEY_VIOLATION",

  // Service Discovery errors
  SERVICE_DISCOVERY_ERROR: "SERVICE_DISCOVERY_ERROR",
  SERVICE_NOT_FOUND: "SERVICE_NOT_FOUND",
  SERVICE_REGISTRATION_FAILED: "SERVICE_REGISTRATION_FAILED",

  // External service errors
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  TIMEOUT: "TIMEOUT",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Standard API error response structure
 */
export interface ApiError {
  code: ErrorCode | string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Standard API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

/**
 * Check if error code matches any of the given codes
 */
export function isErrorCode(
  code: string | undefined,
  ...codes: ErrorCode[]
): boolean {
  if (!code) return false;
  return codes.includes(code as ErrorCode);
}

/**
 * Extract error code from various error structures
 */
export function extractErrorCode(error: any): string | undefined {
  return error?.error?.code || error?.code || undefined;
}

/**
 * Extract error message from various error structures
 */
export function extractErrorMessage(
  error: any,
  defaultMessage = "An error occurred",
): string {
  return error?.error?.message || error?.message || defaultMessage;
}
