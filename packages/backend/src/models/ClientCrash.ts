import { Model, QueryBuilder } from 'objection';
import { CrashState, CrashFilters, PaginationOptions } from '../types/crash';

export class ClientCrash extends Model {
  static tableName = 'crashes';

  id!: number;
  branch!: number;
  chash!: string;
  firstLine!: string;
  count!: number;
  state!: CrashState;
  lastCrash!: Date;
  createdAt!: Date;
  updatedAt!: Date;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['branch', 'chash', 'firstLine'],
      properties: {
        id: { type: 'integer' },
        branch: { type: 'integer' },
        chash: { type: 'string', maxLength: 32 },
        firstLine: { type: 'string', maxLength: 200 },
        count: { type: 'integer', default: 1 },
        state: { type: 'integer', enum: [0, 1, 2], default: 0 },
        lastCrash: { type: 'string', format: 'date-time' },
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
    query.orderBy('crashes.lastCrash', 'desc');

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
        this.where('crash_instances.userId', 'like', searchTerm)
            .orWhere('crash_instances.pubId', 'like', searchTerm);
      });
    }

    // Date range filter
    if (filters.dateFrom) {
      query.where('crashes.lastCrash', '>=', filters.dateFrom);
    }
    if (filters.dateTo) {
      query.where('crashes.lastCrash', '<=', filters.dateTo);
    }

    // Platform filter
    if (filters.deviceType !== undefined) {
      query.where('crash_instances.platform', filters.deviceType);
    }

    // Branch filter
    if (filters.branch !== undefined) {
      query.where('crashes.branch', filters.branch);
    }

    // Version filters
    if (filters.majorVer !== undefined) {
      query.where('crash_instances.majorVer', filters.majorVer);
    }
    if (filters.minorVer !== undefined) {
      query.where('crash_instances.minorVer', filters.minorVer);
    }
    if (filters.buildNum !== undefined) {
      query.where('crash_instances.buildNum', filters.buildNum);
    }
    if (filters.patchNum !== undefined) {
      query.where('crash_instances.patchNum', filters.patchNum);
    }

    // State filter
    if (filters.state !== undefined) {
      query.where('crashes.state', filters.state);
    }
  }

  /**
   * Find crash by hash and branch
   */
  static async findByHashAndBranch(chash: string, branch: number) {
    return await this.query()
      .where('chash', chash)
      .where('branch', branch)
      .first();
  }

  /**
   * Increment crash count and update last crash time
   */
  async incrementCount() {
    return await this.$query()
      .patch({
        count: this.count + 1,
        lastCrash: new Date(),
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
