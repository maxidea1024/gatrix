import { Model } from 'objection';
import { CRASH_CONSTANTS } from '../types/crash';

export class CrashInstance extends Model {
  static tableName = 'crash_instances';

  id!: number;
  cid!: number; // crash id
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
  occurred_at!: Date;
  createdAt!: Date;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['cid', 'platform', 'branch', 'version', 'crash_type', 'occurred_at'],
      properties: {
        id: { type: 'integer' },
        cid: { type: 'integer' },
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
        occurred_at: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    return {
      crash: {
        relation: Model.BelongsToOneRelation,
        modelClass: 'ClientCrash',
        join: {
          from: 'crash_instances.cid',
          to: 'crashes.id'
        }
      }
    };
  }

  $beforeInsert() {
    this.createdAt = new Date();
  }

  /**
   * Create new crash instance
   */
  static async create(data: {
    cid: number;
    user_id?: number;
    user_nickname?: string;
    platform: string;
    branch: string;
    market_type?: string;
    server_group?: string;
    device_type?: string;
    version: string;
    crash_type: string;
    crash_message?: string;
    stack_trace_file?: string;
    logs_file?: string;
    occurred_at?: Date;
  }) {
    // Truncate crash message if too long
    if (data.crash_message && data.crash_message.length > CRASH_CONSTANTS.MaxUserMsgLen) {
      data.crash_message = data.crash_message.substring(0, CRASH_CONSTANTS.MaxUserMsgLen);
    }

    return await this.query().insert({
      ...data,
      occurred_at: data.occurred_at || new Date()
    });
  }

  /**
   * Find instances by crash ID with pagination
   */
  static async findByCrashId(
    crashId: number,
    page: number = 1,
    limit: number = 10
  ) {
    const offset = (page - 1) * limit;

    const [instances, totalResult] = await Promise.all([
      this.query()
        .where('cid', crashId)
        .orderBy('createdAt', 'desc')
        .offset(offset)
        .limit(limit),
      this.query()
        .where('cid', crashId)
        .count('id as count')
        .first()
    ]);

    const total = (totalResult as any)?.count || 0;

    return {
      instances,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get version statistics for a crash
   */
  static async getVersionStats(crashId: number) {
    return await this.query()
      .where('cid', crashId)
      .select('majorVer', 'minorVer', 'buildNum', 'patchNum')
      .count('id as count')
      .groupBy('majorVer', 'minorVer', 'buildNum', 'patchNum')
      .orderBy('count', 'desc');
  }

  /**
   * Get platform statistics for a crash
   */
  static async getPlatformStats(crashId: number) {
    return await this.query()
      .where('cid', crashId)
      .select('platform')
      .count('id as count')
      .groupBy('platform')
      .orderBy('count', 'desc');
  }

  /**
   * Get user statistics for a crash
   */
  static async getUserStats(crashId: number) {
    return await this.query()
      .where('cid', crashId)
      .select('userId', 'pubId')
      .count('id as count')
      .groupBy('userId', 'pubId')
      .orderBy('count', 'desc')
      .limit(100); // Limit to top 100 affected users
  }

  /**
   * Get latest instances for a crash
   */
  static async getLatestInstances(crashId: number, limit: number = 5) {
    return await this.query()
      .where('cid', crashId)
      .orderBy('createdAt', 'desc')
      .limit(limit);
  }

  /**
   * Check if version is latest compared to max versions
   */
  static isLatestVersion(
    maxMajorVer: number,
    maxMinorVer: number,
    maxBuildNum: number,
    maxPatchNum: number,
    majorVer: number,
    minorVer: number,
    buildNum: number,
    patchNum: number
  ): boolean {
    // Compare versions in order: major > minor > build > patch
    if (majorVer > maxMajorVer) return true;
    if (majorVer < maxMajorVer) return false;
    
    if (minorVer > maxMinorVer) return true;
    if (minorVer < maxMinorVer) return false;
    
    if (buildNum > maxBuildNum) return true;
    if (buildNum < maxBuildNum) return false;
    
    return patchNum > maxPatchNum;
  }
}
