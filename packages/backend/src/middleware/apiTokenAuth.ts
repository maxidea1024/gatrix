import { Request, Response, NextFunction } from 'express';
import { ApiAccessToken } from '../models/ApiAccessToken';
import { RemoteConfigEnvironment } from '../models/RemoteConfigEnvironment';
import { CacheService } from '../services/CacheService';
import logger from '../config/logger';
import { HEADERS, HEADER_VALUES } from '../constants/headers';

interface SDKRequest extends Request {
  apiToken?: ApiAccessToken;
  environment?: RemoteConfigEnvironment;
}

/**
 * Middleware to authenticate API access tokens
 */
export const authenticateApiToken = async (req: SDKRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers[HEADERS.AUTHORIZATION];
    const apiTokenHeader = req.headers[HEADERS.X_API_TOKEN] as string;

    // Extract token from Authorization header or X-API-Token header
    let token: string | undefined;

    if (authHeader && authHeader.startsWith(HEADER_VALUES.BEARER_PREFIX)) {
      token = authHeader.substring(HEADER_VALUES.BEARER_PREFIX.length);
    } else if (apiTokenHeader) {
      token = apiTokenHeader;
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
    } else {
      // 캐시에서 토큰을 찾았어도 사용량 기록
      if (apiToken.id) {
        const { default: apiTokenUsageService } = await import('../services/ApiTokenUsageService');
        apiTokenUsageService.recordTokenUsage(apiToken.id).catch(error => {
          logger.error('Failed to record token usage from cache:', error);
        });
      }
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
  const appName = req.headers[HEADERS.X_APPLICATION_NAME] as string;

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
 * Server API 토큰 인증 미들웨어
 * X-API-Token 헤더를 사용하여 서버 간 통신을 인증합니다.
 */
export const authenticateServerApiToken = async (req: SDKRequest, res: Response, next: NextFunction) => {
  try {
    const apiToken = req.headers[HEADERS.X_API_TOKEN] as string;
    const appName = req.headers[HEADERS.X_APPLICATION_NAME] as string;

    if (!apiToken) {
      return res.status(401).json({
        success: false,
        message: 'API token is required'
      });
    }

    if (!appName) {
      return res.status(401).json({
        success: false,
        message: 'Application name is required'
      });
    }

    // Try to get token from cache first
    const cacheKey = `server_api_token:${apiToken.substring(0, 16)}...`;
    let validatedToken = await CacheService.get<ApiAccessToken>(cacheKey);

    if (!validatedToken) {
      // Validate token against database
      validatedToken = await ApiAccessToken.validateAndUse(apiToken);

      if (!validatedToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired API token'
        });
      }

      // 서버 토큰인지 확인
      if (validatedToken.tokenType !== 'server') {
        return res.status(403).json({
          success: false,
          message: 'Server API token required'
        });
      }

      // Cache the validated token for 5 minutes
      await CacheService.set(cacheKey, validatedToken, 5 * 60 * 1000);
    }

    // 요청 객체에 토큰 정보 추가
    req.apiToken = validatedToken;

    next();
  } catch (error) {
    logger.error('Server API token authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Combined middleware for server SDK endpoints
 */
export const serverSDKAuth = [
  authenticateServerApiToken,
  sdkRateLimit
];

export default {
  authenticateApiToken,
  authenticateServerApiToken,
  requireTokenType,
  validateApplicationName,
  sdkRateLimit,
  clientSDKAuth,
  serverSDKAuth
};
