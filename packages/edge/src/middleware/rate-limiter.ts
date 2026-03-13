import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../config/logger';

const logger = createLogger('RateLimiter');

interface RateLimitEntry {
  timestamps: number[];
}

const entries = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries (every 60s)
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [ip, entry] of entries) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      entries.delete(ip);
    }
  }
}, 60000);

/**
 * Create a rate limiting middleware.
 * When maxRps is 0, rate limiting is disabled (pass-through).
 */
export function createRateLimiter(maxRps: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (maxRps <= 0) {
      next();
      return;
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 1000; // 1 second sliding window

    let entry = entries.get(clientIp);
    if (!entry) {
      entry = { timestamps: [] };
      entries.set(clientIp, entry);
    }

    // Remove timestamps outside the window
    const cutoff = now - windowMs;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= maxRps) {
      logger.warn(`Rate limit exceeded for IP: ${clientIp}`);
      res.setHeader('Retry-After', '1');
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        },
      });
      return;
    }

    entry.timestamps.push(now);
    next();
  };
}
