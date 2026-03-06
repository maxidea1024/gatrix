/**
 * Environment Middleware
 *
 * Middleware for handling environment context in multi-environment setup.
 * This middleware:
 * - Extracts environment from request (header: x-environment)
 * - Validates the environment exists
 * - Sets the environment context for the request
 */

import { Response, NextFunction } from 'express';
import { createLogger } from '../config/logger';

const logger = createLogger('environmentMiddleware');
import { AuthenticatedRequest } from '../types/auth';
import { Environment } from '../models/Environment';

/**
 * Middleware to extract and set environment context
 * This should be applied to all routes that need environment filtering
 */
export const environmentContextMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract environment from header ONLY
    // Extract environment ID (ULID) from header
    const environmentId = req.headers['x-environment-id'] as string;

    if (!environmentId) {
      // If no environment is specified, we don't set req.environmentId
      // Controllers should handle missing environment if they need it
      return next();
    }

    // Validate environment exists by ULID id
    const env = await Environment.getById(environmentId);
    if (!env) {
      logger.warn(`Invalid environment requested: ${environmentId}`);
      return next();
    }

    req.environmentId = env.id;

    next();
  } catch (error) {
    logger.error('Error in environment middleware:', error);
    next();
  }
};

/**
 * Middleware to require a specific environment type
 * Use this to restrict certain routes to specific environment types
 */
export const requireEnvironmentType = (allowedTypes: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const environmenId = req.environmentId;

      if (!environmenId) {
        res.status(400).json({
          success: false,
          message: 'Environment context is required for this operation',
        });
        return;
      }

      const env = await Environment.getById(environmenId as string);

      if (!env || !allowedTypes.includes(env.environmentType)) {
        res.status(403).json({
          success: false,
          message: `This operation is not allowed in ${env?.environmentType || 'unknown'} environment`,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in requireEnvironmentType middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate environment type',
      });
    }
  };
};

/**
 * Middleware to prevent modifications in production environment
 * Useful for protecting critical data
 */
export const preventProductionModification = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const environmentId = req.environmentId;

    if (!environmentId) {
      return next();
    }

    const environment = await Environment.getById(environmentId as string);

    if (environment?.environmentType === 'production') {
      // For production, check if approval is required
      if (environment.requiresApproval) {
        // TODO: Implement approval workflow
        // For now, just log a warning
        logger.warn(`Production modification attempted without approval workflow`);
      }
    }

    next();
  } catch (error) {
    logger.error('Error in preventProductionModification middleware:', error);
    next();
  }
};
