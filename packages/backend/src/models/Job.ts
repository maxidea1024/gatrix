import db from '../config/knex';
import logger from '../config/logger';
import { getCurrentEnvironmentId } from '../utils/environmentContext';

export interface JobFilters {
  environmentId?: string;
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
  memo?: string;
  jobTypeId: number;
  isEnabled: boolean;
  jobDataMap?: any;
  tagIds?: number[];
  createdBy: number;
  updatedBy: number;
}

export interface UpdateJobData {
  name?: string;
  memo?: string;
  jobTypeId?: number;
  isEnabled?: boolean;
  jobDataMap?: any;
  tagIds?: number[];
  updatedBy: number;
}

// JSON 파싱 유틸리티 함수
const safeJsonParse = (input: any): any => {
  // 이미 객체인 경우 그대로 반환
  if (typeof input === 'object' && input !== null) {
    return input;
  }

  // null이나 undefined인 경우 빈 객체 반환
  if (!input) {
    return {};
  }

  // 문자열인 경우 JSON 파싱 시도
  if (typeof input === 'string') {
    if (input === '{}') {
      return {};
    }

    try {
      return JSON.parse(input);
    } catch (error) {
      logger.warn('Failed to parse JSON string:', { input, error });
      return {};
    }
  }

  // 기타 타입인 경우 그대로 반환
  return input;
};

// JSON 문자열화 유틸리티 함수
const safeJsonStringify = (data: any): string => {
  if (typeof data === 'string') {
    // 이미 문자열인 경우, JSON인지 확인
    try {
      JSON.parse(data);
      return data; // 이미 유효한 JSON 문자열
    } catch {
      // 유효하지 않은 JSON이면 다시 stringify
      return JSON.stringify(data);
    }
  }
  return JSON.stringify(data || {});
};

