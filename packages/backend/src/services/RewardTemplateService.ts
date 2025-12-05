import { ulid } from 'ulid';
import database from '../config/database';
import { GatrixError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { TagService } from './TagService';
import { getCurrentEnvironmentId } from '../utils/environmentContext';

export interface ParticipationReward {
  rewardType: string;
  itemId: string;
  quantity: number;
}

export interface RewardTemplate {
  id: string;
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
  environmentId?: string;
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
   * Get all reward templates with pagination
   */
  static async getRewardTemplates(params?: GetRewardTemplatesParams): Promise<GetRewardTemplatesResponse> {
    const pool = database.getPool();
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const search = params?.search || '';
    const sortBy = params?.sortBy || 'createdAt';
    const sortOrder = (params?.sortOrder || 'desc').toUpperCase();
    const envId = params?.environmentId ?? getCurrentEnvironmentId();

    const offset = (page - 1) * limit;

    try {
      const whereConditions: string[] = ['environmentId = ?'];
      const queryParams: any[] = [envId];

      if (search) {
        whereConditions.push('(name LIKE ? OR description LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // Validate sortBy to prevent SQL injection
      const validSortColumns = ['name', 'createdAt', 'updatedAt'];
      const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'createdAt';
      const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

      // Get total count
      const [countRows] = await pool.execute<any[]>(
        `SELECT COUNT(*) as count FROM g_reward_templates ${whereClause}`,
        queryParams
      );
      const total = countRows[0]?.count || 0;

      // Get templates with sorting
      const [templates] = await pool.execute<any[]>(
        `SELECT * FROM g_reward_templates ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ${limit} OFFSET ${offset}`,
        queryParams
      );

      // Parse JSON fields and load tags
      const parsedTemplates = await Promise.all((templates as any[]).map(async (t) => {
        const tags = await TagService.listTagsForEntity('reward_template', t.id);
        logger.debug(`Loaded tags for template ${t.id}:`, { templateId: t.id, tagCount: tags.length, tags });
        return {
          ...t,
          rewardItems: typeof t.rewardItems === 'string' ? JSON.parse(t.rewardItems) : t.rewardItems,
          tags: tags,
        };
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
  static async getRewardTemplateById(id: string, environmentId?: string): Promise<RewardTemplate> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();
    try {
      const [templates] = await pool.execute<any[]>(
        'SELECT * FROM g_reward_templates WHERE id = ? AND environmentId = ?',
        [id, envId]
      );

      if (templates.length === 0) {
        throw new GatrixError('Reward template not found', 404);
      }

      const template = templates[0];
      const tags = await TagService.listTagsForEntity('reward_template', id);
      return {
        ...template,
        rewardItems: typeof template.rewardItems === 'string' ? JSON.parse(template.rewardItems) : template.rewardItems,
        tags: tags,
      };
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to get reward template', { error, id });
      throw new GatrixError('Failed to get reward template', 500);
    }
  }

  /**
   * Create a new reward template
   */
  static async createRewardTemplate(input: CreateRewardTemplateInput): Promise<RewardTemplate> {
    const pool = database.getPool();
    const id = ulid();
    const envId = getCurrentEnvironmentId();

    try {
      await pool.execute(
        `INSERT INTO g_reward_templates
         (id, environmentId, name, description, rewardItems, tags, createdBy, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id,
          envId,
          input.name,
          input.description || null,
          JSON.stringify(input.rewardItems),
          JSON.stringify(input.tags || []),
          input.createdBy || null,
        ]
      );

      return this.getRewardTemplateById(id, envId);
    } catch (error) {
      logger.error('Failed to create reward template', { error, input });
      throw new GatrixError('Failed to create reward template', 500);
    }
  }

  /**
   * Update a reward template
   */
  static async updateRewardTemplate(id: string, input: UpdateRewardTemplateInput, environmentId?: string): Promise<RewardTemplate> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();
    try {
      // Check if template exists
      await this.getRewardTemplateById(id, envId);

      const updates: string[] = [];
      const params: any[] = [];

      if (input.name !== undefined) {
        updates.push('name = ?');
        params.push(input.name);
      }

      if (input.description !== undefined) {
        updates.push('description = ?');
        params.push(input.description);
      }

      if (input.rewardItems !== undefined) {
        updates.push('rewardItems = ?');
        params.push(JSON.stringify(input.rewardItems));
      }

      if (input.tags !== undefined) {
        updates.push('tags = ?');
        params.push(JSON.stringify(input.tags));
      }

      if (input.updatedBy !== undefined) {
        updates.push('updatedBy = ?');
        params.push(input.updatedBy);
      }

      updates.push('updatedAt = NOW()');

      params.push(id, envId);

      await pool.execute(
        `UPDATE g_reward_templates SET ${updates.join(', ')} WHERE id = ? AND environmentId = ?`,
        params
      );

      return this.getRewardTemplateById(id, envId);
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to update reward template', { error, id, input });
      throw new GatrixError('Failed to update reward template', 500);
    }
  }

  /**
   * Check if a reward template is referenced by surveys or coupons
   */
  static async checkReferences(templateId: string, environmentId?: string): Promise<{ surveys: any[], coupons: any[] }> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();
    try {
      // Check coupons that reference this template
      const [coupons] = await pool.execute<any[]>(
        `SELECT id, code, type, name, rewardTemplateId
         FROM g_coupon_settings
         WHERE rewardTemplateId = ? AND environmentId = ?`,
        [templateId, envId]
      );

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
  static async deleteRewardTemplate(id: string, environmentId?: string): Promise<void> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();
    try {
      // Check if template exists
      await this.getRewardTemplateById(id, envId);

      await pool.execute(
        'DELETE FROM g_reward_templates WHERE id = ? AND environmentId = ?',
        [id, envId]
      );
    } catch (error) {
      if (error instanceof GatrixError) throw error;
      logger.error('Failed to delete reward template', { error, id });
      throw new GatrixError('Failed to delete reward template', 500);
    }
  }
}

export default RewardTemplateService;

