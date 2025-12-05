import { Model } from 'objection';
import { User } from './User';
import { RemoteConfigEnvironment } from './RemoteConfigEnvironment';

export interface SegmentCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'contains' | 'starts_with' | 'ends_with';
  value: any;
}

export interface SegmentConditions {
  conditions: SegmentCondition[];
  operator?: 'AND' | 'OR'; // Default: AND
}

export interface RemoteConfigSegmentData {
  id?: number;
  environmentId: string; // ULID
  segmentName: string;
  displayName: string;
  description?: string;
  segmentConditions: SegmentConditions;
  isActive: boolean;
  createdBy: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RemoteConfigSegment extends Model implements RemoteConfigSegmentData {
  static tableName = 'g_remote_config_segments';

  id!: number;
  environmentId!: string; // ULID
  segmentName!: string;
  displayName!: string;
  description?: string;
  segmentConditions!: SegmentConditions;
  isActive!: boolean;
  createdBy!: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  environment?: RemoteConfigEnvironment;
  creator?: User;
  updater?: User;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['environmentId', 'segmentName', 'displayName', 'segmentConditions', 'createdBy'],
      properties: {
        id: { type: 'integer' },
        environmentId: { type: 'integer' },
        segmentName: { 
          type: 'string', 
          minLength: 1, 
          maxLength: 200,
          pattern: '^[a-z0-9_-]+$'
        },
        displayName: { type: 'string', minLength: 1, maxLength: 300 },
        description: { type: ['string', 'null'], maxLength: 1000 },
        segmentConditions: { type: 'object' },
        isActive: { type: 'boolean' },
        createdBy: { type: 'integer' },
        updatedBy: { type: ['integer', 'null'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    return {
      environment: {
        relation: Model.BelongsToOneRelation,
        modelClass: RemoteConfigEnvironment,
        join: {
          from: 'g_remote_config_segments.environmentId',
          to: 'g_remote_config_environments.id'
        }
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_remote_config_segments.createdBy',
          to: 'g_users.id'
        }
      },
      updater: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_remote_config_segments.updatedBy',
          to: 'g_users.id'
        }
      }
    };
  }

