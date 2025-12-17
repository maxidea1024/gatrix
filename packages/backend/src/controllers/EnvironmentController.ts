import { Request, Response } from 'express';
import { Environment } from '../models/Environment';
import { RemoteConfigSegment } from '../models/RemoteConfigSegment';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../config/logger';
import { EnvironmentCopyService, CopyOptions } from '../services/EnvironmentCopyService';
import { initializeSystemKVForEnvironment } from '../utils/systemKV';
import { pubSubService } from '../services/PubSubService';

export class EnvironmentController {
  /**
   * Get all environments
   */
  static getEnvironments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environments = await Environment.getAll();

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

    const environment = await Environment.query()
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
    const {
      environmentName,
      displayName,
      description,
      environmentType,
      color,
      displayOrder,
      projectId,
      requiresApproval,
      requiredApprovers,
      baseEnvironmentId
    } = req.body;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate base environment if provided
    if (baseEnvironmentId) {
      const baseEnv = await Environment.query().findById(baseEnvironmentId);
      if (!baseEnv) {
        return res.status(400).json({
          success: false,
          message: 'Base environment not found'
        });
      }
    }

    try {
      const environment = await Environment.createEnvironment({
        environmentName,
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

      // Create predefined segments and system KV for the new environment (only if no base environment)
      if (!baseEnvironmentId) {
        await RemoteConfigSegment.createPredefinedSegments(environment.id, userId);
        // Initialize system-defined KV items ($channels, $platforms, $clientVersionPassiveData)
        await initializeSystemKVForEnvironment(environment.id);
        logger.info(`System KV items initialized for new environment: ${environmentName}`);
      }

      // Copy data from base environment if provided
      let copyResult = null;
      if (baseEnvironmentId) {
        logger.info(`Copying data from base environment ${baseEnvironmentId} to new environment ${environment.id}`);

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
          baseEnvironmentId,
          environment.id,
          copyOptions,
          userId
        );

        logger.info(`Data copied from base environment to ${environmentName}`, { copyResult });
      }

      logger.info(`Environment created: ${environmentName} by user ${userId}`);

      // Publish SDK event for dynamic environment detection
      try {
        await pubSubService.publishSDKEvent({
          type: 'environment.created',
          data: {
            id: environment.id,
            environment: environment.environmentName,
            timestamp: Date.now()
          }
        });
      } catch (eventError) {
        logger.warn('Failed to publish environment created SDK event', { eventError });
      }

      res.status(201).json({
        success: true,
        data: environment,
        copyResult,
        message: baseEnvironmentId
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
    const { id } = req.params;
    const { displayName, description, requiresApproval, requiredApprovers, isDefault } = req.body;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const environment = await Environment.query().findById(id);
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
   * Get related data details for an environment (for delete confirmation)
   */
  static getEnvironmentRelatedData = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const environment = await Environment.query().findById(id);
    if (!environment) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    const relatedData = await environment.getRelatedDataDetails();

    res.json({
      success: true,
      data: {
        environment: {
          id: environment.id,
          environmentName: environment.environmentName,
          displayName: environment.displayName,
          isSystemDefined: environment.isSystemDefined,
          isDefault: environment.isDefault,
        },
        relatedData,
        canDelete: !environment.isSystemDefined && !environment.isDefault,
        hasData: relatedData.total > 0,
      }
    });
  });

  /**
   * Delete environment
   */
  static deleteEnvironment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { force } = req.body || {};
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const environment = await Environment.query().findById(id);
    if (!environment) {
      return res.status(404).json({
        success: false,
        message: 'Environment not found'
      });
    }

    try {
      const environmentName = environment.environmentName;
      await environment.deleteEnvironment(force === true);

      logger.info(`Environment deleted: ${environmentName} by user ${userId}`, {
        force,
        environmentId: id
      });

      // Publish SDK event for dynamic environment detection
      try {
        await pubSubService.publishSDKEvent({
          type: 'environment.deleted',
          data: {
            id,
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
   * Get environment segments
   */
  static getEnvironmentSegments = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const environment = await Environment.query().findById(id);
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

    const environment = await Environment.query().findById(id);
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

    const environment = await Environment.query().findById(id);
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

    const isValid = Environment.isValidEnvironmentName(environmentName);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid environment name. Use only lowercase letters, numbers, underscore, and hyphen.'
      });
    }

    const existing = await Environment.getByName(environmentName);
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
    const { sourceEnvironmentId, targetEnvironmentId } = req.params;
    const options = req.body as CopyOptions;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate source environment
    const sourceEnv = await Environment.query().findById(sourceEnvironmentId);
    if (!sourceEnv) {
      return res.status(404).json({
        success: false,
        message: 'Source environment not found'
      });
    }

    // Validate target environment
    const targetEnv = await Environment.query().findById(targetEnvironmentId);
    if (!targetEnv) {
      return res.status(404).json({
        success: false,
        message: 'Target environment not found'
      });
    }

    if (sourceEnvironmentId === targetEnvironmentId) {
      return res.status(400).json({
        success: false,
        message: 'Source and target environments cannot be the same'
      });
    }

    try {
      const result = await EnvironmentCopyService.copyEnvironmentData(
        sourceEnvironmentId,
        targetEnvironmentId,
        options,
        userId
      );

      logger.info(`Environment data copied from ${sourceEnv.environmentName} to ${targetEnv.environmentName} by user ${userId}`, {
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
    const { sourceEnvironmentId, targetEnvironmentId } = req.params;

    // Validate source environment
    const sourceEnv = await Environment.query().findById(sourceEnvironmentId);
    if (!sourceEnv) {
      return res.status(404).json({
        success: false,
        message: 'Source environment not found'
      });
    }

    // Validate target environment
    const targetEnv = await Environment.query().findById(targetEnvironmentId);
    if (!targetEnv) {
      return res.status(404).json({
        success: false,
        message: 'Target environment not found'
      });
    }

    try {
      const preview = await EnvironmentCopyService.getCopyPreview(
        sourceEnvironmentId,
        targetEnvironmentId
      );

      // Fill in environment info
      preview.source = {
        id: sourceEnv.id,
        name: sourceEnv.displayName,
        environmentName: sourceEnv.environmentName
      };
      preview.target = {
        id: targetEnv.id,
        name: targetEnv.displayName,
        environmentName: targetEnv.environmentName
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
