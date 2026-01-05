import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { ErrorCodes } from '../utils/apiResponse';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class GatrixError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  public payload?: Record<string, any>;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, code?: string, payload?: Record<string, any>) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.payload = payload;

    //TODO 개발 환경에서만 callstack을 추적하는게?
    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number = 500, code?: string, payload?: Record<string, any>): GatrixError => {
  return new GatrixError(message, statusCode, true, code, payload);
};

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let { statusCode = 500, message } = error;
  let errorCode = (error as any).code || ErrorCodes.INTERNAL_SERVER_ERROR;

  // Check if this is a client abort error (common and expected)
  const isClientAbort = error.message?.includes('request aborted') ||
    error.message?.includes('aborted') ||
    (error as any)?.code === 'ECONNABORTED' ||
    (error as any)?.code === 'ECONNRESET' ||
    (error as any)?.code === 'EPIPE' ||
    (error as any)?.type === 'request.aborted' ||
    error.name === 'BadRequestError';

  if (isClientAbort) {
    // Log client aborts at debug level only
    logger.debug('Client aborted request:', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      code: (error as any)?.code,
      type: (error as any)?.type
    });
  } else {
    // Log actual errors at error level
    logger.error('Error occurred:', {
      error: message,
      errorCode,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // Handle specific error types and set appropriate error codes
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
    message = 'Validation Error';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = ErrorCodes.UNAUTHORIZED;
    message = 'Unauthorized';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = ErrorCodes.AUTH_TOKEN_INVALID;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = ErrorCodes.AUTH_TOKEN_EXPIRED;
    message = 'Token expired';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    errorCode = ErrorCodes.BAD_REQUEST;
    message = 'Invalid ID format';
  }

  // For client aborts, don't send response (connection is already closed)
  if (isClientAbort) {
    return;
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
  }

  const errorResponse: any = {
    code: errorCode,
    message,
    ...((error as any).validationErrors && { details: { validationErrors: (error as any).validationErrors } }),
  };

  if ((error as any).payload) {
    errorResponse.details = { ...errorResponse.details, payload: (error as any).payload };
  }

  res.status(statusCode).json({
    success: false,
    error: errorResponse,
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const message = `Route ${req.originalUrl} not found`;
  if (req.originalUrl === '/metrics') {
    logger.debug(message, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  } else {
    logger.warn(message, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  }

  res.status(404).json({
    success: false,
    error: {
      code: ErrorCodes.NOT_FOUND,
      message,
    },
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
