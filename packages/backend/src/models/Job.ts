import Database from '../config/database';
import logger from '../config/logger';
import TagAssignmentModel from './TagAssignment';

// 안전한 JSON 파싱 함수
const safeJsonParse = (value: any): any => {
  if (value === null || value === undefined) {
    return null;
  }

  // 이미 객체인 경우 그대로 반환
  if (typeof value === 'object') {
    return value;
  }

  // 문자열인 경우에만 JSON.parse 시도
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      logger.warn('Failed to parse JSON string:', value);
      return null;
    }
  }

  return value;
};

export interface JobAttributes {
  id: number;
  name: string;
  job_type_id: number;
  job_data_map?: any;
  description?: string;
  memo?: string;
  is_enabled: boolean;
  retry_count: number;
  max_retry_count: number;
  timeout_seconds: number;
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
  job_type_name?: string;
  job_type_display_name?: string;
}

export interface CreateJobData {
  name: string;
  job_type_id: number;
  job_data_map?: any;
  description?: string;
  memo?: string;
  is_enabled?: boolean;
  retry_count?: number;
  max_retry_count?: number;
  timeout_seconds?: number;
  created_by?: number;
}

export interface UpdateJobData {
  name?: string;
  job_data_map?: any;
  description?: string;
  memo?: string;
  is_enabled?: boolean;
  retry_count?: number;
  max_retry_count?: number;
  timeout_seconds?: number;
  updated_by?: number;
}

export interface JobFilters {
  job_type_id?: number;
  is_enabled?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface JobListResult {
  jobs: JobAttributes[];
  total: number;
}

export class JobModel {
  static async findAll(filters?: JobFilters): Promise<JobAttributes[]> {
    try {
      let query = `
        SELECT 
          j.*,
          jt.name as job_type_name,
          jt.display_name as job_type_display_name,
          cu.name as created_by_name,
          uu.name as updated_by_name
        FROM g_jobs j
        LEFT JOIN g_job_types jt ON j.job_type_id = jt.id
        LEFT JOIN g_users cu ON j.created_by = cu.id
        LEFT JOIN g_users uu ON j.updated_by = uu.id
      `;
      
      const conditions: string[] = [];
      const values: any[] = [];
      
      if (filters?.job_type_id) {
        conditions.push('j.job_type_id = ?');
        values.push(filters.job_type_id);
      }
      
      if (filters?.is_enabled !== undefined) {
        conditions.push('j.is_enabled = ?');
        values.push(filters.is_enabled);
      }
      
      if (filters?.search) {
        conditions.push('(j.name LIKE ? OR j.description LIKE ? OR j.memo LIKE ?)');
        const searchTerm = `%${filters.search}%`;
        values.push(searchTerm, searchTerm, searchTerm);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY j.created_at DESC';
      
      const results = await Database.query(query, values);
      return results.map((row: any) => ({
        ...row,
        job_data_map: safeJsonParse(row.job_data_map)
      }));
    } catch (error) {
      logger.error('Error finding all jobs:', error);
      throw error;
    }
  }

  static async findAllWithPagination(filters?: JobFilters): Promise<JobListResult> {
    try {
      // 기본값 설정
      const limit = filters?.limit ? parseInt(filters.limit.toString(), 10) : 20;
      const offset = filters?.offset ? parseInt(filters.offset.toString(), 10) : 0;

      // Count query for total
      let countQuery = `
        SELECT COUNT(*) as total
        FROM g_jobs j
        LEFT JOIN g_job_types jt ON j.job_type_id = jt.id
      `;

      // Data query
      let dataQuery = `
        SELECT
          j.*,
          jt.name as job_type_name,
          jt.display_name as job_type_display_name,
          cu.name as created_by_name,
          uu.name as updated_by_name
        FROM g_jobs j
        LEFT JOIN g_job_types jt ON j.job_type_id = jt.id
        LEFT JOIN g_users cu ON j.created_by = cu.id
        LEFT JOIN g_users uu ON j.updated_by = uu.id
      `;

      const conditions: string[] = [];
      const values: any[] = [];

      if (filters?.job_type_id) {
        conditions.push('j.job_type_id = ?');
        values.push(filters.job_type_id);
      }

      if (filters?.is_enabled !== undefined) {
        conditions.push('j.is_enabled = ?');
        values.push(filters.is_enabled);
      }

      if (filters?.search) {
        conditions.push('(j.name LIKE ? OR j.description LIKE ? OR j.memo LIKE ?)');
        const searchTerm = `%${filters.search}%`;
        values.push(searchTerm, searchTerm, searchTerm);
      }

      if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        countQuery += whereClause;
        dataQuery += whereClause;
      }

      dataQuery += ` ORDER BY j.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      // Execute both queries
      const [countResults, dataResults] = await Promise.all([
        Database.query(countQuery, values),
        Database.query(dataQuery, values)
      ]);

      const total = countResults[0]?.total || 0;
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

  static async findById(id: number): Promise<JobAttributes | null> {
    try {
      const query = `
        SELECT 
          j.*,
          jt.name as job_type_name,
          jt.display_name as job_type_display_name,
          cu.name as created_by_name,
          uu.name as updated_by_name
        FROM g_jobs j
        LEFT JOIN g_job_types jt ON j.job_type_id = jt.id
        LEFT JOIN g_users cu ON j.created_by = cu.id
        LEFT JOIN g_users uu ON j.updated_by = uu.id
        WHERE j.id = ?
      `;
      
      const results = await Database.query(query, [id]);
      if (results.length === 0) return null;
      
      const row = results[0];
      return {
        ...row,
        job_data_map: safeJsonParse(row.job_data_map)
      };
    } catch (error) {
      logger.error('Error finding job by id:', error);
      throw error;
    }
  }

  static async create(data: CreateJobData): Promise<JobAttributes> {
    try {
      const query = `
        INSERT INTO g_jobs (
          name, job_type_id, job_data_map, description, memo, 
          is_enabled, retry_count, max_retry_count, timeout_seconds, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const jobDataJson = data.job_data_map ? JSON.stringify(data.job_data_map) : null;
      const result = await Database.query(query, [
        data.name,
        data.job_type_id,
        jobDataJson,
        data.description || null,
        data.memo || null,
        data.is_enabled ?? true,
        data.retry_count ?? 0,
        data.max_retry_count ?? 3,
        data.timeout_seconds ?? 300,
        data.created_by || null
      ]);
      
      const insertId = (result as any).insertId;
      const created = await this.findById(insertId);
      if (!created) {
        throw new Error('Failed to retrieve created job');
      }
      
      return created;
    } catch (error) {
      logger.error('Error creating job:', error);
      throw error;
    }
  }

  static async update(id: number, data: UpdateJobData): Promise<JobAttributes> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      
      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }
      
