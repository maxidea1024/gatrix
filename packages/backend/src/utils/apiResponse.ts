import { Response } from 'express';
import logger from '../config/logger';

/**
 * Standard API error codes
 * Use these codes for consistent error identification across the application
 */
export const ErrorCodes = {
  // Generic errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Authentication/Authorization
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_PERMISSION_DENIED: 'AUTH_PERMISSION_DENIED',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',

  // Environment
  ENV_NOT_FOUND: 'ENV_NOT_FOUND',
  ENV_ACCESS_DENIED: 'ENV_ACCESS_DENIED',
  ENV_INVALID: 'ENV_INVALID',

  // Resource operations
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CREATE_FAILED: 'RESOURCE_CREATE_FAILED',
  RESOURCE_UPDATE_FAILED: 'RESOURCE_UPDATE_FAILED',
  RESOURCE_DELETE_FAILED: 'RESOURCE_DELETE_FAILED',
  RESOURCE_FETCH_FAILED: 'RESOURCE_FETCH_FAILED',

  // Database
  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
  DB_QUERY_ERROR: 'DB_QUERY_ERROR',
  DB_TRANSACTION_ERROR: 'DB_TRANSACTION_ERROR',

  // External services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  EXTERNAL_SERVICE_TIMEOUT: 'EXTERNAL_SERVICE_TIMEOUT',
  EXTERNAL_SERVICE_UNAVAILABLE: 'EXTERNAL_SERVICE_UNAVAILABLE',

  // File operations
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  FILE_PARSE_ERROR: 'FILE_PARSE_ERROR',

  // Game specific
  GAME_WORLD_NOT_FOUND: 'GAME_WORLD_NOT_FOUND',
  CLIENT_VERSION_NOT_FOUND: 'CLIENT_VERSION_NOT_FOUND',
  COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
  COUPON_ALREADY_USED: 'COUPON_ALREADY_USED',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_LIMIT_REACHED: 'COUPON_LIMIT_REACHED',

  // Service Discovery
  SERVICE_DISCOVERY_ERROR: 'SERVICE_DISCOVERY_ERROR',
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  SERVICE_REGISTRATION_FAILED: 'SERVICE_REGISTRATION_FAILED',

  // Mail
  MAIL_SEND_FAILED: 'MAIL_SEND_FAILED',
  MAIL_NOT_FOUND: 'MAIL_NOT_FOUND',

  // User
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_CREATE_FAILED: 'USER_CREATE_FAILED',
  USER_UPDATE_FAILED: 'USER_UPDATE_FAILED',
  USER_DELETE_FAILED: 'USER_DELETE_FAILED',

  // API Token
  API_TOKEN_NOT_FOUND: 'API_TOKEN_NOT_FOUND',
  API_TOKEN_CREATE_FAILED: 'API_TOKEN_CREATE_FAILED',
  API_TOKEN_UPDATE_FAILED: 'API_TOKEN_UPDATE_FAILED',
  API_TOKEN_DELETE_FAILED: 'API_TOKEN_DELETE_FAILED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Standard error response structure
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Send a standardized error response
 * 
 * @param res - Express response object
 * @param statusCode - HTTP status code
 * @param code - Error code (use ErrorCodes for consistency)
 * @param message - Human-readable error message
 * @param details - Optional additional error details
 * @param logError - Optional error object to log (for internal errors)
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  code: ErrorCode | string,
  message: string,
  details?: Record<string, any>,
  logError?: unknown
): Response {
  // Log internal server errors
  if (statusCode >= 500 && logError) {
    logger.error(`[${code}] ${message}`, {
      errorCode: code,
      statusCode,
      details,
      error: logError instanceof Error ? logError.message : logError,
      stack: logError instanceof Error ? logError.stack : undefined,
    });
  }

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
}

// Convenience methods for common error types

export function sendBadRequest(res: Response, message: string, details?: Record<string, any>): Response {
  return sendErrorResponse(res, 400, ErrorCodes.BAD_REQUEST, message, details);
}

export function sendValidationError(res: Response, message: string, details?: Record<string, any>): Response {
  return sendErrorResponse(res, 400, ErrorCodes.VALIDATION_ERROR, message, details);
}

export function sendUnauthorized(res: Response, message: string = 'Unauthorized', code: ErrorCode = ErrorCodes.UNAUTHORIZED): Response {
  return sendErrorResponse(res, 401, code, message);
}

export function sendForbidden(res: Response, message: string = 'Forbidden', code: ErrorCode = ErrorCodes.FORBIDDEN): Response {
  return sendErrorResponse(res, 403, code, message);
}

export function sendNotFound(res: Response, message: string, code: ErrorCode = ErrorCodes.NOT_FOUND): Response {
  return sendErrorResponse(res, 404, code, message);
}

export function sendConflict(res: Response, message: string, code: ErrorCode = ErrorCodes.CONFLICT): Response {
  return sendErrorResponse(res, 409, code, message);
}

export function sendTooManyRequests(res: Response, message: string = 'Too many requests'): Response {
  return sendErrorResponse(res, 429, ErrorCodes.TOO_MANY_REQUESTS, message);
}

export function sendInternalError(res: Response, message: string, error?: unknown, code: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR): Response {
  return sendErrorResponse(res, 500, code, message, undefined, error);
}

/**
 * Standard success response structure
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Send a standardized success response
 */
export function sendSuccessResponse<T>(res: Response, data?: T, message?: string, statusCode: number = 200): Response {
  const response: ApiSuccessResponse<T> = {
    success: true,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
}
