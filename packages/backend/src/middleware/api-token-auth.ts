import { Request, Response, NextFunction } from 'express';
import { ApiAccessToken } from '../models/api-access-token';
import { Environment } from '../models/environment';
import { CacheService } from '../services/cache-service';
import { createLogger } from '../config/logger';

const logger = createLogger('apiTokenAuth');
import { HEADERS, HEADER_VALUES } from '../constants/headers';
import { ErrorCodes } from '../utils/api-response';

// ==================== Constants ====================

// Unsecured token format: unsecured-{org}:{project}:{env}-{server|client|edge}-api-token
// Only allowed when ALLOW_UNSECURED_TOKENS=true is set in the environment
const ALLOW_UNSECURED_TOKENS = process.env.ALLOW_UNSECURED_TOKENS === 'true';
const UNSECURED_TOKEN_REGEX = /^unsecured-([^:]+):([^:]+):(.+)-(server|client|edge)-api-token$/;

export const EDGE_BYPASS_TOKEN =
  process.env.EDGE_BYPASS_TOKEN || 'gatrix-edge-internal-bypass-token';

const CACHE_TTL = 300; // 5 minutes

// ==================== Types ====================

export interface SDKRequest extends Request {
  apiToken?: ApiAccessToken;
  environments?: Environment[];
  environmentId?: string;
  environmentModel?: Environment;
  isUnsecuredToken?: boolean;
  isEdgeBypassToken?: boolean;
  unsecuredOrgId?: string;
  unsecuredProjectId?: string;
  unsecuredEnvironmentId?: string;
}

// ==================== Helpers ====================

/**
 * Extracts API token from headers or query parameters
 */
function extractToken(req: Request): string | undefined {
  const authHeader = req.headers[HEADERS.AUTHORIZATION] as string;
  if (authHeader?.startsWith(HEADER_VALUES.BEARER_PREFIX)) {
    return authHeader.substring(HEADER_VALUES.BEARER_PREFIX.length);
  }

  return (
    (req.headers[HEADERS.X_API_TOKEN] as string) ||
    (req.query.token as string) ||
    (req.query.apiToken as string)
  );
}

/**
 * Handles special internal/testing tokens
 * Unsecured token format: unsecured-{org}:{project}:{env}-{server|client|edge}-api-token
 */
function handleSpecialTokens(token: string): {
  apiToken: Partial<ApiAccessToken>;
  isUnsecured?: boolean;
  isEdgeBypass?: boolean;
  unsecuredOrgId?: string;
  unsecuredProjectId?: string;
  unsecuredEnvironmentId?: string;
} | null {
  // Unsecured tokens — only allowed when explicitly enabled
  if (ALLOW_UNSECURED_TOKENS) {
    const match = token.match(UNSECURED_TOKEN_REGEX);
    if (match) {
      const [, orgId, projectId, envId, tokenType] = match;
      const type = tokenType as 'client' | 'server' | 'edge';
      return {
        apiToken: {
          id: `unsecured-${tokenType}-${orgId}-${projectId}`,
          projectId,
          tokenType: type as any,
          tokenName: `Unsecured ${tokenType.toUpperCase()} Token (${orgId}/${projectId}/${envId})`,
        },
        isUnsecured: true,
        unsecuredOrgId: orgId,
        unsecuredProjectId: projectId,
        unsecuredEnvironmentId: envId,
      };
    }
  }

  // Edge internal bypass token
  if (token === EDGE_BYPASS_TOKEN) {
    return {
      apiToken: {
        id: 'edge-bypass',
        tokenType: 'server',
        tokenName: 'Edge Bypass Token (Internal)',
        createdBy: '',
      },
      isEdgeBypass: true,
    };
  }

  return null;
}

/**
 * Validates if token has access to specific environment.
 * With single environmentId, this is a simple string comparison.
 */
function checkEnvironmentAccess(apiToken: ApiAccessToken, environmentId: string): boolean {
  if (typeof apiToken.hasEnvironmentAccess === 'function') {
    return apiToken.hasEnvironmentAccess(environmentId);
  }
  // Fallback for cached plain objects
  return apiToken.environmentId === environmentId;
}

// ==================== Middlewares ====================

/**
 * Core API Token authentication middleware
 */
export const authenticateApiToken = async (req: SDKRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: ErrorCodes.AUTH_TOKEN_MISSING, message: 'API token is required' },
      });
    }

    // 1. Check special tokens first
    const special = handleSpecialTokens(token);
    if (special) {
      req.isUnsecuredToken = special.isUnsecured || false;
      req.isEdgeBypassToken = special.isEdgeBypass || false;
      req.apiToken = special.apiToken as ApiAccessToken;
      // For unsecured tokens, auto-set environmentId from parsed token
      if (special.unsecuredEnvironmentId) {
        req.environmentId = special.unsecuredEnvironmentId;
      }
      return next();
    }

    // 2. Check cache
    const cacheKey = `api_token:${token.substring(0, 16)}...`;
    let tokenData = await CacheService.get<ApiAccessToken>(cacheKey);

    // 3. Check database if not in cache
    if (!tokenData) {
      const dbToken = await ApiAccessToken.validateAndUse(token);
      if (!dbToken) {
        return res.status(401).json({
          success: false,
          error: { code: ErrorCodes.AUTH_TOKEN_INVALID, message: 'Invalid or expired API token' },
        });
      }
      tokenData = dbToken;
      await CacheService.set(cacheKey, tokenData, CACHE_TTL);
    } else if (tokenData.id) {
      // Record usage even if cached
      const { default: apiTokenUsageService } = await import('../services/api-token-usage-service');
      apiTokenUsageService.recordTokenUsage(tokenData.id).catch((e) => {
        logger.error('Failed to record token usage from cache:', e);
      });
    }

    // 4. Expiration check
    const isExpired = tokenData.expiresAt ? new Date() > new Date(tokenData.expiresAt) : false;
    if (isExpired) {
      return res.status(401).json({
        success: false,
        error: { code: ErrorCodes.AUTH_TOKEN_EXPIRED, message: 'API token has expired' },
      });
    }

    req.apiToken = tokenData;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: { code: ErrorCodes.INTERNAL_SERVER_ERROR, message: 'Authentication failed' },
    });
  }
};

