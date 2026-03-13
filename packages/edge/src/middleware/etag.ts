import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * ETag middleware for Express.
 *
 * Computes an ETag from the response body and supports If-None-Match
 * for 304 Not Modified responses to reduce bandwidth.
 *
 * Skips health endpoints and non-GET methods.
 */
export function createETagMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip non-GET methods and health endpoints
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/internal/health')
    ) {
      next();
      return;
    }

    const ifNoneMatch = req.headers['if-none-match'] as string | undefined;
    const originalJson = res.json.bind(res);

    // Override res.json to intercept the response body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.json = function (body: any): Response {
      const bodyStr = JSON.stringify(body);
      const hash = crypto
        .createHash('md5')
        .update(bodyStr)
        .digest('hex')
        .substring(0, 16);
      const etag = `"${hash}"`;

      res.setHeader('ETag', etag);

      // Check If-None-Match
      if (
        ifNoneMatch &&
        (ifNoneMatch === etag || ifNoneMatch.replace(/"/g, '') === hash)
      ) {
        res.status(304).end();
        return res;
      }

      return originalJson(body);
    };

    next();
  };
}
