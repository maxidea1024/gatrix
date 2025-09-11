import db from '../config/knex';
import logger from '../config/logger';
import {
  ConfigRule,
  CreateConfigRuleData,
  EvaluationContext
} from '../types/remoteConfig';

export class ConfigRuleModel {
  /**
   * Get all rules for a config
   */
  static async getRulesByConfigId(configId: number): Promise<ConfigRule[]> {
    try {
      const rules = await db('g_remote_config_rules as cr')
        .leftJoin('g_users as creator', 'cr.createdBy', 'creator.id')
        .select([
          'cr.*',
          'creator.name as createdByName'
        ])
        .where('cr.configId', configId)
        .where('cr.isActive', true)
        .orderBy('cr.priority', 'desc');

      return rules.map(this.transformRule);
    } catch (error) {
      logger.error('Error getting config rules:', error);
      throw error;
    }
  }

  /**
   * Create new rule
   */
  static async create(data: CreateConfigRuleData): Promise<ConfigRule> {
    try {
      const [insertId] = await db('g_remote_config_rules').insert({
        configId: data.configId,
        ruleName: data.ruleName,
        conditions: JSON.stringify(data.conditions),
        value: data.value || null,
        priority: data.priority || 0,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy || null
      });

      const created = await db('g_remote_config_rules as cr')
        .leftJoin('g_users as creator', 'cr.createdBy', 'creator.id')
        .select([
          'cr.*',
          'creator.name as createdByName'
        ])
        .where('cr.id', insertId)
        .first();

      if (!created) {
        throw new Error('Failed to retrieve created rule');
      }

      logger.info(`Config rule created: ${data.ruleName} for config ${data.configId}`);
      return this.transformRule(created);
    } catch (error) {
      logger.error('Error creating config rule:', error);
      throw error;
    }
  }

  /**
   * Update rule
   */
  static async update(id: number, data: Partial<CreateConfigRuleData>): Promise<ConfigRule> {
    try {
      const updateData: any = {};

      if (data.ruleName !== undefined) updateData.ruleName = data.ruleName;
      if (data.conditions !== undefined) updateData.conditions = JSON.stringify(data.conditions);
      if (data.value !== undefined) updateData.value = data.value;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      await db('g_remote_config_rules').where('id', id).update(updateData);

      const updated = await db('g_remote_config_rules as cr')
        .leftJoin('g_users as creator', 'cr.createdBy', 'creator.id')
        .select([
          'cr.*',
          'creator.name as createdByName'
        ])
        .where('cr.id', id)
        .first();

      if (!updated) {
        throw new Error('Failed to retrieve updated rule');
      }

      logger.info(`Config rule updated: ID ${id}`);
      return this.transformRule(updated);
    } catch (error) {
      logger.error('Error updating config rule:', error);
      throw error;
    }
  }

  /**
   * Delete rule
   */
  static async delete(id: number): Promise<void> {
    try {
      await db('g_remote_config_rules').where('id', id).del();
      logger.info(`Config rule deleted: ID ${id}`);
    } catch (error) {
      logger.error('Error deleting config rule:', error);
      throw error;
    }
  }

  /**
   * Evaluate rules against context
   */
  static async evaluateRules(configId: number, context: EvaluationContext): Promise<string | null> {
    try {
      const rules = await this.getRulesByConfigId(configId);
      
      for (const rule of rules) {
        if (this.evaluateConditions(rule.conditions, context)) {
          logger.debug(`Rule matched: ${rule.ruleName} for config ${configId}`);
          return rule.value || null;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error evaluating rules:', error);
      throw error;
    }
  }

  /**
   * Evaluate conditions against context
   */
  private static evaluateConditions(conditions: any, context: EvaluationContext): boolean {
    try {
      if (!conditions || typeof conditions !== 'object') {
        return false;
      }

      // Handle AND conditions
      if (conditions.and && Array.isArray(conditions.and)) {
        return conditions.and.every((condition: any) => this.evaluateConditions(condition, context));
      }

      // Handle OR conditions
      if (conditions.or && Array.isArray(conditions.or)) {
        return conditions.or.some((condition: any) => this.evaluateConditions(condition, context));
      }

      // Handle single condition
      if (conditions.field && conditions.operator && conditions.value !== undefined) {
        return this.evaluateSingleCondition(conditions, context);
      }

      return false;
    } catch (error) {
      logger.error('Error evaluating conditions:', error);
      return false;
    }
  }

  /**
   * Evaluate single condition
   */
  private static evaluateSingleCondition(condition: any, context: EvaluationContext): boolean {
    const { field, operator, value } = condition;
    const contextValue = this.getContextValue(field, context);

    switch (operator) {
      case 'equals':
        return contextValue === value;
      case 'not_equals':
        return contextValue !== value;
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(value);
      case 'not_contains':
        return typeof contextValue === 'string' && !contextValue.includes(value);
      case 'starts_with':
        return typeof contextValue === 'string' && contextValue.startsWith(value);
      case 'ends_with':
        return typeof contextValue === 'string' && contextValue.endsWith(value);
      case 'greater_than':
        return Number(contextValue) > Number(value);
      case 'greater_than_or_equal':
        return Number(contextValue) >= Number(value);
      case 'less_than':
        return Number(contextValue) < Number(value);
      case 'less_than_or_equal':
        return Number(contextValue) <= Number(value);
      case 'in':
        return Array.isArray(value) && value.includes(contextValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(contextValue);
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
   * Transform database row to ConfigRule object
   */
  private static transformRule(row: any): ConfigRule {
    return {
      id: row.id,
      configId: row.configId,
      ruleName: row.ruleName,
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

export default ConfigRuleModel;
