import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { tokenMirrorService } from '../services/tokenMirrorService';
import { tokenUsageTracker } from '../services/tokenUsageTracker';

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
 */
export function clientAuth(req: ClientRequest, res: Response, next: NextFunction): void {
  const apiToken = req.headers['x-api-token'] as string;
  const applicationName = req.headers['x-application-name'] as string;
  const environment = req.headers['x-environment'] as string;
  const clientVersion = req.headers['x-client-version'] as string | undefined;
  const platform = req.headers['x-platform'] as string | undefined;

  // Validate required headers
  if (!apiToken) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_TOKEN',
        message: 'x-api-token header is required',
      },
    });
    return;
  }

  if (!applicationName) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_APPLICATION_NAME',
        message: 'x-application-name header is required',
      },
    });
    return;
  }

  if (!environment) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_ENVIRONMENT',
        message: 'x-environment header is required',
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
      invalid_type: { code: 'INVALID_TOKEN_TYPE', message: 'Token is not authorized for client API access' },
      invalid_environment: { code: 'INVALID_ENVIRONMENT', message: 'Token is not authorized for this environment' },
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

  // Record token usage for tracking
  if (validation.token?.id) {
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

