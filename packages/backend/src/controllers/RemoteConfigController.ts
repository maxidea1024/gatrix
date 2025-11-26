import { Request, Response } from 'express';
import { RemoteConfigModel } from '../models/RemoteConfig';
import SegmentModel from '../models/Segment';
import { pubSubService } from '../services/PubSubService';
import logger from '../config/logger';
import { GatrixError } from '../middleware/errorHandler';
import db from '../config/knex';
import {
  CreateRemoteConfigData,
  UpdateRemoteConfigData,
  RemoteConfigFilters,
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
      throw new GatrixError('Failed to fetch remote configs', 500);
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
        throw new GatrixError('Remote config not found', 404);
      }

      res.json({
        success: true,
        data: { config }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.getById:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to fetch remote config', 500);
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
        throw new GatrixError('Key name is required', 400);
      }

      if (!data.valueType) {
        throw new GatrixError('Value type is required', 400);
      }

      // Check if key already exists
      const existing = await RemoteConfigModel.findByKey(data.keyName);
      if (existing) {
        throw new GatrixError('Remote config with this key already exists', 409);
      }

      const config = await RemoteConfigModel.create(data);

      // Send notification via PubSub (multi-instance)
      await pubSubService.publishNotification({
        type: 'remote_config_change',
        data: { configId: config.id, action: 'created', config },
        targetChannels: ['remote_config', 'admin']
      });

      res.status(201).json({
        success: true,
        data: { config }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.create:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to create remote config', 500);
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
        throw new GatrixError('Remote config not found', 404);
      }

      // Check if key name is being changed and if it conflicts
      if (data.keyName && data.keyName !== existing.keyName) {
        const conflicting = await RemoteConfigModel.findByKey(data.keyName);
        if (conflicting && conflicting.id !== id) {
          throw new GatrixError('Remote config with this key already exists', 409);
        }
      }

      // Git-style update: Create new draft version instead of updating existing
      const config = await RemoteConfigModel.update(id, data);

      // Version management removed - configs are now managed through template versions
      // Changes will be captured when publish is called

      // Send notification via PubSub (multi-instance)
      await pubSubService.publishNotification({
        type: 'remote_config_change',
        data: { configId: config.id, action: 'updated', config },
        targetChannels: ['remote_config', 'admin']
      });

      res.json({
        success: true,
        data: { config }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.update:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to update remote config', 500);
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
        throw new GatrixError('Remote config not found', 404);
      }

      await RemoteConfigModel.delete(id);

      // Send notification via PubSub (multi-instance)
      await pubSubService.publishNotification({
        type: 'remote_config_change',
        data: { configId: id, action: 'deleted', id, keyName: existing.keyName },
        targetChannels: ['remote_config', 'admin']
      });

      res.json({
        success: true,
        message: 'Remote config deleted successfully'
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.delete:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to delete remote config', 500);
    }
  }

  // getVersions method removed - using template version system instead

  // discardDraftVersions method removed - using template version system instead

  // Stage method removed - using direct template version creation instead

  /**
   * Get current template data
   */
  static async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      // Get default template
      const template = await db('g_remote_config_templates')
        .where('templateName', 'default_template')
        .first();

      if (!template) {
        // Return empty template structure
        const emptyTemplate = {
          parameters: {},
          campaigns: {},
          segments: {},
          contextFields: {},
          variants: {}
        };

        res.json({
          success: true,
          data: { templateData: emptyTemplate }
        });
        return;
      }

      const templateData = typeof template.templateData === 'string'
        ? JSON.parse(template.templateData)
        : template.templateData;

      res.json({
        success: true,
        data: { templateData }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.getTemplate:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to get template', 500);
    }
  }

  /**
   * Update template data directly (for real-time changes)
   */
  static async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { templateData } = req.body;

      // Get or create default template
      let template = await db('g_remote_config_templates')
        .where('templateName', 'default_template')
        .first();

      if (!template) {
        // Create default template if it doesn't exist
        const [templateId] = await db('g_remote_config_templates').insert({
          environmentId: 1, // Default environment
          templateName: 'default_template',
          displayName: 'Default Template',
          description: 'Default remote config template',
          templateType: 'client',
          status: 'draft',
          version: 1,
          templateData: JSON.stringify(templateData),
          createdBy: userId,
          updatedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        template = await db('g_remote_config_templates').where('id', templateId).first();
      } else {
        // Update existing template
        await db('g_remote_config_templates')
          .where('id', template.id)
          .update({
            templateData: JSON.stringify(templateData),
            etag: `etag_${Date.now()}`,
            updatedBy: userId,
            updatedAt: new Date()
          });
      }

      res.json({
        success: true,
        message: 'Template updated successfully',
        data: { templateId: template.id }
      });

      logger.info(`Template updated by user ${userId}`);
    } catch (error) {
      logger.error('Error in RemoteConfigController.updateTemplate:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to update template', 500);
    }
  }

  /**
   * Add a new parameter to template
   */
  static async addParameter(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { key, type, defaultValue, description } = req.body;

      // Get current template
      let template = await db('g_remote_config_templates')
        .where('templateName', 'default_template')
        .first();

      let templateData: any = {
        parameters: {},
        campaigns: {},
        segments: {},
        contextFields: {},
        variants: {}
      };

      if (template && template.templateData) {
        templateData = typeof template.templateData === 'string'
          ? JSON.parse(template.templateData)
          : template.templateData;
      }

      // Check if parameter already exists
      if (templateData.parameters[key]) {
        throw new GatrixError(`Parameter '${key}' already exists. Use PUT to update existing parameters.`, 409);
      }

      // Add new parameter
      templateData.parameters[key] = {
        id: Date.now(), // Simple ID generation
        key,
        type,
        defaultValue,
        description,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Update template
      if (!template) {
        const [templateId] = await db('g_remote_config_templates').insert({
          environmentId: 1,
          templateName: 'default_template',
          displayName: 'Default Template',
          description: 'Default remote config template',
          templateType: 'client',
          status: 'draft',
          version: 1,
          templateData: JSON.stringify(templateData),
          etag: `etag_${Date.now()}`,
          createdBy: userId,
          updatedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        template = { id: templateId };
      } else {
        await db('g_remote_config_templates')
          .where('id', template.id)
          .update({
            templateData: JSON.stringify(templateData),
            etag: `etag_${Date.now()}`,
            updatedBy: userId,
            updatedAt: new Date()
          });
      }

      res.json({
        success: true,
        message: 'Parameter added successfully',
        data: { parameter: templateData.parameters[key] }
      });

      logger.info(`Parameter ${key} added by user ${userId}`);
    } catch (error) {
      logger.error('Error in RemoteConfigController.addParameter:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to add parameter', 500);
    }
  }

  /**
   * Update an existing parameter in template
   */
  static async updateParameter(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const { type, defaultValue, description } = req.body;
      const userId = (req as any).user?.id;

      // Get existing template
      const template = await db('g_remote_config_templates')
        .where('environmentId', 1)
        .where('templateName', 'default_template')
        .first();

      if (!template) {
        throw new GatrixError('Template not found', 404);
      }

      const templateData = typeof template.templateData === 'string'
        ? JSON.parse(template.templateData)
        : template.templateData;

      // Check if parameter exists
      if (!templateData.parameters[key]) {
        throw new GatrixError(`Parameter '${key}' not found. Use POST to create new parameters.`, 404);
      }

      // Update existing parameter
      const existingParam = templateData.parameters[key];
      templateData.parameters[key] = {
        ...existingParam,
        ...(type && { type }),
        ...(defaultValue !== undefined && { defaultValue }),
        ...(description !== undefined && { description }),
        updatedAt: new Date().toISOString()
      };

      // Update template
      await db('g_remote_config_templates')
        .where('id', template.id)
        .update({
          templateData: JSON.stringify(templateData),
          etag: `etag_${Date.now()}`,
          updatedBy: userId,
          updatedAt: new Date()
        });

      res.json({
        success: true,
        message: 'Parameter updated successfully',
        data: { parameter: templateData.parameters[key] }
      });

      logger.info(`Parameter ${key} updated by user ${userId}`);
    } catch (error) {
      logger.error('Error in RemoteConfigController.updateParameter:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to update parameter', 500);
    }
  }

  /**
   * Delete a parameter from template
   */
  static async deleteParameter(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { key } = req.params;

      // Get current template
      const template = await db('g_remote_config_templates')
        .where('templateName', 'default_template')
        .first();

      if (!template || !template.templateData) {
        throw new GatrixError('Template not found', 404);
      }

      const templateData = typeof template.templateData === 'string'
        ? JSON.parse(template.templateData)
        : template.templateData;

      if (!templateData.parameters || !templateData.parameters[key]) {
        throw new GatrixError('Parameter not found', 404);
      }

      // Delete parameter
      delete templateData.parameters[key];

      // Update template
      await db('g_remote_config_templates')
        .where('id', template.id)
        .update({
          templateData: JSON.stringify(templateData),
          etag: `etag_${Date.now()}`,
          updatedBy: userId,
          updatedAt: new Date()
        });

      res.json({
        success: true,
        message: 'Parameter deleted successfully'
      });

      logger.info(`Parameter ${key} deleted by user ${userId}`);
    } catch (error) {
      logger.error('Error in RemoteConfigController.deleteParameter:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to delete parameter', 500);
    }
  }

  /**
   * Publish template as new version
   */
  static async publish(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { deploymentName, description }: PublishRequest = req.body;

      // Get current template data from the latest template version
      const latestTemplate = await db('g_remote_config_templates')
        .where('templateName', 'default_template')
        .first();

      let templateData: any = {
        parameters: {},
        campaigns: {},
        segments: {},
        contextFields: {},
        variants: {}
      };

      if (latestTemplate && latestTemplate.templateData) {
        // Use existing template data as base
        templateData = typeof latestTemplate.templateData === 'string'
          ? JSON.parse(latestTemplate.templateData)
          : latestTemplate.templateData;
      }

      // Get or create default template
      let template = await db('g_remote_config_templates')
        .where('templateName', 'default_template')
        .first();

      if (!template) {
        const [templateId] = await db('g_remote_config_templates').insert({
          templateName: 'default_template',
          displayName: 'Default Template',
          description: 'Default template for remote config',
          templateData: JSON.stringify(templateData),
          status: 'published',
          createdBy: userId,
          updatedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        template = { id: templateId };
      } else {
        // Update existing template
        await db('g_remote_config_templates')
          .where('id', template.id)
          .update({
            templateData: JSON.stringify(templateData),
            updatedBy: userId,
            updatedAt: new Date()
          });
      }

      // Get next version number
      const latestVersion = await db('g_remote_config_template_versions')
        .where('templateId', template.id)
        .orderBy('version', 'desc')
        .first();

      const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

      // Create new template version
      const [versionId] = await db('g_remote_config_template_versions').insert({
        templateId: template.id,
        version: nextVersion,
        templateData: JSON.stringify(templateData),
        changeDescription: description || 'Published template version',
        createdBy: userId,
        createdAt: new Date()
      });

      // Send real-time notification via PubSub (multi-instance)
      await pubSubService.publishNotification({
        type: 'remote_config_change',
        data: { configId: template.id, action: 'updated', templateName: 'default_template' },
        targetChannels: ['remote_config', 'admin']
      });

      res.json({
        success: true,
        message: `Published template version ${nextVersion}`,
        data: {
          templateId: template.id,
          versionId,
          version: nextVersion,
          publishedAt: new Date().toISOString()
        }
      });

      logger.info(`Published template version ${nextVersion} by user ${userId}`);
    } catch (error) {
      logger.error('Error in RemoteConfigController.publish:', error);
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to publish configs', 500);
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
      if (error instanceof GatrixError) {
        throw error;
      }
      throw new GatrixError('Failed to fetch segments', 500);
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
      throw new GatrixError('Failed to fetch deployments', 500);
    }
  }

  /**
   * Get version history from template versions
   */
  static async getVersionHistory(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Get template versions from database
      const versionsQuery = db('g_remote_config_template_versions as tv')
        .leftJoin('g_users as u', 'tv.createdBy', 'u.id')
        .leftJoin('g_remote_config_templates as t', 'tv.templateId', 't.id')
        .select([
          'tv.id',
          'tv.templateId',
          'tv.version',
          'tv.templateData',
          'tv.changeDescription',
          'tv.createdBy',
          'tv.createdAt',
          'u.name as createdByName',
          'u.email as createdByEmail',
          't.templateName',
          't.status as templateStatus'
        ])
        .orderBy('tv.createdAt', 'desc');

      // Get total count
      const totalQuery = db('g_remote_config_template_versions').count('* as count');
      const [{ count: total }] = await totalQuery;

      // Get paginated results
      const versions = await versionsQuery.limit(limit).offset(offset);

      // Transform results to match expected format
      const transformedVersions = versions.map(version => ({
        id: version.id,
        templateId: version.templateId,
        version: version.version,
        versionNumber: version.version, // Alias for compatibility
        templateData: version.templateData,
        value: version.templateData, // Alias for compatibility
        changeDescription: version.changeDescription,
        createdBy: version.createdBy,
        createdAt: version.createdAt,
        publishedAt: version.createdAt, // Use createdAt as publishedAt for now
        status: version.templateStatus === 'published' ? 'published' : 'draft',
        createdByName: version.createdByName,
        createdByEmail: version.createdByEmail,
        templateName: version.templateName
      }));

      res.json({
        success: true,
        data: {
          versions: transformedVersions,
          total: Number(total),
          page,
          limit,
          totalPages: Math.ceil(Number(total) / limit)
        }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigController.getVersionHistory:', error);
      throw new GatrixError('Failed to fetch version history', 500);
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
        throw new GatrixError('Deployment ID is required', 400);
      }

      // Get the target deployment
      const targetDeployment = await db('g_remote_config_deployments')
        .where('id', deploymentId)
        .first();

      if (!targetDeployment) {
        throw new GatrixError('Deployment not found', 404);
      }

      // Parse the configs snapshot
      let configsSnapshot: any;
      try {
        configsSnapshot = typeof targetDeployment.configsSnapshot === 'string'
          ? JSON.parse(targetDeployment.configsSnapshot)
          : targetDeployment.configsSnapshot;
      } catch (error) {
        throw new GatrixError('Invalid deployment snapshot', 400);
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

        // Send real-time notification via PubSub (multi-instance)
        await pubSubService.publishNotification({
          type: 'remote_config_change',
          data: {
            configId: newDeploymentId,
            action: 'updated',
            details: {
              action: 'rollback',
              targetDeploymentId: deploymentId,
              deploymentName: targetDeployment.deploymentName
            }
          },
          targetChannels: ['remote_config', 'admin']
        });
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
      if (error instanceof GatrixError) {
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
