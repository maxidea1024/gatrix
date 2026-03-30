import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../config/logger';

const logger = createLogger('ClientAuth');
import { tokenMirrorService } from '../services/token-mirror-service';
import { tokenUsageTracker } from '../services/token-usage-tracker';
import { environmentRegistry } from '../services/environment-registry';

// Unsecured token format: unsecured-{org}:{project}:{env}-{type}-api-token
const UNSECURED_TOKEN_REGEX =
  /^unsecured-([^:]+):([^:]+):(.+)-(server|client|edge)-api-token$/;
// Unsecured project token format: unsecured-{org}:{project}-project-api-token
const UNSECURED_PROJECT_TOKEN_REGEX =
  /^unsecured-([^:]+):([^:]+)-project-api-token$/;

// Legacy unsecured tokens — auto-resolve to default/default/development
const LEGACY_TOKENS: Record<string, boolean> = {
  'unsecured-client-api-token': true,
  'unsecured-server-api-token': true,
  'unsecured-edge-api-token': true,
};
const LEGACY_ENV_NAME = 'development';

// Exported constants used by other services
export const UNSECURED_CLIENT_TOKEN = 'unsecured-client-api-token';
export const UNSECURED_SERVER_TOKEN = 'unsecured-server-api-token';
export const UNSECURED_EDGE_TOKEN = 'unsecured-edge-api-token';
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
     * Same as environmentId (SDK uses environmentId as cache key).
     */
    cacheKey: string;
    clientVersion?: string;
    platform?: string;
    tokenName?: string;
    /**
     * Project ID when using project token (dynamic env resolution)
     */
    projectId?: string;
  };
}

/**
 * Client authentication middleware
 * Validates required headers and API token from client requests
 * Environment is resolved from the token (not from URL path)
 */
export async function clientAuth(
  req: ClientRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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
      cacheKey: environmentId,
      clientVersion,
      platform,
      tokenName: `Unsecured Token (${envId})`,
    };
    logger.debug('Authenticated with unsecured format token', {
      environmentId,
    });
    return next();
  }

  // 1b. Unsecured project token: unsecured-{org}:{project}-project-api-token
  const unsecuredProjectMatch = apiToken.match(UNSECURED_PROJECT_TOKEN_REGEX);
  if (unsecuredProjectMatch) {
    const [, , unsecuredProjectId] = unsecuredProjectMatch;
    if (!clientVersion) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CLIENT_VERSION',
          message: 'x-client-version header is required for project tokens',
        },
      });
      return;
    }

    // Resolve environment from version map
    const { versionMapService } =
      await import('../services/version-map-service');
    const targetEnv = versionMapService.resolveEnvironment(
      unsecuredProjectId,
      clientVersion,
      platform
    );
    if (!targetEnv) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ENVIRONMENT_NOT_FOUND',
          message: `No environment mapping found for version ${clientVersion}`,
        },
      });
      return;
    }

    const envId =
      environmentRegistry.resolveEnvironmentId(targetEnv) || targetEnv;
    req.clientContext = {
      apiToken,
      applicationName,
      environmentId: envId,
      cacheKey: envId,
      clientVersion,
      platform,
      tokenName: `Unsecured Project Token (${unsecuredProjectId})`,
      projectId: unsecuredProjectId,
    };
    logger.debug('Authenticated with unsecured project token', {
      environmentId: envId,
      projectId: unsecuredProjectId,
    });
    return next();
  }

  // 2. Legacy unsecured tokens → resolve to default/default/development
  if (LEGACY_TOKENS[apiToken]) {
    const envId = environmentRegistry.resolveEnvironmentId(LEGACY_ENV_NAME);
    if (!envId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'ENVIRONMENT_NOT_FOUND',
          message: 'Could not resolve environment for legacy token',
        },
      });
      return;
    }
    req.clientContext = {
      apiToken,
      applicationName,
      environmentId: envId,
      cacheKey: envId,
      clientVersion,
      platform,
      tokenName: 'Legacy Unsecured Token',
    };
    logger.debug('Authenticated with legacy unsecured token', {
      environmentId: envId,
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

  const token = validation.token;

  // 3a. Project token — dynamic env resolution
  if (token?.tokenType === 'project' && token.projectId) {
    if (!clientVersion) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CLIENT_VERSION',
          message: 'x-client-version header is required for project tokens',
        },
      });
      return;
    }

    const { versionMapService } =
      await import('../services/version-map-service');
    const targetEnv = versionMapService.resolveEnvironment(
      token.projectId.toString(),
      clientVersion,
      platform
    );
    if (!targetEnv) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ENVIRONMENT_NOT_FOUND',
          message: `No environment mapping found for version ${clientVersion}`,
        },
      });
      return;
    }

    const envId =
      environmentRegistry.resolveEnvironmentId(targetEnv) || targetEnv;
    if (!environmentRegistry.hasEnvironment(envId)) {
      res.status(401).json({
        success: false,
        error: {
          code: 'ENVIRONMENT_NOT_FOUND',
          message: `Could not resolve target environment: ${targetEnv}`,
        },
      });
      return;
    }

    req.clientContext = {
      apiToken,
      applicationName,
      environmentId: envId,
      cacheKey: envId,
      clientVersion,
      platform,
      tokenName: validation.token?.tokenName,
      projectId: token.projectId.toString(),
    };

    logger.debug('Client authenticated with project token', {
      applicationName,
      environmentId: envId,
      projectId: token.projectId,
      clientVersion,
      platform,
    });
    return next();
  }

  // 3b. Legacy environment-bound token
  const tokenEnvId = token?.environmentId;
  if (!tokenEnvId) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token does not have a specific environment binding',
      },
    });
    return;
  }

  const envId =
    environmentRegistry.resolveEnvironmentId(tokenEnvId) || tokenEnvId;
  if (!environmentRegistry.hasEnvironment(envId)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'ENVIRONMENT_NOT_FOUND',
        message: `Could not resolve environment: ${tokenEnvId}`,
      },
    });
    return;
  }

  req.clientContext = {
    apiToken,
    applicationName,
    environmentId: envId,
    cacheKey: envId,
    clientVersion,
    platform,
    tokenName: validation.token?.tokenName,
  };

  logger.debug('Client authenticated', {
    applicationName,
    environmentId: envId,
    clientVersion,
    platform,
    tokenName: validation.token?.tokenName,
  });

  next();
}
