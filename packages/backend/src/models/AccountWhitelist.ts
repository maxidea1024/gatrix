import db from '../config/knex';
import { CustomError } from '../middleware/errorHandler';
import TagAssignmentModel from './TagAssignment';

export interface Whitelist {
  id: number;
  accountId: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  purpose?: string;
  isEnabled: boolean;
  tags?: string[];
  createdBy: number;
  updatedBy?: number;
  createdAt: Date;
  updatedAt: Date;
  createdByName?: string;
  createdByEmail?: string;
  updatedByName?: string;
  updatedByEmail?: string;
}

export interface CreateWhitelistData {
  accountId: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  purpose?: string;
  isEnabled?: boolean;
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
  isEnabled?: boolean;
  updatedBy?: number;
}

export interface WhitelistFilters {
  accountId?: string;
  ipAddress?: string;
  createdBy?: number;
  search?: string;
  tags?: string[];
  isEnabled?: boolean;
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

      // Build base query
      let query = db('g_account_whitelist as w')
        .leftJoin('g_users as c', 'w.createdBy', 'c.id')
        .leftJoin('g_users as u', 'w.updatedBy', 'u.id')
        .select([
          'w.id',
          'w.accountId',
          'w.ipAddress',
          'w.startDate',
          'w.endDate',
          'w.purpose',
          'w.isEnabled',
          db.raw('CAST(w.tags AS CHAR) as tags'),
          'w.createdBy',
          'w.updatedBy',
          'w.createdAt',
          'w.updatedAt',
          'c.name as createdByName',
          'c.email as createdByEmail',
          'u.name as updatedByName',
          'u.email as updatedByEmail'
        ]);

      // Apply filters
      if (filters.accountId) {
        query = query.where('w.accountId', 'like', `%${filters.accountId}%`);
      }

      if (filters.ipAddress) {
        query = query.where('w.ipAddress', 'like', `%${filters.ipAddress}%`);
      }

      if (filters.createdBy) {
        query = query.where('w.createdBy', filters.createdBy);
      }

      if (filters.isEnabled !== undefined) {
        query = query.where('w.isEnabled', filters.isEnabled);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.where(function() {
          filters.tags!.forEach((tag, index) => {
            if (index === 0) {
              this.whereRaw('JSON_CONTAINS(w.tags, ?)', [JSON.stringify(tag)]);
            } else {
              this.orWhereRaw('JSON_CONTAINS(w.tags, ?)', [JSON.stringify(tag)]);
            }
          });
        });
      }

      if (filters.search) {
        query = query.where(function() {
          this.where('w.accountId', 'like', `%${filters.search}%`)
            .orWhere('w.ipAddress', 'like', `%${filters.search}%`)
            .orWhere('w.purpose', 'like', `%${filters.search}%`);
        });
      }

      // Get total count
      const countQuery = query.clone().clearSelect().count('* as total').first();
      const countResult = await countQuery;
      const total = Number(countResult?.total || 0);

