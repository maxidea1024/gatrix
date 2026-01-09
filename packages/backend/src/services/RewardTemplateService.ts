import { ulid } from 'ulid';
import db from '../config/knex';
import { GatrixError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { TagService } from './TagService';

export interface ParticipationReward {
  rewardType: string;
  itemId: string;
  quantity: number;
}

export interface RewardTemplate {
  id: string;
  environment: string;
  name: string;
  description?: string;
  rewardItems: ParticipationReward[];
  tags?: string[];
  createdBy?: number;
  updatedBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRewardTemplateInput {
  name: string;
  description?: string;
  rewardItems: ParticipationReward[];
  tags?: string[];
  createdBy?: number;
}

export interface UpdateRewardTemplateInput {
  name?: string;
  description?: string;
  rewardItems?: ParticipationReward[];
  tags?: string[];
  updatedBy?: number;
}

export interface GetRewardTemplatesParams {
  environment: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GetRewardTemplatesResponse {
  templates: RewardTemplate[];
  total: number;
  page: number;
  limit: number;
}

class RewardTemplateService {
  /**
   * Format template from database row
   */
  private static formatTemplate(row: any, tags: string[]): RewardTemplate {
    return {
      ...row,
      rewardItems: typeof row.rewardItems === 'string' ? JSON.parse(row.rewardItems) : row.rewardItems,
      tags: tags,
    };
  }

  /**
   * Get all reward templates with pagination
   */
  static async getRewardTemplates(params: GetRewardTemplatesParams): Promise<GetRewardTemplatesResponse> {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = params.search || '';
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    const environment = params.environment;

    const offset = (page - 1) * limit;

    try {
      let query = db('g_reward_templates').where('environment', environment);

      if (search) {
        query = query.where(function () {
          this.where('name', 'like', `%${search}%`)
            .orWhere('description', 'like', `%${search}%`);
        });
      }

      // Validate sortBy to prevent SQL injection
      const validSortColumns = ['name', 'createdAt', 'updatedAt'];
      const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'createdAt';

      // Get total count
      const countResult = await query.clone().count('* as count').first();
      const total = Number(countResult?.count || 0);

      // Get templates with sorting
      const templates = await query
        .orderBy(safeSortBy, sortOrder)
        .limit(limit)
        .offset(offset);

      // Parse JSON fields and load tags
      const parsedTemplates = await Promise.all(templates.map(async (t: any) => {
        const tags = await TagService.listTagsForEntity('reward_template', t.id);
        logger.debug(`Loaded tags for template ${t.id}:`, { templateId: t.id, tagCount: tags.length, tags });
        return this.formatTemplate(t, tags);
      }));

      return {
        templates: parsedTemplates,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('Failed to get reward templates', { error });
      throw new GatrixError('Failed to get reward templates', 500);
    }
  }

  /**
   * Get reward template by ID
   */
  static async getRewardTemplateById(id: string, environment: string): Promise<RewardTemplate> {
    try {
      const template = await db('g_reward_templates')
        .where('id', id)
        .where('environment', environment)
        .first();

      if (!template) {
        throw new GatrixError('Reward template not found', 404);
      }

      const tags = await TagService.listTagsForEntity('reward_template', id);
      return this.formatTemplate(template, tags);
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to get reward template', { error, id });
      throw new GatrixError('Failed to get reward template', 500);
    }
  }

  /**
   * Create a new reward template
   */
  static async createRewardTemplate(input: CreateRewardTemplateInput, environment: string): Promise<RewardTemplate> {
    const id = ulid();

    try {
      await db('g_reward_templates').insert({
        id,
        environment,
        name: input.name,
        description: input.description || null,
        rewardItems: JSON.stringify(input.rewardItems),
        tags: JSON.stringify(input.tags || []),
        createdBy: input.createdBy || null,
      });

      return this.getRewardTemplateById(id, environment);
    } catch (error) {
      logger.error('Failed to create reward template', { error, input });
      throw new GatrixError('Failed to create reward template', 500);
    }
  }

  /**
   * Update a reward template
   */
  static async updateRewardTemplate(id: string, input: UpdateRewardTemplateInput, environment: string): Promise<RewardTemplate> {
    try {
      // Check if template exists
      await this.getRewardTemplateById(id, environment);

      const updateData: Record<string, any> = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }

      if (input.description !== undefined) {
        updateData.description = input.description;
      }

      if (input.rewardItems !== undefined) {
        updateData.rewardItems = JSON.stringify(input.rewardItems);
      }

      if (input.tags !== undefined) {
        updateData.tags = JSON.stringify(input.tags);
      }

      if (input.updatedBy !== undefined) {
        updateData.updatedBy = input.updatedBy;
      }

      updateData.updatedAt = db.fn.now();

      await db('g_reward_templates')
        .where('id', id)
        .where('environment', environment)
        .update(updateData);

      return this.getRewardTemplateById(id, environment);
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to update reward template', { error, id, input });
      throw new GatrixError('Failed to update reward template', 500);
    }
  }

  /**
   * Check if a reward template is referenced by surveys or coupons
   */
  static async checkReferences(templateId: string, environment: string): Promise<{ surveys: any[], coupons: any[] }> {
    try {
      // Check coupons that reference this template
      const coupons = await db('g_coupon_settings')
        .select('id', 'code', 'type', 'name', 'rewardTemplateId')
        .where('rewardTemplateId', templateId)
        .where('environment', environment);

      return {
        surveys: [],
        coupons: coupons.map((c: any) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          name: c.name,
          referenceType: 'coupon'
        }))
      };
    } catch (error) {
      logger.error('Failed to check references', { error, templateId });
      throw new GatrixError('Failed to check references', 500);
    }
  }

  /**
   * Delete a reward template
   */
  static async deleteRewardTemplate(id: string, environment: string): Promise<void> {
    try {
      // Check if template exists
      await this.getRewardTemplateById(id, environment);

      await db('g_reward_templates')
        .where('id', id)
        .where('environment', environment)
        .del();
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to delete reward template', { error, id });
      throw new GatrixError('Failed to delete reward template', 500);
    }
  }
}

export default RewardTemplateService;
