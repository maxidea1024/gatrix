import db from '../config/knex';
import logger from '../config/logger';

export interface ClientVersionFilters {
  version?: string;
  platform?: string;
  clientStatus?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ClientVersionListResult {
  clientVersions: any[];
  total: number;
}

export enum ClientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated'
}

export interface ClientVersionAttributes {
  id?: number;
  clientVersion: string;
  platform: string;
  clientStatus: ClientStatus;
  gameServerAddress?: string;
  patchAddress?: string;
  guestModeAllowed?: boolean;
  externalClickLink?: string;
  memo?: string;
  customPayload?: string;
  createdBy?: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClientVersionCreationAttributes extends Omit<ClientVersionAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface BulkCreateClientVersionRequest {
  clientVersions: ClientVersionCreationAttributes[];
}

export class ClientVersionModel {
  static async findAll(filters?: ClientVersionFilters): Promise<ClientVersionListResult> {
    try {
      console.log('🚀 ClientVersionKnexModel.findAll called with filters:', filters);

      // 기본값 설정
      const limit = filters?.limit ? parseInt(filters.limit.toString(), 10) : 10;
      const offset = filters?.offset ? parseInt(filters.offset.toString(), 10) : 0;
      const sortBy = filters?.sortBy || 'clientVersion';
      const sortOrder = filters?.sortOrder || 'DESC';

      // 기본 쿼리 빌더
      const baseQuery = () => db('g_client_versions as cv')
        .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'cv.updatedBy', 'updater.id');

      // 필터 적용 함수
      const applyFilters = (query: any) => {
        if (filters?.version) {
          query.where('cv.clientVersion', 'like', `%${filters.version}%`);
        }

        if (filters?.platform) {
          query.where('cv.platform', filters.platform);
        }

        if (filters?.clientStatus) {
          query.where('cv.clientStatus', filters.clientStatus);
        }

        return query;
      };

      // Count 쿼리
      const countQuery = applyFilters(baseQuery())
        .count('cv.id as total')
        .first();

      // Data 쿼리
      const dataQuery = applyFilters(baseQuery())
        .select([
          'cv.*',
          'creator.name as createdByName',
          'updater.name as updatedByName'
        ])
        .orderBy(`cv.${sortBy}`, sortOrder)
        .limit(limit)
        .offset(offset);

      console.log('🔍 Executing count and data queries...');

      // 병렬 실행
      const [countResult, dataResults] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      console.log('✅ Queries completed. Count:', countResult?.total, 'Data rows:', dataResults?.length);

      const total = countResult?.total || 0;

      console.log('🎯 Returning result: clientVersions count =', dataResults.length, 'total =', total);
      return { 
        clientVersions: dataResults,
        total 
      };
    } catch (error) {
      logger.error('Error finding client versions (Knex):', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<any | null> {
    try {
      const clientVersion = await db('g_client_versions as cv')
        .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'cv.updatedBy', 'updater.id')
        .select([
          'cv.*',
          'creator.name as createdByName',
          'updater.name as updatedByName'
        ])
        .where('cv.id', id)
        .first();

      return clientVersion || null;
    } catch (error) {
      logger.error('Error finding client version by ID (Knex):', error);
      throw error;
    }
  }

  static async create(data: any): Promise<any> {
    try {
      const [insertId] = await db('g_client_versions').insert({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return await this.findById(insertId);
    } catch (error) {
      logger.error('Error creating client version (Knex):', error);
      throw error;
    }
  }

  static async update(id: number, data: any): Promise<any> {
    try {
      await db('g_client_versions')
        .where('id', id)
        .update({
          ...data,
          updatedAt: new Date()
        });

      return await this.findById(id);
    } catch (error) {
      logger.error('Error updating client version (Knex):', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<void> {
    try {
      await db('g_client_versions').where('id', id).del();
    } catch (error) {
      logger.error('Error deleting client version (Knex):', error);
      throw error;
    }
  }

  // 추가 메서드들
  static async bulkCreate(data: ClientVersionCreationAttributes[]): Promise<any> {
    try {
      return await db.transaction(async (trx) => {
        const results = [];
        for (const item of data) {
          const [insertId] = await trx('g_client_versions').insert({
            ...item,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          results.push(await this.findById(insertId));
        }
        return results;
      });
    } catch (error) {
      logger.error('Error bulk creating client versions (Knex):', error);
      throw error;
    }
  }

  static async bulkUpdateStatus(ids: number[], clientStatus: ClientStatus, updatedBy: number): Promise<any> {
    try {
      await db('g_client_versions')
        .whereIn('id', ids)
        .update({
          clientStatus,
          updatedBy,
          updatedAt: new Date()
        });
      return { affectedRows: ids.length };
    } catch (error) {
      logger.error('Error bulk updating client version status (Knex):', error);
      throw error;
    }
  }

  static async getPlatforms(): Promise<string[]> {
    try {
      const result = await db('g_client_versions')
        .distinct('platform')
        .select('platform')
        .whereNotNull('platform')
        .orderBy('platform');
      return result.map(row => row.platform);
    } catch (error) {
      logger.error('Error getting platforms (Knex):', error);
      throw error;
    }
  }

  static async checkDuplicate(platform: string, clientVersion: string, excludeId?: number): Promise<boolean> {
    try {
      let query = db('g_client_versions')
        .where('platform', platform)
        .where('clientVersion', clientVersion);

      if (excludeId) {
        query = query.where('id', '!=', excludeId);
      }

      const result = await query.first();
      return !!result;
    } catch (error) {
      logger.error('Error checking duplicate (Knex):', error);
      throw error;
    }
  }

  // 태그 관련 메서드들
  static async setTags(clientVersionId: number, tagIds: number[]): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // 기존 태그 할당 삭제
        await trx('g_tag_assignments')
          .where('entity_type', 'client_version')
          .where('entity_id', clientVersionId)
          .del();

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map(tagId => ({
            entity_type: 'client_version',
            entity_id: clientVersionId,
            tag_id: tagId,
            created_at: new Date()
          }));
          await trx('g_tag_assignments').insert(assignments);
        }
      });
    } catch (error) {
      logger.error('Error setting client version tags (Knex):', error);
      throw error;
    }
  }

  static async getTags(clientVersionId: number): Promise<any[]> {
    try {
      return await db('g_tag_assignments as ta')
        .join('g_tags as t', 'ta.tag_id', 't.id')
        .select(['t.id', 't.name', 't.color', 't.description'])
        .where('ta.entity_type', 'client_version')
        .where('ta.entity_id', clientVersionId)
        .orderBy('t.name');
    } catch (error) {
      logger.error('Error getting client version tags (Knex):', error);
      throw error;
    }
  }
}
