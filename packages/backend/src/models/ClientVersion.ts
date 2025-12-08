import db from '../config/knex';
import logger from '../config/logger';
import { getCurrentEnvironmentId } from '../utils/environmentContext';

export interface ClientVersionFilters {
  environmentId?: string; // ULID
  clientVersion?: string | string[];
  platform?: string | string[];
  clientStatus?: string | string[];
  guestModeAllowed?: boolean | boolean[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  tags?: string[];
  tagsOperator?: 'any_of' | 'include_all'; // For tags filtering logic
}

export interface ClientVersionListResult {
  clientVersions: any[];
  total: number;
}

export enum ClientStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  RECOMMENDED_UPDATE = 'RECOMMENDED_UPDATE',
  FORCED_UPDATE = 'FORCED_UPDATE',
  UNDER_REVIEW = 'UNDER_REVIEW',
  BLOCKED_PATCH_ALLOWED = 'BLOCKED_PATCH_ALLOWED',
  MAINTENANCE = 'MAINTENANCE'
}

export interface ClientVersionAttributes {
  id?: number;
  environmentId?: string; // ULID
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
  maintenanceStartDate?: Date;
  maintenanceEndDate?: Date;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  createdBy?: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClientVersionMaintenanceLocale {
  id?: number;
  clientVersionId: number;
  lang: 'ko' | 'en' | 'zh';
  message: string;
  createdBy?: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClientVersionCreationAttributes extends Omit<ClientVersionAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  maintenanceLocales?: Omit<ClientVersionMaintenanceLocale, 'id' | 'clientVersionId' | 'createdAt' | 'updatedAt'>[];
}

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
      const envId = filters?.environmentId ?? getCurrentEnvironmentId();

