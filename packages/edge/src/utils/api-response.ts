import { Response } from 'express';
import { ErrorCodes, ErrorCode } from '@gatrix/shared';
import { createLogger } from '../config/logger';

const logger = createLogger('ApiResponse');

// Re-export for convenient use in route files
export { ErrorCodes } from '@gatrix/shared';
export type { ErrorCode } from '@gatrix/shared';

/**
 * Send a standardized error response
 * Format: { success: false, error: { code, message, details? } }
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  code: ErrorCode | string,
  message: string,
  details?: Record<string, any>,
  logError?: unknown
): Response {
  if (statusCode >= 500 && logError) {
    logger.error(`[${code}] ${message}`, {
      errorCode: code,
      statusCode,
      details,
      error: logError instanceof Error ? logError.message : logError,
      stack: logError instanceof Error ? logError.stack : undefined,
    });
  }

  const response: any = {
    success: false,
    error: { code, message },
  };

  if (details) {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
}

export function sendBadRequest(
  res: Response,
  message: string,
  details?: Record<string, any>
): Response {
  return sendErrorResponse(res, 400, ErrorCodes.BAD_REQUEST, message, details);
}

export function sendUnauthorized(
  res: Response,
  message: string,
  code: ErrorCode | string = ErrorCodes.UNAUTHORIZED
): Response {
  return sendErrorResponse(res, 401, code, message);
}

export function sendNotFound(
  res: Response,
  message: string,
  code: ErrorCode | string = ErrorCodes.NOT_FOUND
): Response {
  return sendErrorResponse(res, 404, code, message);
}

export function sendInternalError(
  res: Response,
  message: string,
  error?: unknown,
  code: ErrorCode | string = ErrorCodes.INTERNAL_SERVER_ERROR
): Response {
  return sendErrorResponse(res, 500, code, message, undefined, error);
}