export class JobModel {
  static async findAllWithPagination(filters?: JobFilters): Promise<JobListResult> {
    try {
      // 기본값 설정
      const limit = filters?.limit ? parseInt(filters.limit.toString(), 10) : 20;
      const offset = filters?.offset ? parseInt(filters.offset.toString(), 10) : 0;
      const envId = filters?.environmentId ?? getCurrentEnvironmentId();

      // 기본 쿼리 빌더 with environment filter
      const baseQuery = () => db('g_jobs as j')
        .leftJoin('g_job_types as jt', 'j.jobTypeId', 'jt.id')
        .leftJoin('g_users as cu', 'j.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'j.updatedBy', 'uu.id')
        .where('j.environmentId', envId);

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

      // Data 쿼리 - 태그 정보 포함
      const dataQuery = applyFilters(baseQuery())
        .select([
          'j.*',
          'jt.name as jobTypeName',
          'jt.displayName as jobTypeDisplayName',
          'cu.name as createdByName',
          'cu.email as createdByEmail',
          'uu.name as updatedByName',
          'uu.email as updatedByEmail'
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

      // Job 결과 매핑
      const jobs = dataResults.map((row: any) => ({
        id: row.id,
        name: row.name,
        memo: row.memo,
        jobTypeId: row.jobTypeId,
        jobDataMap: safeJsonParse(row.jobDataMap),
        isEnabled: Boolean(row.isEnabled),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        jobTypeName: row.jobTypeName,
        jobTypeDisplayName: row.jobTypeDisplayName,
        createdByName: row.createdByName,
        createdByEmail: row.createdByEmail,
        updatedByName: row.updatedByName,
        updatedByEmail: row.updatedByEmail
      }));

      // 각 Job에 대한 태그 정보 조회
      const jobIds = jobs.map((job: any) => job.id);
      if (jobIds.length > 0) {
        const jobTags = await db('g_tag_assignments as ta')
          .join('g_tags as t', 'ta.tagId', 't.id')
          .select([
            'ta.entityId as jobId',
            't.id as tagId',
            't.name as tagName',
            't.description as tagDescription',
            't.color as tagColor'
          ])
          .where('ta.entityType', 'job')
          .whereIn('ta.entityId', jobIds);

        // Job별로 태그 그룹화
        const tagsByJobId = jobTags.reduce((acc: any, tag: any) => {
          if (!acc[tag.jobId]) {
            acc[tag.jobId] = [];
          }
          acc[tag.jobId].push({
            id: tag.tagId,
            name: tag.tagName,
            description: tag.tagDescription,
            color: tag.tagColor
          });
          return acc;
        }, {});

        // Job에 태그 정보 추가
        jobs.forEach((job: any) => {
          job.tags = tagsByJobId[job.id] || [];
        });
      }

      return { jobs, total };
    } catch (error) {
      logger.error('Error finding jobs with pagination:', error);
      throw error;
    }
  }

  static async findById(id: number, environmentId?: string): Promise<any | null> {
    try {
      const envId = environmentId ?? getCurrentEnvironmentId();
      const job = await db('g_jobs as j')
        .leftJoin('g_job_types as jt', 'j.jobTypeId', 'jt.id')
        .leftJoin('g_users as cu', 'j.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'j.updatedBy', 'uu.id')
        .select([
          'j.*',
          'jt.name as jobTypeName',
          'jt.displayName as jobTypeDisplayName',
          'cu.name as createdByName',
          'cu.email as createdByEmail',
          'uu.name as updatedByName',
          'uu.email as updatedByEmail'
        ])
        .where('j.id', id)
        .where('j.environmentId', envId)
        .first();

      if (!job) return null;

      // 태그 정보 조회
      const jobTags = await db('g_tag_assignments as ta')
        .join('g_tags as t', 'ta.tagId', 't.id')
        .select([
          't.id as tagId',
          't.name as tagName',
          't.description as tagDescription',
          't.color as tagColor'
        ])
        .where('ta.entityType', 'job')
        .where('ta.entityId', id);

      const tags = jobTags.map((tag: any) => ({
        id: tag.tagId,
        name: tag.tagName,
        description: tag.tagDescription,
        color: tag.tagColor
      }));

      return {
        ...job,
        jobDataMap: safeJsonParse(job.jobDataMap),
        tags: tags
      };
    } catch (error) {
      logger.error('Error finding job by ID:', error);
      throw error;
    }
  }

  static async create(jobData: CreateJobData): Promise<any> {
    const trx = await db.transaction();
    try {
      const envId = getCurrentEnvironmentId();
      const [insertId] = await trx('g_jobs').insert({
        name: jobData.name,
        memo: jobData.memo,
        jobTypeId: jobData.jobTypeId,
        isEnabled: jobData.isEnabled,
        jobDataMap: safeJsonStringify(jobData.jobDataMap || {}),
        environmentId: envId,
        createdBy: jobData.createdBy,
        updatedBy: jobData.updatedBy,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 태그 연결
      if (jobData.tagIds && jobData.tagIds.length > 0) {
        const tagAssignments = jobData.tagIds.map(tagId => ({
          entityType: 'job',
          entityId: insertId,
          tagId: tagId,
          createdBy: jobData.createdBy || 1,
          createdAt: new Date()
        }));
        await trx('g_tag_assignments').insert(tagAssignments);
      }

      await trx.commit();
      return await this.findById(insertId);
    } catch (error) {
      await trx.rollback();
      logger.error('Error creating job:', error);
      throw error;
    }
  }

  static async update(id: number, jobData: UpdateJobData, environmentId?: string): Promise<any> {
    const trx = await db.transaction();
    try {
      const envId = environmentId ?? getCurrentEnvironmentId();
      const updateData: any = {};

      if (jobData.name !== undefined) updateData.name = jobData.name;
      if (jobData.memo !== undefined) updateData.memo = jobData.memo;
      if (jobData.jobTypeId !== undefined) updateData.jobTypeId = jobData.jobTypeId;
      if (jobData.isEnabled !== undefined) updateData.isEnabled = jobData.isEnabled;
      if (jobData.jobDataMap !== undefined) updateData.jobDataMap = safeJsonStringify(jobData.jobDataMap);
      if (jobData.updatedBy !== undefined) updateData.updatedBy = jobData.updatedBy;

      updateData.updatedAt = new Date();

      await trx('g_jobs')
        .where('id', id)
        .where('environmentId', envId)
        .update(updateData);

      // 태그 업데이트
      if (jobData.tagIds !== undefined) {
        // 기존 태그 연결 삭제
        await trx('g_tag_assignments')
          .where('entityType', 'job')
          .where('entityId', id)
          .del();

        // 새 태그 연결 추가
        if (jobData.tagIds.length > 0) {
          const tagAssignments = jobData.tagIds.map(tagId => ({
            entityType: 'job',
            entityId: id,
            tagId: tagId,
            createdAt: new Date()
          }));
          await trx('g_tag_assignments').insert(tagAssignments);
        }
      }

      await trx.commit();
      return await this.findById(id, envId);
    } catch (error) {
      await trx.rollback();
      logger.error('Error updating job:', error);
      throw error;
    }
  }

  static async delete(id: number, environmentId?: string): Promise<void> {
    const trx = await db.transaction();
    try {
      const envId = environmentId ?? getCurrentEnvironmentId();
      // 태그 할당 삭제
      await trx('g_tag_assignments')
        .where('entityType', 'job')
        .where('entityId', id)
        .del();

      // Job 삭제
      await trx('g_jobs').where('id', id).where('environmentId', envId).del();

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      logger.error('Error deleting job:', error);
      throw error;
    }
  }

  // 태그 관련 메서드들
  static async setTags(jobId: number, tagIds: number[], createdBy?: number): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // 기존 태그 할당 삭제
        await trx('g_tag_assignments')
          .where('entityType', 'job')
          .where('entityId', jobId)
          .del();

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map(tagId => ({
            entityType: 'job',
            entityId: jobId,
            tagId: tagId,
            createdBy: createdBy || 1,
            createdAt: new Date()
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
        .join('g_tags as t', 'ta.tagId', 't.id')
        .select(['t.id', 't.name', 't.color', 't.description'])
        .where('ta.entityType', 'job')
        .where('ta.entityId', jobId)
        .orderBy('t.name');
    } catch (error) {
      logger.error('Error getting job tags:', error);
      throw error;
    }
  }

  static async findByName(name: string, environmentId?: string): Promise<any | null> {
    try {
      const envId = environmentId ?? getCurrentEnvironmentId();
      const job = await db('g_jobs')
        .where('name', name)
        .where('environmentId', envId)
        .first();

      return job || null;
    } catch (error) {
      logger.error('Error finding job by name:', error);
      throw error;
    }
  }
}
