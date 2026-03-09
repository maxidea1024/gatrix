/**
 * Environment Key Authentication Middleware
 *
 * Replaces the legacy apiTokenAuth for SDK routes.
 * Key → environment → project → organisation (auto-resolve chain).
 *
 * Middleware exports:
 *  - authenticateEnvironmentKey  — core auth (resolves environment from key)
 *  - requireKeyType(type)        — checks client/server key type
 *  - environmentKeyClientAuth    — combined chain for client SDK
 *  - environmentKeyServerAuth    — combined chain for server SDK (with env)
 *  - environmentKeyServerBase    — server SDK without env requirement
 */

import { Request, Response, NextFunction } from 'express';
import {
  EnvironmentKey,
  EnvironmentKeyRecord,
  KeyType,
} from '../models/environment-key';
import { Environment } from '../models/environment';
import { CacheService } from '../services/cache-service';
import { createLogger } from '../config/logger';

const logger = createLogger('environmentKeyAuth');
import { HEADERS, HEADER_VALUES } from '../constants/headers';
import { ErrorCodes } from '../utils/api-response';

// ==================== Constants ====================

const UNSECURED_TOKENS = {
  CLIENT: 'unsecured-client-api-token',
  SERVER: 'unsecured-server-api-token',
  EDGE: 'unsecured-edge-api-token',
} as const;

export const EDGE_BYPASS_TOKEN =
  process.env.EDGE_BYPASS_TOKEN || 'gatrix-edge-internal-bypass-token';

const ALLOW_UNSECURED = process.env.ALLOW_UNSECURED_SDK === 'true';

const ENV_KEY_CACHE_TTL = 300; // 5 minutes

// ==================== Types ====================

export interface EnvironmentKeyRequest extends Request {
  envKey?: EnvironmentKeyRecord;
  environmentId?: string;
  environmentModel?: Environment;
  projectId?: string;
  orgId?: string;
  keyType?: KeyType;
  isUnsecuredToken?: boolean;
  isEdgeBypassToken?: boolean;
}

// ==================== Helpers ====================

/**
 * Extract token from Authorization header, X-Api-Token header, or query params
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
 * Handle special unsecured/bypass tokens (dev/testing only)
 */
function handleSpecialTokens(token: string): {
  keyType: KeyType | 'all';
  isUnsecured?: boolean;
  isEdgeBypass?: boolean;
} | null {
  if (!ALLOW_UNSECURED) {
    // Only bypass token is allowed in production
    if (token === EDGE_BYPASS_TOKEN) {
      return { keyType: 'all', isEdgeBypass: true };
    }
    return null;
  }

  // Unsecured tokens (dev only)
  const tokenTypeMap: Record<string, KeyType | 'all'> = {
    [UNSECURED_TOKENS.CLIENT]: 'client',
    [UNSECURED_TOKENS.SERVER]: 'server',
    [UNSECURED_TOKENS.EDGE]: 'all',
  };

  const keyType = tokenTypeMap[token];
  if (keyType) {
    return { keyType, isUnsecured: true };
  }

  if (token === EDGE_BYPASS_TOKEN) {
    return { keyType: 'all', isEdgeBypass: true };
  }

  return null;
}

// ==================== Middlewares ====================

/**
 * Core authentication: resolve Environment Key → environment → project → org
 */
