import db from '../config/knex';
import logger from '../config/logger';

export interface ClientVersionFilters {
  clientVersion?: string;
  platform?: string;
  clientStatus?: string;
  guestModeAllowed?: boolean;
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
  ONLINE = 'online',
  OFFLINE = 'offline',
  RECOMMENDED_UPDATE = 'recommended_update',
  FORCED_UPDATE = 'forced_update',
  UNDER_REVIEW = 'under_review',
  BLOCKED_PATCH_ALLOWED = 'blocked_patch_allowed'
}

export interface ClientVersionAttributes {
  id?: number;
  clientVersion: string;
  platform: string;
  clientStatus: ClientStatus;
  gameServerAddress?: string;
  gameServerAddressForWhiteList?: string;
  patchAddress?: string;
  patchAddressForWhiteList?: string;
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
  // 사용 가능한 버전 목록 조회 (distinct)
  static async getDistinctVersions(): Promise<string[]> {
    try {
      const result = await db('g_client_versions')
        .distinct('clientVersion')
        .orderBy('clientVersion', 'desc');

      return result.map(row => row.clientVersion);
    } catch (error) {
      logger.error('Error getting distinct versions:', error);
      throw error;
    }
  }

  static async findAll(filters?: ClientVersionFilters): Promise<ClientVersionListResult> {
    try {
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
        if (filters?.clientVersion) {
          query.where('cv.clientVersion', filters.clientVersion);
        }

        if (filters?.platform) {
          query.where('cv.platform', filters.platform);
        }

        if (filters?.clientStatus) {
          query.where('cv.clientStatus', filters.clientStatus);
        }

        if (filters?.guestModeAllowed !== undefined) {
          // TINYINT 타입이므로 boolean을 숫자로 변환 (true -> 1, false -> 0)
          const guestModeValue = filters.guestModeAllowed ? 1 : 0;
          logger.info('Applying guestModeAllowed filter:', filters.guestModeAllowed, '-> DB value:', guestModeValue);
          query.where('cv.guestModeAllowed', guestModeValue);

          // 디버깅: 쿼리 로그
          logger.info('Query with guestModeAllowed filter:', query.toSQL());
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

      // 병렬 실행
      const [countResult, dataResults] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      const total = countResult?.total || 0;

      // 디버깅: 조회된 데이터의 guestModeAllowed 값들 확인
      logger.info('Retrieved client versions guestModeAllowed values:',
        dataResults.map((cv: any) => ({ id: cv.id, guestModeAllowed: cv.guestModeAllowed, type: typeof cv.guestModeAllowed }))
      );

      // 각 클라이언트 버전에 대해 태그 정보 로드
      const clientVersionsWithTags = await Promise.all(
        dataResults.map(async (cv: any) => {
          const tags = await this.getTags(cv.id);
          return {
            ...cv,
            tags
          };
        })
      );

      return {
        clientVersions: clientVersionsWithTags,
        total
      };
    } catch (error) {
      logger.error('Error finding client versions:', error);
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

      if (!clientVersion) {
        return null;
      }

      // 태그 정보 로드
      const tags = await this.getTags(id);

      return {
        ...clientVersion,
        tags
      };
    } catch (error) {
      logger.error('Error finding client version by ID:', error);
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
      logger.error('Error creating client version:', error);
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
      logger.error('Error updating client version:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<void> {
    try {
      await db('g_client_versions').where('id', id).del();
    } catch (error) {
      logger.error('Error deleting client version:', error);
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
      logger.error('Error bulk creating client versions:', error);
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
      logger.error('Error bulk updating client version status:', error);
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
      logger.error('Error getting platforms:', error);
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
      logger.error('Error checking duplicate:', error);
      throw error;
    }
  }

  // 태그 관련 메서드들
  static async setTags(clientVersionId: number, tagIds: number[]): Promise<void> {
    try {
      logger.info(`Setting tags for client version ${clientVersionId}:`, tagIds);

      await db.transaction(async (trx) => {
        // 기존 태그 할당 삭제
        const deletedCount = await trx('g_tag_assignments')
          .where('entityType', 'client_version')
          .where('entityId', clientVersionId)
          .del();

        logger.info(`Deleted ${deletedCount} existing tag assignments for client version ${clientVersionId}`);

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map(tagId => ({
            entityType: 'client_version',
            entityId: clientVersionId,
            tagId: tagId,
            createdAt: new Date()
          }));

          logger.info(`Inserting ${assignments.length} new tag assignments:`, assignments);
          await trx('g_tag_assignments').insert(assignments);
          logger.info(`Successfully inserted tag assignments for client version ${clientVersionId}`);
        }
      });
    } catch (error) {
      logger.error('Error setting client version tags:', error);
      throw error;
    }
  }

  static async getTags(clientVersionId: number): Promise<any[]> {
    try {
      const tags = await db('g_tag_assignments as ta')
        .join('g_tags as t', 'ta.tagId', 't.id')
        .select(['t.id', 't.name', 't.color', 't.description'])
        .where('ta.entityType', 'client_version')
        .where('ta.entityId', clientVersionId)
        .orderBy('t.name');

      logger.info(`Client version ${clientVersionId} has ${tags.length} tags:`, tags);
      return tags;
    } catch (error) {
      logger.error('Error getting client version tags:', error);
      throw error;
    }
  }
}
