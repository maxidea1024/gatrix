import db from '../config/knex';
import logger from '../config/logger';

export interface JobFilters {
  jobTypeId?: number;
  isEnabled?: boolean;
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
  jobTypeId: number;
  isEnabled: boolean;
  jobDataMap?: any;
  memo?: string;
  retryCount?: number;
  maxRetryCount?: number;
  timeoutSeconds?: number;
  createdBy: number;
  updatedBy: number;
}

export interface UpdateJobData {
  name?: string;
  description?: string;
  jobTypeId?: number;
  isEnabled?: boolean;
  jobDataMap?: any;
  memo?: string;
  retryCount?: number;
  maxRetryCount?: number;
  timeoutSeconds?: number;
  updatedBy: number;
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
        .leftJoin('g_job_types as jt', 'j.jobTypeId', 'jt.id')
        .leftJoin('g_users as cu', 'j.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'j.updatedBy', 'uu.id');

      // 필터 적용 함수
      const applyFilters = (query: any) => {
        if (filters?.jobTypeId) {
          query.where('j.jobTypeId', filters.jobTypeId);
        }

        if (filters?.isEnabled !== undefined) {
          query.where('j.isEnabled', filters.isEnabled);
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
          'jt.name as jobTypeName',
          'jt.displayName as jobTypeDisplayName',
          'cu.name as createdByName',
          'uu.name as updatedByName'
        ])
        .orderBy('j.createdAt', 'desc')
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
      logger.error('Error finding jobs with pagination:', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<any | null> {
    try {
      const job = await db('g_jobs as j')
        .leftJoin('g_job_types as jt', 'j.jobTypeId', 'jt.id')
        .leftJoin('g_users as cu', 'j.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'j.updatedBy', 'uu.id')
        .select([
          'j.*',
          'jt.name as jobTypeName',
          'jt.displayName as jobTypeDisplayName',
          'cu.name as createdByName',
          'uu.name as updatedByName'
        ])
        .where('j.id', id)
        .first();

      if (!job) return null;

      return {
        ...job,
        jobDataMap: safeJsonParse(job.jobDataMap)
      };
    } catch (error) {
      logger.error('Error finding job by ID:', error);
      throw error;
    }
  }

  static async create(jobData: CreateJobData): Promise<any> {
    try {
      const [insertId] = await db('g_jobs').insert({
        name: jobData.name,
        description: jobData.description,
        jobTypeId: jobData.jobTypeId,
        isEnabled: jobData.isEnabled,
        jobDataMap: JSON.stringify(jobData.jobDataMap || {}),
        memo: jobData.memo,
        retryCount: jobData.retryCount || 0,
        maxRetryCount: jobData.maxRetryCount || 3,
        timeoutSeconds: jobData.timeoutSeconds,
        createdBy: jobData.createdBy,
        updatedBy: jobData.updatedBy,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return await this.findById(insertId);
    } catch (error) {
      logger.error('Error creating job:', error);
      throw error;
    }
  }

  static async update(id: number, jobData: UpdateJobData): Promise<any> {
    try {
      const updateData: any = {};

      if (jobData.name !== undefined) updateData.name = jobData.name;
      if (jobData.description !== undefined) updateData.description = jobData.description;
      if (jobData.jobTypeId !== undefined) updateData.jobTypeId = jobData.jobTypeId;
      if (jobData.isEnabled !== undefined) updateData.isEnabled = jobData.isEnabled;
      if (jobData.jobDataMap !== undefined) updateData.jobDataMap = JSON.stringify(jobData.jobDataMap);
      if (jobData.memo !== undefined) updateData.memo = jobData.memo;
      if (jobData.retryCount !== undefined) updateData.retryCount = jobData.retryCount;
      if (jobData.maxRetryCount !== undefined) updateData.maxRetryCount = jobData.maxRetryCount;
      if (jobData.timeoutSeconds !== undefined) updateData.timeoutSeconds = jobData.timeoutSeconds;
      if (jobData.updatedBy !== undefined) updateData.updatedBy = jobData.updatedBy;

      updateData.updatedAt = new Date();

      await db('g_jobs')
        .where('id', id)
        .update(updateData);

      return await this.findById(id);
    } catch (error) {
      logger.error('Error updating job:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<void> {
    try {
      await db('g_jobs').where('id', id).del();
    } catch (error) {
      logger.error('Error deleting job:', error);
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
      logger.error('Error setting job tags:', error);
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
      logger.error('Error getting job tags:', error);
      throw error;
    }
  }

  static async findByName(name: string): Promise<any | null> {
    try {
      const job = await db('g_jobs')
        .where('name', name)
        .first();

      return job || null;
    } catch (error) {
      logger.error('Error finding job by name:', error);
      throw error;
    }
  }
}
