import { Request, Response, NextFunction } from 'express';
import { tokenMirrorService } from '../services/token-mirror-service';
import { environmentRegistry } from '../services/environment-registry';
import { ErrorCodes, sendUnauthorized } from '../utils/api-response';

// Unsecured token format: unsecured-{org}:{project}:{env}-{type}-api-token
const UNSECURED_TOKEN_REGEX =
  /^unsecured-([^:]+):([^:]+):(.+)-(server|client|edge)-api-token$/;

// Legacy unsecured tokens — auto-resolve to default/default/development
const LEGACY_TOKENS: Record<string, boolean> = {
  'unsecured-client-api-token': true,
  'unsecured-server-api-token': true,
  'unsecured-edge-api-token': true,
};
const LEGACY_ENV_NAME = 'development';

/**
 * Extended request with resolved environment
 */
export interface ServerRequest extends Request {
  environmentId?: string;
  cacheKey?: string;
  applicationName?: string;
}

/**
 * Server SDK authentication middleware for Edge
 * Resolves environment from token (no :env path parameter)
 */
export function serverAuth(
  req: ServerRequest,
  res: Response,
  next: NextFunction
): void {
  const apiToken = req.headers['x-api-token'] as string;

  if (!apiToken) {
    sendUnauthorized(
      res,
      'x-api-token header is required',
      ErrorCodes.AUTH_TOKEN_REQUIRED
    );
    return;
  }

  // 1. Try unsecured token format: unsecured-{org}:{project}:{env}-{type}-api-token
  const unsecuredMatch = apiToken.match(UNSECURED_TOKEN_REGEX);
  if (unsecuredMatch) {
    const [, , , envId] = unsecuredMatch;
    // The token IS the cache key for the SDK
    req.cacheKey = apiToken;
    // Resolve actual environment ID from the registry
    req.environmentId =
      environmentRegistry.resolveEnvironmentId(envId) || envId;
    req.applicationName =
      (req.headers['x-application-name'] as string) || 'unknown';
    return next();
  }

  // 2. Legacy unsecured tokens → resolve to development
  if (LEGACY_TOKENS[apiToken]) {
    const cacheKey =
      environmentRegistry.resolveEnvironmentToken(LEGACY_ENV_NAME);
    if (!cacheKey) {
      sendUnauthorized(
        res,
        'Could not resolve environment for legacy token',
        ErrorCodes.AUTH_TOKEN_INVALID
      );
      return;
    }
    req.cacheKey = cacheKey;
    // Get actual environment ID
    req.environmentId =
      environmentRegistry.resolveEnvironmentId(LEGACY_ENV_NAME) ||
      LEGACY_ENV_NAME;
    req.applicationName =
      (req.headers['x-application-name'] as string) || 'unknown';
    return next();
  }

  // 3. Real production token — validate and resolve environment
  const validation = tokenMirrorService.validateToken(apiToken, 'server');
  if (!validation.valid) {
    sendUnauthorized(
      res,
      'Invalid or unauthorized server API token',
      ErrorCodes.AUTH_TOKEN_INVALID
    );
    return;
  }

  // Resolve environment from token (token:environment is 1:1)
  const token = validation.token;
  const tokenEnvId = token?.environmentId;
  if (!tokenEnvId) {
    sendUnauthorized(
      res,
      'Token does not have a specific environment binding',
      ErrorCodes.AUTH_TOKEN_INVALID
    );
    return;
  }

  const cacheKey = environmentRegistry.resolveEnvironmentToken(tokenEnvId);
  if (!cacheKey) {
    sendUnauthorized(
      res,
      `Could not resolve environment: ${tokenEnvId}`,
      ErrorCodes.AUTH_TOKEN_INVALID
    );
    return;
  }

  req.cacheKey = cacheKey;
  req.environmentId =
    environmentRegistry.resolveEnvironmentId(tokenEnvId) || tokenEnvId;
  req.applicationName =
    (req.headers['x-application-name'] as string) || 'unknown';

  next();
}
