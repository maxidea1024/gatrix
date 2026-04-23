import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';

const logger = createLogger('Job');

export interface JobFilters {
  environmentId: string;
  jobTypeId?: string;
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
  jobTypeId: string;
  isEnabled: boolean;
  jobDataMap?: any;
  tagIds?: string[];
  createdBy: string;
  updatedBy: string;
  environmentId: string;
  cronExpression?: string;
  triggerAt?: Date;
  timezone?: string;
  retryPolicy?: any;
}

export interface UpdateJobData {
  name?: string;
  memo?: string;
  jobTypeId?: string;
  isEnabled?: boolean;
  jobDataMap?: any;
  tagIds?: string[];
  updatedBy?: string;
  cronExpression?: string | null;
  triggerAt?: Date | null;
  timezone?: string;
  retryPolicy?: any | null;
  lastExecutedAt?: Date;
}

// JSON parsing utility function
const safeJsonParse = (input: any): any => {
  // Return as-is if already an object
  if (typeof input === 'object' && input !== null) {
    return input;
  }

  // Return empty object for null or undefined
  if (!input) {
    return {};
  }

  // Attempt JSON parsing if string
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

  // Return as-is for other types
  return input;
};

// JSON stringify utility function
const safeJsonStringify = (data: any): string => {
  if (typeof data === 'string') {
    // If already a string, check if valid JSON
    try {
      JSON.parse(data);
      return data; // Already a valid JSON string
    } catch {
      // Re-stringify if not valid JSON
      return JSON.stringify(data);
    }
  }
  return JSON.stringify(data || {});
};