/**
 * Validates token type (client, server, etc.)
 */
export const requireTokenType = (tokenType: 'client' | 'server' | 'admin') => {
  return (req: SDKRequest, res: Response, next: NextFunction) => {
    const apiToken = req.apiToken;
    if (!apiToken) {
      return res.status(401).json({
        success: false,
        error: { code: ErrorCodes.AUTH_TOKEN_MISSING, message: 'Token not found' },
      });
    }

    if (apiToken.tokenType === (tokenType as any)) {
      return next();
    }

    logger.warn('Auth: Token type mismatch', {
      tokenId: apiToken.id,
      tokenType: apiToken.tokenType,
      requiredType: tokenType,
      url: req.originalUrl,
      isUnsecured: (req as any).isUnsecuredToken,
    });

    res.status(403).json({
      success: false,
      error: {
        code: ErrorCodes.AUTH_PERMISSION_DENIED,
        message: `Invalid token type. Required: ${tokenType}`,
      },
    });
  };
};

/**
 * Validates application name from header or query
 */
export const validateApplicationName = (req: SDKRequest, res: Response, next: NextFunction) => {
  const appName =
    (req.headers[HEADERS.X_APPLICATION_NAME] as string) || (req.query.appName as string);

  if (!appName) {
    logger.warn('Auth: Application name missing', { url: req.originalUrl });
    return res.status(400).json({
      success: false,
      error: { code: ErrorCodes.BAD_REQUEST, message: `${HEADERS.X_APPLICATION_NAME} is required` },
    });
  }

  // Validate format
  if (!/^[a-zA-Z0-9_-]+$/.test(appName) || appName.length > 100) {
    logger.warn('Auth: Invalid application name format', { appName });
    return res.status(400).json({
      success: false,
      error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid application name format' },
    });
  }

  (req as any).applicationName = appName;
  next();
};

/**
 * Resolves environment from token (token determines everything).
 * No fallback: environment MUST come from the token.
 */
export const setSDKEnvironment = async (req: SDKRequest, res: Response, next: NextFunction) => {
  try {
    // Token determines environment — strict, no fallback
    const environmentId = req.apiToken?.environmentId || req.environmentId; // Already set by unsecured token handler

    if (!environmentId) {
      logger.warn('Auth: Environment not determined from token', {
        url: req.originalUrl,
        tokenId: req.apiToken?.id,
      });
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCodes.ENV_INVALID,
          message: 'Environment could not be determined from token',
        },
      });
    }

    // Resolve and validate environment
    const cacheKey = `sdk_env:${environmentId}`;
    let env = await CacheService.get<Environment>(cacheKey);

    if (!env) {
      env = (await Environment.getById(environmentId)) || null;
      if (!env) {
        logger.warn('Auth: Environment not found', { environmentId });
        return res.status(404).json({
          success: false,
          error: {
            code: ErrorCodes.ENV_NOT_FOUND,
            message: `Environment not found: ${environmentId}`,
          },
        });
      }
      await CacheService.set(cacheKey, env, CACHE_TTL);
    }

    req.environmentId = env.id;
    req.environmentModel = env;

    // Access check (skip for unsecured/bypass tokens)
    if (!req.isUnsecuredToken && !req.isEdgeBypassToken && req.apiToken) {
      const hasAccess = checkEnvironmentAccess(req.apiToken, req.environmentId);
      if (!hasAccess) {
        logger.warn('Auth: Environment access denied', {
          tokenId: req.apiToken.id,
          tokenType: req.apiToken.tokenType,
          tokenEnv: req.apiToken.environmentId,
          requestedEnv: req.environmentId,
          url: req.originalUrl,
        });
        return res.status(403).json({
          success: false,
          error: {
            code: ErrorCodes.ENV_ACCESS_DENIED,
            message: 'Token does not have access to this environment',
          },
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Environment resolution error:', error);
    res.status(500).json({
      success: false,
      error: { code: ErrorCodes.INTERNAL_SERVER_ERROR, message: 'Failed to resolve environment' },
    });
  }
};

export const sdkRateLimit = (req: SDKRequest, res: Response, next: NextFunction) => next();

/**
 * Combined authentication chain for Client SDK
 */
export const clientSDKAuth = [
  authenticateApiToken,
  requireTokenType('client'),
  validateApplicationName,
  setSDKEnvironment,
  sdkRateLimit,
];

/**
 * Base authentication for Server SDK (No environment required)
 */
export const serverAuthBase = [
  authenticateApiToken,
  requireTokenType('server'),
  validateApplicationName,
  sdkRateLimit,
];

/**
 * Combined authentication chain for Server SDK (With environment)
 */
export const serverSDKAuth = [...serverAuthBase, setSDKEnvironment];

export const authenticateServerApiToken = serverSDKAuth;

export default {
  authenticateApiToken,
  authenticateServerApiToken,
  requireTokenType,
  validateApplicationName,
  setSDKEnvironment,
  sdkRateLimit,
  clientSDKAuth,
  serverSDKAuth,
  serverAuthBase,
};
