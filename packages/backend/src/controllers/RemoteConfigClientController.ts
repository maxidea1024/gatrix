import { Request, Response } from 'express';
import { RemoteConfigModel } from '../models/RemoteConfig';
import logger from '../config/logger';
import { CustomError } from '../middleware/errorHandler';
import { TrafficSplitter } from '../utils/trafficSplitter';
import db from '../config/knex';
import {
  EvaluationContext,
  EvaluationResult,
  RemoteConfig
} from '../types/remoteConfig';

export class RemoteConfigClientController {
  /**
   * Evaluate remote configs for client
   * Server-side evaluation to prevent tampering
   */
  static async evaluate(req: Request, res: Response): Promise<void> {
    try {
      const context: EvaluationContext = req.body.context || {};
      const requestedKeys: string[] = req.body.keys || [];

      // Get all active configs or specific requested keys
      let configs: RemoteConfig[];
      
      if (requestedKeys.length > 0) {
        // Get specific configs by keys
        configs = [];
        for (const key of requestedKeys) {
          const config = await RemoteConfigModel.findByKey(key);
          if (config && config.isActive) {
            configs.push(config);
          }
        }
      } else {
        // Get all active configs
        const result = await RemoteConfigModel.list(1, 1000, { isActive: true });
        configs = result.configs;
      }

      const evaluationResult: EvaluationResult = {};

      // Evaluate each config
      for (const config of configs) {
        const evaluatedValue = await this.evaluateConfig(config, context);
        evaluationResult[config.keyName] = evaluatedValue;
      }

      res.json({
        success: true,
        data: {
          configs: evaluationResult,
          evaluatedAt: new Date().toISOString(),
          context: this.sanitizeContext(context)
        }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigClientController.evaluate:', error);
      throw new CustomError('Failed to evaluate remote configs', 500);
    }
  }

  /**
   * Get single config value by key
   */
  static async getConfigByKey(req: Request, res: Response): Promise<void> {
    try {
      const keyName = req.params.key;
      const context: EvaluationContext = req.body.context || {};

      const config = await RemoteConfigModel.findByKey(keyName);
      
      if (!config || !config.isActive) {
        throw new CustomError('Config not found or inactive', 404);
      }

      const evaluatedValue = await this.evaluateConfig(config, context);

      res.json({
        success: true,
        data: {
          key: keyName,
          ...evaluatedValue,
          evaluatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error in RemoteConfigClientController.getConfigByKey:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to get config', 500);
    }
  }

  /**
   * Evaluate a single config against context
   */
  private static async evaluateConfig(config: RemoteConfig, context: EvaluationContext): Promise<{
    value: any;
    source: 'default' | 'rule' | 'variant' | 'campaign';
    ruleId?: number;
    variantId?: number;
    campaignId?: number;
    appliedAt: string;
  }> {
    const appliedAt = new Date().toISOString();

    try {
      // 1. Check for active campaigns first (highest priority)
      const campaignValue = await this.evaluateCampaigns(config.id, context);
      if (campaignValue !== null) {
        return {
          value: this.parseValue(campaignValue.value, config.valueType),
          source: 'campaign',
          campaignId: campaignValue.campaignId,
          appliedAt
        };
      }

      // 2. Rules are now handled through campaigns only
      // (Rules/Segments are no longer directly applied to configs)

      // 3. Check for A/B test variants (third priority)
      const variantValue = await this.evaluateVariants(config.id, context);
      if (variantValue !== null) {
        return {
          value: this.parseValue(variantValue.value, config.valueType),
          source: 'variant',
          variantId: variantValue.variantId,
          appliedAt
        };
      }

      // 4. Return default value (lowest priority)
      return {
        value: this.parseValue(config.defaultValue, config.valueType),
        source: 'default',
        appliedAt
      };
    } catch (error) {
      logger.error(`Error evaluating config ${config.keyName}:`, error);
      
      // Return default value on error
      return {
        value: this.parseValue(config.defaultValue, config.valueType),
        source: 'default',
        appliedAt
      };
    }
  }

  /**
   * Evaluate campaigns for config
   */
  private static async evaluateCampaigns(configId: number, context: EvaluationContext): Promise<{
    value: string;
    campaignId: number;
  } | null> {
    try {
      // Get active campaigns for this config
      const campaigns = await db('g_remote_config_campaigns as c')
        .leftJoin('g_remote_config_campaign_configs as cc', 'c.id', 'cc.campaignId')
        .where('cc.configId', configId)
        .where('c.status', 'active')
        .where('c.startTime', '<=', new Date())
        .where(function() {
          this.whereNull('c.endTime').orWhere('c.endTime', '>', new Date());
        })
        .orderBy('c.priority', 'desc')
        .select('c.*');

      for (const campaign of campaigns) {
        // Check if campaign conditions match
        if (await this.evaluateCampaignConditions(campaign, context)) {
          // Get campaign variant value
          const variant = await this.getCampaignVariant(campaign.id, context);
          if (variant) {
            return {
              value: variant.value,
              campaignId: campaign.id
            };
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error evaluating campaigns:', error);
      return null;
    }
  }

  /**
   * Evaluate campaign conditions
   */
  private static async evaluateCampaignConditions(campaign: any, context: EvaluationContext): Promise<boolean> {
    try {
      if (!campaign.targetConditions) {
        return true; // No conditions means applies to all
      }

      const conditions = typeof campaign.targetConditions === 'string'
        ? JSON.parse(campaign.targetConditions)
        : campaign.targetConditions;

      // Campaign condition evaluation logic would go here
      // For now, return true (allow all traffic)
      return true;
    } catch (error) {
      logger.error('Error evaluating campaign conditions:', error);
      return false;
    }
  }

  /**
   * Get campaign variant for user
   */
  private static async getCampaignVariant(campaignId: number, context: EvaluationContext): Promise<any> {
    try {
      const variants = await db('g_remote_config_campaign_variants')
        .where('campaignId', campaignId)
        .where('isActive', true)
        .orderBy('trafficPercentage', 'desc');

      if (variants.length === 0) {
        return null;
      }

      // Use traffic splitter to determine variant
      const userId = context.userId || (context as any).sessionId || 'anonymous';
      const hash = this.simpleHash(userId + campaignId);
      const percentage = hash % 100;

      let cumulativePercentage = 0;
      for (const variant of variants) {
        cumulativePercentage += variant.trafficPercentage;
        if (percentage < cumulativePercentage) {
          return variant;
        }
      }

      return variants[0]; // Fallback to first variant
    } catch (error) {
      logger.error('Error getting campaign variant:', error);
      return null;
    }
  }

  /**
   * Simple hash function for traffic splitting
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // getMatchingRule method removed - rules are now handled through campaigns

  /**
   * Evaluate A/B test variants using MurmurHash-based traffic splitting
   */
  private static async evaluateVariants(configId: number, context: EvaluationContext): Promise<{
    value: string;
    variantId: number;
  } | null> {
    try {
      // Get active variants for this config
      const variants = await this.getActiveVariants(configId);

      if (!variants || variants.length === 0) {
        return null;
      }

      // Use user ID or fallback identifier for consistent hashing
      const userId = context.userId || 'anonymous';
      if (!userId) {
        return null;
      }

      // Use fast MurmurHash-based variant selection
      const selectedVariant = TrafficSplitter.selectVariantFast(
        userId,
        variants,
        `config_${configId}`
      );

      if (selectedVariant) {
        return {
          value: selectedVariant.value,
          variantId: selectedVariant.id as number
        };
      }

      return null;
    } catch (error) {
      logger.error('Error evaluating variants:', error);
      return null;
    }
  }

  /**
   * Get active variants for a config
   */
  private static async getActiveVariants(configId: number): Promise<Array<{
    id: number;
    trafficPercentage: number;
    value: string;
  }> | null> {
    try {
      const knex = require('../config/knex').default;

      // Query database for active variants using knex
      const variants = await knex('g_remote_config_variants')
        .select('id', 'trafficPercentage', 'value')
        .where('configId', configId)
        .where('isActive', true)
        .orderBy('priority', 'desc');

      return variants.length > 0 ? variants : null;
    } catch (error) {
      logger.error('Error getting active variants:', error);
      return null;
    }
  }

  // evaluateRuleConditions method removed - rules are now handled through campaigns

  /**
   * Parse value according to type
   */
  private static parseValue(value: string | null | undefined, valueType: string): any {
    if (value === null || value === undefined) {
      return null;
    }

    try {
      switch (valueType) {
        case 'string':
          return String(value);
        case 'number': {
          const num = Number(value);
          return isNaN(num) ? 0 : num;
        }
        case 'boolean':
          if (typeof value === 'boolean') return value;
          return value.toLowerCase() === 'true' || value === '1';
        case 'json':
          return typeof value === 'string' ? JSON.parse(value) : value;
        case 'yaml':
          try {
            // Simple YAML-like parsing for basic key-value pairs
            if (typeof value === 'string') {
              const lines = value.split('\n').filter(line => line.trim());
              const result: any = {};

              for (const line of lines) {
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                  const key = line.substring(0, colonIndex).trim();
                  const val = line.substring(colonIndex + 1).trim();

                  // Try to parse as number or boolean
                  if (val === 'true') result[key] = true;
                  else if (val === 'false') result[key] = false;
                  else if (!isNaN(Number(val))) result[key] = Number(val);
                  else result[key] = val.replace(/^["']|["']$/g, ''); // Remove quotes
                }
              }

              return Object.keys(result).length > 0 ? result : value;
            }
            return value;
          } catch (yamlError) {
            logger.warn('YAML parsing failed, returning as string:', yamlError);
            return value;
          }
        default:
          return String(value);
      }
    } catch (error) {
      logger.error(`Error parsing value "${value}" as ${valueType}:`, error);
      return value; // Return original value on parse error
    }
  }

  /**
   * Sanitize context for response (remove sensitive data)
   */
  private static sanitizeContext(context: EvaluationContext): Partial<EvaluationContext> {
    const { customFields, ...safeContext } = context;
    
    // Only include non-sensitive custom fields
    const safeCustomFields: Record<string, any> = {};
    if (customFields) {
      Object.entries(customFields).forEach(([key, value]) => {
        // Exclude potentially sensitive fields
        if (!key.toLowerCase().includes('password') && 
            !key.toLowerCase().includes('token') && 
            !key.toLowerCase().includes('secret')) {
          safeCustomFields[key] = value;
        }
      });
    }

    return {
      ...safeContext,
      customFields: Object.keys(safeCustomFields).length > 0 ? safeCustomFields : undefined
    };
  }
}

export default RemoteConfigClientController;