export class JobModel {
  static async findAllWithPagination(
    filters: JobFilters
  ): Promise<JobListResult> {
    try {
      // Set default values
      const limit = filters?.limit
        ? parseInt(filters.limit.toString(), 10)
        : 20;
      const offset = filters?.offset
        ? parseInt(filters.offset.toString(), 10)
        : 0;
      const environmentId = filters.environmentId;

      // Base query builder with environment filter
      const baseQuery = () =>
        db('g_jobs as j')
          .leftJoin('g_job_types as jt', 'j.jobTypeId', 'jt.id')
          .leftJoin('g_users as cu', 'j.createdBy', 'cu.id')
          .leftJoin('g_users as uu', 'j.updatedBy', 'uu.id')
          .where('j.environmentId', environmentId);

      // Apply filters
      const applyFilters = (query: any) => {
        if (filters?.jobTypeId) {
          query.where('j.jobTypeId', filters.jobTypeId);
        }

        if (filters?.isEnabled !== undefined) {
          query.where('j.isEnabled', filters.isEnabled);
        }

        if (filters?.search) {
          query.where(function (this: any) {
            this.where('j.name', 'like', `%${filters.search}%`)
              .orWhere('j.description', 'like', `%${filters.search}%`)
              .orWhere('j.memo', 'like', `%${filters.search}%`);
          });
        }

        return query;
      };

      // Count Query
      const countQuery = applyFilters(baseQuery())
        .count('j.id as total')
        .first();

      // Data query - include tag info
      const dataQuery = applyFilters(baseQuery())
        .select([
          'j.*',
          'jt.name as jobTypeName',
          'jt.displayName as jobTypeDisplayName',
          'cu.name as createdByName',
          'cu.email as createdByEmail',
          'uu.name as updatedByName',
          'uu.email as updatedByEmail',
        ])
        .orderBy('j.createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      // Execute in parallel
      const [countResult, dataResults] = await Promise.all([
        countQuery,
        dataQuery,
      ]);

      const total = countResult?.total || 0;

      // Map job results
      const jobs = dataResults.map((row: any) => ({
        id: row.id,
        name: row.name,
        memo: row.memo,
        jobTypeId: row.jobTypeId,
        jobDataMap: safeJsonParse(row.jobDataMap),
        cronExpression: row.cronExpression,
        triggerAt: row.triggerAt,
        timezone: row.timezone,
        retryPolicy: safeJsonParse(row.retryPolicy),
        nextExecutionAt: row.nextExecutionAt,
        lastExecutedAt: row.lastExecutedAt,
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
        updatedByEmail: row.updatedByEmail,
      }));

      // Fetch tag info for each job
      const jobIds = jobs.map((job: any) => job.id);
      if (jobIds.length > 0) {
        const jobTags = await db('g_tag_assignments as ta')
          .join('g_tags as t', 'ta.tagId', 't.id')
          .select([
            'ta.entityId as jobId',
            't.id as tagId',
            't.name as tagName',
            't.description as tagDescription',
            't.color as tagColor',
          ])
          .where('ta.entityType', 'job')
          .whereIn('ta.entityId', jobIds);

        // Group tags by job
        const tagsByJobId = jobTags.reduce((acc: any, tag: any) => {
          if (!acc[tag.jobId]) {
            acc[tag.jobId] = [];
          }
          acc[tag.jobId].push({
            id: tag.tagId,
            name: tag.tagName,
            description: tag.tagDescription,
            color: tag.tagColor,
          });
          return acc;
        }, {});

        // Add tag info to jobs
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

  static async findById(
    id: string,
    environmentId: string
  ): Promise<any | null> {
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
          'cu.email as createdByEmail',
          'uu.name as updatedByName',
          'uu.email as updatedByEmail',
        ])
        .where('j.id', id)
        .where('j.environmentId', environmentId)
        .first();

      if (!job) return null;

      // Fetch tag info
      const jobTags = await db('g_tag_assignments as ta')
        .join('g_tags as t', 'ta.tagId', 't.id')
        .select([
          't.id as tagId',
          't.name as tagName',
          't.description as tagDescription',
          't.color as tagColor',
        ])
        .where('ta.entityType', 'job')
        .where('ta.entityId', id);

      const tags = jobTags.map((tag: any) => ({
        id: tag.tagId,
        name: tag.tagName,
        description: tag.tagDescription,
        color: tag.tagColor,
      }));

      return {
        ...job,
        jobDataMap: safeJsonParse(job.jobDataMap),
        retryPolicy: safeJsonParse(job.retryPolicy),
        tags: tags,
      };
    } catch (error) {
      logger.error('Error finding job by ID:', error);
      throw error;
    }
  }

  static async create(jobData: CreateJobData): Promise<any> {
    const trx = await db.transaction();
    try {
      const environmentId = jobData.environmentId;
      const id = generateULID();
      await trx('g_jobs').insert({
        id,
        name: jobData.name,
        memo: jobData.memo,
        jobTypeId: jobData.jobTypeId,
        isEnabled: jobData.isEnabled,
        jobDataMap: safeJsonStringify(jobData.jobDataMap || {}),
        cronExpression: jobData.cronExpression || null,
        triggerAt: jobData.triggerAt || null,
        timezone: jobData.timezone || 'Asia/Seoul',
        retryPolicy: jobData.retryPolicy ? safeJsonStringify(jobData.retryPolicy) : null,
        environmentId: environmentId,
        createdBy: jobData.createdBy,
        updatedBy: jobData.updatedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Link tags
      if (jobData.tagIds && jobData.tagIds.length > 0) {
        const tagAssignments = jobData.tagIds.map((tagId) => ({
          id: generateULID(),
          entityType: 'job',
          entityId: id,
          tagId: tagId,
          createdBy: jobData.createdBy || 1,
          createdAt: new Date(),
        }));
        await trx('g_tag_assignments').insert(tagAssignments);
      }

      await trx.commit();
      return await this.findById(id, environmentId);
    } catch (error) {
      await trx.rollback();
      logger.error('Error creating job:', error);
      throw error;
    }
  }

  static async update(
    id: string,
    jobData: UpdateJobData,
    environmentId: string
  ): Promise<any> {
    const trx = await db.transaction();
    try {
      const updateData: any = {};

      if (jobData.name !== undefined) updateData.name = jobData.name;
      if (jobData.memo !== undefined) updateData.memo = jobData.memo;
      if (jobData.jobTypeId !== undefined)
        updateData.jobTypeId = jobData.jobTypeId;
      if (jobData.isEnabled !== undefined)
        updateData.isEnabled = jobData.isEnabled;
      if (jobData.jobDataMap !== undefined)
        updateData.jobDataMap = safeJsonStringify(jobData.jobDataMap);
      if (jobData.cronExpression !== undefined)
        updateData.cronExpression = jobData.cronExpression;
      if (jobData.triggerAt !== undefined)
        updateData.triggerAt = jobData.triggerAt;
      if (jobData.timezone !== undefined)
        updateData.timezone = jobData.timezone;
      if (jobData.retryPolicy !== undefined)
        updateData.retryPolicy = jobData.retryPolicy ? safeJsonStringify(jobData.retryPolicy) : null;
      if (jobData.updatedBy !== undefined)
        updateData.updatedBy = jobData.updatedBy;
      if (jobData.lastExecutedAt !== undefined)
        updateData.lastExecutedAt = jobData.lastExecutedAt;

      updateData.updatedAt = new Date();

      await trx('g_jobs')
        .where('id', id)
        .where('environmentId', environmentId)
        .update(updateData);

      // Update tags
      if (jobData.tagIds !== undefined) {
        // Delete existing tag links
        await trx('g_tag_assignments')
          .where('entityType', 'job')
          .where('entityId', id)
          .del();

        // Add new tag links
        if (jobData.tagIds.length > 0) {
          const tagAssignments = jobData.tagIds.map((tagId) => ({
            id: generateULID(),
            entityType: 'job',
            entityId: id,
            tagId: tagId,
            createdAt: new Date(),
          }));
          await trx('g_tag_assignments').insert(tagAssignments);
        }
      }

      await trx.commit();
      return await this.findById(id, environmentId);
    } catch (error) {
      await trx.rollback();
      logger.error('Error updating job:', error);
      throw error;
    }
  }

  static async delete(id: string, environmentId: string): Promise<void> {
    const trx = await db.transaction();
    try {
      // Delete tag assignments
      await trx('g_tag_assignments')
        .where('entityType', 'job')
        .where('entityId', id)
        .del();

      // Delete job
      await trx('g_jobs')
        .where('id', id)
        .where('environmentId', environmentId)
        .del();

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      logger.error('Error deleting job:', error);
      throw error;
    }
  }

  static async findByName(
    name: string,
    environmentId: string
  ): Promise<any | null> {
    try {
      const job = await db('g_jobs')
        .where('name', name)
        .where('environmentId', environmentId)
        .first();

      return job || null;
    } catch (error) {
      logger.error('Error finding job by name:', error);
      throw error;
    }
  }
}
