import db from '../config/knex';
import { nanoid } from 'nanoid';
import { createLogger } from '../config/logger';

const logger = createLogger('SpreadsheetModel');
const TABLE = 'g_spreadsheets';

// ==================== Types ====================

export interface SpreadsheetAttributes {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  sheetData: string; // JSON string of Univer IWorkbookData
  thumbnail: string | null;
  isPinned: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  createdByName?: string | null;
  updatedByName?: string | null;
}

/** List item (without sheetData for performance) */
export type SpreadsheetListItem = Omit<SpreadsheetAttributes, 'sheetData'>;

export interface CreateSpreadsheetData {
  orgId: string;
  title?: string;
  description?: string | null;
  sheetData: string;
  createdBy: string;
}

export interface UpdateSpreadsheetData {
  title?: string;
  description?: string | null;
  sheetData?: string;
  thumbnail?: string | null;
  isPinned?: boolean;
  updatedBy: string;
}

export interface UpdateSpreadsheetMetaData {
  title?: string;
  description?: string | null;
  isPinned?: boolean;
  updatedBy: string;
}

// ==================== Model ====================

export default class SpreadsheetModel {
  /**
   * List spreadsheets for an org (without sheetData for performance)
   */
  static async findAllByOrg(params: {
    orgId: string;
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: 'updatedAt' | 'title' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: SpreadsheetListItem[]; total: number }> {
    const {
      orgId,
      limit = 20,
      offset = 0,
      search,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = params;

    try {
      let query = db(TABLE + ' as s')
        .leftJoin('g_users as c', 'c.id', 's.createdBy')
        .leftJoin('g_users as u', 'u.id', 's.updatedBy')
        .where('s.orgId', orgId);

      let countQuery = db(TABLE).where('orgId', orgId);

      if (search) {
        const term = `%${search}%`;
        const searchCond = function (this: any) {
          this.where('s.title', 'like', term).orWhere(
            's.description',
            'like',
            term
          );
        };
        query = query.where(searchCond);
        countQuery = countQuery.where(function (this: any) {
          this.where('title', 'like', term).orWhere('description', 'like', term);
        });
      }

      const [{ count }] = await countQuery.count('* as count');
      const total = Number(count);

      const allowedSort = ['updatedAt', 'title', 'createdAt'];
      const safeSortBy = allowedSort.includes(sortBy) ? sortBy : 'updatedAt';

      const items = await query
        .select([
          's.id',
          's.orgId',
          's.title',
          's.description',
          's.thumbnail',
          's.isPinned',
          's.createdBy',
          's.updatedBy',
          's.createdAt',
          's.updatedAt',
          'c.name as createdByName',
          'u.name as updatedByName',
        ])
        .orderBy('s.isPinned', 'desc')
        .orderBy(`s.${safeSortBy}`, sortOrder)
        .limit(limit)
        .offset(offset);

      return { items, total };
    } catch (error) {
      logger.error('Failed to list spreadsheets', { error, params });
      throw error;
    }
  }

  /**
   * Find by ID (includes sheetData)
   */
  static async findById(id: string): Promise<SpreadsheetAttributes | null> {
    try {
      const row = await db(TABLE + ' as s')
        .leftJoin('g_users as c', 'c.id', 's.createdBy')
        .leftJoin('g_users as u', 'u.id', 's.updatedBy')
        .where('s.id', id)
        .select([
          's.*',
          'c.name as createdByName',
          'u.name as updatedByName',
        ])
        .first();
      return row || null;
    } catch (error) {
      logger.error('Failed to find spreadsheet by id', { error, id });
      throw error;
    }
  }

  /**
   * Create a new spreadsheet
   */
  static async create(data: CreateSpreadsheetData): Promise<SpreadsheetAttributes> {
    const id = nanoid();
    try {
      await db(TABLE).insert({
        id,
        orgId: data.orgId,
        title: data.title || 'Untitled Spreadsheet',
        description: data.description || null,
        sheetData: data.sheetData,
        isPinned: false,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      });
      const created = await this.findById(id);
      if (!created) {
        throw new Error(`Spreadsheet not found after creation: ${id}`);
      }
      return created;
    } catch (error) {
      logger.error('Failed to create spreadsheet', { error });
      throw error;
    }
  }

  /**
   * Full update (auto-save from editor — includes sheetData)
   */
  static async update(
    id: string,
    data: UpdateSpreadsheetData
  ): Promise<SpreadsheetAttributes | null> {
    try {
      const updateFields: Record<string, any> = {
        updatedBy: data.updatedBy,
        updatedAt: db.fn.now(),
      };
      if (data.title !== undefined) updateFields.title = data.title;
      if (data.description !== undefined) updateFields.description = data.description;
      if (data.sheetData !== undefined) updateFields.sheetData = data.sheetData;
      if (data.thumbnail !== undefined) updateFields.thumbnail = data.thumbnail;
      if (data.isPinned !== undefined) updateFields.isPinned = data.isPinned ? 1 : 0;

      await db(TABLE).where({ id }).update(updateFields);
      return this.findById(id);
    } catch (error) {
      logger.error('Failed to update spreadsheet', { error, id });
      throw error;
    }
  }

  /**
   * Update metadata only (title, description, isPinned)
   */
  static async updateMeta(
    id: string,
    data: UpdateSpreadsheetMetaData
  ): Promise<SpreadsheetAttributes | null> {
    try {
      const updateFields: Record<string, any> = {
        updatedBy: data.updatedBy,
        updatedAt: db.fn.now(),
      };
      if (data.title !== undefined) updateFields.title = data.title;
      if (data.description !== undefined) updateFields.description = data.description;
      if (data.isPinned !== undefined) updateFields.isPinned = data.isPinned ? 1 : 0;

      await db(TABLE).where({ id }).update(updateFields);
      return this.findById(id);
    } catch (error) {
      logger.error('Failed to update spreadsheet meta', { error, id });
      throw error;
    }
  }

  /**
   * Delete a spreadsheet
   */
  static async delete(id: string): Promise<void> {
    try {
      await db(TABLE).where({ id }).del();
    } catch (error) {
      logger.error('Failed to delete spreadsheet', { error, id });
      throw error;
    }
  }

  /**
   * Duplicate a spreadsheet
   */
  static async duplicate(
    id: string,
    userId: string
  ): Promise<SpreadsheetAttributes> {
    try {
      const original = await this.findById(id);
      if (!original) {
        throw new Error(`Spreadsheet not found: ${id}`);
      }
      return this.create({
        orgId: original.orgId,
        title: `${original.title} (Copy)`,
        description: original.description,
        sheetData: original.sheetData,
        createdBy: userId,
      });
    } catch (error) {
      logger.error('Failed to duplicate spreadsheet', { error, id });
      throw error;
    }
  }
}
