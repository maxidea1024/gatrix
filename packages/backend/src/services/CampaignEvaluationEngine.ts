import db from '../config/knex';
import logger from '../config/logger';
import { Campaign, CampaignConfig } from '../types/remoteConfig';

export interface UserContext {
  userId?: string;
  userLevel?: string;
  country?: string;
  appVersion?: string;
  platform?: string;
  deviceType?: string;
  language?: string;
  customAttributes?: Record<string, any>;
}

export interface EvaluationResult {
  configId: number;
  value: any;
  campaignId?: number;
  campaignName?: string;
  source: 'default' | 'campaign' | 'variant';
  priority: number;
}

export class CampaignEvaluationEngine {
  /**
   * Evaluate all active campaigns for a user and return config values
   */
  static async evaluateForUser(
    userId: string, 
    userContext: UserContext,
    configIds?: number[]
  ): Promise<Record<string, EvaluationResult>> {
    try {
      const now = new Date();
      
      // Get all active campaigns that are currently running
      let campaignQuery = db('g_remote_config_campaigns as c')
        .where('c.isActive', true)
        .where('c.status', 'running')
        .where(function() {
          this.whereNull('c.startDate').orWhere('c.startDate', '<=', now);
        })
        .where(function() {
          this.whereNull('c.endDate').orWhere('c.endDate', '>=', now);
        })
        .orderBy('c.priority', 'desc')
        .orderBy('c.createdAt', 'asc');

      const activeCampaigns = await campaignQuery;
      
      // Get all configs (either specified ones or all active configs)
      let configQuery = db('g_remote_configs as rc')
        .where('rc.isActive', true);
      
      if (configIds && configIds.length > 0) {
        configQuery = configQuery.whereIn('rc.id', configIds);
      }
      
      const configs = await configQuery;
      
      const results: Record<string, EvaluationResult> = {};
      
      // Initialize with default values
      for (const config of configs) {
        results[config.keyName] = {
          configId: config.id,
          value: this.parseConfigValue(config.defaultValue, config.valueType),
          source: 'default',
          priority: 0
        };
      }
      
      // Evaluate campaigns in priority order
      for (const campaign of activeCampaigns) {
        // Check if user matches campaign conditions
        if (await this.evaluateTargetConditions(campaign, userContext)) {
          // Get campaign configs
          const campaignConfigs = await db('g_remote_config_campaign_configs as cc')
            .leftJoin('g_remote_configs as rc', 'cc.configId', 'rc.id')
            .select([
              'cc.*',
              'rc.keyName',
              'rc.valueType'
            ])
            .where('cc.campaignId', campaign.id)
            .orderBy('cc.priority', 'desc');
          
          // Apply campaign values (higher priority campaigns override lower ones)
          for (const campaignConfig of campaignConfigs) {
            const configKey = campaignConfig.keyName;
            
            if (results[configKey] && campaign.priority >= results[configKey].priority) {
              results[configKey] = {
                configId: campaignConfig.configId,
                value: this.parseConfigValue(campaignConfig.campaignValue, campaignConfig.valueType),
                campaignId: campaign.id,
                campaignName: campaign.campaignName,
                source: 'campaign',
                priority: campaign.priority
              };
            }
          }
        }
      }
      
      logger.info(`Evaluated ${Object.keys(results).length} configs for user ${userId}`);
      return results;
      
    } catch (error) {
      logger.error('Error evaluating campaigns for user:', error);
      throw error;
    }
  }

  /**
   * Evaluate target conditions for a campaign
   */
  private static async evaluateTargetConditions(
    campaign: Campaign, 
    userContext: UserContext
  ): Promise<boolean> {
    try {
      if (!campaign.targetConditions) {
        return true; // No conditions = applies to all users
      }
      
      const conditions = typeof campaign.targetConditions === 'string' 
        ? JSON.parse(campaign.targetConditions) 
        : campaign.targetConditions;
      
      // Evaluate each condition
      for (const [key, expectedValue] of Object.entries(conditions)) {
        const userValue = this.getUserContextValue(userContext, key);
        
        if (!this.evaluateCondition(userValue, expectedValue)) {
          return false;
        }
      }
      
      return true;
      
    } catch (error) {
      logger.error('Error evaluating target conditions:', error);
      return false; // Fail safe - don't apply campaign if evaluation fails
    }
  }

  /**
   * Get user context value by key
   */
  private static getUserContextValue(userContext: UserContext, key: string): any {
    switch (key) {
      case 'userLevel':
        return userContext.userLevel;
      case 'country':
        return userContext.country;
      case 'appVersion':
        return userContext.appVersion;
      case 'platform':
        return userContext.platform;
      case 'deviceType':
        return userContext.deviceType;
      case 'language':
        return userContext.language;
      default:
        return userContext.customAttributes?.[key];
    }
  }

