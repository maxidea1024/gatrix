import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export interface ClientRequest extends Request {
  clientContext?: {
    apiToken: string;
    applicationName: string;
    environmentId: string;
    clientVersion?: string;
    platform?: string;
  };
}

/**
 * Client authentication middleware
 * Validates required headers from client requests
 */
export function clientAuth(req: ClientRequest, res: Response, next: NextFunction): void {
  const apiToken = req.headers['x-api-token'] as string;
  const applicationName = req.headers['x-application-name'] as string;
  const environmentId = req.headers['x-environment-id'] as string;
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

  if (!environmentId) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_ENVIRONMENT_ID',
        message: 'x-environment-id header is required',
      },
    });
    return;
  }

  // TODO: Validate API token against cached tokens
  // For now, we just pass through the headers
  // In production, this should validate against ApiTokenCacheService

  // Set client context
  req.clientContext = {
    apiToken,
    applicationName,
    environmentId,
    clientVersion,
    platform,
  };

  logger.debug('Client authenticated', {
    applicationName,
    environmentId,
    clientVersion,
    platform,
  });

  next();
}

