import db from '../config/knex';
import logger from '../config/logger';

export interface ContextFieldOption {
  value: string | number;
  label: string;
  description?: string;
}

export interface ContextFieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
}

export interface ContextField {
  id: number;
  key: string;
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  options?: ContextFieldOption[];
  defaultValue?: string;
  validation?: ContextFieldValidation;
  isActive: boolean;
  isSystem: boolean;
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContextFieldData {
  key: string;
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  options?: ContextFieldOption[];
  defaultValue?: string;
  validation?: ContextFieldValidation;
  isActive?: boolean;
  isSystem?: boolean;
  createdBy?: number;
  updatedBy?: number;
}

export interface UpdateContextFieldData {
  name?: string;
  description?: string;
  options?: ContextFieldOption[];
  defaultValue?: string;
  validation?: ContextFieldValidation;
  isActive?: boolean;
  updatedBy?: number;
}

export class ContextFieldModel {
  static async findAll(filters?: {
    search?: string;
    type?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ fields: ContextField[]; total: number }> {
    try {
      let query = db('g_remote_config_context_fields')
        .leftJoin('g_users as creator', 'g_remote_config_context_fields.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'g_remote_config_context_fields.updatedBy', 'updater.id')
        .select([
          'g_remote_config_context_fields.*',
          'creator.name as creatorName',
          'updater.name as updaterName'
        ])
        .orderBy('g_remote_config_context_fields.createdAt', 'desc');

      // Apply filters
      if (filters?.search) {
        query = query.where(function() {
          this.where('g_remote_config_context_fields.key', 'like', `%${filters.search}%`)
            .orWhere('g_remote_config_context_fields.name', 'like', `%${filters.search}%`)
            .orWhere('g_remote_config_context_fields.description', 'like', `%${filters.search}%`);
        });
      }

      if (filters?.type) {
        query = query.where('g_remote_config_context_fields.type', filters.type);
      }

      if (filters?.isActive !== undefined) {
        query = query.where('g_remote_config_context_fields.isActive', filters.isActive);
      }

      // Get total count
      const totalQuery = query.clone().count('* as count').first();
      const totalResult = await totalQuery;
      const total = totalResult ? Number(totalResult.count) : 0;

      // Apply pagination
      if (filters?.page && filters?.limit) {
        const offset = (filters.page - 1) * filters.limit;
        query = query.limit(filters.limit).offset(offset);
      }

      const fields = await query;

      return {
        fields: fields.map(field => ({
          ...field,
          options: field.options ? JSON.parse(field.options) : null,
          validation: field.validation ? JSON.parse(field.validation) : null,
          creator: field.creatorName ? { name: field.creatorName } : undefined,
          updater: field.updaterName ? { name: field.updaterName } : undefined
        })),
        total
      };
    } catch (error) {
      logger.error('Error finding context fields:', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<ContextField | null> {
    try {
      const field = await db('g_remote_config_context_fields')
        .leftJoin('g_users as creator', 'g_remote_config_context_fields.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'g_remote_config_context_fields.updatedBy', 'updater.id')
        .select([
          'g_remote_config_context_fields.*',
          'creator.name as creatorName',
          'updater.name as updaterName'
        ])
        .where('g_remote_config_context_fields.id', id)
        .first();

      if (!field) return null;

      return {
        ...field,
        options: field.options ? JSON.parse(field.options) : null,
        validation: field.validation ? JSON.parse(field.validation) : null,
        creator: field.creatorName ? { name: field.creatorName } : undefined,
        updater: field.updaterName ? { name: field.updaterName } : undefined
      };
    } catch (error) {
      logger.error('Error finding context field by id:', error);
      throw error;
    }
  }

  static async findByKey(key: string): Promise<ContextField | null> {
    try {
      const field = await db('g_remote_config_context_fields')
        .where('key', key)
        .first();

      if (!field) return null;

      return {
        ...field,
        options: field.options ? JSON.parse(field.options) : null,
        validation: field.validation ? JSON.parse(field.validation) : null
      };
    } catch (error) {
      logger.error('Error finding context field by key:', error);
      throw error;
    }
  }

  static async create(data: CreateContextFieldData): Promise<ContextField> {
    try {
      const insertData = {
        ...data,
        options: data.options ? JSON.stringify(data.options) : null,
        validation: data.validation ? JSON.stringify(data.validation) : null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isSystem: data.isSystem !== undefined ? data.isSystem : false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [id] = await db('g_remote_config_context_fields').insert(insertData);
      const created = await this.findById(id);

      if (!created) {
        throw new Error('Failed to retrieve created context field');
      }

      return created;
    } catch (error) {
      logger.error('Error creating context field:', error);
      throw error;
    }
  }

  static async update(id: number, data: UpdateContextFieldData): Promise<ContextField | null> {
    try {
      const updateData = {
        ...data,
        options: data.options ? JSON.stringify(data.options) : undefined,
        validation: data.validation ? JSON.stringify(data.validation) : undefined,
        updatedAt: new Date()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof UpdateContextFieldData] === undefined) {
          delete updateData[key as keyof UpdateContextFieldData];
        }
      });

      await db('g_remote_config_context_fields')
        .where('id', id)
        .update(updateData);

      return this.findById(id);
    } catch (error) {
      logger.error('Error updating context field:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const deleted = await db('g_remote_config_context_fields')
        .where('id', id)
        .del();

      return deleted > 0;
    } catch (error) {
      logger.error('Error deleting context field:', error);
      throw error;
    }
  }

  // Validation methods
  static validateKey(key: string): boolean {
    const keyRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    return keyRegex.test(key);
  }

  static validateOptions(type: string, options?: ContextFieldOption[]): boolean {
    if (type === 'array' && options) {
      return Array.isArray(options) && options.every(option =>
        typeof option === 'object' &&
        option.hasOwnProperty('value') &&
        option.hasOwnProperty('label')
      );
    }
    return true;
  }

  static validateDefaultValue(type: string, defaultValue?: string): boolean {
    if (!defaultValue) return true;

    switch (type) {
      case 'string':
        return typeof defaultValue === 'string';
      case 'number':
        return !isNaN(Number(defaultValue));
      case 'boolean':
        return defaultValue === 'true' || defaultValue === 'false';
      case 'array':
        try {
          const parsed = JSON.parse(defaultValue);
          return Array.isArray(parsed);
        } catch {
          return false;
        }
      default:
        return true;
    }
  }

  // Get formatted default value based on type
  static getFormattedDefaultValue(field: ContextField): any {
    if (!field.defaultValue) return null;

    switch (field.type) {
      case 'number':
        return Number(field.defaultValue);
      case 'boolean':
        return field.defaultValue === 'true';
      case 'array':
        try {
          return JSON.parse(field.defaultValue);
        } catch {
          return [];
        }
      default:
        return field.defaultValue;
    }
  }

  // Get available operators for this field type
  static getAvailableOperators(fieldType: string) {
    const { CONTEXT_OPERATORS } = require('../types/contextFields');
    return CONTEXT_OPERATORS.filter((op: any) =>
      op.supportedFieldTypes.includes(fieldType)
    );
  }
}
