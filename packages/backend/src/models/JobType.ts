import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import logger from '../config/logger';
import { getCurrentEnvironment } from '../utils/environmentContext';

export interface JobTypeAttributes {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  jobSchema?: any;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface CreateJobTypeData {
  name: string;
  displayName: string;
  description?: string;
  jobSchema?: any;
  isEnabled?: boolean;
  createdBy?: string;
}

export interface UpdateJobTypeData {
  displayName?: string;
  description?: string;
  jobSchema?: any;
  isEnabled?: boolean;
  updatedBy?: string;
}

export class JobTypeModel {
  // 안전한 JSON 파싱 메서드
  private static parseJobSchema(value: any): any {
    if (!value) return null;

    // 이미 객체인 경우 그대로 반환
    if (typeof value === 'object') {
      return value;
    }

    // 문자열인 경우 JSON 파싱 시도
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        logger.error('Failed to parse jobSchema JSON:', { value, error });
        return null;
      }
    }

    return null;
  }

  static async findAll(environmentId?: string): Promise<JobTypeAttributes[]> {
    try {
      const envName = environmentId ?? getCurrentEnvironment();
      const results = await db('g_job_types as jt')
        .leftJoin('g_users as cu', 'jt.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'jt.updatedBy', 'uu.id')
        .select(['jt.*', 'cu.name as createdByName', 'uu.name as updatedByName'])
        .where('jt.environmentId', envName)
        .orderBy('jt.name', 'asc');

      return results.map((row: any) => ({
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        description: row.description,
        jobSchema: row.jobSchema ? this.parseJobSchema(row.jobSchema) : null,
        isEnabled: Boolean(row.isActive),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        createdByName: row.createdByName,
        updatedByName: row.updatedByName,
      }));
    } catch (error) {
      logger.error('Error finding all job types:', error);
      throw error;
    }
  }

  static async findById(id: string, environmentId?: string): Promise<JobTypeAttributes | null> {
    try {
      const envName = environmentId ?? getCurrentEnvironment();
      const row = await db('g_job_types as jt')
        .leftJoin('g_users as cu', 'jt.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'jt.updatedBy', 'uu.id')
        .select(['jt.*', 'cu.name as createdByName', 'uu.name as updatedByName'])
        .where('jt.id', id)
        .where('jt.environmentId', envName)
        .first();

      if (!row) return null;

      return {
        ...row,
        jobSchema: row.jobSchema ? this.parseJobSchema(row.jobSchema) : null,
      };
    } catch (error) {
      logger.error('Error finding job type by id:', error);
      throw error;
    }
  }

  static async findByName(name: string, environmentId?: string): Promise<JobTypeAttributes | null> {
    try {
      const envName = environmentId ?? getCurrentEnvironment();
      const row = await db('g_job_types as jt')
        .leftJoin('g_users as uu', 'jt.updatedBy', 'uu.id')
        .select(['jt.*', 'cu.name as createdByName', 'uu.name as updatedByName'])
        .where('jt.name', name)
        .where('jt.environmentId', envName)
        .first();

      if (!row) return null;

      return {
        ...row,
        isEnabled: Boolean(row.isActive),
        jobSchema: row.jobSchema ? this.parseJobSchema(row.jobSchema) : null,
      };
    } catch (error) {
      logger.error('Error finding job type by name:', error);
      throw error;
    }
  }

  static async create(data: CreateJobTypeData): Promise<JobTypeAttributes> {
    try {
      const envName = getCurrentEnvironment();
      const schemaJson = data.jobSchema ? JSON.stringify(data.jobSchema) : null;

      const id = generateULID();

      await db('g_job_types').insert({
        id,
        environmentId: envName,
        name: data.name,
        displayName: data.displayName,
        description: data.description || null,
        jobSchema: schemaJson,
        isActive: data.isEnabled ?? true,
        createdBy: data.createdBy || null,
      });

      const created = await this.findById(id, envName);
      if (!created) {
        throw new Error('Failed to retrieve created job type');
      }

      return created;
    } catch (error) {
      logger.error('Error creating job type:', error);
      throw error;
    }
  }

  static async update(
    id: string,
    data: UpdateJobTypeData,
    environmentId?: string
  ): Promise<JobTypeAttributes> {
    try {
      const envName = environmentId ?? getCurrentEnvironment();
      const updateData: any = {};

      if (data.displayName !== undefined) updateData.displayName = data.displayName;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.jobSchema !== undefined)
        updateData.jobSchema = data.jobSchema ? JSON.stringify(data.jobSchema) : null;
      if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
      if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

      updateData.updatedAt = db.fn.now();

      await db('g_job_types').where('id', id).where('environmentId', envName).update(updateData);

      const updated = await this.findById(id, envName);
      if (!updated) {
        throw new Error('Job type not found after update');
      }

      return updated;
    } catch (error) {
      logger.error('Error updating job type:', error);
      throw error;
    }
  }

  static async delete(id: string, environmentId?: string): Promise<boolean> {
    try {
      const envName = environmentId ?? getCurrentEnvironment();
      const result = await db('g_job_types').where('id', id).where('environmentId', envName).del();

      return result > 0;
    } catch (error) {
      logger.error('Error deleting job type:', error);
      throw error;
    }
  }

  static async findEnabled(environmentId?: string): Promise<JobTypeAttributes[]> {
    try {
      const envName = environmentId ?? getCurrentEnvironment();
      const results = await db('g_job_types as jt')
        .leftJoin('g_users as uu', 'jt.updatedBy', 'uu.id')
        .select(['jt.*', 'cu.name as createdByName', 'uu.name as updatedByName'])
        .where('jt.environmentId', envName)
        .where('jt.isEnabled', true)
        .orderBy('jt.name', 'asc');

      return results.map((row: any) => ({
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        description: row.description,
        jobSchema: row.jobSchema ? this.parseJobSchema(row.jobSchema) : null,
        isEnabled: Boolean(row.isEnabled),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        createdByName: row.createdByName,
        updatedByName: row.updatedByName,
      }));
    } catch (error) {
      logger.error('Error finding enabled job types:', error);
      throw error;
    }
  }
}
