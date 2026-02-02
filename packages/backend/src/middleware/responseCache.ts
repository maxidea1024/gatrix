import { Request, Response, NextFunction } from "express";
import redisClient from "../config/redis";
import logger from "../config/logger";
import { HEADERS, HEADER_VALUES } from "../constants/headers";
import crypto from "crypto";

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  skipCache?: (req: Request) => boolean;
  varyBy?: string[]; // Headers to vary cache by
}

interface RequestWithCache extends Request {
  cacheKey?: string;
  skipCache?: boolean;
}

// Default cache TTL (5 minutes)
const DEFAULT_TTL = 300;

// Generate cache key based on request
function generateCacheKey(req: Request, options: CacheOptions): string {
  const { keyPrefix = "cache" } = options;

  // Use x-request-id header if provided for POST/PUT requests
  const requestId = req.headers["x-request-id"] as string;
  if (requestId && ["POST", "PUT", "PATCH"].includes(req.method)) {
    return `${keyPrefix}:request:${requestId}`;
  }

  // For GET requests, use URL and query parameters
  const baseKey = `${req.method}:${req.originalUrl}`;

  // Add vary headers to key
  const varyParts: string[] = [];
  if (options.varyBy) {
    for (const header of options.varyBy) {
      const value = req.headers[header];
      if (value) {
        varyParts.push(`${header}:${value}`);
      }
    }
  }

  // Add user ID if authenticated
  const userId = (req as any).user?.userId;
  if (userId) {
    varyParts.push(`user:${userId}`);
  }

  const fullKey =
    varyParts.length > 0 ? `${baseKey}:${varyParts.join(":")}` : baseKey;

  // Hash the key if it's too long
  if (fullKey.length > 200) {
    const hash = crypto.createHash("sha256").update(fullKey).digest("hex");
    return `${keyPrefix}:${hash}`;
  }

  return `${keyPrefix}:${fullKey}`;
}

// Check if request should be cached
function shouldCache(req: Request, res: Response): boolean {
  // Don't cache if response has errors
  if (res.statusCode >= 400) {
    return false;
  }

  // Don't cache if response has cache-control: no-cache
  const cacheControl = res.get("Cache-Control");
  if (cacheControl && cacheControl.includes("no-cache")) {
    return false;
  }

  // Don't cache if response is too large (> 1MB)
  const contentLength = res.get("Content-Length");
  if (contentLength && parseInt(contentLength) > 1024 * 1024) {
    return false;
  }

  return true;
}

// Response caching middleware
export function responseCache(options: CacheOptions = {}) {
  const { ttl = DEFAULT_TTL, skipCache } = options;

  return async (req: RequestWithCache, res: Response, next: NextFunction) => {
    // Skip caching if condition is met
    if (skipCache && skipCache(req)) {
      req.skipCache = true;
      return next();
    }

    // Skip caching for non-cacheable methods (except POST/PUT with request ID)
    const requestId = req.headers["x-request-id"] as string;
    if (!["GET", "HEAD"].includes(req.method) && !requestId) {
      req.skipCache = true;
      return next();
    }

    // Generate cache key
    const cacheKey = generateCacheKey(req, options);
    req.cacheKey = cacheKey;

    try {
      // Try to get cached response
      const cachedResponse = await redisClient.get(cacheKey);

      if (cachedResponse) {
        const parsed = JSON.parse(cachedResponse);

        // Set cached headers
        if (parsed.headers) {
          Object.entries(parsed.headers).forEach(([key, value]) => {
            res.set(key, value as string);
          });
        }

        // Add cache hit header
        res.set(HEADERS.X_CACHE, HEADER_VALUES.CACHE_HIT);
        res.set(HEADERS.X_CACHE_KEY, cacheKey);

        logger.debug("Cache hit", {
          cacheKey,
          method: req.method,
          url: req.originalUrl,
        });

        return res.status(parsed.statusCode || 200).json(parsed.body);
      }

      // Cache miss - continue to route handler
      res.set(HEADERS.X_CACHE, HEADER_VALUES.CACHE_MISS);
      res.set(HEADERS.X_CACHE_KEY, cacheKey);

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function (body: any) {
        // Store original response
        const responseData = {
          statusCode: res.statusCode,
          headers: {
            [HEADERS.CONTENT_TYPE]: res.get(HEADERS.CONTENT_TYPE),
            [HEADERS.CACHE_CONTROL]: res.get(HEADERS.CACHE_CONTROL),
          },
          body,
          timestamp: new Date().toISOString(),
        };

        // Cache the response if it should be cached
        if (!req.skipCache && shouldCache(req, res)) {
          redisClient
            .set(cacheKey, JSON.stringify(responseData), ttl)
            .then(() => {
              logger.debug("Response cached", {
                cacheKey,
                ttl,
                method: req.method,
                url: req.originalUrl,
              });
            })
            .catch((error: any) => {
              logger.error("Failed to cache response", { error, cacheKey });
            });
        }

        // Call original json method
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      logger.error("Cache middleware error", { error, cacheKey });
      // Continue without caching on error
      req.skipCache = true;
      next();
    }
  };
}

// Cache invalidation helpers
export async function invalidateCache(pattern: string): Promise<number> {
  try {
    // Note: keys() and del() methods need to be implemented in RedisClient
    // This is a simplified version for now
    logger.info("Cache invalidation requested", { pattern });
    return 0;
  } catch (error) {
    logger.error("Failed to invalidate cache", { error, pattern });
    return 0;
  }
}

// Invalidate cache for specific user
export async function invalidateUserCache(userId: number): Promise<number> {
  return invalidateCache(`cache:*:user:${userId}*`);
}

// Invalidate cache for specific resource
export async function invalidateResourceCache(
  resource: string,
): Promise<number> {
  return invalidateCache(`cache:*${resource}*`);
}

// Clear all cache
export async function clearAllCache(): Promise<void> {
  try {
    // Note: flushdb() method needs to be implemented in RedisClient
    // This is a simplified version for now
    logger.info("Clear all cache requested");
  } catch (error) {
    logger.error("Failed to clear all cache", { error });
  }
}

// Predefined cache configurations
export const cacheConfigs = {
  // Short cache for frequently changing data
  short: { ttl: 60 }, // 1 minute

  // Medium cache for moderately changing data
  medium: { ttl: 300 }, // 5 minutes

  // Long cache for rarely changing data
  long: { ttl: 3600 }, // 1 hour

  // User-specific cache
  userSpecific: {
    ttl: 300,
    varyBy: ["authorization"],
    keyPrefix: "user-cache",
  },

  // Public cache (no user variation)
  public: {
    ttl: 600,
    keyPrefix: "public-cache",
  },

  // Admin cache (longer TTL for admin data)
  admin: {
    ttl: 900,
    varyBy: ["authorization"],
    keyPrefix: "admin-cache",
  },
};

export default responseCache;
