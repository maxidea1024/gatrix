import db from '../config/knex';
import logger from '../config/logger';

export interface MessageTemplateFilters {
  type?: string;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MessageTemplateListResult {
  messageTemplates: any[];
  total: number;
}

export class MessageTemplateModel {
  static async findAllWithPagination(filters?: MessageTemplateFilters): Promise<MessageTemplateListResult> {
    try {
      console.log('🚀 MessageTemplateKnexModel.findAllWithPagination called with filters:', filters);

      // 기본값 설정
      const limit = filters?.limit ? parseInt(filters.limit.toString(), 10) : 10;
      const offset = filters?.offset ? parseInt(filters.offset.toString(), 10) : 0;

      // 기본 쿼리 빌더
      const baseQuery = () => db('g_message_templates as mt')
        .leftJoin('g_users as creator', 'mt.created_by', 'creator.id')
        .leftJoin('g_users as updater', 'mt.updated_by', 'updater.id');

      // 필터 적용 함수
      const applyFilters = (query: any) => {
        if (filters?.type) {
          query.where('mt.type', filters.type);
        }

        if (filters?.isActive !== undefined) {
          query.where('mt.is_active', filters.isActive);
        }

        if (filters?.search) {
          query.where(function() {
            this.where('mt.name', 'like', `%${filters.search}%`)
                .orWhere('mt.description', 'like', `%${filters.search}%`);
          });
        }

        return query;
      };

      // Count 쿼리
      const countQuery = applyFilters(baseQuery())
        .count('mt.id as total')
        .first();

      // Data 쿼리
      const dataQuery = applyFilters(baseQuery())
        .select([
          'mt.*',
          'creator.name as created_by_name',
          'updater.name as updated_by_name'
        ])
        .orderBy('mt.created_at', 'desc')
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

      // 각 메시지 템플릿의 로케일 데이터 로드
      const messageTemplatesWithLocales = await Promise.all(
        dataResults.map(async (template: any) => {
          const locales = await db('g_message_template_locales')
            .where('template_id', template.id)
            .select('*');

          return {
            ...template,
            locales: locales || []
          };
        })
      );

      console.log('🎯 Returning result: messageTemplates count =', messageTemplatesWithLocales.length, 'total =', total);
      return { 
        messageTemplates: messageTemplatesWithLocales,
        total 
      };
    } catch (error) {
      logger.error('Error finding message templates with pagination (Knex):', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<any | null> {
    try {
      const template = await db('g_message_templates as mt')
        .leftJoin('g_users as creator', 'mt.created_by', 'creator.id')
        .leftJoin('g_users as updater', 'mt.updated_by', 'updater.id')
        .select([
          'mt.*',
          'creator.name as created_by_name',
          'updater.name as updated_by_name'
        ])
        .where('mt.id', id)
        .first();

      if (!template) return null;

      // 로케일 데이터 로드
      const locales = await db('g_message_template_locales')
        .where('template_id', id)
        .select('*');

      return {
        ...template,
        locales: locales || []
      };
    } catch (error) {
      logger.error('Error finding message template by ID (Knex):', error);
      throw error;
    }
  }

  static async create(data: any): Promise<any> {
    try {
      return await db.transaction(async (trx) => {
        // 메시지 템플릿 생성
        const [insertId] = await trx('g_message_templates').insert({
          name: data.name,
          type: data.type,
          description: data.description,
          is_active: data.is_active,
          created_by: data.created_by,
          updated_by: data.updated_by,
          created_at: new Date(),
          updated_at: new Date()
        });

        // 로케일 데이터 생성
        if (data.locales && data.locales.length > 0) {
          const localeData = data.locales.map((locale: any) => ({
            template_id: insertId,
            language: locale.language,
            title: locale.title,
            content: locale.content,
            created_at: new Date(),
            updated_at: new Date()
          }));
          await trx('g_message_template_locales').insert(localeData);
        }

        return await this.findById(insertId);
      });
    } catch (error) {
      logger.error('Error creating message template (Knex):', error);
      throw error;
    }
  }

  static async update(id: number, data: any): Promise<any> {
    try {
      return await db.transaction(async (trx) => {
        // 메시지 템플릿 업데이트
        await trx('g_message_templates')
          .where('id', id)
          .update({
            name: data.name,
            type: data.type,
            description: data.description,
            is_active: data.is_active,
            updated_by: data.updated_by,
            updated_at: new Date()
          });

        // 기존 로케일 데이터 삭제
        await trx('g_message_template_locales')
          .where('template_id', id)
          .del();

        // 새 로케일 데이터 생성
        if (data.locales && data.locales.length > 0) {
          const localeData = data.locales.map((locale: any) => ({
            template_id: id,
            language: locale.language,
            title: locale.title,
            content: locale.content,
            created_at: new Date(),
            updated_at: new Date()
          }));
          await trx('g_message_template_locales').insert(localeData);
        }

        return await this.findById(id);
      });
    } catch (error) {
      logger.error('Error updating message template (Knex):', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // 로케일 데이터 삭제
        await trx('g_message_template_locales')
          .where('template_id', id)
          .del();

        // 메시지 템플릿 삭제
        await trx('g_message_templates')
          .where('id', id)
          .del();
      });
    } catch (error) {
      logger.error('Error deleting message template (Knex):', error);
      throw error;
    }
  }

  // 태그 관련 메서드들
  static async setTags(templateId: number, tagIds: number[]): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // 기존 태그 할당 삭제
        await trx('g_tag_assignments')
          .where('entity_type', 'message_template')
          .where('entity_id', templateId)
          .del();

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map(tagId => ({
            entity_type: 'message_template',
            entity_id: templateId,
            tag_id: tagId,
            created_at: new Date()
          }));
          await trx('g_tag_assignments').insert(assignments);
        }
      });
    } catch (error) {
      logger.error('Error setting message template tags (Knex):', error);
      throw error;
    }
  }

  static async getTags(templateId: number): Promise<any[]> {
    try {
      return await db('g_tag_assignments as ta')
        .join('g_tags as t', 'ta.tag_id', 't.id')
        .select(['t.id', 't.name', 't.color', 't.description'])
        .where('ta.entity_type', 'message_template')
        .where('ta.entity_id', templateId)
        .orderBy('t.name');
    } catch (error) {
      logger.error('Error getting message template tags (Knex):', error);
      throw error;
    }
  }
}
