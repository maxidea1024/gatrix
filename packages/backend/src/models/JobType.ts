import Database from '../config/database';
import logger from '../config/logger';

export interface JobTypeAttributes {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  schema_definition?: any;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface CreateJobTypeData {
  name: string;
  display_name: string;
  description?: string;
  schema_definition?: any;
  is_enabled?: boolean;
  created_by?: number;
}

export interface UpdateJobTypeData {
  display_name?: string;
  description?: string;
  schema_definition?: any;
  is_enabled?: boolean;
  updated_by?: number;
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
        logger.error('Failed to parse schema_definition JSON:', { value, error });
        return null;
      }
    }

    return null;
  }

  static async findAll(): Promise<JobTypeAttributes[]> {
    try {
      const query = `
        SELECT 
          jt.*,
          cu.name as created_by_name,
          uu.name as updated_by_name
        FROM g_job_types jt
        LEFT JOIN g_users cu ON jt.created_by = cu.id
        LEFT JOIN g_users uu ON jt.updated_by = uu.id
        ORDER BY jt.name ASC
      `;
      
      const results = await Database.query(query);
      return results.map((row: any) => ({
        ...row,
        schema_definition: row.schema_definition ? this.parseSchemaDefinition(row.schema_definition) : null
      }));
    } catch (error) {
      logger.error('Error finding all job types:', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<JobTypeAttributes | null> {
    try {
      const query = `
        SELECT 
          jt.*,
          cu.name as created_by_name,
          uu.name as updated_by_name
        FROM g_job_types jt
        LEFT JOIN g_users cu ON jt.created_by = cu.id
        LEFT JOIN g_users uu ON jt.updated_by = uu.id
        WHERE jt.id = ?
      `;
      
      const results = await Database.query(query, [id]);
      if (results.length === 0) return null;
      
      const row = results[0];
      return {
        ...row,
        schema_definition: row.schema_definition ? this.parseSchemaDefinition(row.schema_definition) : null
      };
    } catch (error) {
      logger.error('Error finding job type by id:', error);
      throw error;
    }
  }

  static async findByName(name: string): Promise<JobTypeAttributes | null> {
    try {
      const query = `
        SELECT 
          jt.*,
          cu.name as created_by_name,
          uu.name as updated_by_name
        FROM g_job_types jt
        LEFT JOIN g_users cu ON jt.created_by = cu.id
        LEFT JOIN g_users uu ON jt.updated_by = uu.id
        WHERE jt.name = ?
      `;
      
      const results = await Database.query(query, [name]);
      if (results.length === 0) return null;
      
      const row = results[0];
      return {
        ...row,
        schema_definition: row.schema_definition ? this.parseSchemaDefinition(row.schema_definition) : null
      };
    } catch (error) {
      logger.error('Error finding job type by name:', error);
      throw error;
    }
  }

  static async create(data: CreateJobTypeData): Promise<JobTypeAttributes> {
    try {
      const query = `
        INSERT INTO g_job_types (name, display_name, description, schema_definition, is_enabled, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const schemaJson = data.schema_definition ? JSON.stringify(data.schema_definition) : null;
      const result = await Database.query(query, [
        data.name,
        data.display_name,
        data.description || null,
        schemaJson,
        data.is_enabled ?? true,
        data.created_by || null
      ]);
      
      const insertId = (result as any).insertId;
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
      const updates: string[] = [];
      const values: any[] = [];
      
      if (data.display_name !== undefined) {
        updates.push('display_name = ?');
        values.push(data.display_name);
      }
      
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description);
      }
      
      if (data.schema_definition !== undefined) {
        updates.push('schema_definition = ?');
        values.push(data.schema_definition ? JSON.stringify(data.schema_definition) : null);
      }
      
      if (data.is_enabled !== undefined) {
        updates.push('is_enabled = ?');
        values.push(data.is_enabled);
      }
      
      if (data.updated_by !== undefined) {
        updates.push('updated_by = ?');
        values.push(data.updated_by);
      }
      
      if (updates.length === 0) {
        throw new Error('No fields to update');
      }
      
      values.push(id);
      const query = `UPDATE g_job_types SET ${updates.join(', ')} WHERE id = ?`;
      
      await Database.query(query, values);
      
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
      const query = 'DELETE FROM g_job_types WHERE id = ?';
      const result = await Database.query(query, [id]);
      return (result as any).affectedRows > 0;
    } catch (error) {
      logger.error('Error deleting job type:', error);
      throw error;
    }
  }

  static async findEnabled(): Promise<JobTypeAttributes[]> {
    try {
      const query = `
        SELECT 
          jt.*,
          cu.name as created_by_name,
          uu.name as updated_by_name
        FROM g_job_types jt
        LEFT JOIN g_users cu ON jt.created_by = cu.id
        LEFT JOIN g_users uu ON jt.updated_by = uu.id
        WHERE jt.is_enabled = true
        ORDER BY jt.name ASC
      `;
      
      const results = await Database.query(query);
      return results.map((row: any) => ({
        ...row,
        schema_definition: row.schema_definition ? this.parseSchemaDefinition(row.schema_definition) : null
      }));
    } catch (error) {
      logger.error('Error finding enabled job types:', error);
      throw error;
    }
  }
}
