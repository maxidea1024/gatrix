import db from '../config/knex';
import logger from '../config/logger';
import {
  Campaign,
  CreateCampaignData,
  CampaignConfig,
  CreateCampaignConfigData
} from '../types/remoteConfig';

export class CampaignModel {
  /**
   * Get all campaigns with pagination and filters
   */
  static async list(
    page: number = 1,
    limit: number = 10,
    filters: { environment: string; search?: string; isActive?: boolean }
  ): Promise<{
    campaigns: Campaign[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      const { environment } = filters;

      let query = db('g_remote_config_campaigns as c')
        .leftJoin('g_users as creator', 'c.createdBy', 'creator.id')
        .select([
          'c.*',
          'creator.name as createdByName'
        ])
        .where('c.environment', environment);

      // Apply filters
      if (filters.search) {
        query = query.where(function () {
          this.where('c.campaignName', 'like', `%${filters.search}%`)
            .orWhere('c.description', 'like', `%${filters.search}%`);
        });
      }

      if (filters.isActive !== undefined) {
        query = query.where('c.isActive', filters.isActive);
      }

      // Get total count
      const totalQuery = query.clone().clearSelect().count('* as count');
      const [{ count: total }] = await totalQuery;

      // Apply sorting and pagination
      const campaigns = await query
        .orderBy('c.createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      // Transform results
      const transformedCampaigns = campaigns.map(this.transformCampaign);

      return {
        campaigns: transformedCampaigns,
        total: Number(total),
        page,
        limit
      };
    } catch (error) {
      logger.error('Error listing campaigns:', error);
      throw error;
    }
  }

  /**
   * Get campaign by ID with relations
   */
  static async findById(id: number, environment: string, includeConfigs: boolean = true): Promise<Campaign | null> {
    try {
      const campaign = await db('g_remote_config_campaigns as c')
        .leftJoin('g_users as creator', 'c.createdBy', 'creator.id')
        .select([
          'c.*',
          'creator.name as createdByName'
        ])
        .where('c.id', id)
        .where('c.environment', environment)
        .first();

      if (!campaign) {
        return null;
      }

      const transformedCampaign = this.transformCampaign(campaign);

      if (includeConfigs) {
        // Get associated configs
        const configs = await db('g_remote_config_campaign_configs as cc')
          .leftJoin('g_remote_configs as rc', 'cc.configId', 'rc.id')
          .select([
            'cc.*',
            'rc.keyName as configKeyName',
            'rc.valueType as configValueType'
          ])
          .where('cc.campaignId', id)
          .where('rc.environment', environment);

        transformedCampaign.configs = configs.map(this.transformCampaignConfig);
      }

      return transformedCampaign;
    } catch (error) {
      logger.error('Error finding campaign by ID:', error);
      throw error;
    }
  }

  /**
   * Create new campaign
   */
  static async create(data: CreateCampaignData, environment: string): Promise<Campaign> {
    try {
      const [insertId] = await db('g_remote_config_campaigns').insert({
        environment,
        campaignName: data.campaignName,
        description: data.description || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        targetConditions: data.targetConditions ? JSON.stringify(data.targetConditions) : null,
        trafficPercentage: data.trafficPercentage ?? 100.00,
        priority: data.priority || 0,
        status: data.status || 'draft',
        isActive: data.isActive ?? true,
        createdBy: data.createdBy || null
      });

      const created = await this.findById(insertId, environment, false);
      if (!created) {
        throw new Error('Failed to retrieve created campaign');
      }

      logger.info(`Campaign created: ${data.campaignName} (ID: ${insertId}, Env: ${environment})`);
      return created;
    } catch (error) {
      logger.error('Error creating campaign:', error);
      throw error;
    }
  }

  /**
   * Update campaign
   */
  static async update(id: number, environment: string, data: Partial<CreateCampaignData>): Promise<Campaign> {
    try {
      const updateData: any = {};

      if (data.campaignName !== undefined) updateData.campaignName = data.campaignName;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
      if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
      if (data.targetConditions !== undefined) updateData.targetConditions = data.targetConditions ? JSON.stringify(data.targetConditions) : null;
      if (data.trafficPercentage !== undefined) updateData.trafficPercentage = data.trafficPercentage;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      await db('g_remote_config_campaigns')
        .where('id', id)
        .where('environment', environment)
        .update(updateData);

      const updated = await this.findById(id, environment, false);
      if (!updated) {
        throw new Error('Failed to retrieve updated campaign');
      }

      logger.info(`Campaign updated: ID ${id}, Env: ${environment}`);
      return updated;
    } catch (error) {
      logger.error('Error updating campaign:', error);
      throw error;
    }
  }

  /**
   * Delete campaign
   */
  static async delete(id: number, environment: string): Promise<void> {
    try {
      await db('g_remote_config_campaigns')
        .where('id', id)
        .where('environment', environment)
        .del();
      logger.info(`Campaign deleted: ID ${id}, Env: ${environment}`);
    } catch (error) {
      logger.error('Error deleting campaign:', error);
      throw error;
    }
  }

  /**
   * Add config to campaign
   */
  static async addConfig(data: CreateCampaignConfigData, environment: string): Promise<CampaignConfig> {
    try {
      // Verify campaign exists in environment
      const campaign = await db('g_remote_config_campaigns')
        .where('id', data.campaignId)
        .where('environment', environment)
        .first();

      if (!campaign) {
        throw new Error('Campaign not found in environment');
      }

      const [insertId] = await db('g_remote_config_campaign_configs').insert({
        campaignId: data.campaignId,
        configId: data.configId,
        campaignValue: data.campaignValue || null
      });

      const created = await db('g_remote_config_campaign_configs as cc')
        .leftJoin('g_remote_configs as rc', 'cc.configId', 'rc.id')
        .select([
          'cc.*',
          'rc.keyName as configKeyName',
          'rc.valueType as configValueType'
        ])
        .where('cc.id', insertId)
        .where('rc.environment', environment)
        .first();

      if (!created) {
        throw new Error('Failed to retrieve created campaign config');
      }

      return this.transformCampaignConfig(created);
    } catch (error) {
      logger.error('Error adding config to campaign:', error);
      throw error;
    }
  }

  /**
   * Remove config from campaign
   */
  static async removeConfig(campaignId: number, configId: number, environment: string): Promise<void> {
    try {
      // Verify campaign exists in environment
      const campaign = await db('g_remote_config_campaigns')
        .where('id', campaignId)
        .where('environment', environment)
        .first();

      if (!campaign) {
        throw new Error('Campaign not found in environment');
      }

      await db('g_remote_config_campaign_configs')
        .where('campaignId', campaignId)
        .where('configId', configId)
        .del();

      logger.info(`Config ${configId} removed from campaign ${campaignId} in Env: ${environment}`);
    } catch (error) {
      logger.error('Error removing config from campaign:', error);
      throw error;
    }
  }

  /**
   * Transform database row to Campaign object
   */
  private static transformCampaign(row: any): Campaign {
    return {
      id: row.id,
      environment: row.environment,
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByName: row.createdByName
    };
  }

  /**
   * Transform database row to CampaignConfig object
   */
  private static transformCampaignConfig(row: any): CampaignConfig {
    return {
      id: row.id,
      campaignId: row.campaignId,
      configId: row.configId,
      campaignValue: row.campaignValue,
      createdAt: row.createdAt,
      configKeyName: row.configKeyName,
      configValueType: row.configValueType
    };
  }
}

export default CampaignModel;
