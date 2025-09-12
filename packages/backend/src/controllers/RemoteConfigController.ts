import { Request, Response } from 'express';
import { RemoteConfigModel, ConfigVersionModel } from '../models/RemoteConfig';
import SegmentModel from '../models/Segment';
import { RemoteConfigNotifications } from '../services/sseNotificationService';
import logger from '../config/logger';
import { CustomError } from '../middleware/errorHandler';
import db from '../config/knex';
import {
  CreateRemoteConfigData,
  UpdateRemoteConfigData,
  RemoteConfigFilters,
  StagingRequest,
  PublishRequest,
  RollbackRequest
} from '../types/remoteConfig';

export class RemoteConfigController {
  /**
   * Get all remote configs with pagination and filters
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // isActive 파라미터 안전하게 처리
      let isActiveFilter: boolean | undefined = undefined;
      const isActiveParam = req.query.isActive as string;

      if (isActiveParam && isActiveParam !== '' && isActiveParam !== 'undefined') {
        isActiveFilter = isActiveParam === 'true';
      }

      const filters: RemoteConfigFilters = {
        search: req.query.search as string,
        valueType: req.query.valueType as any,
        isActive: isActiveFilter,
        createdBy: req.query.createdBy ? parseInt(req.query.createdBy as string) : undefined,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const result = await RemoteConfigModel.list(page, limit, filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.list:', error);
      throw new CustomError('Failed to fetch remote configs', 500);
    }
  }

  /**
   * Get remote config by ID
   */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const includeRelations = req.query.include !== 'false';

      const config = await RemoteConfigModel.findById(id, includeRelations);
      
      if (!config) {
        throw new CustomError('Remote config not found', 404);
      }

      res.json({
        success: true,
        data: { config }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.getById:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to fetch remote config', 500);
    }
  }

