import { Model, QueryBuilder } from 'objection';
import { CrashState, CrashFilters, PaginationOptions } from '../types/crash';

export class ClientCrash extends Model {
  static tableName = 'crashes';

  id!: number;
  crash_id!: string;
  user_id?: number;
  user_nickname?: string;
  platform!: string;
  branch!: string;
  market_type?: string;
  server_group?: string;
  device_type?: string;
  version!: string;
  crash_type!: string;
  crash_message?: string;
  stack_trace_file?: string;
  logs_file?: string;
  state!: CrashState;
  first_occurred_at!: Date;
  last_occurred_at!: Date;
  occurrence_count!: number;
  createdAt!: Date;
  updatedAt!: Date;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['crash_id', 'platform', 'branch', 'version', 'crash_type', 'first_occurred_at', 'last_occurred_at'],
      properties: {
        id: { type: 'integer' },
        crash_id: { type: 'string', maxLength: 255 },
        user_id: { type: 'integer' },
        user_nickname: { type: 'string', maxLength: 255 },
        platform: { type: 'string', enum: ['android', 'ios', 'windows', 'macos', 'linux'] },
        branch: { type: 'string', enum: ['release', 'patch', 'beta', 'alpha', 'dev'] },
        market_type: { type: 'string' },
        server_group: { type: 'string', maxLength: 100 },
        device_type: { type: 'string', maxLength: 255 },
        version: { type: 'string', maxLength: 100 },
        crash_type: { type: 'string', maxLength: 100 },
        crash_message: { type: 'string' },
        stack_trace_file: { type: 'string', maxLength: 500 },
        logs_file: { type: 'string', maxLength: 500 },
        state: { type: 'integer', enum: [0, 1, 2], default: 0 },
        first_occurred_at: { type: 'string', format: 'date-time' },
        last_occurred_at: { type: 'string', format: 'date-time' },
        occurrence_count: { type: 'integer', default: 1 },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    return {
      instances: {
        relation: Model.HasManyRelation,
        modelClass: 'CrashInstance',
        join: {
          from: 'crashes.id',
          to: 'crash_instances.cid'
        }
      }
    };
  }

  // 누락된 메서드 추가
  static async findByHashAndBranch(crashId: string, branch: string): Promise<ClientCrash | undefined> {
    return await this.query()
      .where('crash_id', crashId)
      .where('branch', branch)
      .first();
  }

  $beforeInsert() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
  }

  /**
   * Find crashes with filtering and pagination
   */
  static async findAll(
    page: number = 1,
    limit: number = 10,
    filters: CrashFilters = {}
  ) {
    const query = this.query()
      .select('crashes.*')
      .leftJoin('crash_instances', 'crashes.id', 'crash_instances.cid');

    // Apply filters
    this.applyFilters(query, filters);

    // Group by crash id to avoid duplicates from join
    query.groupBy('crashes.id');

    // Count total
    const countQuery = this.query()
      .leftJoin('crash_instances', 'crashes.id', 'crash_instances.cid');
    this.applyFilters(countQuery, filters);
    const totalResult = await countQuery
      .groupBy('crashes.id')
      .count('crashes.id as count');
    const total = totalResult.length;

    // Apply pagination
    const offset = (page - 1) * limit;
    query.offset(offset).limit(limit);

    // Order by last crash time (most recent first)
    query.orderBy('crashes.last_occurred_at', 'desc');

    const crashes = await query;

    return {
      crashes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Apply filters to query
   */
  private static applyFilters(query: QueryBuilder<ClientCrash>, filters: CrashFilters) {
    // Search by user nickname or userId
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query.where(function() {
        this.where('crashes.user_id', 'like', searchTerm)
            .orWhere('crashes.user_nickname', 'like', searchTerm);
      });
    }

    // Date range filter
    if (filters.dateFrom) {
      query.where('crashes.last_occurred_at', '>=', filters.dateFrom);
    }
    if (filters.dateTo) {
      query.where('crashes.last_occurred_at', '<=', filters.dateTo);
    }

    // Platform filter
    if (filters.deviceType !== undefined) {
      query.where('crashes.platform', filters.deviceType);
    }

    // Branch filter
    if (filters.branch !== undefined) {
      query.where('crashes.branch', filters.branch);
    }

    // Version filter
    if (filters.version) {
      query.where('crashes.version', 'like', `%${filters.version}%`);
    }

    // Server group filter
    if (filters.serverGroup) {
      query.where('crashes.server_group', filters.serverGroup);
    }

    // Market type filter
    if (filters.marketType) {
      query.where('crashes.market_type', filters.marketType);
    }

    // Device type filter
    if (filters.deviceType) {
      query.where('crashes.device_type', 'like', `%${filters.deviceType}%`);
    }

    // State filter
    if (filters.state !== undefined) {
      query.where('crashes.state', filters.state);
    }
  }

  /**
   * Find crash by crash_id
   */
  static async findByCrashId(crash_id: string) {
    return await this.query()
      .where('crash_id', crash_id)
      .first();
  }

  /**
   * Increment crash count and update last crash time
   */
  async incrementCount() {
    return await this.$query()
      .patch({
        occurrence_count: this.occurrence_count + 1,
        last_occurred_at: new Date(),
        updatedAt: new Date()
      });
  }

  /**
   * Update crash state
   */
  async updateState(state: CrashState) {
    return await this.$query()
      .patch({
        state,
        updatedAt: new Date()
      });
  }

  /**
   * Get crash with instances
   */
  static async findByIdWithInstances(id: number) {
    return await this.query()
      .findById(id)
      .withGraphFetched('instances')
      .orderBy('instances.createdAt', 'desc');
  }
}