      // Get paginated results
      const whitelists = await query
        .orderBy('w.createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      return {
        whitelists: whitelists.map(this.mapRowToWhitelist),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('AccountWhitelist.findAll error:', error);
      throw new CustomError('Failed to fetch whitelists', 500);
    }
  }

  static async findById(id: number): Promise<Whitelist | null> {
    try {
      const result = await db('g_account_whitelist as w')
        .leftJoin('g_users as c', 'w.createdBy', 'c.id')
        .leftJoin('g_users as u', 'w.updatedBy', 'u.id')
        .select([
          'w.id',
          'w.accountId',
          'w.ipAddress',
          'w.startDate',
          'w.endDate',
          'w.purpose',
          'w.isEnabled',
          db.raw('CAST(w.tags AS CHAR) as tags'),
          'w.createdBy',
          'w.updatedBy',
          'w.createdAt',
          'w.updatedAt',
          'c.name as createdByName',
          'c.email as createdByEmail',
          'u.name as updatedByName',
          'u.email as updatedByEmail'
        ])
        .where('w.id', id)
        .first();

      return result ? this.mapRowToWhitelist(result) : null;
    } catch (error) {
      throw new CustomError('Failed to fetch whitelist entry', 500);
    }
  }

  static async create(data: CreateWhitelistData): Promise<Whitelist> {
    try {
      const [insertId] = await db('g_account_whitelist').insert({
        accountId: data.accountId,
        ipAddress: data.ipAddress || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        purpose: data.purpose || null,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        createdBy: data.createdBy
      });

      const created = await this.findById(insertId);
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
      const updateData: any = {};

      if (data.accountId !== undefined) {
        updateData.accountId = data.accountId;
      }

      if (data.ipAddress !== undefined) {
        updateData.ipAddress = data.ipAddress || null;
      }

      if (data.isEnabled !== undefined) {
        updateData.isEnabled = data.isEnabled;
      }

      if (data.startDate !== undefined) {
        updateData.startDate = data.startDate || null;
      }

      if (data.endDate !== undefined) {
        updateData.endDate = data.endDate || null;
      }

      if (data.purpose !== undefined) {
        updateData.purpose = data.purpose || null;
      }

      if (data.tags !== undefined) {
        updateData.tags = data.tags ? JSON.stringify(data.tags) : null;
      }

      if (data.updatedBy !== undefined) {
        updateData.updatedBy = data.updatedBy;
      }

      if (Object.keys(updateData).length === 0) {
        throw new CustomError('No fields to update', 400);
      }

      updateData.updatedAt = db.fn.now();

      await db('g_account_whitelist')
        .where('id', id)
        .update(updateData);

      return await this.findById(id);
    } catch (error) {
      throw new CustomError('Failed to update whitelist entry', 500);
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const result = await db('g_account_whitelist')
        .where('id', id)
        .del();
      return result > 0;
    } catch (error) {
      throw new CustomError('Failed to delete whitelist entry', 500);
    }
  }

  static async bulkCreate(entries: CreateWhitelistData[]): Promise<number> {
    try {
      if (entries.length === 0) {
        return 0;
      }

      const insertData = entries.map(entry => ({
        accountId: entry.accountId,
        ipAddress: entry.ipAddress || null,
        startDate: entry.startDate || null,
        endDate: entry.endDate || null,
        purpose: entry.purpose || null,
        createdBy: entry.createdBy,
        isEnabled: entry.isEnabled !== undefined ? entry.isEnabled : true,
        tags: entry.tags ? JSON.stringify(entry.tags) : null
      }));

      const result = await db('g_account_whitelist').insert(insertData);
      return Array.isArray(result) ? result.length : 1;
    } catch (error) {
      throw new CustomError('Failed to bulk create whitelist entries', 500);
    }
  }

  private static mapRowToWhitelist(row: any): Whitelist {
    let tags: string[] | undefined = undefined;

    if (row.tags) {
      try {
        tags = JSON.parse(row.tags);
      } catch (error) {
        // JSON 파싱 실패 시 문자열을 배열로 변환
        console.warn(`Invalid JSON in tags for whitelist ${row.id}: ${row.tags}`);
        if (typeof row.tags === 'string') {
          // 쉼표로 구분된 문자열을 배열로 변환
          tags = row.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
        }
      }
    }

    return {
      id: row.id,
      accountId: row.accountId,
      ipAddress: row.ipAddress,
      startDate: row.startDate ? new Date(row.startDate) : undefined,
      endDate: row.endDate ? new Date(row.endDate) : undefined,
      purpose: row.purpose,
      isEnabled: Boolean(row.isEnabled),
      tags: tags,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      createdByName: row.createdByName,
      createdByEmail: row.createdByEmail,
      updatedByName: row.updatedByName,
      updatedByEmail: row.updatedByEmail,
    };
  }

  static async findByAccountId(accountId: string): Promise<Whitelist[]> {
    try {
      const rows = await db('g_account_whitelist as w')
        .leftJoin('g_users as c', 'w.createdBy', 'c.id')
        .leftJoin('g_users as u', 'w.updatedBy', 'u.id')
        .select([
          'w.*',
          'c.name as createdByName',
          'c.email as createdByEmail',
          'u.name as updatedByName',
          'u.email as updatedByEmail'
        ])
        .where('w.accountId', accountId)
        .orderBy('w.createdAt', 'desc');

      return rows.map(this.mapRowToWhitelist);
    } catch (error) {
      throw new CustomError('Failed to find whitelist entries by account ID', 500);
    }
  }

  // 태그 관련 메서드들
  static async setTags(whitelistId: number, tagIds: number[], createdBy?: number): Promise<void> {
    await TagAssignmentModel.setTagsForEntity('whitelist', whitelistId, tagIds, createdBy);
  }

  static async getTags(whitelistId: number): Promise<any[]> {
    return await TagAssignmentModel.listTagsForEntity('whitelist', whitelistId);
  }
}
