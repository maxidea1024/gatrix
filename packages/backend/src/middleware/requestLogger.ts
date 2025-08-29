import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../config/logger';

const logger = createLogger('RequestLogger');

export interface RequestWithStartTime extends Request {
  startTime?: number;
}

export const requestLogger = (req: RequestWithStartTime, res: Response, next: NextFunction): void => {
  req.startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    hasAuthHeader: !!req.get('Authorization'),
    authHeaderPrefix: req.get('Authorization')?.substring(0, 20) + '...' || 'none'
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): Response {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
    });

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};
