import db from '../config/knex';
import logger from '../config/logger';

export interface IpWhitelistFilters {
  ip?: string;
  description?: string;
  is_active?: boolean;
  isEnabled?: boolean;
  created_by?: number;
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
  id?: number;
  ip: string;
  description?: string;
  is_active: boolean;
  start_date?: Date;
  end_date?: Date;
  created_by?: number;
  updated_by?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateIpWhitelistData extends Omit<IpWhitelist, 'id' | 'created_at' | 'updated_at'> {
  ipAddress?: string;
  purpose?: string;
  isEnabled?: boolean;
  createdBy?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateIpWhitelistData extends Partial<CreateIpWhitelistData> {}

export class IpWhitelistModel {
  static async findAll(
    page: number = 1,
    limit: number = 10,
    filters: IpWhitelistFilters = {}
  ): Promise<IpWhitelistListResponse> {
    try {
      // 기본값 설정
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const offset = (pageNum - 1) * limitNum;

      // 기본 쿼리 빌더
      const baseQuery = () => db('g_ip_whitelist as iw')
        .leftJoin('g_users as creator', 'iw.created_by', 'creator.id')
        .leftJoin('g_users as updater', 'iw.updated_by', 'updater.id');

      // 필터 적용 함수
      const applyFilters = (query: any) => {
        // 기본 조건: 만료되지 않은 항목만
        query.where(function(this: any) {
          this.whereNull('iw.end_date')
              .orWhere('iw.end_date', '>', new Date());
        });

        if (filters.ip) {
          query.where('iw.ip', 'like', `%${filters.ip}%`);
        }

        if (filters.description) {
          query.where('iw.description', 'like', `%${filters.description}%`);
        }

        if (filters.is_active !== undefined) {
          query.where('iw.is_active', filters.is_active);
        }

        if (filters.created_by) {
          query.where('iw.created_by', filters.created_by);
        }

        return query;
      };

      // Count 쿼리
      const countQuery = applyFilters(baseQuery())
        .count('iw.id as total')
        .first();

      // Data 쿼리
      const dataQuery = applyFilters(baseQuery())
        .select([
          'iw.*',
          'creator.name as createdByName',
          'updater.name as updatedByName'
        ])
        .orderBy('iw.created_at', 'desc')
        .limit(limitNum)
        .offset(offset);

      // 병렬 실행
      const [countResult, dataResults] = await Promise.all([
        countQuery,
        dataQuery
      ]);

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
      logger.error('Error finding IP whitelists (Knex):', error);
      throw new Error('Failed to fetch IP whitelists');
    }
  }

  static async findById(id: number): Promise<any | null> {
    try {
      const ipWhitelist = await db('g_ip_whitelist as iw')
        .leftJoin('g_users as creator', 'iw.created_by', 'creator.id')
        .leftJoin('g_users as updater', 'iw.updated_by', 'updater.id')
        .select([
          'iw.*',
          'creator.name as createdByName',
          'updater.name as updatedByName'
        ])
        .where('iw.id', id)
        .first();

      return ipWhitelist ? this.mapRowToIpWhitelist(ipWhitelist) : null;
    } catch (error) {
      logger.error('Error finding IP whitelist by ID (Knex):', error);
      throw error;
    }
  }

  static async create(data: any): Promise<any> {
    try {
      const [insertId] = await db('g_ip_whitelist').insert({
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      });

      return await this.findById(insertId);
    } catch (error) {
      logger.error('Error creating IP whitelist (Knex):', error);
      throw error;
    }
  }

  static async update(id: number, data: any): Promise<any> {
    try {
      await db('g_ip_whitelist')
        .where('id', id)
        .update({
          ...data,
          updated_at: new Date()
        });

      return await this.findById(id);
    } catch (error) {
      logger.error('Error updating IP whitelist (Knex):', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<void> {
    try {
      await db('g_ip_whitelist').where('id', id).del();
    } catch (error) {
      logger.error('Error deleting IP whitelist (Knex):', error);
      throw error;
    }
  }

  // 행 매핑 함수
  private static mapRowToIpWhitelist(row: any): any {
    return {
      id: row.id,
      ip: row.ip,
      description: row.description,
      is_active: Boolean(row.is_active),
      start_date: row.start_date,
      end_date: row.end_date,
      created_by: row.created_by,
      updated_by: row.updated_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      createdByName: row.createdByName,
      updatedByName: row.updatedByName,
    };
  }

  // 추가 메서드들
  static async findByIpAddress(ip: string): Promise<any | null> {
    try {
      return await db('g_ip_whitelist')
        .where('ip', ip)
        .first();
    } catch (error) {
      logger.error('Error finding IP whitelist by IP address (Knex):', error);
      throw error;
    }
  }

  // 태그 관련 메서드들
  static async setTags(whitelistId: number, tagIds: number[]): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // 기존 태그 할당 삭제
        await trx('g_tag_assignments')
          .where('entity_type', 'whitelist')
          .where('entity_id', whitelistId)
          .del();

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map(tagId => ({
            entity_type: 'whitelist',
            entity_id: whitelistId,
            tag_id: tagId,
            created_at: new Date()
          }));
          await trx('g_tag_assignments').insert(assignments);
        }
      });
    } catch (error) {
      logger.error('Error setting IP whitelist tags (Knex):', error);
      throw error;
    }
  }

  static async getTags(whitelistId: number): Promise<any[]> {
    try {
      return await db('g_tag_assignments as ta')
        .join('g_tags as t', 'ta.tag_id', 't.id')
        .select(['t.id', 't.name', 't.color', 't.description'])
        .where('ta.entity_type', 'whitelist')
        .where('ta.entity_id', whitelistId)
        .orderBy('t.name');
    } catch (error) {
      logger.error('Error getting IP whitelist tags (Knex):', error);
      throw error;
    }
  }
}
