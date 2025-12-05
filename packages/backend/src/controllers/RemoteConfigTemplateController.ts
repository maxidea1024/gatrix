import { Request, Response } from 'express';
import { RemoteConfigTemplate, TemplateStatus, TemplateType } from '../models/RemoteConfigTemplate';
import { Environment } from '../models/Environment';
import { RemoteConfigChangeRequest } from '../models/RemoteConfigChangeRequest';
import { RemoteConfigTemplateVersion } from '../models/RemoteConfigTemplateVersion';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { pubSubService } from '../services/PubSubService';
import logger from '../config/logger';

export class RemoteConfigTemplateController {
  /**
   * Get templates for environment
   */
  static getTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environmentId } = req.params;
    const { status, type } = req.query;

    let templates;
    
    if (status) {
      templates = await RemoteConfigTemplate.getByStatus(
        parseInt(environmentId), 
        status as TemplateStatus
      );
    } else {
      templates = await RemoteConfigTemplate.query()
        .where('environmentId', environmentId)
        .modify((builder) => {
          if (type) {
            builder.where('templateType', type as TemplateType);
          }
        })
        .withGraphFetched('[environment, creator(basicInfo), updater(basicInfo)]')
        .modifiers({
          basicInfo: (builder) => builder.select('id', 'username', 'email')
        })
        .orderBy('updatedAt', 'desc');
    }

    res.json({
      success: true,
      data: templates
    });
  });

  /**
   * Get template by ID
   */
  static getTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    const template = await RemoteConfigTemplate.query()
      .findById(id)
      .withGraphFetched('[environment, creator(basicInfo), updater(basicInfo)]')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  });

  /**
   * Create new template
   */
  static createTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environmentId, templateName, displayName, description, templateType, templateData } = req.body;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    try {
      // Check if environment requires approval
      const environment = await Environment.query().findById(environmentId);
      if (!environment) {
        return res.status(404).json({
          success: false,
          message: 'Environment not found'
        });
      }

      const template = await RemoteConfigTemplate.createTemplate({
        environmentId,
        templateName,
        displayName,
        description,
        templateType,
        templateData,
        status: 'draft',
        createdBy: userId
      });

      // If environment requires approval, create change request
      if (environment.requiresApproval) {
        await RemoteConfigChangeRequest.createChangeRequest({
          templateId: template.id,
          environmentId,
          requestType: 'create',
          proposedChanges: templateData,
          description: `Create new template: ${displayName}`,
          requestedBy: userId
        });

        // Send notification via PubSub so all instances fan-out
        await pubSubService.publishNotification({
          type: 'remote_config_approval_request',
          data: {
            templateId: template.id,
            templateName: template.templateName,
            environmentName: environment.environmentName,
            requestType: 'create',
            requestedBy: userId
          },
          targetChannels: ['remote_config_approvals', 'admin']
        });
      } else {
        // Auto-publish if no approval required
        await template.publish(userId);
      }

      logger.info(`Template created: ${templateName} in ${environment.environmentName} by user ${userId}`);

      res.status(201).json({
        success: true,
        data: template,
        message: 'Template created successfully'
      });
    } catch (error) {
      logger.error('Error creating template:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create template'
      });
    }
  });

  /**
   * Update template
   */
  static updateTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { templateData, changeDescription } = req.body;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const template = await RemoteConfigTemplate.query()
      .findById(id)
      .withGraphFetched('environment');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    if (!template.canEdit()) {
      return res.status(400).json({
        success: false,
        message: 'Template cannot be edited in its current status'
      });
    }

    try {
      // If environment requires approval, create change request
      if (template.environment?.requiresApproval) {
        await RemoteConfigChangeRequest.createChangeRequest({
          templateId: template.id,
          environmentId: template.environmentId,
          requestType: 'update',
          proposedChanges: templateData,
          currentData: template.templateData,
          description: changeDescription || 'Template update',
          requestedBy: userId
        });

        // Send notification via PubSub so all instances fan-out
        await pubSubService.publishNotification({
          type: 'remote_config_approval_request',
          data: {
            templateId: template.id,
            templateName: template.templateName,
            environmentName: template.environment?.environmentName,
            requestType: 'update',
            requestedBy: userId
          },
          targetChannels: ['remote_config_approvals', 'admin']
        });

        res.json({
          success: true,
          message: 'Change request created and pending approval'
        });
      } else {
        // Update directly if no approval required
        const updatedTemplate = await template.updateTemplate(templateData, userId, changeDescription);

        logger.info(`Template updated: ${template.templateName} by user ${userId}`);

        res.json({
          success: true,
          data: updatedTemplate,
          message: 'Template updated successfully'
        });
      }
    } catch (error) {
      logger.error('Error updating template:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update template'
      });
    }
  });

  /**
   * Publish template
   */
  static publishTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const template = await RemoteConfigTemplate.query().findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    if (!template.canPublish()) {
      return res.status(400).json({
        success: false,
        message: 'Template cannot be published in its current status'
      });
    }

    try {
      const publishedTemplate = await template.publish(userId);

      // Send notification via PubSub so all instances fan-out
      await pubSubService.publishNotification({
        type: 'remote_config_published',
        data: {
          templateId: template.id,
          templateName: template.templateName,
          publishedBy: userId
        },
        targetChannels: ['remote_config', 'admin']
      });

      logger.info(`Template published: ${template.templateName} by user ${userId}`);

      res.json({
        success: true,
        data: publishedTemplate,
        message: 'Template published successfully'
      });
    } catch (error) {
      logger.error('Error publishing template:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to publish template'
      });
    }
  });

  /**
   * Archive template
   */
  static archiveTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user as any)?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const template = await RemoteConfigTemplate.query().findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    if (!template.canArchive()) {
      return res.status(400).json({
        success: false,
        message: 'Template cannot be archived in its current status'
      });
    }

    try {
      const archivedTemplate = await template.archive(userId);

      logger.info(`Template archived: ${template.templateName} by user ${userId}`);

      res.json({
        success: true,
        data: archivedTemplate,
        message: 'Template archived successfully'
      });
    } catch (error) {
      logger.error('Error archiving template:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to archive template'
      });
    }
  });

  /**
   * Get template versions
   */
  static getTemplateVersions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { limit } = req.query;

    const versions = await RemoteConfigTemplateVersion.getVersionsForTemplate(
      parseInt(id),
      limit ? parseInt(limit as string) : 10
    );

    res.json({
      success: true,
      data: versions
    });
  });

  /**
   * Get template version history
   */
  static getTemplateHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const history = await RemoteConfigTemplateVersion.getVersionHistory(parseInt(id));

    res.json({
      success: true,
      data: history
    });
  });

  /**
   * Compare template versions
   */
  static compareVersions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { fromVersion, toVersion } = req.query;

    if (!fromVersion || !toVersion) {
      return res.status(400).json({
        success: false,
        message: 'Both fromVersion and toVersion are required'
      });
    }

    const comparison = await RemoteConfigTemplateVersion.compareVersions(
      parseInt(id),
      parseInt(fromVersion as string),
      parseInt(toVersion as string)
    );

    res.json({
      success: true,
      data: comparison
    });
  });

  /**
   * Validate template name
   */
  static validateTemplateName = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { environmentId, templateName } = req.body;

    if (!templateName) {
      return res.status(400).json({
        success: false,
        message: 'Template name is required'
      });
    }

    const isValid = RemoteConfigTemplate.isValidTemplateName(templateName);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template name. Use only lowercase letters, numbers, underscore, and hyphen.'
      });
    }

    const existing = await RemoteConfigTemplate.getByEnvironmentAndName(environmentId, templateName);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Template name already exists in this environment'
      });
    }

    res.json({
      success: true,
      message: 'Template name is valid and available'
    });
  });
}

export default RemoteConfigTemplateController;