      if (data.job_data_map !== undefined) {
        updates.push('job_data_map = ?');
        values.push(data.job_data_map ? JSON.stringify(data.job_data_map) : null);
      }
      
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description);
      }
      
      if (data.memo !== undefined) {
        updates.push('memo = ?');
        values.push(data.memo);
      }
      
      if (data.is_enabled !== undefined) {
        updates.push('is_enabled = ?');
        values.push(data.is_enabled);
      }
      
      if (data.retry_count !== undefined) {
        updates.push('retry_count = ?');
        values.push(data.retry_count);
      }
      
      if (data.max_retry_count !== undefined) {
        updates.push('max_retry_count = ?');
        values.push(data.max_retry_count);
      }
      
      if (data.timeout_seconds !== undefined) {
        updates.push('timeout_seconds = ?');
        values.push(data.timeout_seconds);
      }
      
      if (data.updated_by !== undefined) {
        updates.push('updated_by = ?');
        values.push(data.updated_by);
      }
      
      if (updates.length === 0) {
        throw new Error('No fields to update');
      }
      
      values.push(id);
      const query = `UPDATE g_jobs SET ${updates.join(', ')} WHERE id = ?`;
      
      await Database.query(query, values);
      
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error('Job not found after update');
      }
      
      return updated;
    } catch (error) {
      logger.error('Error updating job:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const query = 'DELETE FROM g_jobs WHERE id = ?';
      const result = await Database.query(query, [id]);
      return (result as any).affectedRows > 0;
    } catch (error) {
      logger.error('Error deleting job:', error);
      throw error;
    }
  }

  static async findByName(name: string, excludeId?: number): Promise<JobAttributes | null> {
    try {
      let query = 'SELECT * FROM g_jobs WHERE name = ?';
      const values: any[] = [name];

      if (excludeId) {
        query += ' AND id != ?';
        values.push(excludeId);
      }

      const results = await Database.query(query, values);
      if (results.length === 0) return null;

      const row = results[0];
      return {
        ...row,
        job_data_map: safeJsonParse(row.job_data_map)
      };
    } catch (error) {
      logger.error('Error finding job by name:', error);
      throw error;
    }
  }

  static async findByJobType(jobTypeId: number): Promise<JobAttributes[]> {
    try {
      return await this.findAll({ job_type_id: jobTypeId });
    } catch (error) {
      logger.error('Error finding jobs by job type:', error);
      throw error;
    }
  }

  static async findEnabled(): Promise<JobAttributes[]> {
    try {
      return await this.findAll({ is_enabled: true });
    } catch (error) {
      logger.error('Error finding enabled jobs:', error);
      throw error;
    }
  }

  // 태그 관련 메서드들
  static async setTags(jobId: number, tagIds: number[]): Promise<void> {
    await TagAssignmentModel.setTagsForEntity('job', jobId, tagIds);
  }

  static async getTags(jobId: number): Promise<any[]> {
    return await TagAssignmentModel.listTagsForEntity('job', jobId);
  }
}
