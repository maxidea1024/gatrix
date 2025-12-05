/**
 * Environment Middleware
 *
 * Middleware for handling environment context in multi-environment setup.
 * This middleware:
 * - Extracts environment ID from request (header, query, or body)
 * - Validates the environment exists
 * - Sets the environment context for the request
 * - Optionally validates user access to the environment
 */

import { Request, Response, NextFunction } from 'express';
import db from '../config/knex';
import logger from '../config/logger';
import {
  getEnvironmentIdFromRequest,
  runWithEnvironmentAsync,
  getDefaultEnvironmentId,
  validateEnvironmentId,
  isDefaultEnvironmentInitialized
} from '../utils/environmentContext';

// Extend Express Request to include environment info
declare global {
  namespace Express {
    interface Request {
      environmentId?: string; // ULID
      environmentName?: string;
    }
  }
}

/**
 * Middleware to extract and set environment context
 * This should be applied to all routes that need environment filtering
 */
export const environmentContextMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if default environment is initialized
    if (!isDefaultEnvironmentInitialized()) {
      logger.warn('Default environment not initialized, skipping environment context');
      next();
      return;
    }

    const environmentId = getEnvironmentIdFromRequest(req);
    const defaultEnvId = getDefaultEnvironmentId();

    // Validate environment exists
    const isValid = await validateEnvironmentId(db, environmentId);
    if (!isValid) {
      logger.warn(`Invalid environment ID requested: ${environmentId}`);
      // Fall back to default environment instead of failing
      req.environmentId = defaultEnvId;
    } else {
      req.environmentId = environmentId;
    }

    // Get environment name for logging
    const environment = await db('g_remote_config_environments')
      .where('id', req.environmentId)
      .select('environmentName')
      .first();

    if (environment) {
      req.environmentName = environment.environmentName;
    }

    // Run the rest of the request with environment context
    await runWithEnvironmentAsync(req.environmentId, async () => {
      next();
    });
  } catch (error) {
    logger.error('Error in environment middleware:', error);
    // Don't fail the request, just use default environment
    if (isDefaultEnvironmentInitialized()) {
      req.environmentId = getDefaultEnvironmentId();
    }
    next();
  }
};

/**
 * Middleware to require a specific environment type
 * Use this to restrict certain routes to specific environment types
 */
export const requireEnvironmentType = (allowedTypes: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const environmentId = req.environmentId ?? getDefaultEnvironmentId();

      const environment = await db('g_remote_config_environments')
        .where('id', environmentId)
        .select('environmentType')
        .first();

      if (!environment || !allowedTypes.includes(environment.environmentType)) {
        res.status(403).json({
          success: false,
          message: `This operation is not allowed in ${environment?.environmentType || 'unknown'} environment`
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in requireEnvironmentType middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate environment type'
      });
    }
  };
};

/**
 * Middleware to prevent modifications in production environment
 * Useful for protecting critical data
 */
export const preventProductionModification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const environmentId = req.environmentId ?? getDefaultEnvironmentId();

    const environment = await db('g_remote_config_environments')
      .where('id', environmentId)
      .select('environmentType', 'requiresApproval')
      .first();

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

