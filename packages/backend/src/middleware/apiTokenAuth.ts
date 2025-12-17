import { Request, Response, NextFunction } from 'express';
import { ApiAccessToken } from '../models/ApiAccessToken';
import { Environment } from '../models/Environment';
import { CacheService } from '../services/CacheService';
import logger from '../config/logger';
import { HEADERS, HEADER_VALUES } from '../constants/headers';
import {
  getDefaultEnvironmentId,
  isDefaultEnvironmentInitialized
} from '../utils/environmentContext';

// Unsecured tokens for testing purposes
const UNSECURED_CLIENT_TOKEN = 'gatrix-unsecured-client-api-token';
const UNSECURED_SERVER_TOKEN = 'gatrix-unsecured-server-api-token';

// Edge bypass token - allows access to all environments and internal APIs
// This token is used by Edge servers that run in internal network
// Can be configured via EDGE_BYPASS_TOKEN environment variable
// TODO: In the future, this should be replaced with a generated/registered token
export const EDGE_BYPASS_TOKEN = process.env.EDGE_BYPASS_TOKEN || 'gatrix-edge-internal-bypass-token';

export interface SDKRequest extends Request {
  apiToken?: ApiAccessToken;
  environments?: Environment[];
  environment?: Environment;
  environmentId?: string;
  isUnsecuredToken?: boolean; // Flag to indicate unsecured token usage
  isEdgeBypassToken?: boolean; // Flag to indicate Edge bypass token usage
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

    // Check for Edge bypass token (internal network only)
    // Edge server uses this token when proxying client requests to backend
    if (token === EDGE_BYPASS_TOKEN) {
      req.isUnsecuredToken = true;
      req.isEdgeBypassToken = true;
      req.apiToken = {
        id: 0,
        tokenType: 'client', // Treat as client for client SDK endpoints
        tokenValue: EDGE_BYPASS_TOKEN,
        name: 'Edge Bypass Token (Internal)',
        allowAllEnvironments: true,
        isActive: true,
        expiresAt: null,
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
      // 캐시?�서 ?�큰??찾았?�도 ?�용??기록
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

    // Environment access check is deferred to setSDKEnvironment middleware
    // where the target environment is definitively resolved.

    // Get environments if token has specific environment access
    let environments: Environment[] = [];

    if (!apiToken.allowAllEnvironments && apiToken.environments && apiToken.environments.length > 0) {
      environments = apiToken.environments;
    } else if (!apiToken.allowAllEnvironments) {
      // Fetch environments from database if not loaded
      const { default: knex } = await import('../config/knex');
      const envIds = await knex('g_api_access_token_environments')
        .where('tokenId', apiToken.id)
        .select('environmentId');

      if (envIds.length > 0) {
        environments = await Environment.query()
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
 * 'all' token type can access both client and server APIs
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

    // 'all' token type can access any API
    if (apiToken.tokenType === 'all') {
      return next();
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
 * SDK ?�경 ?�정 미들?�어
 * X-Environment-Id ?�더 ?�는 기본 ?�경???�용?�여 req.environment�??�정?�니??
 * ?�큰???�경 ?�근 권한??검증합?�다.
 */
export const setSDKEnvironment = async (req: SDKRequest, res: Response, next: NextFunction) => {
  try {
    const apiToken = req.apiToken;
    const requestedEnvId = req.headers[HEADERS.X_ENVIRONMENT_ID] as string;

    // Get environment ID from header or use default
    // SDK sends 'X-Environment', but backend defines 'x-environment-id'
    let environmentId = (req.headers['x-environment'] as string) ||
      (req.headers[HEADERS.X_ENVIRONMENT_ID] as string) ||
      requestedEnvId;

    // Use pre-resolved environment if available (e.g. from URL params)
    if (!environmentId && req.environment?.id) {
      environmentId = req.environment.id;
    }

    // Attempt to resolve from URL (specifically for server routes like /api/v1/server/:env/...)
    if (!environmentId) {
      let envParam = req.params?.env;

      // Fallback: Manually parse URL if req.params is not populated (middleware order issue)
      // Look for /api/v1/server/:env/ pattern
      if (!envParam) {
        const path = req.originalUrl || req.url;
        const match = path.match(/\/api\/v1\/server\/([^\/]+)\//);
        if (match && match[1] && match[1] !== 'services' && match[1] !== 'internal' && match[1] !== 'auth') {
          envParam = match[1];
        }
      }

      if (envParam) {
        // Try to find environment by ID first
        let resolvedEnv = await Environment.query().findById(envParam);

        // If not found by ID, try by name
        if (!resolvedEnv) {
          resolvedEnv = await Environment.getByName(envParam);
        }

        if (resolvedEnv) {
          environmentId = resolvedEnv.id;
        }
      }
    }

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

    // Fetch environment from database FIRST to resolve ID vs Name ambiguity
    // This handles cases where client sends environment name (e.g. 'development') instead of ID
    const cacheKey = `sdk_env:${environmentId}`;
    let environment: Environment | null = await CacheService.get<Environment>(cacheKey);

    if (!environment) {
      // Try to find by ID
      let foundEnv = await Environment.query().findById(environmentId);

      // If not found by ID, try by name
      if (!foundEnv) {
        foundEnv = await Environment.getByName(environmentId);
      }

      if (!foundEnv) {
        return res.status(404).json({
          success: false,
          message: `Environment not found: ${environmentId}`
        });
      }

      environment = foundEnv;

      // Cache environment for 5 minutes
      // Cache using the key we looked up with
      await CacheService.set(cacheKey, environment, 300);

      // Also cache by canonical ID if we looked up by name
      if (environment.id !== environmentId) {
        await CacheService.set(`sdk_env:${environment.id}`, environment, 300);
      }
    }

    // Update environmentId to the canonical ID from the database
    // This ensures subsequent checks use the correct ID even if name was passed
    environmentId = environment.id;
    req.environment = environment;

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
        // Detailed logging for debugging
        logger.error('API token environment access denied:', {
          tokenId: apiToken.id,
          tokenName: apiToken.tokenName,
          environmentId: environmentId,
          isUnsecuredToken: req.isUnsecuredToken,
          allowAllEnvironments: apiToken.allowAllEnvironments,
          path: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          message: 'API token does not have access to this environment',
          debug: {
            tokenId: apiToken.id,
            tokenName: apiToken.tokenName,
            environmentId: environmentId,
            environmentName: environment.environmentName,
          }
        });
      }
    }

    // Proceed without AsyncLocalStorage context wrapper
    next();
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
 * Server API ?�큰 ?�증 미들?�어
 * X-API-Token ?�더�??�용?�여 ?�버 �??�신???�증?�니??
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

    // Check for Edge bypass token (internal network only)
    if (apiToken === EDGE_BYPASS_TOKEN) {
      req.isUnsecuredToken = true;
      req.isEdgeBypassToken = true;
      req.apiToken = {
        id: 'edge-bypass',
        tokenType: 'server',
        tokenValue: EDGE_BYPASS_TOKEN,
        tokenName: 'Edge Bypass Token (Internal)',
        allowAllEnvironments: true,
        isActive: true,
        expiresAt: null,
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

      // Check server token type - 'server' or 'all' are allowed
      if (validatedToken.tokenType !== 'server' && validatedToken.tokenType !== 'all') {
        return res.status(403).json({
          success: false,
          message: 'Server API token required'
        });
      }

      // Cache the validated token for 5 minutes
      await CacheService.set(cacheKey, validatedToken, 5 * 60 * 1000);
    }

    // ?�청 객체???�큰 ?�보 추�?
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