  $beforeInsert() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
  }

  /**
   * Get segment by environment and name
   */
  static async getByEnvironmentAndName(environmentId: string, segmentName: string): Promise<RemoteConfigSegment | undefined> {
    return await this.query()
      .where('environmentId', environmentId)
      .where('segmentName', segmentName)
      .first();
  }

  /**
   * Get active segments for environment
   */
  static async getActiveByEnvironment(environmentId: number): Promise<RemoteConfigSegment[]> {
    return await this.query()
      .where('environmentId', environmentId)
      .where('isActive', true)
      .orderBy('displayName');
  }

  /**
   * Get all segments for environment
   */
  static async getAllByEnvironment(environmentId: string): Promise<RemoteConfigSegment[]> {
    return await this.query()
      .where('environmentId', environmentId)
      .withGraphFetched('[creator(basicInfo), updater(basicInfo)]')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      })
      .orderBy('displayName');
  }

  /**
   * Create new segment
   */
  static async createSegment(data: Omit<RemoteConfigSegmentData, 'id' | 'createdAt' | 'updatedAt'>): Promise<RemoteConfigSegment> {
    // Validate segment name
    if (!this.isValidSegmentName(data.segmentName)) {
      throw new Error('Invalid segment name. Use only lowercase letters, numbers, underscore, and hyphen.');
    }

    // Check if segment already exists
    const existing = await this.getByEnvironmentAndName(data.environmentId, data.segmentName);
    if (existing) {
      throw new Error(`Segment '${data.segmentName}' already exists in this environment`);
    }

    // Validate conditions
    this.validateConditions(data.segmentConditions);

    return await this.query().insert(data);
  }

  /**
   * Update segment
   */
  async updateSegment(data: Partial<RemoteConfigSegmentData>, updatedBy: number): Promise<RemoteConfigSegment> {
    // Validate conditions if provided
    if (data.segmentConditions) {
      RemoteConfigSegment.validateConditions(data.segmentConditions);
    }

    return await this.$query().patchAndFetch({
      ...data,
      updatedBy,
      updatedAt: new Date()
    });
  }

  /**
   * Validate segment name
   */
  static isValidSegmentName(name: string): boolean {
    return /^[a-z0-9_-]+$/.test(name) && name.length >= 1 && name.length <= 200;
  }

  /**
   * Validate segment conditions
   */
  static validateConditions(conditions: SegmentConditions): void {
    if (!conditions || typeof conditions !== 'object') {
      throw new Error('Segment conditions must be an object');
    }

    if (!Array.isArray(conditions.conditions) || conditions.conditions.length === 0) {
      throw new Error('Segment conditions must contain at least one condition');
    }

    const validOperators = ['equals', 'not_equals', 'in', 'not_in', 'greater_than', 'less_than', 'contains', 'starts_with', 'ends_with'];

    for (const condition of conditions.conditions) {
      if (!condition.field || typeof condition.field !== 'string') {
        throw new Error('Each condition must have a valid field name');
      }

      if (!validOperators.includes(condition.operator)) {
        throw new Error(`Invalid operator '${condition.operator}'. Must be one of: ${validOperators.join(', ')}`);
      }

      if (condition.value === undefined) {
        throw new Error('Each condition must have a value');
      }

      // Validate array operators
      if (['in', 'not_in'].includes(condition.operator) && !Array.isArray(condition.value)) {
        throw new Error(`Operator '${condition.operator}' requires an array value`);
      }
    }

    // Validate logical operator
    if (conditions.operator && !['AND', 'OR'].includes(conditions.operator)) {
      throw new Error("Logical operator must be 'AND' or 'OR'");
    }
  }

  /**
   * Evaluate segment against user context
   */
  evaluate(userContext: Record<string, any>): boolean {
    if (!this.isActive) {
      return false;
    }

    const conditions = this.segmentConditions.conditions;
    const operator = this.segmentConditions.operator || 'AND';

    const results = conditions.map(condition => this.evaluateCondition(condition, userContext));

    if (operator === 'OR') {
      return results.some(result => result);
    } else {
      return results.every(result => result);
    }
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(condition: SegmentCondition, userContext: Record<string, any>): boolean {
    const userValue = userContext[condition.field];
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return userValue === conditionValue;

      case 'not_equals':
        return userValue !== conditionValue;

      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(userValue);

      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(userValue);

      case 'greater_than':
        return typeof userValue === 'number' && typeof conditionValue === 'number' && userValue > conditionValue;

      case 'less_than':
        return typeof userValue === 'number' && typeof conditionValue === 'number' && userValue < conditionValue;

      case 'contains':
        return typeof userValue === 'string' && typeof conditionValue === 'string' && userValue.includes(conditionValue);

      case 'starts_with':
        return typeof userValue === 'string' && typeof conditionValue === 'string' && userValue.startsWith(conditionValue);

      case 'ends_with':
        return typeof userValue === 'string' && typeof conditionValue === 'string' && userValue.endsWith(conditionValue);

      default:
        return false;
    }
  }

  /**
   * Get predefined segments
   */
  static getPredefinedSegments(): Array<{
    segmentName: string;
    displayName: string;
    description: string;
    segmentConditions: SegmentConditions;
  }> {
    return [
      {
        segmentName: 'beta_users',
        displayName: 'Beta Users',
        description: 'Users enrolled in beta testing program',
        segmentConditions: {
          conditions: [
            { field: 'user_type', operator: 'equals', value: 'beta' }
          ]
        }
      },
      {
        segmentName: 'premium_users',
        displayName: 'Premium Users',
        description: 'Users with premium subscription',
        segmentConditions: {
          conditions: [
            { field: 'subscription_type', operator: 'in', value: ['premium', 'enterprise'] }
          ]
        }
      },
      {
        segmentName: 'mobile_users',
        displayName: 'Mobile Users',
        description: 'Users on mobile platforms',
        segmentConditions: {
          conditions: [
            { field: 'platform', operator: 'in', value: ['ios', 'android'] }
          ]
        }
      },
      {
        segmentName: 'new_users',
        displayName: 'New Users',
        description: 'Users registered within last 30 days',
        segmentConditions: {
          conditions: [
            { field: 'registration_date', operator: 'greater_than', value: '30_days_ago' }
          ]
        }
      }
    ];
  }

  /**
   * Create predefined segments for environment
   */
  static async createPredefinedSegments(environmentId: string, createdBy: number): Promise<RemoteConfigSegment[]> {
    const predefined = this.getPredefinedSegments();
    const segments: RemoteConfigSegment[] = [];

    for (const segmentData of predefined) {
      try {
        const segment = await this.createSegment({
          environmentId,
          ...segmentData,
          isActive: true,
          createdBy
        });
        segments.push(segment);
      } catch (error) {
        // Segment might already exist, skip
        console.warn(`Failed to create predefined segment ${segmentData.segmentName}:`, error);
      }
    }

    return segments;
  }

  /**
   * Delete segment (only if not used in templates)
   */
  async deleteSegment(): Promise<void> {
    // TODO: Check if segment is used in any templates
    // For now, just deactivate
    await this.$query().patch({
      isActive: false,
      updatedAt: new Date()
    });
  }

  /**
   * Get segment usage statistics
   */
  async getUsageStats(): Promise<{
    templatesUsing: number;
    campaignsUsing: number;
  }> {
    // TODO: Implement actual usage tracking
    // This would require checking templates and campaigns that reference this segment
    return {
      templatesUsing: 0,
      campaignsUsing: 0
    };
  }
}

export default RemoteConfigSegment;
