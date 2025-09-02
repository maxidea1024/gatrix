import database from '../config/database';
import { CustomError } from '../middleware/errorHandler';
import TagAssignmentModel from './TagAssignment';

export interface Whitelist {
  id: number;
  accountId: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  purpose?: string;
  tags?: string[];
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  createdByName?: string;
  createdByEmail?: string;
  isActive: boolean;
}

export interface CreateWhitelistData {
  accountId: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  purpose?: string;
  tags?: string[];
  createdBy: number;
}

export interface UpdateWhitelistData {
  accountId?: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  purpose?: string;
  tags?: string[];
}

export interface WhitelistFilters {
  accountId?: string;
  ipAddress?: string;
  createdBy?: number;
  search?: string;
  tags?: string[];
}

export interface WhitelistListResponse {
  whitelists: Whitelist[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class WhitelistModel {
  static async findAll(
    page: number = 1,
    limit: number = 10,
    filters: WhitelistFilters = {}
  ): Promise<WhitelistListResponse> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const filterParams: any[] = [];

      // Apply filters
      if (filters.accountId) {
        whereClause += ' AND w.accountId LIKE ?';
        filterParams.push(`%${filters.accountId}%`);
      }

      if (filters.ipAddress) {
        whereClause += ' AND w.ipAddress LIKE ?';
        filterParams.push(`%${filters.ipAddress}%`);
      }

      if (filters.createdBy) {
        whereClause += ' AND w.createdBy = ?';
        filterParams.push(filters.createdBy);
      }

      if (filters.tags && filters.tags.length > 0) {
        const tagConditions = filters.tags.map(() => 'JSON_CONTAINS(w.tags, ?)').join(' OR ');
        whereClause += ` AND (${tagConditions})`;
        filters.tags.forEach(tag => {
          filterParams.push(JSON.stringify(tag));
        });
      }

      if (filters.search) {
        whereClause += ' AND (w.accountId LIKE ? OR w.ipAddress LIKE ? OR w.purpose LIKE ?)';
        filterParams.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM g_account_whitelist w
        LEFT JOIN g_users u ON w.createdBy = u.id
        ${whereClause}
      `;
      const countResult = await database.query(countQuery, filterParams);
      const total = countResult[0].total;

      // Get paginated results
      const query = `
        SELECT
          w.id,
          w.accountId,
          w.ipAddress,
          w.startDate,
          w.endDate,
          w.purpose,
          w.tags,
          w.createdBy,
          w.createdAt,
          w.updatedAt,
          u.name as createdByName,
          u.email as createdByEmail,
          1 as isActive
        FROM g_account_whitelist w
        LEFT JOIN g_users u ON w.createdBy = u.id
        ${whereClause}
        ORDER BY w.createdAt DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const whitelists = await database.query(query, filterParams);

      return {
        whitelists: whitelists.map(this.mapRowToWhitelist),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new CustomError('Failed to fetch whitelists', 500);
    }
  }

  static async findById(id: number): Promise<Whitelist | null> {
    try {
      const query = `
        SELECT
          w.id,
          w.accountId,
          w.ipAddress,
          w.startDate,
          w.endDate,
          w.purpose,
          w.tags,
          w.createdBy,
          w.createdAt,
          w.updatedAt,
          u.name as createdByName,
          u.email as createdByEmail,
          1 as isActive
        FROM g_account_whitelist w
        LEFT JOIN g_users u ON w.createdBy = u.id
        WHERE w.id = ?
      `;

      const result = await database.query(query, [id]);
      return result.length > 0 ? this.mapRowToWhitelist(result[0]) : null;
    } catch (error) {
      throw new CustomError('Failed to fetch whitelist entry', 500);
    }
  }

  static async create(data: CreateWhitelistData): Promise<Whitelist> {
    try {
      const query = `
        INSERT INTO g_account_whitelist (accountId, ipAddress, startDate, endDate, purpose, tags, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await database.query(query, [
        data.accountId,
        data.ipAddress || null,
        data.startDate || null,
        data.endDate || null,
        data.purpose || null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.createdBy,
      ]);

      const created = await this.findById(result.insertId);
      if (!created) {
        throw new CustomError('Failed to create whitelist entry', 500);
      }

      return created;
    } catch (error) {
      throw new CustomError('Failed to create whitelist entry', 500);
    }
  }

  static async update(id: number, data: UpdateWhitelistData): Promise<Whitelist | null> {
    try {
      const fields: string[] = [];
      const params: any[] = [];

      if (data.accountId !== undefined) {
        fields.push('accountId = ?');
        params.push(data.accountId);
      }

      if (data.ipAddress !== undefined) {
        fields.push('ipAddress = ?');
        params.push(data.ipAddress || null);
      }

      if (data.startDate !== undefined) {
        fields.push('startDate = ?');
        params.push(data.startDate || null);
      }

      if (data.endDate !== undefined) {
        fields.push('endDate = ?');
        params.push(data.endDate || null);
      }

      if (data.purpose !== undefined) {
        fields.push('purpose = ?');
        params.push(data.purpose || null);
      }

      if (data.tags !== undefined) {
        fields.push('tags = ?');
        params.push(data.tags ? JSON.stringify(data.tags) : null);
      }

      if (fields.length === 0) {
        throw new CustomError('No fields to update', 400);
      }

      fields.push('updatedAt = CURRENT_TIMESTAMP');
      params.push(id);

      const query = `UPDATE g_account_whitelist SET ${fields.join(', ')} WHERE id = ?`;
      await database.query(query, params);

      return await this.findById(id);
    } catch (error) {
      throw new CustomError('Failed to update whitelist entry', 500);
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const result = await database.query('DELETE FROM g_account_whitelist WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new CustomError('Failed to delete whitelist entry', 500);
    }
  }

  static async bulkCreate(entries: CreateWhitelistData[]): Promise<number> {
    try {
      if (entries.length === 0) {
        return 0;
      }

      const values = entries.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const query = `
        INSERT INTO g_account_whitelist (accountId, ipAddress, startDate, endDate, purpose, createdBy)
        VALUES ${values}
      `;

      const params: any[] = [];
      entries.forEach(entry => {
        params.push(
          entry.accountId,
          entry.ipAddress || null,
          entry.startDate || null,
          entry.endDate || null,
          entry.purpose || null,
          entry.createdBy
        );
      });

      const result = await database.query(query, params);
      return result.affectedRows;
    } catch (error) {
      throw new CustomError('Failed to bulk create whitelist entries', 500);
    }
  }

  private static mapRowToWhitelist(row: any): Whitelist {
    return {
      id: row.id,
      accountId: row.accountId,
      ipAddress: row.ipAddress,
      startDate: row.startDate ? new Date(row.startDate) : undefined,
      endDate: row.endDate ? new Date(row.endDate) : undefined,
      purpose: row.purpose,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      createdBy: row.createdBy,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      createdByName: row.createdByName,
      createdByEmail: row.createdByEmail,
      isActive: Boolean(row.isActive),
    };
  }

  static async findByAccountId(accountId: string): Promise<Whitelist[]> {
    try {
      const query = `
        SELECT w.*, u.name as createdByName, u.email as createdByEmail
        FROM g_account_whitelist w
        LEFT JOIN g_users u ON w.createdBy = u.id
        WHERE w.accountId = ?
        ORDER BY w.createdAt DESC
      `;

      const rows = await database.query(query, [accountId]);
      return rows.map(this.mapRowToWhitelist);
    } catch (error) {
      throw new CustomError('Failed to find whitelist entries by account ID', 500);
    }
  }

  // 태그 관련 메서드들
  static async setTags(whitelistId: number, tagIds: number[]): Promise<void> {
    await TagAssignmentModel.setTagsForEntity('whitelist', whitelistId, tagIds);
  }

  static async getTags(whitelistId: number): Promise<any[]> {
    return await TagAssignmentModel.listTagsForEntity('whitelist', whitelistId);
  }
}
