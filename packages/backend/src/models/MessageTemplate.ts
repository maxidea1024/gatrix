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

export interface MessageTemplate {
  id?: number;
  name: string;
  type: string;
  is_enabled: boolean;
  default_message: string;
  created_by?: number;
  updated_by?: number;
  created_at?: Date;
  updated_at?: Date;
}

export class MessageTemplateModel {
  static async findAllWithPagination(filters?: MessageTemplateFilters): Promise<MessageTemplateListResult> {
    try {
      // 기본값 설정
      const limit = filters?.limit ? parseInt(filters.limit.toString(), 10) : 10;
      const offset = filters?.offset ? parseInt(filters.offset.toString(), 10) : 0;

      console.log('🔍 MessageTemplate query filters:', filters);

      // 테스트: 테이블에 데이터가 있는지 확인
      const testCount = await db('g_message_templates').count('* as count').first();
      console.log('🔍 Total records in g_message_templates:', testCount);

      // 기본 쿼리 빌더
      const baseQuery = () => db('g_message_templates as mt')
        .leftJoin('g_users as creator', 'mt.created_by', 'creator.id')
        .leftJoin('g_users as updater', 'mt.updated_by', 'updater.id');

      // 필터 적용 함수
      const applyFilters = (query: any) => {
        if (filters?.type) {
          query.where('mt.type', filters.type);
        }

        // isActive 필터 처리
        // 컨트롤러에서 undefined가 false로 변환되는 문제 때문에
        // false인 경우도 필터를 적용하지 않음 (모든 레코드 조회)
        if (filters?.isActive === true) {
          query.where('mt.is_enabled', true);
        }
        // false나 undefined인 경우 필터 적용하지 않음

        if (filters?.search) {
          query.where(function(this: any) {
            this.where('mt.name', 'like', `%${filters.search}%`)
                .orWhere('mt.default_message', 'like', `%${filters.search}%`);
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

      // 병렬 실행
      const [countResult, dataResults] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      const total = countResult?.total || 0;

      console.log('🔍 Database query results:');
      console.log('🔍 Count result:', countResult);
      console.log('🔍 Data results:', dataResults);
      console.log('🔍 Total:', total);

      // 각 메시지 템플릿에 태그 정보 추가
      const messageTemplatesWithTags = await Promise.all(
        dataResults.map(async (template: any) => {
          const tags = await db('g_tag_assignments as ta')
            .join('g_tags as t', 'ta.tagId', 't.id')
            .where('ta.entityType', 'message_template')
            .where('ta.entityId', template.id)
            .select('t.id', 't.name', 't.color');

          return {
            ...template,
            tags: tags || []
          };
        })
      );

      return {
        messageTemplates: messageTemplatesWithTags,
        total
      };
    } catch (error) {
      logger.error('Error finding message templates with pagination:', error);
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

      return template;
    } catch (error) {
      logger.error('Error finding message template by ID:', error);
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
          default_message: data.default_message || data.content || '',
          is_enabled: data.is_enabled !== undefined ? data.is_enabled : true,
          created_by: data.created_by,
          updated_by: data.updated_by,
          created_at: new Date(),
          updated_at: new Date()
        });

        return await this.findById(insertId);
      });
    } catch (error) {
      logger.error('Error creating message template:', error);
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
            default_message: data.default_message || data.content,
            is_enabled: data.is_enabled,
            updated_by: data.updated_by,
            updated_at: new Date()
          });

        return await this.findById(id);
      });
    } catch (error) {
      logger.error('Error updating message template:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<void> {
    try {
      await db('g_message_templates')
        .where('id', id)
        .del();
    } catch (error) {
      logger.error('Error deleting message template:', error);
      throw error;
    }
  }

  // 추가 메서드들
  static async findByName(name: string, excludeId?: number): Promise<any | null> {
    try {
      let query = db('g_message_templates')
        .where('name', name);

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
  static async setTags(templateId: number, tagIds: number[]): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // 기존 태그 할당 삭제
        await trx('g_tag_assignments')
          .where('entityType', 'message_template')
          .where('entityId', templateId)
          .del();

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map(tagId => ({
            entityType: 'message_template',
            entityId: templateId,
            tagId: tagId,
            createdAt: new Date()
          }));
          await trx('g_tag_assignments').insert(assignments);
        }
      });
    } catch (error) {
      logger.error('Error setting message template tags:', error);
      throw error;
    }
  }

  static async getTags(templateId: number): Promise<any[]> {
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
