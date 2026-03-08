import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../config/logger';

const logger = createLogger('ClientAuth');
import { tokenMirrorService } from '../services/token-mirror-service';
import { tokenUsageTracker } from '../services/token-usage-tracker';
import { environmentRegistry } from '../services/environment-registry';

// Unsecured token format: unsecured-{org}:{project}:{env}-{type}-api-token
const UNSECURED_TOKEN_REGEX =
  /^unsecured-([^:]+):([^:]+):(.+)-(server|client|edge)-api-token$/;

// Legacy unsecured tokens — auto-resolve to default/default/development
const LEGACY_TOKENS: Record<string, boolean> = {
  'gatrix-unsecured-client-api-token': true,
  'gatrix-unsecured-server-api-token': true,
  'gatrix-unsecured-edge-api-token': true,
};
const LEGACY_ENV_NAME = 'development';

// Exported constants used by other services
export const UNSECURED_CLIENT_TOKEN = 'gatrix-unsecured-client-api-token';
export const UNSECURED_SERVER_TOKEN = 'gatrix-unsecured-server-api-token';
export const UNSECURED_EDGE_TOKEN = 'gatrix-unsecured-edge-api-token';
export const UNSECURED_TOKENS = [
  UNSECURED_CLIENT_TOKEN,
  UNSECURED_SERVER_TOKEN,
  UNSECURED_EDGE_TOKEN,
];

export interface ClientRequest extends Request {
  clientContext?: {
    apiToken: string;
    applicationName: string;
    /**
     * Actual environment ID (ULID).
     * Resolved from token, not from URL path.
     */
    environmentId: string;
    /**
     * SDK cache key for this environment.
     * Format: unsecured-{orgId}:{projectId}:{envId}-server-api-token
     * Falls back to environmentId if not resolved.
     */
    cacheKey: string;
    clientVersion?: string;
    platform?: string;
    tokenName?: string;
  };
}

/**
 * Client authentication middleware
 * Validates required headers and API token from client requests
 * Environment is resolved from the token (not from URL path)
 */
export function clientAuth(
  req: ClientRequest,
  res: Response,
  next: NextFunction
): void {
  // Extract token from multiple sources
  const authHeader = req.headers['authorization'] as string | undefined;
  let apiToken = req.headers['x-api-token'] as string | undefined;

  if (!apiToken && authHeader?.startsWith('Bearer ')) {
    apiToken = authHeader.substring(7);
  }

  // Support token in query for testing convenience
  if (!apiToken) {
    apiToken = (req.query.token as string) || (req.query.apiToken as string);
  }

  // Support applicationName in query
  const applicationName =
    (req.headers['x-application-name'] as string) ||
    (req.query.appName as string) ||
    (req.query.applicationName as string);

  const clientVersion = req.headers['x-client-version'] as string | undefined;
  const platform = req.headers['x-platform'] as string | undefined;

  // Validate required parameters
  if (!apiToken) {
    logger.warn('Missing API token in client request', {
      url: req.originalUrl,
      query: req.query,
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_TOKEN',
        message: 'x-api-token header or token query parameter is required',
      },
    });
    return;
  }

  if (!applicationName) {
    logger.warn('Missing application name in client request', {
      url: req.originalUrl,
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_APPLICATION_NAME',
        message:
          'x-application-name header or appName query parameter is required',
      },
    });
    return;
  }

  // 1. Try unsecured token format: unsecured-{org}:{project}:{env}-{type}-api-token
  const unsecuredMatch = apiToken.match(UNSECURED_TOKEN_REGEX);
  if (unsecuredMatch) {
    const [, , , envId] = unsecuredMatch;
    const environmentId =
      environmentRegistry.resolveEnvironmentId(envId) || envId;
    req.clientContext = {
      apiToken,
      applicationName,
      environmentId,
      cacheKey: apiToken,
      clientVersion,
      platform,
      tokenName: `Unsecured Token (${envId})`,
    };
    logger.debug('Authenticated with unsecured format token', {
      environmentId,
    });
    return next();
  }

  // 2. Legacy unsecured tokens → resolve to default/default/development
  if (LEGACY_TOKENS[apiToken]) {
    const cacheKey =
      environmentRegistry.resolveEnvironmentToken(LEGACY_ENV_NAME);
    if (!cacheKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'ENVIRONMENT_NOT_FOUND',
          message: 'Could not resolve environment for legacy token',
        },
      });
      return;
    }
    const environmentId =
      environmentRegistry.resolveEnvironmentId(LEGACY_ENV_NAME) ||
      LEGACY_ENV_NAME;
    req.clientContext = {
      apiToken,
      applicationName,
      environmentId,
      cacheKey,
      clientVersion,
      platform,
      tokenName: 'Legacy Unsecured Token',
    };
    logger.debug('Authenticated with legacy unsecured token', {
      environmentId,
      cacheKey,
    });
    return next();
  }

  // 3. Real production token — validate and resolve environment
  const validation = tokenMirrorService.validateToken(apiToken, 'client');

  if (!validation.valid) {
    const errorMessages: Record<string, { code: string; message: string }> = {
      not_found: { code: 'INVALID_TOKEN', message: 'Invalid API token' },
      expired: { code: 'TOKEN_EXPIRED', message: 'API token has expired' },
      invalid_type: {
        code: 'INVALID_TOKEN_TYPE',
        message: 'Token is not authorized for client API access',
      },
      invalid_environment: {
        code: 'INVALID_ENVIRONMENT',
        message: 'Token is not authorized for this environment',
      },
    };

    const error = errorMessages[validation.reason || 'not_found'];

    logger.warn('Client authentication failed', {
      reason: validation.reason,
      applicationName,
    });

    res.status(401).json({
      success: false,
      error,
    });
    return;
  }

  // Record token usage for tracking (skip unsecured tokens with id=0)
  if (validation.token?.id && validation.token.id > 0) {
    tokenUsageTracker.recordUsage(validation.token.id);
  }

  // Resolve environment from token
  const token = validation.token;
  const envName = token?.environments?.[0];
  if (!envName || envName === '*') {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token does not have a specific environment binding',
      },
    });
    return;
  }

  const cacheKey = environmentRegistry.resolveEnvironmentToken(envName);
  if (!cacheKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'ENVIRONMENT_NOT_FOUND',
        message: `Could not resolve environment: ${envName}`,
      },
    });
    return;
  }

  const environmentId =
    environmentRegistry.resolveEnvironmentId(envName) || envName;
  req.clientContext = {
    apiToken,
    applicationName,
    environmentId,
    cacheKey,
    clientVersion,
    platform,
    tokenName: validation.token?.tokenName,
  };

  logger.debug('Client authenticated', {
    applicationName,
    environmentId,
    clientVersion,
    platform,
    tokenName: validation.token?.tokenName,
  });

  next();
}
