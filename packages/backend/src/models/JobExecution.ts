import db from "../config/knex";
import logger from "../config/logger";

export enum JobExecutionStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  TIMEOUT = "timeout",
  CANCELLED = "cancelled",
}

export interface JobExecutionAttributes {
  id: number;
  jobId: number;
  scheduleId?: number;
  status: JobExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  errorMessage?: string;
  retryAttempt: number;
  executionTimeMs?: number;
  createdAt: string;
  jobName?: string;
  jobTypeName?: string;
  scheduleName?: string;
}

export interface CreateJobExecutionData {
  jobId: number;
  scheduleId?: number;
  status?: JobExecutionStatus;
  retryAttempt?: number;
}

export interface UpdateJobExecutionData {
  status?: JobExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  errorMessage?: string;
  executionTimeMs?: number;
}

export interface JobExecutionFilters {
  jobId?: number;
  scheduleId?: number;
  status?: JobExecutionStatus;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export class JobExecutionModel {
  static async findAll(
    filters?: JobExecutionFilters,
  ): Promise<JobExecutionAttributes[]> {
    try {
      // Convert to knex query builder
      const baseQuery = db("g_job_executions as je")
        .leftJoin("g_jobs as j", "je.jobId", "j.id")
        .leftJoin("g_job_types as jt", "j.jobTypeId", "jt.id")
        .leftJoin("g_schedules as s", "je.scheduleId", "s.id")
        .select([
          "je.*",
          "j.name as jobName",
          "jt.name as jobTypeName",
          "s.name as scheduleName",
        ]);

      // Apply filters
      if (filters?.jobId) {
        baseQuery.where("je.jobId", filters.jobId);
      }
      if (filters?.status) {
        baseQuery.where("je.status", filters.status);
      }
      if (filters?.dateFrom) {
        baseQuery.where("je.createdAt", ">=", filters.dateFrom);
      }
      if (filters?.dateTo) {
        baseQuery.where("je.createdAt", "<=", filters.dateTo);
      }

      const results = await baseQuery
        .orderBy("je.createdAt", "desc")
        .limit(filters?.limit || 50)
        .offset(filters?.offset || 0);
      return results.map((row: any) => ({
        ...row,
        result: row.result ? JSON.parse(row.result) : null,
      }));
    } catch (error) {
      logger.error("Error finding all job executions:", error);
      throw error;
    }
  }

  static async findById(id: number): Promise<JobExecutionAttributes | null> {
    try {
      const results = await db("g_job_executions as je")
        .leftJoin("g_jobs as j", "je.jobId", "j.id")
        .leftJoin("g_job_types as jt", "j.jobTypeId", "jt.id")
        .leftJoin("g_schedules as s", "je.scheduleId", "s.id")
        .select([
          "je.*",
          "j.name as jobName",
          "jt.name as jobTypeName",
          "s.name as scheduleName",
        ])
        .where("je.id", id);
      if (results.length === 0) return null;

      const row = results[0];
      return {
        ...row,
        result: row.result ? JSON.parse(row.result) : null,
      };
    } catch (error) {
      logger.error("Error finding job execution by id:", error);
      throw error;
    }
  }

  static async create(
    data: CreateJobExecutionData,
  ): Promise<JobExecutionAttributes> {
    try {
      const [insertId] = await db("g_job_executions").insert({
        jobId: data.jobId,
        scheduleId: data.scheduleId || null,
        status: data.status || JobExecutionStatus.PENDING,
        retryAttempt: data.retryAttempt || 0,
      });

      const created = await this.findById(insertId);
      if (!created) {
        throw new Error("Failed to retrieve created job execution");
      }

      return created;
    } catch (error) {
      logger.error("Error creating job execution:", error);
      throw error;
    }
  }

  static async update(
    id: number,
    data: UpdateJobExecutionData,
  ): Promise<JobExecutionAttributes> {
    try {
      const updateData: any = {};

      if (data.status !== undefined) {
        updateData.status = data.status;
      }
      if (data.startedAt !== undefined) {
        updateData.startedAt = data.startedAt;
      }
      if (data.completedAt !== undefined) {
        updateData.completedAt = data.completedAt;
      }
      if (data.result !== undefined) {
        updateData.result = data.result ? JSON.stringify(data.result) : null;
      }
      if (data.errorMessage !== undefined) {
        updateData.errorMessage = data.errorMessage;
      }
      if (data.executionTimeMs !== undefined) {
        updateData.executionTimeMs = data.executionTimeMs;
      }

      if (Object.keys(updateData).length === 0) {
        const existing = await this.findById(id);
        if (!existing) {
          throw new Error("Job execution not found");
        }
        return existing;
      }

      updateData.updatedAt = db.fn.now();

      await db("g_job_executions").where("id", id).update(updateData);

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error("Job execution not found after update");
      }

      return updated;
    } catch (error) {
      logger.error("Error updating job execution:", error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const result = await db("g_job_executions").where("id", id).del();

      return result > 0;
    } catch (error) {
      logger.error("Error deleting job execution:", error);
      throw error;
    }
  }

  static async findByJob(
    jobId: number,
    limit?: number,
  ): Promise<JobExecutionAttributes[]> {
    try {
      return await this.findAll({ jobId, limit });
    } catch (error) {
      logger.error("Error finding job executions by job:", error);
      throw error;
    }
  }

  static async findBySchedule(
    scheduleId: number,
    limit?: number,
  ): Promise<JobExecutionAttributes[]> {
    try {
      return await this.findAll({ scheduleId, limit });
    } catch (error) {
      logger.error("Error finding job executions by schedule:", error);
      throw error;
    }
  }

  static async findRunning(): Promise<JobExecutionAttributes[]> {
    try {
      return await this.findAll({ status: JobExecutionStatus.RUNNING });
    } catch (error) {
      logger.error("Error finding running job executions:", error);
      throw error;
    }
  }

  static async getStatistics(dateFrom?: string, dateTo?: string): Promise<any> {
    try {
      const results = await db("g_job_executions")
        .select([
          "status",
          db.raw("COUNT(*) as count"),
          db.raw("AVG(executionTimeMs) as avgExecutionTime"),
          db.raw("MAX(executionTimeMs) as maxExecutionTime"),
          db.raw("MIN(executionTimeMs) as minExecutionTime"),
        ])
        .modify((query) => {
          if (dateFrom) {
            query.where("createdAt", ">=", dateFrom);
          }
          if (dateTo) {
            query.where("createdAt", "<=", dateTo);
          }
        })
        .groupBy("status");
      return results;
    } catch (error) {
      logger.error("Error getting job execution statistics:", error);
      throw error;
    }
  }
}
