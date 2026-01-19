import { Request, Response } from 'express';
import { Environment } from '../models/Environment';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../config/logger';
import { EnvironmentCopyService, CopyOptions } from '../services/EnvironmentCopyService';
import { initializeSystemKV } from '../utils/systemKV';
import { pubSubService } from '../services/PubSubService';
import { ErrorCodes } from '../utils/apiResponse';

export class EnvironmentController {
  /**
   * Get all environments
   */
  static getEnvironments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const includeHidden = req.query.includeHidden === 'true';
    const environments = await Environment.getAll(includeHidden);

    // Get stats for each environment and add id field for frontend compatibility
    const environmentsWithStats = await Promise.all(
      environments.map(async (env) => {
        const stats = await env.getStats();
        return {
          id: env.environment, // Map environment to id for frontend compatibility
          environmentName: env.environment, // Also provide as environmentName
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
   * Get environment by name
   */
  static getEnvironment = asyncHandler(async (req: Request, res: Response) => {
    const { environment } = req.params;

    const env = await Environment.query()
      .findById(environment)
      .withGraphFetched('[creator(basicInfo), updater(basicInfo)]')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      });

    if (!env) {
      throw new GatrixError('Environment not found', 404, true, ErrorCodes.ENV_NOT_FOUND);
    }

    const stats = await env.getStats();

    res.json({
      success: true,
      data: {
        ...env,
        stats
      }
    });
  });

  /**
   * Create new environment
   */
  static createEnvironment = asyncHandler(async (req: Request, res: Response) => {
    const {
      environment,
      displayName,
      description,
      environmentType,
      color,
      displayOrder,
      projectId,
      requiresApproval,
      requiredApprovers,
      baseEnvironment
    } = req.body;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      throw new GatrixError('User not authenticated', 401, true, ErrorCodes.UNAUTHORIZED);
    }

    // Validate base environment if provided
    if (baseEnvironment) {
      const baseEnv = await Environment.query().findById(baseEnvironment);
      if (!baseEnv) {
        throw new GatrixError('Base environment not found', 400, true, ErrorCodes.ENV_NOT_FOUND);
      }
    }

    try {
      const newEnv = await Environment.createEnvironment({
        environment,
        displayName,
        description,
        environmentType: environmentType || 'development',
        isSystemDefined: false, // User-created environments are never system-defined
        isHidden: false,
        displayOrder: displayOrder || 99,
        color: color || '#607D8B',
        projectId: projectId || undefined,
        isDefault: false,
        requiresApproval: requiresApproval || false,
        requiredApprovers: requiredApprovers || 1,
        createdBy: userId
      });

      // Note: Segments will be created by new remote config system when implemented
      if (!baseEnvironment) {
        // Initialize system-defined KV items ($channels, $platforms, $clientVersionPassiveData)
        await initializeSystemKV(newEnv.environment);
        logger.info(`System KV items initialized for new environment: ${environment}`);
      }

      // Copy data from base environment if provided
      let copyResult = null;
      if (baseEnvironment) {
        logger.info(`Copying data from base environment ${baseEnvironment} to new environment ${newEnv.environment}`);

        const copyOptions: CopyOptions = {
          copyTemplates: true,
          copyGameWorlds: true,
          copySegments: true,
          copyBanners: true,
          copyClientVersions: true,
          copyCoupons: true,
          copyIngamePopupNotices: true,
          copyMessageTemplates: true,
          copyRewardTemplates: true,
          copyServiceMaintenance: true,
          copyServiceNotices: true,
          copySurveys: true,
          copyVars: true,
          copyContextFields: true,
          copyCampaigns: true,
          copyAccountWhitelist: true,
          copyIpWhitelist: true,
          copyJobs: true,
          copyPlanningData: true,
          overwriteExisting: false
        };

        copyResult = await EnvironmentCopyService.copyEnvironmentData(
          baseEnvironment,
          newEnv.environment,
          copyOptions,
          userId
        );

        logger.info(`Data copied from base environment to ${environment}`, { copyResult });
      }

      logger.info(`Environment created: ${environment} by user ${userId}`);

      // Publish SDK event for dynamic environment detection
      try {
        await pubSubService.publishSDKEvent({
          type: 'environment.created',
          data: {
            environment: newEnv.environment,
            timestamp: Date.now()
          }
        });
      } catch (eventError) {
        logger.warn('Failed to publish environment created SDK event', { eventError });
      }

      res.status(201).json({
        success: true,
        data: newEnv,
        copyResult,
        message: baseEnvironment
          ? 'Environment created and data copied from base environment successfully'
          : 'Environment created successfully'
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
    const { environment } = req.params;
    const { displayName, description, requiresApproval, requiredApprovers, isDefault, isHidden, color, displayOrder } = req.body;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      throw new GatrixError('User not authenticated', 401, true, ErrorCodes.UNAUTHORIZED);
    }

    const env = await Environment.query().findById(environment);
    if (!env) {
      throw new GatrixError('Environment not found', 404, true, ErrorCodes.ENV_NOT_FOUND);
    }

    // Prevent modifying hidden status for system environments like gatrix-env
    if (isHidden !== undefined && env.environment === 'gatrix-env') {
      return res.status(400).json({
        success: false,
        code: 'CANNOT_MODIFY_SYSTEM_ENVIRONMENT',
        message: 'Cannot modify visibility of system environment'
      });
    }

    try {
      const updatedEnvironment = await env.updateEnvironment({
        displayName,
        description,
        requiresApproval,
        requiredApprovers,
        isDefault,
        isHidden,
        color,
        displayOrder
      }, userId);

      logger.info(`Environment updated: ${env.environment} by user ${userId}`);

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
   * Get related data details for an environment (for delete confirmation)
   */
  static getEnvironmentRelatedData = asyncHandler(async (req: Request, res: Response) => {
    const { environment: envParam } = req.params;

    const env = await Environment.query().findById(envParam);
    if (!env) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    const relatedData = await env.getRelatedDataDetails();

    res.json({
      success: true,
      data: {
        environment: {
          environment: env.environment,
          displayName: env.displayName,
          isSystemDefined: env.isSystemDefined,
          isDefault: env.isDefault,
        },
        relatedData,
        canDelete: !env.isSystemDefined && !env.isDefault,
        hasData: relatedData.total > 0,
      }
    });
  });

  /**
   * Delete environment
   */
  static deleteEnvironment = asyncHandler(async (req: Request, res: Response) => {
    const { environment: envParam } = req.params;
    const { force } = req.body || {};
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const env = await Environment.query().findById(envParam);
    if (!env) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    try {
      const environmentName = env.environment;
      await env.deleteEnvironment(force === true);

      logger.info(`Environment deleted: ${environmentName} by user ${userId}`, {
        force,
        environment: envParam
      });

      // Publish SDK event for dynamic environment detection
      try {
        await pubSubService.publishSDKEvent({
          type: 'environment.deleted',
          data: {
            environment: environmentName,
            timestamp: Date.now()
          }
        });
      } catch (eventError) {
        logger.warn('Failed to publish environment deleted SDK event', { eventError });
      }

      res.json({
        success: true,
        message: 'Environment deleted successfully'
      });
    } catch (error: any) {
      logger.error('Error deleting environment:', error);

      // Handle specific error types
      if (error.message === 'CANNOT_DELETE_SYSTEM_ENVIRONMENT') {
        return res.status(400).json({
          success: false,
          code: 'CANNOT_DELETE_SYSTEM_ENVIRONMENT',
          message: 'Cannot delete system-defined environment'
        });
      }

      if (error.message === 'CANNOT_DELETE_DEFAULT_ENVIRONMENT') {
        return res.status(400).json({
          success: false,
          code: 'CANNOT_DELETE_DEFAULT_ENVIRONMENT',
          message: 'Cannot delete default environment'
        });
      }

      if (error.message === 'ENVIRONMENT_HAS_RELATED_DATA') {
        return res.status(400).json({
          success: false,
          code: 'ENVIRONMENT_HAS_RELATED_DATA',
          message: 'Environment has related data. Use force=true to delete all data.',
          relatedData: error.relatedData
        });
      }

      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete environment'
      });
    }
  });

  /**
   * Get environment segments - Placeholder for new remote config system
   */
  static getEnvironmentSegments = asyncHandler(async (req: Request, res: Response) => {
    const { environment } = req.params;

    const env = await Environment.query().findById(environment);
    if (!env) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    // Segments will be implemented in new remote config system
    res.json({
      success: true,
      data: []
    });
  });

  /**
   * Create predefined segments for environment - Placeholder for new remote config system
   */
  static createPredefinedSegments = asyncHandler(async (req: Request, res: Response) => {
    const { environment } = req.params;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const env = await Environment.query().findById(environment);
    if (!env) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    // Segments will be implemented in new remote config system
    res.json({
      success: true,
      data: [],
      message: 'Segments feature is being rebuilt - no predefined segments created'
    });
  });

  /**
   * Get environment statistics
   */
  static getEnvironmentStats = asyncHandler(async (req: Request, res: Response) => {
    const { environment } = req.params;

    const env = await Environment.query().findById(environment);
    if (!env) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    const stats = await env.getStats();

    res.json({
      success: true,
      data: stats
    });
  });

  /**
   * Validate environment name
   */
  static validateEnvironmentName = asyncHandler(async (req: Request, res: Response) => {
    const { environment } = req.body;

    if (!environment) {
      return res.status(400).json({
        success: false,
        message: 'Environment name is required'
      });
    }

    const isValid = Environment.isValidEnvironmentName(environment);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid environment name. Use only lowercase letters, numbers, underscore, and hyphen.'
      });
    }

    const existing = await Environment.getByName(environment);
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

  /**
   * Copy data from one environment to another
   */
  static copyEnvironmentData = asyncHandler(async (req: Request, res: Response) => {
    const { sourceEnvironment, targetEnvironment } = req.params;
    const options = req.body as CopyOptions;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate source environment
    const sourceEnv = await Environment.query().findById(sourceEnvironment);
    if (!sourceEnv) {
      return res.status(404).json({
        success: false,
        message: 'Source environment not found'
      });
    }

    // Validate target environment
    const targetEnv = await Environment.query().findById(targetEnvironment);
    if (!targetEnv) {
      return res.status(404).json({
        success: false,
        message: 'Target environment not found'
      });
    }

    if (sourceEnvironment === targetEnvironment) {
      return res.status(400).json({
        success: false,
        message: 'Source and target environments cannot be the same'
      });
    }

    try {
      const result = await EnvironmentCopyService.copyEnvironmentData(
        sourceEnvironment,
        targetEnvironment,
        options,
        userId
      );

      logger.info(`Environment data copied from ${sourceEnv.environment} to ${targetEnv.environment} by user ${userId}`, {
        result
      });

      res.json({
        success: true,
        data: result,
        message: `Data copied from ${sourceEnv.displayName} to ${targetEnv.displayName}`
      });
    } catch (error) {
      logger.error('Error copying environment data:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to copy environment data'
      });
    }
  });

  /**
   * Get preview of data to be copied
   */
  static getCopyPreview = asyncHandler(async (req: Request, res: Response) => {
    const { sourceEnvironment, targetEnvironment } = req.params;

    // Validate source environment
    const sourceEnv = await Environment.query().findById(sourceEnvironment);
    if (!sourceEnv) {
      return res.status(404).json({
        success: false,
        message: 'Source environment not found'
      });
    }

    // Validate target environment
    const targetEnv = await Environment.query().findById(targetEnvironment);
    if (!targetEnv) {
      return res.status(404).json({
        success: false,
        message: 'Target environment not found'
      });
    }

    try {
      const preview = await EnvironmentCopyService.getCopyPreview(
        sourceEnvironment,
        targetEnvironment
      );

      // Fill in environment info
      preview.source = {
        environment: sourceEnv.environment,
        name: sourceEnv.displayName
      };
      preview.target = {
        environment: targetEnv.environment,
        name: targetEnv.displayName
      };

      res.json({
        success: true,
        data: preview
      });
    } catch (error) {
      logger.error('Error getting copy preview:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get copy preview'
      });
    }
  });
}

export default EnvironmentController;
