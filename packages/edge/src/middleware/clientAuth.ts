import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { tokenMirrorService } from '../services/tokenMirrorService';
import { tokenUsageTracker } from '../services/tokenUsageTracker';

// Unsecured tokens for testing purposes
const UNSECURED_CLIENT_TOKEN = 'gatrix-unsecured-client-api-token';
const UNSECURED_SERVER_TOKEN = 'gatrix-unsecured-server-api-token';
const UNSECURED_EDGE_TOKEN = 'gatrix-unsecured-edge-api-token';

export interface ClientRequest extends Request {
  clientContext?: {
    apiToken: string;
    applicationName: string;
    /**
     * Environment identifier (environmentName value).
     * This is the standard external identifier for environments.
     */
    environment: string;
    clientVersion?: string;
    platform?: string;
    tokenName?: string;
  };
}

/**
 * Client authentication middleware
 * Validates required headers and API token from client requests
 * Uses locally mirrored tokens for validation (no backend call needed)
 *
 * Environment is extracted from URL path parameter (:environment)
 * instead of x-environment header for cleaner API design.
 */
export function clientAuth(req: ClientRequest, res: Response, next: NextFunction): void {
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

  // Get environment from URL path parameter instead of header
  const environment = req.params.environment as string;
  const clientVersion = req.headers['x-client-version'] as string | undefined;
  const platform = req.headers['x-platform'] as string | undefined;

  // Validate required parameters
  if (!apiToken) {
    logger.warn('Missing API token in client request', { url: req.originalUrl, query: req.query });
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
    logger.warn('Missing application name in client request', { url: req.originalUrl });
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_APPLICATION_NAME',
        message: 'x-application-name header or appName query parameter is required',
      },
    });
    return;
  }

  // Handle Unsecured Tokens (Bypass)
  if (
    apiToken === UNSECURED_CLIENT_TOKEN ||
    apiToken === UNSECURED_SERVER_TOKEN ||
    apiToken === UNSECURED_EDGE_TOKEN
  ) {
    req.clientContext = {
      apiToken,
      applicationName,
      environment,
      clientVersion,
      platform,
      tokenName: 'Unsecured Testing Token',
    };
    logger.debug('Authenticated with unsecured token', { token: apiToken, environment });
    return next();
  }

  // Validate environment from path parameter
  if (!environment) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_ENVIRONMENT',
        message: 'Environment is required in URL path (e.g., /api/v1/client/{environment}/...)',
      },
    });
    return;
  }

  // Validate API token using mirrored tokens
  const validation = tokenMirrorService.validateToken(apiToken, 'client', environment);

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
      environment,
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

  // Set client context
  req.clientContext = {
    apiToken,
    applicationName,
    environment,
    clientVersion,
    platform,
    tokenName: validation.token?.tokenName,
  };

  logger.debug('Client authenticated', {
    applicationName,
    environment,
    clientVersion,
    platform,
    tokenName: validation.token?.tokenName,
  });

  next();
}
