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
  isRequired?: boolean;
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
  isRequired?: boolean;
  isActive?: boolean;
  updatedBy?: number;
}

export class ContextFieldModel {
  // 안전한 JSON 파싱 메서드
  private static parseValidationRules(value: any): any {
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
        logger.error('Failed to parse validationRules JSON:', { value, error });
        return null;
      }
    }

    return null;
  }

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
          'updater.name as updaterName',
        ])
        .orderBy('g_remote_config_context_fields.createdAt', 'desc');

      // Apply filters
      if (filters?.search) {
        query = query.where(function () {
          this.where(
            'g_remote_config_context_fields.fieldName',
            'like',
            `%${filters.search}%`
          ).orWhere('g_remote_config_context_fields.description', 'like', `%${filters.search}%`);
        });
      }

      if (filters?.type) {
        query = query.where('g_remote_config_context_fields.fieldType', filters.type);
      }

      if (filters?.isActive !== undefined) {
        query = query.where('g_remote_config_context_fields.isRequired', filters.isActive);
      }

      // Get total count with a separate simple query
      let countQuery = db('g_remote_config_context_fields');

      // Apply the same filters for count
      if (filters?.search) {
        countQuery = countQuery.where(function () {
          this.where(
            'g_remote_config_context_fields.fieldName',
            'like',
            `%${filters.search}%`
          ).orWhere('g_remote_config_context_fields.description', 'like', `%${filters.search}%`);
        });
      }

      if (filters?.type) {
        countQuery = countQuery.where('g_remote_config_context_fields.fieldType', filters.type);
      }

      if (filters?.isActive !== undefined) {
        countQuery = countQuery.where(
          'g_remote_config_context_fields.isRequired',
          filters.isActive
        );
      }

      const totalResult = await countQuery.count('* as count').first();
      const total = totalResult ? Number(totalResult.count) : 0;

      // Apply pagination
      if (filters?.page && filters?.limit) {
        const offset = (filters.page - 1) * filters.limit;
        query = query.limit(filters.limit).offset(offset);
      }

      const fields = await query;

      return {
        fields: fields.map((field) => {
          const validation = this.parseValidationRules(field.validationRules);
          return {
            ...field,
            key: field.fieldName, // Map fieldName to key
            name: field.fieldName, // Use fieldName as name if no separate name field
            type: field.fieldType, // Map fieldType to type
            options: null, // g_remote_config_context_fields doesn't have options
            validation,
            isRequired: field.isRequired || false,
            isActive: true, // Default to true since table doesn't have isActive
            isSystem: false, // Default to false since table doesn't have isSystem
            creator: field.creatorName ? { name: field.creatorName } : undefined,
            updater: field.updaterName ? { name: field.updaterName } : undefined,
          };
        }),
        total,
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
          'updater.name as updaterName',
        ])
        .where('g_remote_config_context_fields.id', id)
        .first();

      if (!field) return null;

      const validation = this.parseValidationRules(field.validationRules);
      return {
        ...field,
        key: field.fieldName, // Map fieldName to key
        name: field.fieldName, // Use fieldName as name if no separate name field
        type: field.fieldType, // Map fieldType to type
        options: null, // g_remote_config_context_fields doesn't have options
        validation,
        isRequired: field.isRequired || false,
        isActive: true, // Default to true since table doesn't have isActive
        isSystem: false, // Default to false since table doesn't have isSystem
        creator: field.creatorName ? { name: field.creatorName } : undefined,
        updater: field.updaterName ? { name: field.updaterName } : undefined,
      };
    } catch (error) {
      logger.error('Error finding context field by id:', error);
      throw error;
    }
  }

  static async findByKey(key: string): Promise<ContextField | null> {
    try {
      const field = await db('g_remote_config_context_fields')
        .leftJoin('g_users as creator', 'g_remote_config_context_fields.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'g_remote_config_context_fields.updatedBy', 'updater.id')
        .select([
          'g_remote_config_context_fields.*',
          'creator.name as creatorName',
          'updater.name as updaterName',
        ])
        .where('g_remote_config_context_fields.fieldName', key)
        .first();

      if (!field) {
        return null;
      }

      const validation = this.parseValidationRules(field.validationRules);
      return {
        ...field,
        key: field.fieldName, // Map fieldName to key
        name: field.fieldName, // Use fieldName as name if no separate name field
        type: field.fieldType, // Map fieldType to type
        options: null, // g_remote_config_context_fields doesn't have options
        validation,
        isRequired: field.isRequired || false,
        isActive: true, // Default to true since table doesn't have isActive
        isSystem: false, // Default to false since table doesn't have isSystem
        creator: field.creatorName ? { name: field.creatorName } : undefined,
        updater: field.updaterName ? { name: field.updaterName } : undefined,
      };
    } catch (error) {
      logger.error('Error finding context field by key:', error);
      throw error;
    }
  }

  static async create(data: CreateContextFieldData): Promise<ContextField> {
    try {
      const insertData = {
        fieldName: data.key, // Map key to fieldName
        fieldType: data.type, // Map type to fieldType
        description: data.description,
        isRequired: data.isRequired || false,
        defaultValue: data.defaultValue || null,
        validationRules: data.validation ? JSON.stringify(data.validation) : null,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
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
      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: data.updatedBy,
      };

      // Map fields to correct column names
      if (data.name !== undefined) {
        updateData.fieldName = data.name; // Map name to fieldName
      }
      if (data.description !== undefined) {
        updateData.description = data.description;
      }
      if (data.defaultValue !== undefined) {
        updateData.defaultValue = data.defaultValue;
      }
      if (data.isRequired !== undefined) {
        updateData.isRequired = data.isRequired;
      }
      if (data.validation !== undefined) {
        updateData.validationRules = data.validation ? JSON.stringify(data.validation) : null;
      }

      await db('g_remote_config_context_fields').where('id', id).update(updateData);

      return this.findById(id);
    } catch (error) {
      logger.error('Error updating context field:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const deleted = await db('g_remote_config_context_fields').where('id', id).del();

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
      return (
        Array.isArray(options) &&
        options.every(
          (option) =>
            typeof option === 'object' &&
            option.hasOwnProperty('value') &&
            option.hasOwnProperty('label')
        )
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
    return CONTEXT_OPERATORS.filter((op: any) => op.supportedFieldTypes.includes(fieldType));
  }
}

export default ContextField;
