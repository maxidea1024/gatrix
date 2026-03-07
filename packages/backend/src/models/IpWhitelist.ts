import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';

const logger = createLogger('IpWhitelist');

export interface IpWhitelistFilters {
  environmentId: string;
  ipAddress?: string;
  purpose?: string;
  isEnabled?: boolean;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export interface IpWhitelistListResponse {
  ipWhitelists: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IpWhitelist {
  id?: string;
  environmentId: string;
  ipAddress: string;
  purpose?: string;
  isEnabled: boolean;
  startDate?: Date;
  endDate?: Date;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateIpWhitelistData extends Omit<IpWhitelist, 'id' | 'createdAt' | 'updatedAt'> {
  purpose?: string;
  createdBy?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateIpWhitelistData extends Partial<CreateIpWhitelistData> {}

export class IpWhitelistModel {
  static async findAll(
    page: number = 1,
    limit: number = 10,
    filters: IpWhitelistFilters = { environmentId: '' }
  ): Promise<IpWhitelistListResponse> {
    try {
      // Set default values
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const offset = (pageNum - 1) * limitNum;
      const environmentId = filters.environmentId;

      // 기본 Query 빌더 with environment filter
      const baseQuery = () =>
        db('g_ip_whitelist as iw')
          .leftJoin('g_users as creator', 'iw.createdBy', 'creator.id')
          .leftJoin('g_users as updater', 'iw.updatedBy', 'updater.id')
          .where('iw.environmentId', environmentId);

      // Filter 적용 함수
      const applyFilters = (query: any) => {
        // 기본 조건: Expired되지 않은 항목만
        query.where(function (this: any) {
          this.whereNull('iw.endDate').orWhere('iw.endDate', '>', new Date());
        });

        if (filters.ipAddress) {
          query.where('iw.ipAddress', 'like', `%${filters.ipAddress}%`);
        }

        if (filters.purpose) {
          query.where('iw.purpose', 'like', `%${filters.purpose}%`);
        }

        if (filters.isEnabled !== undefined) {
          // Convert boolean to the format expected by the database
          const enabledValue = filters.isEnabled ? 1 : 0;
          query.where('iw.isEnabled', enabledValue);
        }

        if (filters.createdBy) {
          query.where('iw.createdBy', filters.createdBy);
        }

        return query;
      };

      // Count Query
      const countQuery = applyFilters(baseQuery()).count('iw.id as total').first();

      // Data Query
      const dataQuery = applyFilters(baseQuery())
        .select(['iw.*', 'creator.name as createdByName', 'updater.name as updatedByName'])
        .orderBy('iw.createdAt', 'desc')
        .limit(limitNum)
        .offset(offset);

      // 병렬 실행
      const [countResult, dataResults] = await Promise.all([countQuery, dataQuery]);

      const total = countResult?.total || 0;
      const totalPages = Math.ceil(total / limitNum);

      return {
        ipWhitelists: dataResults.map(this.mapRowToIpWhitelist),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      };
    } catch (error) {
      logger.error('Error finding IP whitelists:', error);
      throw new Error('Failed to fetch IP whitelists');
    }
  }

  static async findById(id: string, environmentId: string): Promise<any | null> {
    try {
      const ipWhitelist = await db('g_ip_whitelist as iw')
        .leftJoin('g_users as creator', 'iw.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'iw.updatedBy', 'updater.id')
        .select(['iw.*', 'creator.name as createdByName', 'updater.name as updatedByName'])
        .where('iw.id', id)
        .where('iw.environmentId', environmentId)
        .first();

      return ipWhitelist ? this.mapRowToIpWhitelist(ipWhitelist) : null;
    } catch (error) {
      logger.error('Error finding IP whitelist by ID:', error);
      throw error;
    }
  }

  static async create(data: any, environmentId: string): Promise<any> {
    try {
      const id = generateULID();
      await db('g_ip_whitelist').insert({
        id,
        ...data,
        environmentId: environmentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return await this.findById(id, environmentId);
    } catch (error) {
      logger.error('Error creating IP whitelist:', error);
      throw error;
    }
  }

  static async update(id: string, data: any, environmentId: string): Promise<any> {
    try {
      await db('g_ip_whitelist')
        .where('id', id)
        .where('environmentId', environmentId)
        .update({
          ...data,
          updatedAt: new Date(),
        });

      return await this.findById(id, environmentId);
    } catch (error) {
      logger.error('Error updating IP whitelist:', error);
      throw error;
    }
  }

  static async delete(id: string, environmentId: string): Promise<void> {
    try {
      await db('g_ip_whitelist').where('id', id).where('environmentId', environmentId).del();
    } catch (error) {
      logger.error('Error deleting IP whitelist:', error);
      throw error;
    }
  }

  // 행 매핑 함수
  private static mapRowToIpWhitelist(row: any): any {
    return {
      id: row.id,
      ipAddress: row.ipAddress,
      purpose: row.purpose,
      isEnabled: Boolean(row.isEnabled),
      startDate: row.startDate,
      endDate: row.endDate,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByName: row.createdByName,
      updatedByName: row.updatedByName,
    };
  }

  // 추가 메서드들
  static async findByIpAddress(ip: string, environmentId: string): Promise<any | null> {
    try {
      return await db('g_ip_whitelist')
        .where('ipAddress', ip)
        .where('environmentId', environmentId)
        .first();
    } catch (error) {
      logger.error('Error finding IP whitelist by IP address:', error);
      throw error;
    }
  }

  // 태그 관련 메서드들
  static async setTags(whitelistId: string, tagIds: string[]): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // Existing 태그 할당 Delete
        await trx('g_tag_assignments')
          .where('entityType', 'whitelist')
          .where('entityId', whitelistId)
          .del();

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map((tagId) => ({
            entityType: 'whitelist',
            entityId: whitelistId,
            tagId: tagId,
            createdAt: new Date(),
          }));
          await trx('g_tag_assignments').insert(assignments);
        }
      });
    } catch (error) {
      logger.error('Error setting IP whitelist tags:', error);
      throw error;
    }
  }

  static async getTags(whitelistId: string): Promise<any[]> {
    try {
      return await db('g_tag_assignments as ta')
        .join('g_tags as t', 'ta.tagId', 't.id')
        .select(['t.id', 't.name', 't.color', 't.description'])
        .where('ta.entityType', 'whitelist')
        .where('ta.entityId', whitelistId)
        .orderBy('t.name');
    } catch (error) {
      logger.error('Error getting IP whitelist tags:', error);
      throw error;
    }
  }
}
