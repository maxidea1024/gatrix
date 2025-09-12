import db from '../config/knex';
import logger from '../config/logger';
import {
  ConfigRule,
  CreateConfigRuleData,
  EvaluationContext
} from '../types/remoteConfig';

export class SegmentModel {
  /**
   * Get all segments
   */
  static async getAllSegments(): Promise<ConfigRule[]> {
    try {
      const segments = await db('g_remote_config_segments as s')
        .leftJoin('g_users as creator', 's.createdBy', 'creator.id')
        .select([
          's.*',
          'creator.name as createdByName'
        ])
        .where('s.isActive', true)
        .orderBy('s.priority', 'asc');

      return segments.map(this.transformSegment);
    } catch (error) {
      logger.error('Error getting segments:', error);
      throw error;
    }
  }

  /**
   * Create new segment
   */
  static async create(data: CreateConfigRuleData): Promise<ConfigRule> {
    try {
      const [insertId] = await db('g_remote_config_segments').insert({
        segmentName: data.ruleName,
        conditions: JSON.stringify(data.conditions),
        value: data.value || null,
        priority: data.priority || 0,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy || null
      });

      const created = await db('g_remote_config_segments as s')
        .leftJoin('g_users as creator', 's.createdBy', 'creator.id')
        .select([
          's.*',
          'creator.name as createdByName'
        ])
        .where('s.id', insertId)
        .first();

      if (!created) {
        throw new Error('Failed to retrieve created segment');
      }

      logger.info(`Segment created: ${data.ruleName}`);
      return this.transformSegment(created);
    } catch (error) {
      logger.error('Error creating segment:', error);
      throw error;
    }
  }

  /**
   * Update segment
   */
  static async update(id: number, data: Partial<CreateConfigRuleData>): Promise<ConfigRule> {
    try {
      const updateData: any = {};
      
      if (data.ruleName !== undefined) updateData.segmentName = data.ruleName;
      if (data.conditions !== undefined) updateData.conditions = JSON.stringify(data.conditions);
      if (data.value !== undefined) updateData.value = data.value;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      await db('g_remote_config_segments')
        .where('id', id)
        .update(updateData);

      const updated = await db('g_remote_config_segments as s')
        .leftJoin('g_users as creator', 's.createdBy', 'creator.id')
        .select([
          's.*',
          'creator.name as createdByName'
        ])
        .where('s.id', id)
        .first();

      if (!updated) {
        throw new Error('Segment not found after update');
      }

      logger.info(`Segment updated: ID ${id}`);
      return this.transformSegment(updated);
    } catch (error) {
      logger.error('Error updating segment:', error);
      throw error;
    }
  }

  /**
   * Delete segment
   */
  static async delete(id: number): Promise<boolean> {
    try {
      const deleted = await db('g_remote_config_segments')
        .where('id', id)
        .del();

      logger.info(`Segment deleted: ID ${id}`);
      return deleted > 0;
    } catch (error) {
      logger.error('Error deleting segment:', error);
      throw error;
    }
  }

  /**
   * Get segment by ID
   */
  static async getById(id: number): Promise<ConfigRule | null> {
    try {
      const segment = await db('g_remote_config_segments as s')
        .leftJoin('g_users as creator', 's.createdBy', 'creator.id')
        .select([
          's.*',
          'creator.name as createdByName'
        ])
        .where('s.id', id)
        .first();

      return segment ? this.transformSegment(segment) : null;
    } catch (error) {
      logger.error('Error getting segment by ID:', error);
      throw error;
    }
  }

  /**
   * Evaluate segment conditions against context
   */
  static evaluateSegment(segment: ConfigRule, context: EvaluationContext): boolean {
    try {
      if (!segment.conditions || !segment.conditions.conditions) {
        return false;
      }

      const conditions = Array.isArray(segment.conditions.conditions) 
        ? segment.conditions.conditions 
        : [segment.conditions.conditions];

      return conditions.every((condition: any) =>
        this.evaluateCondition(condition, context)
      );
    } catch (error) {
      logger.error('Error evaluating segment conditions:', error);
      return false;
    }
  }

  /**
   * Evaluate single condition
   */
  private static evaluateCondition(condition: any, context: EvaluationContext): boolean {
    const { field, operator, value } = condition;
    const contextValue = this.getContextValue(field, context);

    switch (operator) {
      case 'equals':
        return contextValue == value;
      case 'not_equals':
        return contextValue != value;
      case 'greater_than':
        return Number(contextValue) > Number(value);
      case 'greater_than_or_equal':
        return Number(contextValue) >= Number(value);
      case 'less_than':
        return Number(contextValue) < Number(value);
      case 'less_than_or_equal':
        return Number(contextValue) <= Number(value);
      case 'in':
        const values = typeof value === 'string' ? value.split(',') : value;
        return Array.isArray(values) && values.includes(String(contextValue));
      case 'not_in':
        const notValues = typeof value === 'string' ? value.split(',') : value;
        return Array.isArray(notValues) && !notValues.includes(String(contextValue));
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(String(value));
      case 'not_contains':
        return typeof contextValue === 'string' && !contextValue.includes(String(value));
      case 'starts_with':
        return typeof contextValue === 'string' && contextValue.startsWith(String(value));
      case 'ends_with':
        return typeof contextValue === 'string' && contextValue.endsWith(String(value));
      case 'regex':
        try {
          const regex = new RegExp(value);
          return typeof contextValue === 'string' && regex.test(contextValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Get value from context by field path
   */
  private static getContextValue(field: string, context: EvaluationContext): any {
    const fieldParts = field.split('.');
    let value: any = context;

    for (const part of fieldParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Transform database row to ConfigRule object (used as Segment)
   */
  private static transformSegment(row: any): ConfigRule {
    return {
      id: row.id,
      ruleName: row.segmentName, // segmentName을 ruleName으로 매핑 (호환성)
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
      value: row.value,
      priority: row.priority,
      isActive: Boolean(row.isActive),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByName: row.createdByName
    };
  }
}

export default SegmentModel;
