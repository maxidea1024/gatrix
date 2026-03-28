import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../config/logger';

const logger = createLogger('RequestLogger');

export interface RequestWithStartTime extends Request {
  startTime?: number;
}

/**
 * Check if request logging is enabled for this service
 * Each service can be configured separately via environment variables:
 * - BACKEND_REQUEST_LOGGING_ENABLED: Enable/disable for backend (default: true)
 * - CHAT_SERVER_REQUEST_LOGGING_ENABLED: Enable/disable for chat-server (default: true)
 * - EDGE_REQUEST_LOGGING_ENABLED: Enable/disable for edge (default: true)
 *
 * Global fallback: REQUEST_LOGGING_ENABLED
 */
const isRequestLoggingEnabled = (): boolean => {
  // Check service-specific environment variable first
  const backendEnabled = process.env.BACKEND_REQUEST_LOGGING_ENABLED;
  if (backendEnabled !== undefined) {
    return backendEnabled.toLowerCase() === 'true';
  }

  // Fallback to global setting
  const globalEnabled = process.env.REQUEST_LOGGING_ENABLED;
  if (globalEnabled !== undefined) {
    return globalEnabled.toLowerCase() === 'true';
  }

  // Default: enabled
  return true;
};

export const requestLogger = (
  req: RequestWithStartTime,
  res: Response,
  next: NextFunction
): void => {
  // Skip logging if disabled
  if (!isRequestLoggingEnabled()) {
    next();
    return;
  }

  req.startTime = Date.now();

  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log request
  const requestLogData: any = {
    method: req.method,
    url: req.originalUrl || req.url,
    externalIp: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    hasAuthHeader: !!req.get('Authorization'),
    authHeaderPrefix:
      req.get('Authorization')?.substring(0, 20) + '...' || 'none',
  };

  // Additional logging in development environment
  if (isDevelopment) {
    // Add query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      requestLogData.queryParams = req.query;
    }

    // Add request body (when Content-Type is application/json)
    const contentType = req.get('Content-Type');
    if (
      contentType?.includes('application/json') &&
      req.body &&
      Object.keys(req.body).length > 0
    ) {
      requestLogData.requestBody = req.body;
    }
  }

  logger.info('Incoming request', requestLogData);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any): Response {
    const duration = req.startTime ? Date.now() - req.startTime : 0;

    const responseLogData: any = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
    };

    // Add response body in development (when Content-Type is application/json)
    if (
      isDevelopment &&
      chunk &&
      res.get('Content-Type')?.includes('application/json')
    ) {
      try {
        let responseText: string | undefined;

        if (Buffer.isBuffer(chunk)) {
          // Convert Buffer to string
        } else if (typeof chunk === 'string') {
          responseText = chunk;
        } else {
          // Use as-is if already an object
          responseLogData.responseBody = chunk;
        }

        // Attempt JSON parsing if string
        if (responseText) {
          responseLogData.responseBody = JSON.parse(responseText);
        }
      } catch (error) {
        // Ignore JSON parse failure
      }
    }

    logger.info('Request completed', responseLogData);

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};