      // 기본 쿼리 빌더 with environment filter
      const baseQuery = () => db('g_client_versions as cv')
        .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'cv.updatedBy', 'updater.id')
        .where('cv.environmentId', envId);

      // 필터 적용 함수
      const applyFilters = (query: any) => {
        // clientVersion filter - support both single value and array (any_of)
        if (filters?.clientVersion) {
          if (Array.isArray(filters.clientVersion)) {
            query.whereIn('cv.clientVersion', filters.clientVersion);
          } else {
            query.where('cv.clientVersion', filters.clientVersion);
          }
        }

        // platform filter - support both single value and array (any_of)
        if (filters?.platform) {
          if (Array.isArray(filters.platform)) {
            query.whereIn('cv.platform', filters.platform);
          } else {
            query.where('cv.platform', filters.platform);
          }
        }

        // clientStatus filter - support both single value and array (any_of)
        if (filters?.clientStatus) {
          if (Array.isArray(filters.clientStatus)) {
            query.whereIn('cv.clientStatus', filters.clientStatus);
          } else {
            query.where('cv.clientStatus', filters.clientStatus);
          }
        }

        // guestModeAllowed filter - support both single value and array (any_of)
        if (filters?.guestModeAllowed !== undefined) {
          if (Array.isArray(filters.guestModeAllowed)) {
            // Convert boolean array to number array (true -> 1, false -> 0)
            const guestModeValues = filters.guestModeAllowed.map(val => val ? 1 : 0);
            query.whereIn('cv.guestModeAllowed', guestModeValues);
          } else {
            // TINYINT 타입이므로 boolean을 숫자로 변환 (true -> 1, false -> 0)
            const guestModeValue = filters.guestModeAllowed ? 1 : 0;
            query.where('cv.guestModeAllowed', guestModeValue);
          }
        }

        // 태그 필터링 - support both any_of and include_all
        if (filters?.tags && filters.tags.length > 0) {
          const tagsOperator = filters.tagsOperator || 'any_of';

          if (tagsOperator === 'include_all') {
            // AND 조건: 모든 태그를 포함해야 함
            filters.tags.forEach(tagId => {
              query.whereExists((subquery: any) => {
                subquery.select('*')
                  .from('g_tag_assignments as ta')
                  .whereRaw('ta.entityId = cv.id')
                  .where('ta.entityType', 'client_version')
                  .where('ta.tagId', tagId);
              });
            });
          } else {
            // OR 조건: 태그 중 하나라도 포함하면 됨
            query.whereExists((subquery: any) => {
              subquery.select('*')
                .from('g_tag_assignments as ta')
                .whereRaw('ta.entityId = cv.id')
                .where('ta.entityType', 'client_version')
                .whereIn('ta.tagId', filters.tags);
            });
          }
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
          'creator.email as createdByEmail',
          'updater.name as updatedByName',
          'updater.email as updatedByEmail'
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
          'creator.email as createdByEmail',
          'updater.name as updatedByName',
          'updater.email as updatedByEmail'
        ])
        .where('cv.id', id)
        .first();

      if (!clientVersion) {
        return null;
      }

      // 태그 정보 로드
      const tags = await this.getTags(id);

      // 점검 메시지 로케일 정보 로드
      const maintenanceLocales = await db('g_client_version_maintenance_locales')
        .where('clientVersionId', id)
        .select('lang', 'message');

      return {
        ...clientVersion,
        tags,
        maintenanceLocales: maintenanceLocales || []
      };
    } catch (error) {
      logger.error('Error finding client version by ID:', error);
      throw error;
    }
  }

  static async create(data: any): Promise<any> {
    try {
      const envId = data.environmentId ?? getCurrentEnvironmentId();

      return await db.transaction(async (trx) => {
        // tags와 maintenanceLocales 필드는 별도 테이블에서 관리하므로 제거
        const { tags, maintenanceLocales, environmentId: _envId, ...clientVersionData } = data;

        const [insertId] = await trx('g_client_versions').insert({
          ...clientVersionData,
          environmentId: envId,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // 점검 메시지 로케일 처리
        if (maintenanceLocales && maintenanceLocales.length > 0) {
          const localeInserts = maintenanceLocales.map((locale: any) => ({
            clientVersionId: insertId,
            lang: locale.lang,
            message: locale.message,
            createdBy: data.createdBy,
            updatedBy: data.updatedBy,
            createdAt: new Date(),
            updatedAt: new Date()
          }));

          await trx('g_client_version_maintenance_locales').insert(localeInserts);
        }

        return await this.findById(insertId);
      });
    } catch (error) {
      logger.error('Error creating client version:', error);
      throw error;
    }
  }

  static async update(id: number, data: any): Promise<any> {
    try {
      return await db.transaction(async (trx) => {
        // tags와 maintenanceLocales 필드는 별도 테이블에서 관리하므로 제거
        const { tags, maintenanceLocales, ...clientVersionData } = data;

        await trx('g_client_versions')
          .where('id', id)
          .update({
            ...clientVersionData,
            updatedAt: new Date()
          });

        // 점검 메시지 로케일 처리
        if (maintenanceLocales !== undefined) {
          // 기존 로케일 삭제
          await trx('g_client_version_maintenance_locales')
            .where('clientVersionId', id)
            .del();

          // 새 로케일 추가
          if (maintenanceLocales.length > 0) {
            const localeInserts = maintenanceLocales.map((locale: any) => ({
              clientVersionId: id,
              lang: locale.lang,
              message: locale.message,
              createdBy: data.createdBy,
              updatedBy: data.updatedBy,
              createdAt: new Date(),
              updatedAt: new Date()
            }));

            await trx('g_client_version_maintenance_locales').insert(localeInserts);
          }
        }

        return await this.findById(id);
      });
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
      const insertedIds: number[] = [];

      // Get environment ID from context
      const envId = getCurrentEnvironmentId();
      if (!envId) {
        throw new Error('Environment ID is required for bulk creating client versions');
      }

      // 먼저 모든 데이터를 삽입
      await db.transaction(async (trx) => {
        for (const item of data) {
          // tags 필드는 별도 테이블에서 관리하므로 제거
          const { tags, environmentId: _envId, ...clientVersionData } = item as any;

          const [insertId] = await trx('g_client_versions').insert({
            ...clientVersionData,
            environmentId: envId,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          insertedIds.push(insertId);
        }
      });

      // 트랜잭션 완료 후 생성된 데이터 조회
      const results = [];
      for (const id of insertedIds) {
        const clientVersion = await this.findById(id);
        if (clientVersion) {
          results.push(clientVersion);
        } else {
          logger.warn(`Failed to find created client version with id: ${id}`);
          // 기본 객체라도 반환하여 null 방지
          results.push({ id, platform: 'unknown', clientVersion: 'unknown' });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error bulk creating client versions:', error);
      throw error;
    }
  }

  static async bulkUpdateStatus(data: any): Promise<any> {
    try {
      const updateData: any = {
        clientStatus: data.clientStatus,
        updatedBy: data.updatedBy,
        updatedAt: new Date()
      };

      // 점검 관련 필드들 추가
      if (data.maintenanceStartDate) {
        updateData.maintenanceStartDate = data.maintenanceStartDate;
      }
      if (data.maintenanceEndDate) {
        updateData.maintenanceEndDate = data.maintenanceEndDate;
      }
      if (data.maintenanceMessage) {
        updateData.maintenanceMessage = data.maintenanceMessage;
      }
      if (data.supportsMultiLanguage !== undefined) {
        updateData.supportsMultiLanguage = data.supportsMultiLanguage;
      }
      if (data.messageTemplateId) {
        updateData.messageTemplateId = data.messageTemplateId;
      }

      await db('g_client_versions')
        .whereIn('id', data.ids)
        .update(updateData);

      // 언어별 메시지 처리
      if (data.maintenanceLocales && Array.isArray(data.maintenanceLocales)) {
        // 기존 언어별 메시지 삭제
        await db('g_client_version_maintenance_locales')
          .whereIn('clientVersionId', data.ids)
          .del();

        // 새로운 언어별 메시지 추가
        if (data.maintenanceLocales.length > 0) {
          const localeInserts = [];
          for (const id of data.ids) {
            for (const locale of data.maintenanceLocales) {
              localeInserts.push({
                clientVersionId: id,
                lang: locale.lang,
                message: locale.message,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          }
          if (localeInserts.length > 0) {
            await db('g_client_version_maintenance_locales').insert(localeInserts);
          }
        }
      }

      return data.ids.length;
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
  static async setTags(clientVersionId: number, tagIds: number[], createdBy?: number): Promise<void> {
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
            createdBy: createdBy || 1,
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


      return tags;
    } catch (error) {
      logger.error('Error getting client version tags:', error);
      throw error;
    }
  }

  static async getMaintenanceLocales(clientVersionId: number): Promise<ClientVersionMaintenanceLocale[]> {
    try {
      const locales = await db('g_client_version_maintenance_locales')
        .select(['lang', 'message'])
        .where('clientVersionId', clientVersionId)
        .orderBy('lang');

      return locales;
    } catch (error) {
      logger.error('Error getting maintenance locales:', error);
      throw error;
    }
  }

  /**
   * Delete all client versions (for testing/reset)
   */
  static async deleteAll(): Promise<number> {
    try {
      // First delete all maintenance locales
      await db('g_client_version_maintenance_locales').del();

      // Then delete all tag assignments
      await db('g_tag_assignments')
        .where('entityType', 'client_version')
        .del();

      // Finally delete all client versions
      const deletedCount = await db('g_client_versions').del();

      logger.info(`Deleted all client versions: ${deletedCount} records`);
      return deletedCount;
    } catch (error) {
      logger.error('Error deleting all client versions:', error);
      throw error;
    }
  }
}
