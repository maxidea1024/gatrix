/**
 * Environment Resolver Middleware
 * Resolves environment from URL parameter and attaches to request
 */

import { Response, NextFunction } from 'express';
import { SDKRequest } from './apiTokenAuth';
import { Environment } from '../models/Environment';
import logger from '../config/logger';

export interface EnvironmentRequest extends SDKRequest {
  environment?: string;
  environmentModel?: Environment;
}

/**
 * Middleware to resolve environment from :env URL parameter
 * Accepts environment name
 */
export const resolveEnvironment = async (
  req: EnvironmentRequest,
  res: Response,
  next: NextFunction
) => {
  const envParam = req.params.env;

  if (!envParam) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_ENVIRONMENT',
        message: 'Environment parameter is required',
      },
    });
  }

  try {
    // Find environment by name
    const environment = await Environment.getByName(envParam);

    if (!environment) {
      logger.warn(`Environment not found: ${envParam}`);
      return res.status(404).json({
        success: false,
        error: {
          code: 'ENVIRONMENT_NOT_FOUND',
          message: `Environment '${envParam}' not found`,
        },
      });
    }

    // Attach environment to request
    req.environment = environment.environment;
    req.environmentModel = environment;

    next();
  } catch (error) {
    logger.error('Error resolving environment:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to resolve environment',
      },
    });
  }
};

export default resolveEnvironment;
