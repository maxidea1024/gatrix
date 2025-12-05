import { Request, Response, NextFunction } from 'express';
import { ApiAccessToken } from '../models/ApiAccessToken';
import { RemoteConfigEnvironment } from '../models/RemoteConfigEnvironment';
import { CacheService } from '../services/CacheService';
import logger from '../config/logger';
import { HEADERS, HEADER_VALUES } from '../constants/headers';
import {
  getCurrentEnvironmentId,
  getDefaultEnvironmentId,
  runWithEnvironmentAsync,
  isDefaultEnvironmentInitialized
} from '../utils/environmentContext';

// Unsecured tokens for testing purposes
const UNSECURED_CLIENT_TOKEN = 'gatrix-unsecured-client-api-token';
const UNSECURED_SERVER_TOKEN = 'gatrix-unsecured-server-api-token';

interface SDKRequest extends Request {
  apiToken?: ApiAccessToken;
  environments?: RemoteConfigEnvironment[];
  environment?: RemoteConfigEnvironment;
  isUnsecuredToken?: boolean; // Flag to indicate unsecured token usage
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

    // Check for unsecured client token (for testing)
    if (token === UNSECURED_CLIENT_TOKEN) {
      req.isUnsecuredToken = true;
      req.apiToken = {
        id: 0,
        tokenType: 'client',
        tokenValue: UNSECURED_CLIENT_TOKEN,
        name: 'Unsecured Client Token (Testing)',
        isActive: true,
        expiresAt: null,
        environmentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      return next();
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

    // Check if token is valid (handle both model instances and plain objects from cache)
    const isExpired = apiToken.expiresAt ? new Date() > new Date(apiToken.expiresAt) : false;
    if (isExpired) {
      return res.status(401).json({
        success: false,
        message: 'API token is inactive or expired'
      });
    }

    // Check environment access for multi-environment support
    const currentEnvId = getCurrentEnvironmentId();
    if (currentEnvId && !apiToken.allowAllEnvironments) {
      // Check if token has access to current environment
      let hasAccess = false;

      if (typeof apiToken.hasEnvironmentAccess === 'function') {
        hasAccess = await apiToken.hasEnvironmentAccess(currentEnvId);
      } else {
        // For cached plain objects, query the database
        const { default: knex } = await import('../config/knex');
        const envAccess = await knex('g_api_access_token_environments')
          .where('tokenId', apiToken.id)
          .where('environmentId', currentEnvId)
          .first();
        hasAccess = !!envAccess;
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'API token does not have access to this environment'
        });
      }
    }

    // Get environments if token has specific environment access
    let environments: RemoteConfigEnvironment[] = [];

    if (!apiToken.allowAllEnvironments && apiToken.environments && apiToken.environments.length > 0) {
      environments = apiToken.environments;
    } else if (!apiToken.allowAllEnvironments) {
      // Fetch environments from database if not loaded
      const { default: knex } = await import('../config/knex');
      const envIds = await knex('g_api_access_token_environments')
        .where('tokenId', apiToken.id)
        .select('environmentId');

      if (envIds.length > 0) {
        environments = await RemoteConfigEnvironment.query()
          .whereIn('id', envIds.map(e => e.environmentId));
      }
    }

    // If token has no environments and doesn't allow all, deny access
    if (!apiToken.allowAllEnvironments && environments.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'API token has no environment access configured'
      });
    }

    // Attach token and environments to request
    req.apiToken = apiToken;
    req.environments = environments;

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
 * SDK 환경 설정 미들웨어
 * X-Environment-Id 헤더 또는 기본 환경을 사용하여 req.environment를 설정합니다.
 * 토큰의 환경 접근 권한도 검증합니다.
 */
export const setSDKEnvironment = async (req: SDKRequest, res: Response, next: NextFunction) => {
  try {
    const apiToken = req.apiToken;
    const requestedEnvId = req.headers[HEADERS.X_ENVIRONMENT_ID] as string;

    // Get environment ID from header or use default
    let environmentId = requestedEnvId;

    if (!environmentId) {
      // Use default environment if not specified
      if (!isDefaultEnvironmentInitialized()) {
        return res.status(503).json({
          success: false,
          message: 'Environment not initialized. Please try again later.'
        });
      }
      environmentId = getDefaultEnvironmentId();
    }

    if (!environmentId) {
      return res.status(400).json({
        success: false,
        message: 'Environment ID is required (via X-Environment-Id header)'
      });
    }

    // Validate token has access to this environment (skip for unsecured tokens)
    if (!req.isUnsecuredToken && apiToken && !apiToken.allowAllEnvironments) {
      let hasAccess = false;

      if (typeof apiToken.hasEnvironmentAccess === 'function') {
        hasAccess = await apiToken.hasEnvironmentAccess(environmentId);
      } else {
        // For cached plain objects, query the database
        const { default: knex } = await import('../config/knex');
        const envAccess = await knex('g_api_access_token_environments')
          .where('tokenId', apiToken.id)
          .where('environmentId', environmentId)
          .first();
        hasAccess = !!envAccess;
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'API token does not have access to this environment'
        });
      }
    }

    // Fetch environment from database
    const cacheKey = `sdk_env:${environmentId}`;
    let environment: RemoteConfigEnvironment | null = await CacheService.get<RemoteConfigEnvironment>(cacheKey);

    if (!environment) {
      const foundEnv = await RemoteConfigEnvironment.query().findById(environmentId);

      if (!foundEnv) {
        return res.status(404).json({
          success: false,
          message: 'Environment not found'
        });
      }

      environment = foundEnv;

      // Cache environment for 5 minutes
      await CacheService.set(cacheKey, environment, 300);
    }

    // Set environment on request
    req.environment = environment;

    // Run the rest of the request with environment context
    await runWithEnvironmentAsync(environmentId, async () => {
      next();
    });
  } catch (error) {
    logger.error('Error setting SDK environment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set environment'
    });
  }
};

/**
 * Combined middleware for client SDK endpoints
 */
export const clientSDKAuth = [
  authenticateApiToken,
  requireTokenType('client'),
  validateApplicationName,
  setSDKEnvironment,
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

    // Check for unsecured server token (for testing)
    if (apiToken === UNSECURED_SERVER_TOKEN) {
      req.isUnsecuredToken = true;
      req.apiToken = {
        id: 0,
        tokenType: 'server',
        tokenValue: UNSECURED_SERVER_TOKEN,
        name: 'Unsecured Server Token (Testing)',
        isActive: true,
        expiresAt: null,
        environmentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      return next();
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
  setSDKEnvironment,
  sdkRateLimit
];

export default {
  authenticateApiToken,
  authenticateServerApiToken,
  requireTokenType,
  validateApplicationName,
  setSDKEnvironment,
  sdkRateLimit,
  clientSDKAuth,
  serverSDKAuth
};
