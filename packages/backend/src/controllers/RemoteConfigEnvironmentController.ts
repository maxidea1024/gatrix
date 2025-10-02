import { Request, Response } from 'express';
import { RemoteConfigEnvironment } from '../models/RemoteConfigEnvironment';
import { RemoteConfigSegment } from '../models/RemoteConfigSegment';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../config/logger';

export class RemoteConfigEnvironmentController {
  /**
   * Get all environments
   */
  static getEnvironments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environments = await RemoteConfigEnvironment.getAll();
    
    // Get stats for each environment
    const environmentsWithStats = await Promise.all(
      environments.map(async (env) => {
        const stats = await env.getStats();
        return {
          ...env,
          stats
        };
      })
    );

    res.json({
      success: true,
      data: environmentsWithStats
    });
  });

  /**
   * Get environment by ID
   */
  static getEnvironment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const environment = await RemoteConfigEnvironment.query()
      .findById(id)
      .withGraphFetched('[creator(basicInfo), updater(basicInfo)]')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      });

    if (!environment) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    const stats = await environment.getStats();

    res.json({
      success: true,
      data: {
        ...environment,
        stats
      }
    });
  });

  /**
   * Create new environment
   */
  static createEnvironment = asyncHandler(async (req: Request, res: Response) => {
    const { environmentName, displayName, description, requiresApproval, requiredApprovers } = req.body;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    try {
      const environment = await RemoteConfigEnvironment.createEnvironment({
        environmentName,
        displayName,
        description,
        isDefault: false,
        requiresApproval: requiresApproval || false,
        requiredApprovers: requiredApprovers || 1,
        createdBy: userId
      });

      // Create predefined segments for the new environment
      await RemoteConfigSegment.createPredefinedSegments(environment.id, userId);

      logger.info(`Environment created: ${environmentName} by user ${userId}`);

      res.status(201).json({
        success: true,
        data: environment,
        message: 'Environment created successfully'
      });
    } catch (error) {
      logger.error('Error creating environment:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create environment'
      });
    }
  });

  /**
   * Update environment
   */
  static updateEnvironment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { displayName, description, requiresApproval, requiredApprovers, isDefault } = req.body;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const environment = await RemoteConfigEnvironment.query().findById(id);
    if (!environment) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    try {
      const updatedEnvironment = await environment.updateEnvironment({
        displayName,
        description,
        requiresApproval,
        requiredApprovers,
        isDefault
      }, userId);

      logger.info(`Environment updated: ${environment.environmentName} by user ${userId}`);

      res.json({
        success: true,
        data: updatedEnvironment,
        message: 'Environment updated successfully'
      });
    } catch (error) {
      logger.error('Error updating environment:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update environment'
      });
    }
  });

  /**
   * Delete environment
   */
  static deleteEnvironment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const environment = await RemoteConfigEnvironment.query().findById(id);
    if (!environment) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    try {
      await environment.deleteEnvironment();

      logger.info(`Environment deleted: ${environment.environmentName} by user ${userId}`);

      res.json({
        success: true,
        message: 'Environment deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting environment:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete environment'
      });
    }
  });

  /**
   * Get environment segments
   */
  static getEnvironmentSegments = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const environment = await RemoteConfigEnvironment.query().findById(id);
    if (!environment) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    const segments = await RemoteConfigSegment.getAllByEnvironment(environment.id);

    res.json({
      success: true,
      data: segments
    });
  });

  /**
   * Create predefined segments for environment
   */
  static createPredefinedSegments = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const environment = await RemoteConfigEnvironment.query().findById(id);
    if (!environment) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    try {
      const segments = await RemoteConfigSegment.createPredefinedSegments(environment.id, userId);

      logger.info(`Predefined segments created for environment: ${environment.environmentName} by user ${userId}`);

      res.json({
        success: true,
        data: segments,
        message: 'Predefined segments created successfully'
      });
    } catch (error) {
      logger.error('Error creating predefined segments:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create predefined segments'
      });
    }
  });

  /**
   * Get environment statistics
   */
  static getEnvironmentStats = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const environment = await RemoteConfigEnvironment.query().findById(id);
    if (!environment) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    const stats = await environment.getStats();

    res.json({
      success: true,
      data: stats
    });
  });

  /**
   * Validate environment name
   */
  static validateEnvironmentName = asyncHandler(async (req: Request, res: Response) => {
    const { environmentName } = req.body;

    if (!environmentName) {
      return res.status(400).json({
        success: false,
        message: 'Environment name is required'
      });
    }

    const isValid = RemoteConfigEnvironment.isValidEnvironmentName(environmentName);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid environment name. Use only lowercase letters, numbers, underscore, and hyphen.'
      });
    }

    const existing = await RemoteConfigEnvironment.getByName(environmentName);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Environment name already exists'
      });
    }

    res.json({
      success: true,
      message: 'Environment name is valid and available'
    });
  });
}

export default RemoteConfigEnvironmentController;
