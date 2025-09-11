import { Request, Response } from 'express';
import { RemoteConfigModel, ConfigVersionModel } from '../models/RemoteConfig';
import ConfigRuleModel from '../models/ConfigRule';
import { RemoteConfigNotifications } from '../services/sseNotificationService';
import logger from '../config/logger';
import { CustomError } from '../middleware/errorHandler';
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
      
      const filters: RemoteConfigFilters = {
        search: req.query.search as string,
        valueType: req.query.valueType as any,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
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

      const config = await RemoteConfigModel.update(id, data);

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

      res.json({
        success: true,
        message: `Published ${publishedConfigIds.length} config(s)`,
        data: { publishedConfigIds }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.publish:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to publish configs', 500);
    }
  }

  /**
   * Get rules for a config
   */
  static async getRules(req: Request, res: Response): Promise<void> {
    try {
      const configId = parseInt(req.params.id);

      // Check if config exists
      const config = await RemoteConfigModel.findById(configId, false);
      if (!config) {
        throw new CustomError('Remote config not found', 404);
      }

      const rules = await ConfigRuleModel.getRulesByConfigId(configId);

      res.json({
        success: true,
        data: { rules }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.getRules:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to fetch rules', 500);
    }
  }
}

export default RemoteConfigController;
