import Database from '../config/database';
import logger from '../config/logger';

export enum JobExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled'
}

export interface JobExecutionAttributes {
  id: number;
  job_id: number;
  schedule_id?: number;
  status: JobExecutionStatus;
  started_at?: string;
  completed_at?: string;
  result?: any;
  error_message?: string;
  retry_attempt: number;
  execution_time_ms?: number;
  created_at: string;
  job_name?: string;
  job_type_name?: string;
  schedule_name?: string;
}

export interface CreateJobExecutionData {
  job_id: number;
  schedule_id?: number;
  status?: JobExecutionStatus;
  retry_attempt?: number;
}

export interface UpdateJobExecutionData {
  status?: JobExecutionStatus;
  started_at?: string;
  completed_at?: string;
  result?: any;
  error_message?: string;
  execution_time_ms?: number;
}

export interface JobExecutionFilters {
  job_id?: number;
  schedule_id?: number;
  status?: JobExecutionStatus;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export class JobExecutionModel {
  static async findAll(filters?: JobExecutionFilters): Promise<JobExecutionAttributes[]> {
    try {
      let query = `
        SELECT 
          je.*,
          j.name as job_name,
          jt.name as job_type_name,
          s.name as schedule_name
        FROM g_job_executions je
        LEFT JOIN g_jobs j ON je.job_id = j.id
        LEFT JOIN g_job_types jt ON j.job_type_id = jt.id
        LEFT JOIN g_schedules s ON je.schedule_id = s.id
      `;
      
      const conditions: string[] = [];
      const values: any[] = [];
      
      if (filters?.job_id) {
        conditions.push('je.job_id = ?');
        values.push(filters.job_id);
      }
      
      if (filters?.schedule_id) {
        conditions.push('je.schedule_id = ?');
        values.push(filters.schedule_id);
      }
      
      if (filters?.status) {
        conditions.push('je.status = ?');
        values.push(filters.status);
      }
      
      if (filters?.date_from) {
        conditions.push('je.created_at >= ?');
        values.push(filters.date_from);
      }
      
      if (filters?.date_to) {
        conditions.push('je.created_at <= ?');
        values.push(filters.date_to);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY je.created_at DESC';
      
      if (filters?.limit) {
        query += ' LIMIT ?';
        values.push(filters.limit);
        
        if (filters?.offset) {
          query += ' OFFSET ?';
          values.push(filters.offset);
        }
      }
      
      const results = await Database.query(query, values);
      return results.map((row: any) => ({
        ...row,
        result: row.result ? JSON.parse(row.result) : null
      }));
    } catch (error) {
      logger.error('Error finding all job executions:', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<JobExecutionAttributes | null> {
    try {
      const query = `
        SELECT 
          je.*,
          j.name as job_name,
          jt.name as job_type_name,
          s.name as schedule_name
        FROM g_job_executions je
        LEFT JOIN g_jobs j ON je.job_id = j.id
        LEFT JOIN g_job_types jt ON j.job_type_id = jt.id
        LEFT JOIN g_schedules s ON je.schedule_id = s.id
        WHERE je.id = ?
      `;
      
      const results = await Database.query(query, [id]);
      if (results.length === 0) return null;
      
      const row = results[0];
      return {
        ...row,
        result: row.result ? JSON.parse(row.result) : null
      };
    } catch (error) {
      logger.error('Error finding job execution by id:', error);
      throw error;
    }
  }

  static async create(data: CreateJobExecutionData): Promise<JobExecutionAttributes> {
    try {
      const query = `
        INSERT INTO g_job_executions (job_id, schedule_id, status, retry_attempt)
        VALUES (?, ?, ?, ?)
      `;
      
      const result = await Database.query(query, [
        data.job_id,
        data.schedule_id || null,
        data.status || JobExecutionStatus.PENDING,
        data.retry_attempt || 0
      ]);
      
      const insertId = (result as any).insertId;
      const created = await this.findById(insertId);
      if (!created) {
        throw new Error('Failed to retrieve created job execution');
      }
      
      return created;
    } catch (error) {
      logger.error('Error creating job execution:', error);
      throw error;
    }
  }

  static async update(id: number, data: UpdateJobExecutionData): Promise<JobExecutionAttributes> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      
      if (data.status !== undefined) {
        updates.push('status = ?');
        values.push(data.status);
      }
      
      if (data.started_at !== undefined) {
        updates.push('started_at = ?');
        values.push(data.started_at);
      }
      
      if (data.completed_at !== undefined) {
        updates.push('completed_at = ?');
        values.push(data.completed_at);
      }
      
      if (data.result !== undefined) {
        updates.push('result = ?');
        values.push(data.result ? JSON.stringify(data.result) : null);
      }
      
      if (data.error_message !== undefined) {
        updates.push('error_message = ?');
        values.push(data.error_message);
      }
      
      if (data.execution_time_ms !== undefined) {
        updates.push('execution_time_ms = ?');
        values.push(data.execution_time_ms);
      }
      
      if (updates.length === 0) {
        throw new Error('No fields to update');
      }
      
      values.push(id);
      const query = `UPDATE g_job_executions SET ${updates.join(', ')} WHERE id = ?`;
      
      await Database.query(query, values);
      
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error('Job execution not found after update');
      }
      
      return updated;
    } catch (error) {
      logger.error('Error updating job execution:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const query = 'DELETE FROM g_job_executions WHERE id = ?';
      const result = await Database.query(query, [id]);
      return (result as any).affectedRows > 0;
    } catch (error) {
      logger.error('Error deleting job execution:', error);
      throw error;
    }
  }

  static async findByJob(jobId: number, limit?: number): Promise<JobExecutionAttributes[]> {
    try {
      return await this.findAll({ job_id: jobId, limit });
    } catch (error) {
      logger.error('Error finding job executions by job:', error);
      throw error;
    }
  }

  static async findBySchedule(scheduleId: number, limit?: number): Promise<JobExecutionAttributes[]> {
    try {
      return await this.findAll({ schedule_id: scheduleId, limit });
    } catch (error) {
      logger.error('Error finding job executions by schedule:', error);
      throw error;
    }
  }

  static async findRunning(): Promise<JobExecutionAttributes[]> {
    try {
      return await this.findAll({ status: JobExecutionStatus.RUNNING });
    } catch (error) {
      logger.error('Error finding running job executions:', error);
      throw error;
    }
  }

  static async getStatistics(dateFrom?: string, dateTo?: string): Promise<any> {
    try {
      let query = `
        SELECT 
          status,
          COUNT(*) as count,
          AVG(execution_time_ms) as avg_execution_time,
          MAX(execution_time_ms) as max_execution_time,
          MIN(execution_time_ms) as min_execution_time
        FROM g_job_executions
      `;
      
      const conditions: string[] = [];
      const values: any[] = [];
      
      if (dateFrom) {
        conditions.push('created_at >= ?');
        values.push(dateFrom);
      }
      
      if (dateTo) {
        conditions.push('created_at <= ?');
        values.push(dateTo);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' GROUP BY status';
      
      const results = await Database.query(query, values);
      return results;
    } catch (error) {
      logger.error('Error getting job execution statistics:', error);
      throw error;
    }
  }
}
