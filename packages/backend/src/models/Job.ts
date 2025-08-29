import db from '../config/knex';
import logger from '../config/logger';

export interface JobFilters {
  job_type_id?: number;
  is_enabled?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface JobListResult {
  jobs: any[];
  total: number;
}

export interface CreateJobData {
  name: string;
  description?: string;
  job_type_id: number;
  is_enabled: boolean;
  job_data_map?: any;
  memo?: string;
  retry_count?: number;
  max_retry_count?: number;
  timeout_seconds?: number;
  created_by: number;
  updated_by: number;
}

export interface UpdateJobData {
  name?: string;
  description?: string;
  job_type_id?: number;
  is_enabled?: boolean;
  job_data_map?: any;
  memo?: string;
  retry_count?: number;
  max_retry_count?: number;
  timeout_seconds?: number;
  updated_by: number;
}

// JSON 파싱 유틸리티 함수
const safeJsonParse = (jsonString: string | null): any => {
  if (!jsonString) return {};
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.warn('Failed to parse JSON:', { jsonString, error });
    return {};
  }
};

export class JobModel {
  static async findAllWithPagination(filters?: JobFilters): Promise<JobListResult> {
    try {
      // 기본값 설정
      const limit = filters?.limit ? parseInt(filters.limit.toString(), 10) : 20;
      const offset = filters?.offset ? parseInt(filters.offset.toString(), 10) : 0;

      // 기본 쿼리 빌더
      const baseQuery = () => db('g_jobs as j')
        .leftJoin('g_job_types as jt', 'j.job_type_id', 'jt.id')
        .leftJoin('g_users as cu', 'j.created_by', 'cu.id')
        .leftJoin('g_users as uu', 'j.updated_by', 'uu.id');

      // 필터 적용 함수
      const applyFilters = (query: any) => {
        if (filters?.job_type_id) {
          query.where('j.job_type_id', filters.job_type_id);
        }

        if (filters?.is_enabled !== undefined) {
          query.where('j.is_enabled', filters.is_enabled);
        }

        if (filters?.search) {
          query.where(function(this: any) {
            this.where('j.name', 'like', `%${filters.search}%`)
                .orWhere('j.description', 'like', `%${filters.search}%`)
                .orWhere('j.memo', 'like', `%${filters.search}%`);
          });
        }

        return query;
      };

      // Count 쿼리
      const countQuery = applyFilters(baseQuery())
        .count('j.id as total')
        .first();

      // Data 쿼리
      const dataQuery = applyFilters(baseQuery())
        .select([
          'j.*',
          'jt.name as job_type_name',
          'jt.display_name as job_type_display_name',
          'cu.name as created_by_name',
          'uu.name as updated_by_name'
        ])
        .orderBy('j.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      // 병렬 실행
      const [countResult, dataResults] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      const total = countResult?.total || 0;
      const jobs = dataResults.map((row: any) => ({
        ...row,
        job_data_map: safeJsonParse(row.job_data_map)
      }));

      return { jobs, total };
    } catch (error) {
      logger.error('Error finding jobs with pagination (Knex):', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<any | null> {
    try {
      const job = await db('g_jobs as j')
        .leftJoin('g_job_types as jt', 'j.job_type_id', 'jt.id')
        .leftJoin('g_users as cu', 'j.created_by', 'cu.id')
        .leftJoin('g_users as uu', 'j.updated_by', 'uu.id')
        .select([
          'j.*',
          'jt.name as job_type_name',
          'jt.display_name as job_type_display_name',
          'cu.name as created_by_name',
          'uu.name as updated_by_name'
        ])
        .where('j.id', id)
        .first();

      if (!job) return null;

      return {
        ...job,
        job_data_map: safeJsonParse(job.job_data_map)
      };
    } catch (error) {
      logger.error('Error finding job by ID (Knex):', error);
      throw error;
    }
  }

  static async create(jobData: any): Promise<any> {
    try {
      const [insertId] = await db('g_jobs').insert({
        ...jobData,
        job_data_map: JSON.stringify(jobData.job_data_map || {}),
        created_at: new Date(),
        updated_at: new Date()
      });

      return await this.findById(insertId);
    } catch (error) {
      logger.error('Error creating job (Knex):', error);
      throw error;
    }
  }

  static async update(id: number, jobData: any): Promise<any> {
    try {
      await db('g_jobs')
        .where('id', id)
        .update({
          ...jobData,
          job_data_map: jobData.job_data_map ? JSON.stringify(jobData.job_data_map) : undefined,
          updated_at: new Date()
        });

      return await this.findById(id);
    } catch (error) {
      logger.error('Error updating job (Knex):', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<void> {
    try {
      await db('g_jobs').where('id', id).del();
    } catch (error) {
      logger.error('Error deleting job (Knex):', error);
      throw error;
    }
  }

  // 태그 관련 메서드들
  static async setTags(jobId: number, tagIds: number[]): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // 기존 태그 할당 삭제
        await trx('g_tag_assignments')
          .where('entity_type', 'job')
          .where('entity_id', jobId)
          .del();

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map(tagId => ({
            entity_type: 'job',
            entity_id: jobId,
            tag_id: tagId,
            created_at: new Date()
          }));
          await trx('g_tag_assignments').insert(assignments);
        }
      });
    } catch (error) {
      logger.error('Error setting job tags (Knex):', error);
      throw error;
    }
  }

  static async getTags(jobId: number): Promise<any[]> {
    try {
      return await db('g_tag_assignments as ta')
        .join('g_tags as t', 'ta.tag_id', 't.id')
        .select(['t.id', 't.name', 't.color', 't.description'])
        .where('ta.entity_type', 'job')
        .where('ta.entity_id', jobId)
        .orderBy('t.name');
    } catch (error) {
      logger.error('Error getting job tags (Knex):', error);
      throw error;
    }
  }
}
