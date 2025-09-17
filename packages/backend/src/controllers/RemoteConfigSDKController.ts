import { Request, Response } from 'express';
import { RemoteConfigTemplate } from '../models/RemoteConfigTemplate';
import { RemoteConfigEnvironment } from '../models/RemoteConfigEnvironment';
import { ApiAccessToken } from '../models/ApiAccessToken';
import { asyncHandler } from '../utils/asyncHandler';
import { CacheService } from '../services/CacheService';
import logger from '../config/logger';

interface SDKRequest extends Request {
  apiToken?: ApiAccessToken;
  environment?: RemoteConfigEnvironment;
}

interface UserContext {
  userId?: string;
  platform?: string;
  appVersion?: string;
  customAttributes?: Record<string, any>;
}

export class RemoteConfigSDKController {
  /**
   * Simple test endpoint for SDK authentication
   */
  static testAuth = asyncHandler(async (req: SDKRequest, res: Response) => {
    const apiToken = req.apiToken;

    res.json({
      success: true,
      message: 'SDK authentication successful',
      data: {
        tokenId: apiToken?.id,
        tokenName: apiToken?.tokenName,
        tokenType: apiToken?.tokenType,
        timestamp: new Date().toISOString()
      }
    });
  });

  /**
   * Get client templates for SDK
   */
  static getClientTemplates = asyncHandler(async (req: SDKRequest, res: Response) => {
    const environment = req.environment;
    const etag = req.headers['if-none-match'];

    if (!environment) {
      return res.status(400).json({
        success: false,
        message: 'Environment not found'
      });
    }

    try {
      // Get cache key
      const cacheKey = `remote_config:client:${environment.environmentName}`;
      
      // Try to get from cache first
      const cached = await CacheService.get<{etag: string; data: any}>(cacheKey);
      if (cached) {
        const cachedEtag = cached.etag;

        // Check if client has the latest version
        if (etag && etag === cachedEtag) {
          return res.status(304).end();
        }

        res.set('ETag', cachedEtag);
        res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
        return res.json(cached.data);
      }

      // Get published client templates
      const templates = await RemoteConfigTemplate.getPublishedByEnvironment(
        environment.id,
        'client'
      );

      // Combine all templates into a single response
      const combinedConfig: any = {
        configs: {},
        segments: {},
        campaigns: [],
        metadata: {
          environment: environment.environmentName,
          lastUpdated: new Date().toISOString(),
          templateCount: templates.length
        }
      };

      // Merge all template data
      for (const template of templates) {
        if (template.templateData.configs) {
          Object.assign(combinedConfig.configs, template.templateData.configs);
        }
        if (template.templateData.segments) {
          Object.assign(combinedConfig.segments, template.templateData.segments);
        }
        if (template.templateData.campaigns) {
          combinedConfig.campaigns.push(...template.templateData.campaigns);
        }
      }

      // Generate ETag
      const responseEtag = `"${Date.now()}-${templates.length}"`;
      
      // Cache the response
      await CacheService.set(cacheKey, {
        data: {
          success: true,
          data: combinedConfig
        },
        etag: responseEtag
      }, 300); // 5 minutes

      res.set('ETag', responseEtag);
      res.set('Cache-Control', 'public, max-age=300');
      
      res.json({
        success: true,
        data: combinedConfig
      });

    } catch (error) {
      logger.error('Error getting client templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get client templates'
      });
    }
  });

  /**
   * Get server templates for SDK
   */
  static getServerTemplates = asyncHandler(async (req: SDKRequest, res: Response) => {
    const environment = req.environment;
    const etag = req.headers['if-none-match'];

    if (!environment) {
      return res.status(400).json({
        success: false,
        message: 'Environment not found'
      });
    }

    try {
      // Get cache key
      const cacheKey = `remote_config:server:${environment.environmentName}`;
      
      // Try to get from cache first
      const cached = await CacheService.get<{etag: string; data: any}>(cacheKey);
      if (cached) {
        const cachedEtag = cached.etag;

        // Check if client has the latest version
        if (etag && etag === cachedEtag) {
          return res.status(304).end();
        }

        res.set('ETag', cachedEtag);
        res.set('Cache-Control', 'public, max-age=300');
        return res.json(cached.data);
      }

      // Get published server templates
      const templates = await RemoteConfigTemplate.getPublishedByEnvironment(
        environment.id,
        'server'
      );

      // Combine all templates into a single response
      const combinedConfig: any = {
        configs: {},
        segments: {},
        campaigns: [],
        metadata: {
          environment: environment.environmentName,
          lastUpdated: new Date().toISOString(),
          templateCount: templates.length
        }
      };

      // Merge all template data
      for (const template of templates) {
        if (template.templateData.configs) {
          Object.assign(combinedConfig.configs, template.templateData.configs);
        }
        if (template.templateData.segments) {
          Object.assign(combinedConfig.segments, template.templateData.segments);
        }
        if (template.templateData.campaigns) {
          combinedConfig.campaigns.push(...template.templateData.campaigns);
        }
      }

      // Generate ETag
      const responseEtag = `"${Date.now()}-${templates.length}"`;
      
      // Cache the response
      await CacheService.set(cacheKey, {
        data: {
          success: true,
          data: combinedConfig
        },
        etag: responseEtag
      }, 300); // 5 minutes

      res.set('ETag', responseEtag);
      res.set('Cache-Control', 'public, max-age=300');
      
      res.json({
        success: true,
        data: combinedConfig
      });

    } catch (error) {
      logger.error('Error getting server templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get server templates'
      });
    }
  });

  /**
   * Evaluate config for client SDK
   */
  static evaluateConfig = asyncHandler(async (req: SDKRequest, res: Response) => {
    const { configKey, userContext } = req.body;
    const environment = req.environment;

    if (!environment) {
      return res.status(400).json({
        success: false,
        message: 'Environment not found'
      });
    }

    if (!configKey) {
      return res.status(400).json({
        success: false,
        message: 'Config key is required'
      });
    }

    try {
      // Get client templates
      const templates = await RemoteConfigTemplate.getPublishedByEnvironment(
        environment.id,
        'client'
      );

      // Find the config
      let configValue = null;
      let configFound = false;

      for (const template of templates) {
        if (template.templateData.configs[configKey]) {
          configValue = template.templateData.configs[configKey].defaultValue;
          configFound = true;
          break;
        }
      }

      if (!configFound) {
        return res.status(404).json({
          success: false,
          message: 'Config not found'
        });
      }

      // TODO: Implement campaign evaluation logic here
      // For now, just return the default value

      res.json({
        success: true,
        data: {
          configKey,
          value: configValue,
          evaluatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error evaluating config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to evaluate config'
      });
    }
  });

  /**
   * Submit metrics from SDK
   */
  static submitMetrics = asyncHandler(async (req: SDKRequest, res: Response) => {
    const { metrics } = req.body;
    const environment = req.environment;
    const apiToken = req.apiToken;

    if (!environment || !apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Environment or API token not found'
      });
    }

    if (!metrics || !Array.isArray(metrics)) {
      return res.status(400).json({
        success: false,
        message: 'Metrics array is required'
      });
    }

    try {
      // TODO: Implement metrics storage
      // For now, just log the metrics
      logger.info('Metrics received:', {
        environment: environment.environmentName,
        tokenType: apiToken.tokenType,
        metricsCount: metrics.length
      });

      res.json({
        success: true,
        message: 'Metrics submitted successfully',
        processed: metrics.length
      });

    } catch (error) {
      logger.error('Error submitting metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit metrics'
      });
    }
  });
}

export default RemoteConfigSDKController;