  /**
   * Evaluate a single condition
   */
  private static evaluateCondition(userValue: any, expectedValue: any): boolean {
    if (typeof expectedValue === 'string') {
      // String comparison or version comparison
      if (expectedValue.startsWith('>=')) {
        return this.compareVersions(userValue, expectedValue.substring(2)) >= 0;
      } else if (expectedValue.startsWith('<=')) {
        return this.compareVersions(userValue, expectedValue.substring(2)) <= 0;
      } else if (expectedValue.startsWith('>')) {
        return this.compareVersions(userValue, expectedValue.substring(1)) > 0;
      } else if (expectedValue.startsWith('<')) {
        return this.compareVersions(userValue, expectedValue.substring(1)) < 0;
      } else {
        return userValue === expectedValue;
      }
    } else if (Array.isArray(expectedValue)) {
      // Array contains check
      return expectedValue.includes(userValue);
    } else {
      // Direct comparison
      return userValue === expectedValue;
    }
  }

  /**
   * Compare semantic versions
   */
  private static compareVersions(version1: string, version2: string): number {
    if (!version1 || !version2) return 0;
    
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    const maxLength = Math.max(v1parts.length, v2parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }
    
    return 0;
  }

  /**
   * Parse config value based on type
   */
  private static parseConfigValue(value: string, valueType: string): any {
    if (!value) return null;
    
    try {
      switch (valueType) {
        case 'boolean':
          return value === 'true' || value === '1';
        case 'number':
          return Number(value);
        case 'json':
          return JSON.parse(value);
        case 'yaml':
          // For now, treat YAML as string. Could add YAML parser later
          return value;
        default:
          return value;
      }
    } catch (error) {
      logger.warn(`Failed to parse config value: ${value} as ${valueType}`);
      return value; // Return as string if parsing fails
    }
  }

  /**
   * Get active campaigns for a specific time
   */
  static async getActiveCampaigns(timestamp: Date = new Date()): Promise<Campaign[]> {
    try {
      const campaigns = await db('g_remote_config_campaigns as c')
        .leftJoin('g_users as creator', 'c.createdBy', 'creator.id')
        .select([
          'c.*',
          'creator.name as createdByName'
        ])
        .where('c.isActive', true)
        .where('c.status', 'running')
        .where(function() {
          this.whereNull('c.startDate').orWhere('c.startDate', '<=', timestamp);
        })
        .where(function() {
          this.whereNull('c.endDate').orWhere('c.endDate', '>=', timestamp);
        })
        .orderBy('c.priority', 'desc')
        .orderBy('c.createdAt', 'asc');

      return campaigns.map(this.transformCampaign);
    } catch (error) {
      logger.error('Error getting active campaigns:', error);
      throw error;
    }
  }

  /**
   * Evaluate conditions against user context (public method for testing)
   */
  static evaluateConditions(conditions: any[], userContext: UserContext): boolean {
    if (!conditions || conditions.length === 0) {
      return true; // No conditions = match all
    }

    // Simple AND logic for now - all conditions must be true
    for (const condition of conditions) {
      if (!this.evaluateSingleCondition(condition, userContext)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition
   */
  private static evaluateSingleCondition(condition: any, userContext: UserContext): boolean {
    const { field, operator, value } = condition;
    const userValue = (userContext as any)[field];

    switch (operator) {
      case 'equals':
        return userValue === value;
      case 'not_equals':
        return userValue !== value;
      case 'greater_than':
        return Number(userValue) > Number(value);
      case 'less_than':
        return Number(userValue) < Number(value);
      case 'greater_than_or_equal':
        return Number(userValue) >= Number(value);
      case 'less_than_or_equal':
        return Number(userValue) <= Number(value);
      case 'in':
        return Array.isArray(value) && value.includes(userValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(userValue);
      case 'contains':
        return Array.isArray(userValue) && userValue.includes(value);
      case 'not_contains':
        return Array.isArray(userValue) && !userValue.includes(value);
      case 'contains_any':
        return Array.isArray(userValue) && Array.isArray(value) &&
               value.some(v => userValue.includes(v));
      case 'contains_all':
        return Array.isArray(userValue) && Array.isArray(value) &&
               value.every(v => userValue.includes(v));
      default:
        return false;
    }
  }

  /**
   * Transform database row to Campaign object
   */
  private static transformCampaign(row: any): Campaign {
    return {
      id: row.id,
      campaignName: row.campaignName,
      description: row.description,
      startDate: row.startDate,
      endDate: row.endDate,
      targetConditions: typeof row.targetConditions === 'string' ?
        JSON.parse(row.targetConditions) : row.targetConditions,
      trafficPercentage: parseFloat(row.trafficPercentage) || 100.00,
      priority: row.priority || 0,
      status: row.status || 'draft',
      isActive: Boolean(row.isActive),
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByName: row.createdByName,
      updatedByName: row.updatedByName
    };
  }
}