  /**
   * Create new remote config
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      
      const data: CreateRemoteConfigData = {
        keyName: req.body.keyName,
        defaultValue: req.body.defaultValue,
        valueType: req.body.valueType,
        description: req.body.description,
        isActive: req.body.isActive,
        createdBy: userId
      };

      // Validate required fields
      if (!data.keyName) {
        throw new CustomError('Key name is required', 400);
      }

      if (!data.valueType) {
        throw new CustomError('Value type is required', 400);
      }

      // Check if key already exists
      const existing = await RemoteConfigModel.findByKey(data.keyName);
      if (existing) {
        throw new CustomError('Remote config with this key already exists', 409);
      }

      const config = await RemoteConfigModel.create(data);

      // Send SSE notification
      RemoteConfigNotifications.notifyConfigChange(config.id, 'created', config);

      res.status(201).json({
        success: true,
        data: { config }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.create:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to create remote config', 500);
    }
  }

  /**
   * Update remote config
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const userId = (req as any).user?.id;

      const data: UpdateRemoteConfigData = {
        keyName: req.body.keyName,
        defaultValue: req.body.defaultValue,
        valueType: req.body.valueType,
        description: req.body.description,
        isActive: req.body.isActive,
        updatedBy: userId
      };

      // Check if config exists
      const existing = await RemoteConfigModel.findById(id, false);
      if (!existing) {
        throw new CustomError('Remote config not found', 404);
      }

      // Check if key name is being changed and if it conflicts
      if (data.keyName && data.keyName !== existing.keyName) {
        const conflicting = await RemoteConfigModel.findByKey(data.keyName);
        if (conflicting && conflicting.id !== id) {
          throw new CustomError('Remote config with this key already exists', 409);
        }
      }

      // Git-style update: Create new draft version instead of updating existing
      const config = await RemoteConfigModel.update(id, data);

      // Smart version management: Check if value matches published version
      if (data.defaultValue !== undefined) {
        // Get the latest published version
        const publishedVersion = await ConfigVersionModel.getLatestPublishedVersion(id);

        if (publishedVersion && publishedVersion.value === data.defaultValue) {
          // Value matches published version - delete any existing draft versions
          await ConfigVersionModel.deleteDraftVersions(id);
        } else {
          // Value is different - create or update draft version
          const existingDraft = await ConfigVersionModel.getLatestDraftVersion(id);

          if (existingDraft) {
            // Update existing draft
            await ConfigVersionModel.updateVersion(existingDraft.id, {
              value: data.defaultValue,
              changeDescription: 'Updated via admin interface',
              updatedBy: userId
            });
          } else {
            // Create new draft version
            await ConfigVersionModel.createVersion({
              configId: id,
              value: data.defaultValue,
              status: 'draft',
              changeDescription: 'Updated via admin interface',
              createdBy: userId
            });
          }
        }
      }

      // Send SSE notification
      RemoteConfigNotifications.notifyConfigChange(config.id, 'updated', config);

      res.json({
        success: true,
        data: { config }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.update:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to update remote config', 500);
    }
  }

  /**
   * Delete remote config
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      // Check if config exists
      const existing = await RemoteConfigModel.findById(id, false);
      if (!existing) {
        throw new CustomError('Remote config not found', 404);
      }

      await RemoteConfigModel.delete(id);

      // Send SSE notification
      RemoteConfigNotifications.notifyConfigChange(id, 'deleted', { id, keyName: existing.keyName });

      res.json({
        success: true,
        message: 'Remote config deleted successfully'
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.delete:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to delete remote config', 500);
    }
  }

  /**
   * Get versions for a config
   */
  static async getVersions(req: Request, res: Response): Promise<void> {
    try {
      const configId = parseInt(req.params.id);

      // Check if config exists
      const config = await RemoteConfigModel.findById(configId, false);
      if (!config) {
        throw new CustomError('Remote config not found', 404);
      }

      const versions = await ConfigVersionModel.getVersionsByConfigId(configId);

      res.json({
        success: true,
        data: { versions }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.getVersions:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to fetch versions', 500);
    }
  }

  /**
   * Discard draft changes for a config
   */
  static async discardDraftVersions(req: Request, res: Response): Promise<void> {
    try {
      const configId = parseInt(req.params.id);
      const userId = (req.user as any)?.userId;

      // Check if config exists
      const config = await RemoteConfigModel.findById(configId, false);
      if (!config) {
        throw new CustomError('Remote config not found', 404);
      }

      // Get the latest published version to restore the value
      const publishedVersion = await ConfigVersionModel.getLatestPublishedVersion(configId);

      // Delete all draft versions for this config
      const deletedCount = await ConfigVersionModel.deleteDraftVersions(configId);

      // Restore the defaultValue to the published version's value
      if (publishedVersion) {
        await RemoteConfigModel.update(configId, {
          defaultValue: publishedVersion.value,
          updatedBy: userId
        });
      }

      res.json({
        success: true,
        message: `${deletedCount} draft versions discarded and value restored`,
        data: { deletedCount, restoredValue: publishedVersion?.value || null }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.discardDraftVersions:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to discard draft versions', 500);
    }
  }

  /**
   * Stage configs (Git-like staging)
   */
  static async stage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { configIds, description }: StagingRequest = req.body;

      if (!configIds || !Array.isArray(configIds) || configIds.length === 0) {
        throw new CustomError('Config IDs are required', 400);
      }

      await ConfigVersionModel.stageVersions(configIds, userId);

      res.json({
        success: true,
        message: `Staged ${configIds.length} config(s)`,
        data: { stagedConfigIds: configIds }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.stage:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to stage configs', 500);
    }
  }

  /**
   * Publish staged configs (Git-like push)
   */
  static async publish(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { deploymentName, description }: PublishRequest = req.body;

      const publishedConfigIds = await ConfigVersionModel.publishStagedVersions(userId);

      if (publishedConfigIds.length === 0) {
        throw new CustomError('No staged configs to publish', 400);
      }

      // Create deployment record
      const configsSnapshot: any = {};
      for (const configId of publishedConfigIds) {
        const config = await RemoteConfigModel.findById(configId, false);
        const currentVersion = await ConfigVersionModel.getCurrentVersion(configId);
        if (config && currentVersion) {
          configsSnapshot[config.keyName] = {
            id: config.id,
            keyName: config.keyName,
            valueType: config.valueType,
            value: currentVersion.value,
            versionNumber: currentVersion.versionNumber,
            publishedAt: currentVersion.publishedAt
          };
        }
      }

      const [deploymentId] = await db('g_remote_config_deployments').insert({
        deploymentName: deploymentName || `Deployment ${new Date().toISOString()}`,
        description: description || 'Automated deployment',
        configsSnapshot: JSON.stringify(configsSnapshot),
        deployedBy: userId,
        deployedAt: new Date()
      });

      // Send real-time notification for each published config
      for (const configId of publishedConfigIds) {
        const config = await RemoteConfigModel.findById(configId, false);
        if (config) {
          RemoteConfigNotifications.notifyConfigChange(configId, 'updated', config);
        }
      }

      res.json({
        success: true,
        message: `Published ${publishedConfigIds.length} config(s)`,
        data: {
          publishedConfigIds,
          deploymentId,
          publishedAt: new Date().toISOString()
        }
      });

      logger.info(`Published configurations: ${publishedConfigIds.join(', ')} by user ${userId}, deployment ID: ${deploymentId}`);
    } catch (error) {
      logger.error('Error in RemoteConfigController.publish:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to publish configs', 500);
    }
  }



  /**
   * Get all segments (formerly rules)
   */
  static async getSegments(req: Request, res: Response): Promise<void> {
    try {
      const segments = await SegmentModel.getAllSegments();

      res.json({
        success: true,
        data: { segments }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.getSegments:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to fetch segments', 500);
    }
  }

  /**
   * Get deployment history
   */
  static async getDeployments(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Get deployments from database
      const deploymentsQuery = db('g_remote_config_deployments as d')
        .leftJoin('g_users as u', 'd.deployedBy', 'u.id')
        .select([
          'd.id',
          'd.deploymentName',
          'd.description',
          'd.configsSnapshot',
          'd.deployedBy',
          'd.deployedAt',
          'd.rollbackDeploymentId',
          'u.name as deployedByName',
          'u.email as deployedByEmail'
        ])
        .orderBy('d.deployedAt', 'desc');

      // Get total count
      const totalQuery = db('g_remote_config_deployments').count('* as count');
      const [{ count: total }] = await totalQuery;

      // Get paginated results
      const deployments = await deploymentsQuery.limit(limit).offset(offset);

      // Transform and add configsCount
      const transformedDeployments = deployments.map(deployment => ({
        id: deployment.id,
        deploymentName: deployment.deploymentName,
        description: deployment.description,
        configsSnapshot: deployment.configsSnapshot,
        deployedBy: deployment.deployedBy,
        deployedAt: deployment.deployedAt,
        rollbackDeploymentId: deployment.rollbackDeploymentId,
        deployedByName: deployment.deployedByName,
        deployedByEmail: deployment.deployedByEmail,
        configsCount: deployment.configsSnapshot ?
          (typeof deployment.configsSnapshot === 'string' ?
            Object.keys(JSON.parse(deployment.configsSnapshot)).length :
            Object.keys(deployment.configsSnapshot).length) : 0
      }));

      res.json({
        success: true,
        data: {
          deployments: transformedDeployments,
          total: Number(total),
          page,
          limit
        }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.getDeployments:', error);
      throw new CustomError('Failed to fetch deployments', 500);
    }
  }

  /**
   * Get version history
   */
  static async getVersionHistory(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Get versions from database with config info
      const versionsQuery = db('g_remote_config_versions as v')
        .leftJoin('g_users as u', 'v.createdBy', 'u.id')
        .leftJoin('g_remote_configs as c', 'v.configId', 'c.id')
        .select([
          'v.id',
          'v.configId',
          'v.versionNumber',
          'v.value',
          'v.status',
          'v.changeDescription',
          'v.publishedAt',
          'v.createdBy',
          'v.createdAt',
          'u.name as createdByName',
          'u.email as createdByEmail',
          'c.keyName as configKeyName'
        ])
        .orderBy('v.createdAt', 'desc');

      // Get total count
      const totalQuery = db('g_remote_config_versions').count('* as count');
      const [{ count: total }] = await totalQuery;

      // Get paginated results
      const versions = await versionsQuery.limit(limit).offset(offset);

      // Transform results
      const transformedVersions = versions.map(version => ({
        id: version.id,
        configId: version.configId,
        versionNumber: version.versionNumber,
        value: version.value,
        status: version.status,
        changeDescription: version.changeDescription,
        publishedAt: version.publishedAt,
        createdBy: version.createdBy,
        createdAt: version.createdAt,
        createdByName: version.createdByName,
        createdByEmail: version.createdByEmail,
        configKeyName: version.configKeyName
      }));

      res.json({
        success: true,
        data: {
          versions: transformedVersions,
          total: Number(total),
          page,
          limit
        }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.getVersionHistory:', error);
      throw new CustomError('Failed to fetch version history', 500);
    }
  }

  /**
   * Rollback to a previous deployment
   */
  static async rollback(req: Request, res: Response): Promise<void> {
    try {
      const { deploymentId } = req.body as RollbackRequest;
      const userId = (req as any).user?.id;

      if (!deploymentId) {
        throw new CustomError('Deployment ID is required', 400);
      }

      // Get the target deployment
      const targetDeployment = await db('g_remote_config_deployments')
        .where('id', deploymentId)
        .first();

      if (!targetDeployment) {
        throw new CustomError('Deployment not found', 404);
      }

      // Parse the configs snapshot
      let configsSnapshot: any;
      try {
        configsSnapshot = typeof targetDeployment.configsSnapshot === 'string'
          ? JSON.parse(targetDeployment.configsSnapshot)
          : targetDeployment.configsSnapshot;
      } catch (error) {
        throw new CustomError('Invalid deployment snapshot', 400);
      }

      // Start transaction
      await db.transaction(async (trx) => {
        // Update all configs to match the snapshot
        for (const [keyName, configData] of Object.entries(configsSnapshot)) {
          const config = configData as any;

          // Update the config
          await trx('g_remote_configs')
            .where('keyName', keyName)
            .update({
              valueType: config.valueType,
              defaultValue: config.value,
              description: config.description || null,
              isActive: config.isActive !== false, // Default to true if not specified
              updatedBy: userId,
              updatedAt: new Date()
            });
        }

        // Create a new deployment record for the rollback
        const [newDeploymentId] = await trx('g_remote_config_deployments').insert({
          deploymentName: `Rollback to ${targetDeployment.deploymentName || `Deployment #${deploymentId}`}`,
          description: `Rollback to deployment from ${new Date(targetDeployment.deployedAt).toLocaleString()}`,
          configsSnapshot: targetDeployment.configsSnapshot,
          deployedBy: userId,
          deployedAt: new Date(),
          rollbackDeploymentId: deploymentId
        });

        logger.info(`Rollback completed: deployment ${deploymentId} rolled back by user ${userId}`);

        // Send real-time notification
        RemoteConfigNotifications.notifyConfigChange(
          newDeploymentId,
          'updated',
          {
            action: 'rollback',
            targetDeploymentId: deploymentId,
            deploymentName: targetDeployment.deploymentName
          }
        );
      });

      res.json({
        success: true,
        message: 'Rollback completed successfully',
        data: {
          targetDeploymentId: deploymentId,
          targetDeploymentName: targetDeployment.deploymentName
        }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.rollback:', error);
      if (error instanceof CustomError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to rollback deployment'
        });
      }
    }
  }
}

export default RemoteConfigController;