export const authenticateEnvironmentKey = async (
  req: EnvironmentKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.AUTH_TOKEN_MISSING,
          message: 'API key is required',
        },
      });
    }

    // 1. Handle special tokens
    const special = handleSpecialTokens(token);
    if (special) {
      req.isUnsecuredToken = special.isUnsecured || false;
      req.isEdgeBypassToken = special.isEdgeBypass || false;
      req.keyType = special.keyType === 'all' ? 'server' : special.keyType;

      // Unsecured tokens with legacy format do not carry environment info.
      // Use the new format (unsecured-{org}:{project}:{env}-{type}-api-token)
      // via api-token-auth.ts instead.

      return next();
    }

    // 2. Check cache
    const cacheKey = `env_key:${token.substring(0, 20)}`;
    let keyData = await CacheService.get<EnvironmentKeyRecord>(cacheKey);

    // 3. Lookup in DB
    if (!keyData) {
      const dbKey = await EnvironmentKey.findByKeyValue(token);
      if (!dbKey) {
        return res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTH_TOKEN_INVALID,
            message: 'Invalid or inactive API key',
          },
        });
      }
      keyData = dbKey;
      await CacheService.set(cacheKey, keyData, ENV_KEY_CACHE_TTL);
    }

    // 4. Set request context
    req.envKey = keyData;
    req.keyType = keyData.keyType;
    req.environmentId = keyData.environmentId;

    // 5. Resolve environment → project → org chain
    const envModel = await Environment.getById(keyData.environmentId);
    if (!envModel) {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCodes.ENV_NOT_FOUND,
          message: 'Environment not found for this key',
        },
      });
    }
    req.environmentModel = envModel;
    req.projectId = (envModel as any).projectId;

    // Resolve orgId from project if available
    if (req.projectId) {
      const { default: knex } = await import('../config/knex');
      const project = await knex('g_projects')
        .select('orgId')
        .where('id', req.projectId)
        .first();
      if (project) {
        req.orgId = project.orgId;
      }
    }

    // 6. Record usage (fire-and-forget)
    EnvironmentKey.recordUsage(keyData.id).catch((e) => {
      logger.error('Failed to record env key usage:', e);
    });

    next();
  } catch (error) {
    logger.error('Environment key authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Authentication failed',
      },
    });
  }
};

/**
 * Require a specific key type (client or server)
 */
export const requireKeyType = (requiredType: KeyType) => {
  return (req: EnvironmentKeyRequest, res: Response, next: NextFunction) => {
    // Unsecured/bypass tokens pass all type checks
    if (req.isUnsecuredToken || req.isEdgeBypassToken) {
      return next();
    }

    if (!req.keyType) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.AUTH_TOKEN_MISSING,
          message: 'Key not authenticated',
        },
      });
    }

    if (req.keyType !== requiredType) {
      logger.warn('Key type mismatch', {
        keyId: req.envKey?.id,
        keyType: req.keyType,
        requiredType,
        url: req.originalUrl,
      });
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCodes.AUTH_PERMISSION_DENIED,
          message: `Invalid key type. Required: ${requiredType}`,
        },
      });
    }

    next();
  };
};

/**
 * Validate application name from header or query
 */
export const validateApplicationName = (
  req: EnvironmentKeyRequest,
  res: Response,
  next: NextFunction
) => {
  const appName =
    (req.headers[HEADERS.X_APPLICATION_NAME] as string) ||
    (req.query.appName as string);

  if (!appName) {
    logger.warn('Application name missing', { url: req.originalUrl });
    return res.status(400).json({
      success: false,
      error: {
        code: ErrorCodes.BAD_REQUEST,
        message: 'X-Application-Name is required',
      },
    });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(appName) || appName.length > 100) {
    logger.warn('Invalid application name format', { appName });
    return res.status(400).json({
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid application name format',
      },
    });
  }

  (req as any).applicationName = appName;
  next();
};

/**
 * No-op rate limiter (placeholder for future implementation)
 */
export const sdkRateLimit = (
  req: EnvironmentKeyRequest,
  res: Response,
  next: NextFunction
) => next();

// ==================== Combined Auth Chains ====================

/**
 * Client SDK: key auth + client type + app name + rate limit
 * Environment is auto-resolved from the key itself.
 */
export const environmentKeyClientAuth = [
  authenticateEnvironmentKey,
  requireKeyType('client'),
  validateApplicationName,
  sdkRateLimit,
];

/**
 * Server SDK base: key auth + server type + app name + rate limit
 * Environment is auto-resolved from the key itself.
 */
export const environmentKeyServerBase = [
  authenticateEnvironmentKey,
  requireKeyType('server'),
  validateApplicationName,
  sdkRateLimit,
];

/**
 * Server SDK with environment: same as base (env is already resolved from key)
 */
export const environmentKeyServerAuth = [...environmentKeyServerBase];

export default {
  authenticateEnvironmentKey,
  requireKeyType,
  validateApplicationName,
  sdkRateLimit,
  environmentKeyClientAuth,
  environmentKeyServerAuth,
  environmentKeyServerBase,
};
