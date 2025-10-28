import { ulid } from 'ulid';
import database from '../config/database';
import { CustomError } from '../middleware/errorHandler';
import logger from '../config/logger';

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
  page?: number;
  limit?: number;
  search?: string;
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

    const offset = (page - 1) * limit;

    try {
      const whereConditions: string[] = [];
      const queryParams: any[] = [];

      if (search) {
        whereConditions.push('(name LIKE ? OR description LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const [countRows] = await pool.execute<any[]>(
        `SELECT COUNT(*) as count FROM g_reward_item_templates ${whereClause}`,
        queryParams
      );
      const total = countRows[0]?.count || 0;

      // Get templates
      const [templates] = await pool.execute<any[]>(
        `SELECT * FROM g_reward_item_templates ${whereClause} ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}`,
        queryParams
      );

      // Parse JSON fields
      const parsedTemplates = (templates as any[]).map(t => ({
        ...t,
        rewardItems: typeof t.rewardItems === 'string' ? JSON.parse(t.rewardItems) : t.rewardItems,
        tags: typeof t.tags === 'string' ? JSON.parse(t.tags) : (t.tags || []),
      }));

      return {
        templates: parsedTemplates,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('Failed to get reward templates', { error });
      throw new CustomError('Failed to get reward templates', 500);
    }
  }

  /**
   * Get reward template by ID
   */
  static async getRewardTemplateById(id: string): Promise<RewardTemplate> {
    const pool = database.getPool();
    try {
      const [templates] = await pool.execute<any[]>(
        'SELECT * FROM g_reward_item_templates WHERE id = ?',
        [id]
      );

      if (templates.length === 0) {
        throw new CustomError('Reward template not found', 404);
      }

      const template = templates[0];
      return {
        ...template,
        rewardItems: typeof template.rewardItems === 'string' ? JSON.parse(template.rewardItems) : template.rewardItems,
        tags: typeof template.tags === 'string' ? JSON.parse(template.tags) : (template.tags || []),
      };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to get reward template', { error, id });
      throw new CustomError('Failed to get reward template', 500);
    }
  }

  /**
   * Create a new reward template
   */
  static async createRewardTemplate(input: CreateRewardTemplateInput): Promise<RewardTemplate> {
    const pool = database.getPool();
    const id = ulid();

    try {
      await pool.execute(
        `INSERT INTO g_reward_item_templates
         (id, name, description, rewardItems, tags, createdBy, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id,
          input.name,
          input.description || null,
          JSON.stringify(input.rewardItems),
          JSON.stringify(input.tags || []),
          input.createdBy || null,
        ]
      );

      return this.getRewardTemplateById(id);
    } catch (error) {
      logger.error('Failed to create reward template', { error, input });
      throw new CustomError('Failed to create reward template', 500);
    }
  }

  /**
   * Update a reward template
   */
  static async updateRewardTemplate(id: string, input: UpdateRewardTemplateInput): Promise<RewardTemplate> {
    const pool = database.getPool();
    try {
      // Check if template exists
      await this.getRewardTemplateById(id);

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

      params.push(id);

      await pool.execute(
        `UPDATE g_reward_item_templates SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      return this.getRewardTemplateById(id);
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to update reward template', { error, id, input });
      throw new CustomError('Failed to update reward template', 500);
    }
  }

  /**
   * Check if a reward template is referenced by surveys or coupons
   */
  static async checkReferences(templateId: string): Promise<{ surveys: any[], coupons: any[] }> {
    const pool = database.getPool();
    try {
      // Check coupons that reference this template
      const [coupons] = await pool.execute<any[]>(
        `SELECT id, code, type, name, rewardTemplateId
         FROM g_coupon_settings
         WHERE rewardTemplateId = ?`,
        [templateId]
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
      throw new CustomError('Failed to check references', 500);
    }
  }

  /**
   * Delete a reward template
   */
  static async deleteRewardTemplate(id: string): Promise<void> {
    const pool = database.getPool();
    try {
      // Check if template exists
      await this.getRewardTemplateById(id);

      await pool.execute(
        'DELETE FROM g_reward_item_templates WHERE id = ?',
        [id]
      );
    } catch (error) {
      if (error instanceof CustomError) throw error;
      logger.error('Failed to delete reward template', { error, id });
      throw new CustomError('Failed to delete reward template', 500);
    }
  }
}

export default RewardTemplateService;

