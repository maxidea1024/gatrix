import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';

const logger = createLogger('QuickLinkModel');

const TABLE = 'g_user_quick_links';
const MAX_QUICK_LINKS_PER_USER = 20;

export interface QuickLink {
  id: string;
  userId: string;
  title: string;
  url: string;
  description?: string | null;
  iconName: string;
  color?: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateQuickLinkData {
  userId: string;
  title: string;
  url: string;
  description?: string;
  iconName?: string;
  color?: string;
}

export interface UpdateQuickLinkData {
  title?: string;
  url?: string;
  description?: string | null;
  iconName?: string;
  color?: string | null;
}

export class QuickLinkModel {
  /**
   * Get all quick links for a user, ordered by sortOrder
   */
  static async findByUserId(userId: string): Promise<QuickLink[]> {
    try {
      return await db(TABLE)
        .where('userId', userId)
        .orderBy('sortOrder', 'asc')
        .orderBy('createdAt', 'asc');
    } catch (error) {
      logger.error('Error finding quick links by userId:', error);
      throw error;
    }
  }

  /**
   * Find a single quick link by ID
   */
  static async findById(id: string): Promise<QuickLink | null> {
    try {
      const link = await db(TABLE).where('id', id).first();
      return link || null;
    } catch (error) {
      logger.error('Error finding quick link by ID:', error);
      throw error;
    }
  }

  /**
   * Count quick links for a user
   */
  static async countByUserId(userId: string): Promise<number> {
    try {
      const result = await db(TABLE)
        .where('userId', userId)
        .count('id as count')
        .first();
      return (result?.count as number) || 0;
    } catch (error) {
      logger.error('Error counting quick links:', error);
      throw error;
    }
  }

  /**
   * Create a new quick link
   */
  static async create(data: CreateQuickLinkData): Promise<QuickLink> {
    try {
      // Check max limit
      const count = await this.countByUserId(data.userId);
      if (count >= MAX_QUICK_LINKS_PER_USER) {
        throw new Error(
          `Maximum of ${MAX_QUICK_LINKS_PER_USER} quick links allowed per user`
        );
      }

      const id = generateULID();

      // Get next sortOrder
      const maxSort = await db(TABLE)
        .where('userId', data.userId)
        .max('sortOrder as maxSort')
        .first();
      const sortOrder = ((maxSort?.maxSort as number) || 0) + 1;

      await db(TABLE).insert({
        id,
        userId: data.userId,
        title: data.title,
        url: data.url,
        description: data.description || null,
        iconName: data.iconName || 'Link',
        color: data.color || null,
        sortOrder,
      });

      const link = await this.findById(id);
      if (!link) {
        throw new Error('Failed to create quick link');
      }
      return link;
    } catch (error) {
      logger.error('Error creating quick link:', error);
      throw error;
    }
  }

  /**
   * Update a quick link (only if owned by the user)
   */
  static async update(
    id: string,
    userId: string,
    data: UpdateQuickLinkData
  ): Promise<QuickLink | null> {
    try {
      const updateData: Record<string, any> = {};

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[key] = value;
        }
      });

      if (Object.keys(updateData).length === 0) {
        return this.findById(id);
      }

      updateData.updatedAt = db.fn.now();

      const updated = await db(TABLE)
        .where('id', id)
        .andWhere('userId', userId)
        .update(updateData);

      if (updated === 0) {
        return null;
      }

      return this.findById(id);
    } catch (error) {
      logger.error('Error updating quick link:', error);
      throw error;
    }
  }

  /**
   * Delete a quick link (only if owned by the user)
   */
  static async delete(id: string, userId: string): Promise<boolean> {
    try {
      const result = await db(TABLE)
        .where('id', id)
        .andWhere('userId', userId)
        .del();
      return result > 0;
    } catch (error) {
      logger.error('Error deleting quick link:', error);
      throw error;
    }
  }

  /**
   * Reorder quick links for a user.
   * Accepts an array of IDs in the desired order.
   */
  static async reorder(userId: string, orderedIds: string[]): Promise<void> {
    try {
      // Verify all IDs belong to this user
      const existing = await db(TABLE).where('userId', userId).select('id');
      const existingIds = new Set(existing.map((r: any) => r.id));

      for (const id of orderedIds) {
        if (!existingIds.has(id)) {
          throw new Error(`Quick link ${id} not found or not owned by user`);
        }
      }

      // Update sortOrder in a transaction
      await db.transaction(async (trx) => {
        for (let i = 0; i < orderedIds.length; i++) {
          await trx(TABLE)
            .where('id', orderedIds[i])
            .andWhere('userId', userId)
            .update({ sortOrder: i + 1, updatedAt: trx.fn.now() });
        }
      });
    } catch (error) {
      logger.error('Error reordering quick links:', error);
      throw error;
    }
  }
}
