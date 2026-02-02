/**
 * Environment Middleware
 *
 * Middleware for handling environment context in multi-environment setup.
 * This middleware:
 * - Extracts environment from request (header: x-environment)
 * - Validates the environment exists
 * - Sets the environment context for the request
 */

import { Response, NextFunction } from "express";
import logger from "../config/logger";
import { AuthenticatedRequest } from "../types/auth";
import { Environment } from "../models/Environment";

/**
 * Middleware to extract and set environment context
 * This should be applied to all routes that need environment filtering
 */
export const environmentContextMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Extract environment from header ONLY
    const environmentName = req.headers["x-environment"] as string;

    if (!environmentName) {
      // If no environment is specified, we don't set req.environment
      // Controllers should handle missing environment if they need it
      return next();
    }

    // Validate environment exists
    const environment = await Environment.getByName(environmentName);
    if (!environment) {
      logger.warn(`Invalid environment requested: ${environmentName}`);
      return next();
    }

    req.environment = environment.environment;

    next();
  } catch (error) {
    logger.error("Error in environment middleware:", error);
    next();
  }
};

/**
 * Middleware to require a specific environment type
 * Use this to restrict certain routes to specific environment types
 */
export const requireEnvironmentType = (allowedTypes: string[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const environmentName = req.environment;

      if (!environmentName) {
        res.status(400).json({
          success: false,
          message: "Environment context is required for this operation",
        });
        return;
      }

      const environment = await Environment.getByName(environmentName);

      if (!environment || !allowedTypes.includes(environment.environmentType)) {
        res.status(403).json({
          success: false,
          message: `This operation is not allowed in ${environment?.environmentType || "unknown"} environment`,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error("Error in requireEnvironmentType middleware:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate environment type",
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
  next: NextFunction,
): Promise<void> => {
  try {
    const environmentName = req.environment;

    if (!environmentName) {
      return next();
    }

    const environment = await Environment.getByName(environmentName);

    if (environment?.environmentType === "production") {
      // For production, check if approval is required
      if (environment.requiresApproval) {
        // TODO: Implement approval workflow
        // For now, just log a warning
        logger.warn(
          `Production modification attempted without approval workflow`,
        );
      }
    }

    next();
  } catch (error) {
    logger.error("Error in preventProductionModification middleware:", error);
    next();
  }
};
