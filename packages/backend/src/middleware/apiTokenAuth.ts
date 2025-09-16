import { Request, Response, NextFunction } from 'express';
import { ApiAccessToken } from '../models/ApiAccessToken';
import { RemoteConfigEnvironment } from '../models/RemoteConfigEnvironment';
import { CacheService } from '../services/CacheService';
import logger from '../config/logger';

interface SDKRequest extends Request {
  apiToken?: ApiAccessToken;
  environment?: RemoteConfigEnvironment;
}

/**
 * Middleware to authenticate API access tokens
 */
export const authenticateApiToken = async (req: SDKRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;
    
    // Extract token from Authorization header or X-API-Key header
    let token: string | undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (apiKey) {
      token = apiKey;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'API token is required'
      });
    }

    // Try to get token from cache first
    const cacheKey = `api_token:${token.substring(0, 16)}...`; // Use partial token for cache key
    let apiToken = await CacheService.get<ApiAccessToken>(cacheKey);

    if (!apiToken) {
      // Validate token against database
      apiToken = await ApiAccessToken.validateAndUse(token);
      
      if (!apiToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired API token'
        });
      }

      // Cache the token for 5 minutes
      await CacheService.set(cacheKey, apiToken, 300);
    }

    // Check if token is valid
    if (!apiToken.isValid()) {
      return res.status(401).json({
        success: false,
        message: 'API token is inactive or expired'
      });
    }

    // Get environment if token is environment-specific
    let environment: RemoteConfigEnvironment | undefined;
    
    if (apiToken.environmentId) {
      const envCacheKey = `environment:${apiToken.environmentId}`;
      environment = await CacheService.get<RemoteConfigEnvironment>(envCacheKey) || undefined;
      
      if (!environment) {
        environment = await RemoteConfigEnvironment.query().findById(apiToken.environmentId);
        if (environment) {
          await CacheService.set(envCacheKey, environment, 600); // 10 minutes
        }
      }

      if (!environment) {
        return res.status(404).json({
          success: false,
          message: 'Environment not found'
        });
      }
    }

    // Attach token and environment to request
    req.apiToken = apiToken;
    req.environment = environment;

    next();
  } catch (error) {
    logger.error('Error authenticating API token:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};



/**
 * Middleware to check token type
 */
export const requireTokenType = (tokenType: 'client' | 'server' | 'admin') => {
  return (req: SDKRequest, res: Response, next: NextFunction) => {
    const apiToken = req.apiToken;

    if (!apiToken) {
      return res.status(401).json({
        success: false,
        message: 'API token not found'
      });
    }

    if (apiToken.tokenType !== tokenType) {
      return res.status(403).json({
        success: false,
        message: `Invalid token type. Required: ${tokenType}, got: ${apiToken.tokenType}`
      });
    }

    next();
  };
};

/**
 * Middleware to validate application name header
 */
export const validateApplicationName = (req: SDKRequest, res: Response, next: NextFunction) => {
  const appName = req.headers['x-application-name'] as string;

  if (!appName) {
    return res.status(400).json({
      success: false,
      message: 'X-Application-Name header is required'
    });
  }

  // Validate app name format
  if (!/^[a-zA-Z0-9_-]+$/.test(appName) || appName.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid application name format'
    });
  }

  // Attach app name to request for metrics
  (req as any).applicationName = appName;

  next();
};

/**
 * Rate limiting for SDK endpoints
 */
export const sdkRateLimit = (req: SDKRequest, res: Response, next: NextFunction) => {
  // TODO: Implement rate limiting based on token type and environment
  // For now, just pass through
  next();
};

/**
 * Combined middleware for client SDK endpoints
 */
export const clientSDKAuth = [
  authenticateApiToken,
  requireTokenType('client'),
  validateApplicationName,
  sdkRateLimit
];

/**
 * Combined middleware for server SDK endpoints
 */
export const serverSDKAuth = [
  authenticateApiToken,
  requireTokenType('server'),
  validateApplicationName,
  sdkRateLimit
];

export default {
  authenticateApiToken,
  requireTokenType,
  validateApplicationName,
  sdkRateLimit,
  clientSDKAuth,
  serverSDKAuth
};
