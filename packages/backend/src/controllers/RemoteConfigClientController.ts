import { Request, Response } from 'express';
import { RemoteConfigModel } from '../models/RemoteConfig';
import ConfigRuleModel from '../models/ConfigRule';
import logger from '../config/logger';
import { CustomError } from '../middleware/errorHandler';
import { TrafficSplitter, CampaignEvaluator } from '../utils/trafficSplitter';
import { Database } from '../config/database';
import {
  EvaluationContext,
  EvaluationResult,
  RemoteConfig,
  ConfigRule,
  ConfigVariant
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

      // 2. Check for rules (second priority)
      const ruleValue = await ConfigRuleModel.evaluateRules(config.id, context);
      if (ruleValue !== null) {
        const rule = await this.getMatchingRule(config.id, context);
        return {
          value: this.parseValue(ruleValue, config.valueType),
          source: 'rule',
          ruleId: rule?.id,
          appliedAt
        };
      }

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
    // TODO: Implement campaign evaluation
    // This would check active campaigns and their conditions
    return null;
  }

  /**
   * Get matching rule for config
   */
  private static async getMatchingRule(configId: number, context: EvaluationContext): Promise<ConfigRule | null> {
    try {
      const rules = await ConfigRuleModel.getRulesByConfigId(configId);
      
      for (const rule of rules) {
        if (await this.evaluateRuleConditions(rule, context)) {
          return rule;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting matching rule:', error);
      return null;
    }
  }

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
      const db = Database.getInstance();

      // Query database for active variants
      const [rows] = await db.query(`
        SELECT id, trafficPercentage, value
        FROM g_remote_config_variants
        WHERE configId = ? AND isActive = true
        ORDER BY priority DESC
      `, [configId]);

      const variants = Array.isArray(rows) ? rows : [];
      return variants.length > 0 ? variants : null;
    } catch (error) {
      logger.error('Error getting active variants:', error);
      return null;
    }
  }

  /**
   * Evaluate rule conditions
   */
  private static async evaluateRuleConditions(rule: ConfigRule, context: EvaluationContext): Promise<boolean> {
    // This is a simplified version - the full implementation is in ConfigRuleModel
    try {
      const ruleValue = await ConfigRuleModel.evaluateRules(rule.configId, context);
      return ruleValue === rule.value;
    } catch (error) {
      logger.error('Error evaluating rule conditions:', error);
      return false;
    }
  }

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
        case 'number':
          const num = Number(value);
          return isNaN(num) ? 0 : num;
        case 'boolean':
          if (typeof value === 'boolean') return value;
          return value.toLowerCase() === 'true' || value === '1';
        case 'json':
          return typeof value === 'string' ? JSON.parse(value) : value;
        case 'yaml':
          // TODO: Implement YAML parsing
          return value;
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

  /**
   * Generate consistent hash for A/B testing
   */
  private static generateHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export default RemoteConfigClientController;
