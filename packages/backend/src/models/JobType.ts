import db from '../config/knex';
import logger from '../config/logger';

export interface JobTypeAttributes {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  schemaDefinition?: any;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
  updatedBy?: number;
  createdByName?: string;
  updatedByName?: string;
}

export interface CreateJobTypeData {
  name: string;
  displayName: string;
  description?: string;
  schemaDefinition?: any;
  isEnabled?: boolean;
  createdBy?: number;
}

export interface UpdateJobTypeData {
  displayName?: string;
  description?: string;
  schemaDefinition?: any;
  isEnabled?: boolean;
  updatedBy?: number;
}

export class JobTypeModel {
  // 안전한 JSON 파싱 메서드
  private static parseSchemaDefinition(value: any): any {
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
        logger.error('Failed to parse schemaDefinition JSON:', { value, error });
        return null;
      }
    }

    return null;
  }

  static async findAll(): Promise<JobTypeAttributes[]> {
    try {
      const results = await db('g_job_types as jt')
        .leftJoin('g_users as cu', 'jt.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'jt.updatedBy', 'uu.id')
        .select([
          'jt.*',
          'cu.name as createdByName',
          'uu.name as updatedByName'
        ])
        .orderBy('jt.name', 'asc');

      return results.map((row: any) => ({
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        description: row.description,
        schemaDefinition: row.schema ? this.parseSchemaDefinition(row.schema) : null,
        isEnabled: Boolean(row.isActive),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        createdByName: row.createdByName,
        updatedByName: row.updatedByName
      }));
    } catch (error) {
      logger.error('Error finding all job types:', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<JobTypeAttributes | null> {
    try {
      const row = await db('g_job_types as jt')
        .leftJoin('g_users as cu', 'jt.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'jt.updatedBy', 'uu.id')
        .select([
          'jt.*',
          'cu.name as createdByName',
          'uu.name as updatedByName'
        ])
        .where('jt.id', id)
        .first();

      if (!row) return null;

      return {
        ...row,
        schemaDefinition: row.schemaDefinition ? this.parseSchemaDefinition(row.schemaDefinition) : null
      };
    } catch (error) {
      logger.error('Error finding job type by id:', error);
      throw error;
    }
  }

  static async findByName(name: string): Promise<JobTypeAttributes | null> {
    try {
      const row = await db('g_job_types as jt')
        .leftJoin('g_users as cu', 'jt.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'jt.updatedBy', 'uu.id')
        .select([
          'jt.*',
          'cu.name as createdByName',
          'uu.name as updatedByName'
        ])
        .where('jt.name', name)
        .first();

      if (!row) return null;

      return {
        ...row,
        schemaDefinition: row.schemaDefinition ? this.parseSchemaDefinition(row.schemaDefinition) : null
      };
    } catch (error) {
      logger.error('Error finding job type by name:', error);
      throw error;
    }
  }

  static async create(data: CreateJobTypeData): Promise<JobTypeAttributes> {
    try {
      const schemaJson = data.schemaDefinition ? JSON.stringify(data.schemaDefinition) : null;

      const [insertId] = await db('g_job_types').insert({
        name: data.name,
        displayName: data.displayName,
        description: data.description || null,
        schema: schemaJson,
        isActive: data.isEnabled ?? true,
        createdBy: data.createdBy || null
      });

      const created = await this.findById(insertId);
      if (!created) {
        throw new Error('Failed to retrieve created job type');
      }

      return created;
    } catch (error) {
      logger.error('Error creating job type:', error);
      throw error;
    }
  }

  static async update(id: number, data: UpdateJobTypeData): Promise<JobTypeAttributes> {
    try {

      const updateData: any = {};

      if (data.displayName !== undefined) {
        updateData.displayName = data.displayName;
      }
      if (data.description !== undefined) {
        updateData.description = data.description;
      }
      if (data.schemaDefinition !== undefined) {
        updateData.schema = data.schemaDefinition ? JSON.stringify(data.schemaDefinition) : null;
      }
      if (data.isEnabled !== undefined) {
        updateData.isActive = data.isEnabled;
      }
      if (data.updatedBy !== undefined) {
        updateData.updatedBy = data.updatedBy;
      }

      updateData.updatedAt = db.fn.now();

      await db('g_job_types')
        .where('id', id)
        .update(updateData);
      
      const updated = await this.findById(id);
      if (!updated) {
        throw new Error('Job type not found after update');
      }
      
      return updated;
    } catch (error) {
      logger.error('Error updating job type:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const result = await db('g_job_types')
        .where('id', id)
        .del();

      return result > 0;
    } catch (error) {
      logger.error('Error deleting job type:', error);
      throw error;
    }
  }

  static async findEnabled(): Promise<JobTypeAttributes[]> {
    try {
      const results = await db('g_job_types as jt')
        .leftJoin('g_users as cu', 'jt.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'jt.updatedBy', 'uu.id')
        .select([
          'jt.*',
          'cu.name as createdByName',
          'uu.name as updatedByName'
        ])
        .where('jt.isEnabled', true)
        .orderBy('jt.name', 'asc');

      return results.map((row: any) => ({
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        description: row.description,
        schemaDefinition: row.schema ? this.parseSchemaDefinition(row.schema) : null,
        isEnabled: Boolean(row.isActive),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        createdByName: row.createdByName,
        updatedByName: row.updatedByName
      }));
    } catch (error) {
      logger.error('Error finding enabled job types:', error);
      throw error;
    }
  }
}
