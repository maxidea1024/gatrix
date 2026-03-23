import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';

const logger = createLogger('MessageTemplate');

export interface MessageTemplateFilters {
  environmentId: string;
  createdBy?: string[];
  createdBy_operator?: 'any_of' | 'include_all';
  isEnabled?: boolean | boolean[];
  isEnabled_operator?: 'any_of' | 'include_all';
  search?: string;
  tags?: string[];
  tags_operator?: 'any_of' | 'include_all';
  limit?: number;
  offset?: number;
}

export interface MessageTemplateListResult {
  messageTemplates: any[];
  total: number;
}

export interface MessageTemplate {
  id?: string;
  environmentId: string;
  name: string;
  type: string;
  isEnabled: boolean;
  supportsMultiLanguage: boolean;
  defaultMessage: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MessageTemplateModel {
  static async findAllWithPagination(
    filters: MessageTemplateFilters
  ): Promise<MessageTemplateListResult> {
    try {
      // Set default values
      const limit = filters?.limit
        ? parseInt(filters.limit.toString(), 10)
        : 10;
      const offset = filters?.offset
        ? parseInt(filters.offset.toString(), 10)
        : 0;
      const environmentId = filters.environmentId;

      logger.debug('🔍 MessageTemplate query filters:', { filters });

      // 테스트: 테이블에 데이터가 있는지 Confirm
      const testCount = await db('g_message_templates')
        .where('environmentId', environmentId)
        .count('* as count')
        .first();
      logger.debug('🔍 Total records in g_message_templates:', { testCount });

      // 기본 Query 빌더 with environment filter
      const baseQuery = () =>
        db('g_message_templates as mt')
          .leftJoin('g_users as creator', 'mt.createdBy', 'creator.id')
          .leftJoin('g_users as updater', 'mt.updatedBy', 'updater.id')
          .where('mt.environmentId', environmentId);

      // Filter 적용 함수
      const applyFilters = (query: any) => {
        // Handle createdBy filter (single or multiple)
        if (filters?.createdBy !== undefined) {
          if (Array.isArray(filters.createdBy)) {
            query.whereIn('mt.createdBy', filters.createdBy);
          } else {
            query.where('mt.createdBy', filters.createdBy);
          }
        }

        // Handle isEnabled filter (single or multiple)
        if (filters?.isEnabled !== undefined) {
          if (Array.isArray(filters.isEnabled)) {
            // For array of booleans, use OR condition
            const enabledArray = filters.isEnabled as boolean[];
            query.where(function (this: any) {
              enabledArray.forEach((enabled: boolean, index: number) => {
                if (index === 0) {
                  this.where('mt.isEnabled', enabled);
                } else {
                  this.orWhere('mt.isEnabled', enabled);
                }
              });
            });
          } else if (filters.isEnabled === true) {
            query.where('mt.isEnabled', true);
          } else if (filters.isEnabled === false) {
            query.where('mt.isEnabled', false);
          }
        }

        if (filters?.search) {
          query.where(function (this: any) {
            this.where('mt.name', 'like', `%${filters.search}%`).orWhere(
              'mt.defaultMessage',
              'like',
              `%${filters.search}%`
            );
          });
        }

        // 태그 Filter 처리
        if (filters?.tags && filters.tags.length > 0) {
          const operator = filters.tags_operator || 'include_all';

          if (operator === 'any_of') {
            // OR 조건: 선택한 태그 중 하나라도 가진 템플릿 반환
            query.whereExists(function (this: any) {
              this.select('*')
                .from('g_tag_assignments as ta')
                .whereRaw('ta.entityId = mt.id')
                .where('ta.entityType', 'message_template')
                .whereIn('ta.tagId', filters.tags!);
            });
          } else {
            // AND 조건: 선택한 모든 태그를 가진 템플릿만 반환
            filters.tags.forEach((tagId) => {
              query.whereExists(function (this: any) {
                this.select('*')
                  .from('g_tag_assignments as ta')
                  .whereRaw('ta.entityId = mt.id')
                  .where('ta.entityType', 'message_template')
                  .where('ta.tagId', tagId);
              });
            });
          }
        }

        return query;
      };

      // Count Query
      const countQuery = applyFilters(baseQuery())
        .count('mt.id as total')
        .first();

      // Data Query
      const dataQuery = applyFilters(baseQuery())
        .select([
          'mt.*',
          'creator.name as createdByName',
          'updater.name as updatedByName',
        ])
        .orderBy('mt.createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      // 병렬 실행
      const [countResult, dataResults] = await Promise.all([
        countQuery,
        dataQuery,
      ]);

      const total = countResult?.total || 0;

      // 각 메시지 템플릿에 태그 정보와 locales 정보 추가
      const messageTemplatesWithTags = await Promise.all(
        dataResults.map(async (template: any) => {
          const [tags, locales] = await Promise.all([
            db('g_tag_assignments as ta')
              .join('g_tags as t', 'ta.tagId', 't.id')
              .where('ta.entityType', 'message_template')
              .where('ta.entityId', template.id)
              .select('t.id', 't.name', 't.color', 't.description'),
            db('g_message_template_locales')
              .where('templateId', template.id)
              .select('lang', 'message'),
          ]);

          return {
            ...template,
            isEnabled: Boolean(template.isEnabled),
            supportsMultiLanguage: Boolean(template.supportsMultiLanguage),
            tags: tags || [],
            locales: locales || [],
          };
        })
      );

      return {
        messageTemplates: messageTemplatesWithTags,
        total,
      };
    } catch (error) {
      logger.error('Error finding message templates with pagination:', error);
      throw error;
    }
  }

  static async findById(
    id: string,
    environmentId: string
  ): Promise<any | null> {
    try {
      const template = await db('g_message_templates as mt')
        .leftJoin('g_users as creator', 'mt.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'mt.updatedBy', 'updater.id')
        .select([
          'mt.*',
          'creator.name as createdByName',
          'updater.name as updatedByName',
        ])
        .where('mt.id', id)
        .where('mt.environmentId', environmentId)
        .first();

      if (!template) {
        return null;
      }

      // locales 정보 추가
      const locales = await db('g_message_template_locales')
        .where('templateId', id)
        .select('lang', 'message');

      return {
        ...template,
        isEnabled: Boolean(template.isEnabled),
        supportsMultiLanguage: Boolean(template.supportsMultiLanguage),
        locales: locales || [],
      };
    } catch (error) {
      logger.error('Error finding message template by ID:', error);
      throw error;
    }
  }

  static async create(data: any, environmentId: string): Promise<any> {
    try {
      return await db.transaction(async (trx) => {
        // 메시지 템플릿 Create
        const id = generateULID();
        await trx('g_message_templates').insert({
          id,
          environmentId: environmentId,
          name: data.name,
          type: data.type,
          defaultMessage:
            data.defaultMessage || data.default_message || data.content || '',
          isEnabled:
            data.isEnabled !== undefined
              ? data.isEnabled
              : data.isEnabled !== undefined
                ? data.isEnabled
                : true,
          supportsMultiLanguage:
            data.supportsMultiLanguage !== undefined
              ? data.supportsMultiLanguage
              : false,
          createdBy: data.createdBy || data.created_by,
          updatedBy: data.updatedBy || data.updated_by,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 언어별 메시지 처리
        if (data.locales && data.locales.length > 0) {
          const localeInserts = data.locales.map((locale: any) => ({
            templateId: id,
            lang: locale.lang,
            message: locale.message,
            createdBy: data.createdBy || data.created_by,
            updatedBy: data.updatedBy || data.updated_by,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          await trx('g_message_template_locales').insert(localeInserts);
        }

        const created = await this.findById(id, environmentId);

        if (!created) {
          // 직접 ID와 기본 정보를 반환
          return {
            id: id,
            name: data.name,
            type: data.type,
            defaultMessage:
              data.defaultMessage || data.default_message || data.content || '',
            isEnabled:
              data.isEnabled !== undefined
                ? data.isEnabled
                : data.isEnabled !== undefined
                  ? data.isEnabled
                  : true,
            locales: data.locales || [],
          };
        }

        return created;
      });
    } catch (error) {
      logger.error('Error creating message template:', error);
      throw error;
    }
  }

  static async update(
    id: string,
    data: any,
    environmentId: string
  ): Promise<any> {
    try {
      return await db.transaction(async (trx) => {
        // 메시지 템플릿 업데이트
        await trx('g_message_templates')
          .where('id', id)
          .where('environmentId', environmentId)
          .update({
            name: data.name,
            type: data.type,
            defaultMessage: data.defaultMessage || data.content,
            isEnabled:
              data.isEnabled !== undefined ? data.isEnabled : data.isEnabled,
            supportsMultiLanguage:
              data.supportsMultiLanguage !== undefined
                ? data.supportsMultiLanguage
                : false,
            updatedBy: data.updatedBy || data.updated_by,
            updatedAt: new Date(),
          });

        // Existing 언어별 메시지 Delete
        await trx('g_message_template_locales').where('templateId', id).del();

        // New 언어별 메시지 추가
        if (data.locales && data.locales.length > 0) {
          const localeInserts = data.locales.map((locale: any) => ({
            templateId: id,
            lang: locale.lang,
            message: locale.message,
            createdBy:
              data.updatedBy ||
              data.updated_by ||
              data.createdBy ||
              data.created_by,
            updatedBy: data.updatedBy || data.updated_by,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          await trx('g_message_template_locales').insert(localeInserts);
        }

        return await this.findById(id, environmentId);
      });
    } catch (error) {
      logger.error('Error updating message template:', error);
      throw error;
    }
  }

  static async delete(id: string, environmentId: string): Promise<void> {
    try {
      await db('g_message_templates')
        .where('id', id)
        .where('environmentId', environmentId)
        .del();
    } catch (error) {
      logger.error('Error deleting message template:', error);
      throw error;
    }
  }

  // 추가 메서드들
  static async findByName(
    name: string,
    excludeId?: string
  ): Promise<any | null> {
    try {
      let query = db('g_message_templates').where('name', name);

      if (excludeId) {
        query = query.where('id', '!=', excludeId);
      }

      return await query.first();
    } catch (error) {
      logger.error('Error finding message template by name:', error);
      throw error;
    }
  }

  // 태그 관련 메서드들
  static async setTags(
    templateId: string,
    tagIds: string[],
    createdBy?: string
  ): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // Existing 태그 할당 Delete
        await trx('g_tag_assignments')
          .where('entityType', 'message_template')
          .where('entityId', templateId)
          .del();

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map((tagId) => ({
            id: generateULID(),
            entityType: 'message_template',
            entityId: templateId,
            tagId: tagId,
            createdBy: createdBy || '',
            createdAt: new Date(),
          }));
          await trx('g_tag_assignments').insert(assignments);
        }
      });
    } catch (error) {
      logger.error('Error setting message template tags:', error);
      throw error;
    }
  }

  static async getTags(templateId: string): Promise<any[]> {
    try {
      return await db('g_tag_assignments as ta')
        .join('g_tags as t', 'ta.tagId', 't.id')
        .select(['t.id', 't.name', 't.color', 't.description'])
        .where('ta.entityType', 'message_template')
        .where('ta.entityId', templateId)
        .orderBy('t.name');
    } catch (error) {
      logger.error('Error getting message template tags:', error);
      throw error;
    }
  }
}
