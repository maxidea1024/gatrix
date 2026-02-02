import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import logger from "../config/logger";

// Rate limiter configuration from environment variables
const isDevelopment = process.env.NODE_ENV === "development";

// More lenient limits for development
const RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_WINDOW_MS || (isDevelopment ? "60000" : "900000"),
); // 1 min dev, 15 min prod
const RATE_LIMIT_MAX_REQUESTS = parseInt(
  process.env.RATE_LIMIT_MAX_REQUESTS || (isDevelopment ? "1000" : "100"),
); // 1000 dev, 100 prod
const RATE_LIMIT_AUTH_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_AUTH_WINDOW_MS || (isDevelopment ? "60000" : "900000"),
); // 1 min dev, 15 min prod
const RATE_LIMIT_AUTH_MAX_REQUESTS = parseInt(
  process.env.RATE_LIMIT_AUTH_MAX_REQUESTS || (isDevelopment ? "100" : "5"),
); // 100 dev, 5 prod

// Rate limiter configuration from environment variables

// Allow disabling rate limiting in any environment via env flag
const disableRateLimit = process.env.DISABLE_RATE_LIMIT === "true";
const skipRateLimit = disableRateLimit;

// General rate limiter
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  skip: skipRateLimit ? () => true : undefined,
  keyGenerator: (req: any): string => {
    const userId = req.user?.userId;
    const ip = req.ip || req.connection?.remoteAddress || "unknown";

    if (userId) {
      return `user:${userId}:${ip}`;
    }
    return `ip:${ip}`;
  },
  message: {
    success: false,
    error: {
      message: "Too many requests from this IP, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: any, res: any) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
    });

    res.status(429).json({
      success: false,
      error: {
        message: "Too many requests from this IP, please try again later.",
      },
    });
  },
});

// Strict rate limiter for authentication endpoints
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX_REQUESTS,
  skip: skipRateLimit ? () => true : undefined,
  keyGenerator: (req: any): string => {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    return `auth:${ip}`;
  },
  message: {
    success: false,
    error: {
      message: "Too many authentication attempts, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req: any, res: any) => {
    logger.warn("Auth rate limit exceeded", {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
    });

    res.status(429).json({
      success: false,
      error: {
        message: "Too many authentication attempts, please try again later.",
      },
    });
  },
});

// API rate limiter
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: Math.floor(RATE_LIMIT_MAX_REQUESTS * 0.8), // 80% of general limit
  skip: skipRateLimit ? () => true : undefined,
  keyGenerator: (req: any): string => {
    const userId = req.user?.userId;
    const ip = req.ip || req.connection?.remoteAddress || "unknown";

    if (userId) {
      return `user:${userId}:${ip}`;
    }
    return `ip:${ip}`;
  },
  message: {
    success: false,
    error: {
      message: "API rate limit exceeded, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: any, res: any) => {
    logger.warn("API rate limit exceeded", {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
    });

    res.status(429).json({
      success: false,
      error: {
        message: "API rate limit exceeded, please try again later.",
      },
    });
  },
});
