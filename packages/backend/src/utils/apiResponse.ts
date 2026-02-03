import { Response } from 'express';
import logger from '../config/logger';

// Re-export ErrorCodes from shared package for backward compatibility
// This allows existing imports to continue working
export { ErrorCodes, isErrorCode, extractErrorCode, extractErrorMessage } from '@gatrix/shared';
export type { ErrorCode, ApiError, ApiResponse } from '@gatrix/shared';

// Import for internal use
import { ErrorCodes, ErrorCode } from '@gatrix/shared';

/**
 * Standard error response structure (backward compatible)
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

export function sendBadRequest(
  res: Response,
  message: string,
  details?: Record<string, any>
): Response {
  return sendErrorResponse(res, 400, ErrorCodes.BAD_REQUEST, message, details);
}

export function sendValidationError(
  res: Response,
  message: string,
  details?: Record<string, any>
): Response {
  return sendErrorResponse(res, 400, ErrorCodes.VALIDATION_ERROR, message, details);
}

export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized',
  code: ErrorCode | string = ErrorCodes.UNAUTHORIZED
): Response {
  return sendErrorResponse(res, 401, code, message);
}

export function sendForbidden(
  res: Response,
  message: string = 'Forbidden',
  code: ErrorCode | string = ErrorCodes.FORBIDDEN
): Response {
  return sendErrorResponse(res, 403, code, message);
}

export function sendNotFound(
  res: Response,
  message: string,
  code: ErrorCode | string = ErrorCodes.NOT_FOUND
): Response {
  return sendErrorResponse(res, 404, code, message);
}

export function sendConflict(
  res: Response,
  message: string,
  code: ErrorCode | string = ErrorCodes.CONFLICT
): Response {
  return sendErrorResponse(res, 409, code, message);
}

export function sendTooManyRequests(
  res: Response,
  message: string = 'Too many requests'
): Response {
  return sendErrorResponse(res, 429, ErrorCodes.TOO_MANY_REQUESTS, message);
}

export function sendInternalError(
  res: Response,
  message: string,
  error?: unknown,
  code: ErrorCode | string = ErrorCodes.INTERNAL_SERVER_ERROR
): Response {
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
export function sendSuccessResponse<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200
): Response {
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
