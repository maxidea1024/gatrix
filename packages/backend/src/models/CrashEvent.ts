import { Model } from 'objection';
import { CRASH_CONSTANTS } from '../types/crash';
import { generateULID } from '../utils/ulid';

/**
 * CrashEvent Model
 * Represents an individual crash occurrence
 */
export class CrashEvent extends Model {
  static tableName = 'crash_events';

  id!: string; // ULID
  crashId!: string; // Reference to crashes.id
  firstLine?: string; // First line of stack trace

  platform!: string; // Platform
  marketType?: string; // Market type
  branch!: string; // Branch name
  environment!: string; // Environment
  isEditor!: boolean; // Whether crash occurred in editor
  
  appVersion?: string; // App version (semver format)
  resVersion?: string; // Resource version
  
  accountId?: string; // Account ID
  characterId?: string; // Character ID
  gameUserId?: string; // Game user ID
  userName?: string; // User name
  gameServerId?: string; // Game server ID
  
  userMessage?: string; // User message (max 255 chars)
  logFilePath?: string; // Path to log file

  crashEventIp?: string; // IP address
  crashEventUserAgent?: string; // Browser user agent

  createdAt!: Date;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['id', 'crashId', 'platform', 'branch', 'environment'],
      properties: {
        id: { type: 'string', maxLength: 26 }, // ULID
        crashId: { type: 'string', maxLength: 26 }, // ULID
        firstLine: { type: ['string', 'null'], maxLength: 200 },
        platform: { type: 'string', maxLength: 50 },
        marketType: { type: ['string', 'null'], maxLength: 50 },
        branch: { type: 'string', maxLength: 50 },
        environment: { type: 'string', maxLength: 50 },
        isEditor: { type: 'boolean', default: false },
        appVersion: { type: ['string', 'null'], maxLength: 50 },
        resVersion: { type: ['string', 'null'], maxLength: 50 },
        accountId: { type: ['string', 'null'], maxLength: 100 },
        characterId: { type: ['string', 'null'], maxLength: 100 },
        gameUserId: { type: ['string', 'null'], maxLength: 100 },
        userName: { type: ['string', 'null'], maxLength: 100 },
        gameServerId: { type: ['string', 'null'], maxLength: 100 },
        userMessage: { type: ['string', 'null'], maxLength: 255 },
        logFilePath: { type: ['string', 'null'], maxLength: 500 },
        crashEventIp: { type: ['string', 'null'], maxLength: 45 },
        crashEventUserAgent: { type: ['string', 'null'], maxLength: 500 },
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
          from: 'crash_events.crashId',
          to: 'crashes.id'
        }
      }
    };
  }

  $beforeInsert() {
    if (!this.id) {
      this.id = generateULID();
    }
    this.createdAt = new Date();
  }

  /**
   * Create new crash event
   */
  static async create(data: {
    crashId: string;
    firstLine?: string;
    platform: string;
    marketType?: string;
    branch: string;
    environment: string;
    isEditor?: boolean;
    appVersion?: string;
    resVersion?: string;
    accountId?: string;
    characterId?: string;
    gameUserId?: string;
    userName?: string;
    gameServerId?: string;
    userMessage?: string;
    logFilePath?: string;
    crashEventIp?: string;
    crashEventUserAgent?: string;
  }) {
    // Truncate user message if too long
    if (data.userMessage && data.userMessage.length > CRASH_CONSTANTS.MaxUserMsgLen) {
      data.userMessage = data.userMessage.substring(0, CRASH_CONSTANTS.MaxUserMsgLen);
    }

    const eventId = generateULID();

    await this.query().insert({
      id: eventId,
      ...data,
      isEditor: data.isEditor || false
    });

    const event = await this.query().findById(eventId);
    if (!event) {
      throw new Error('Failed to create crash event');
    }

    return event;
  }

  /**
   * Get events by crash ID
   */
  static async getByCrashId(crashId: string, limit: number = 100) {
    return await this.query()
      .where('crashId', crashId)
      .orderBy('createdAt', 'desc')
      .limit(limit);
  }

  /**
   * Get version statistics for a crash
   */
  static async getVersionStats(crashId: string) {
    return await this.query()
      .where('crashId', crashId)
      .select('appVersion')
      .count('* as count')
      .groupBy('appVersion')
      .orderBy('count', 'desc');
  }

  /**
   * Get platform statistics for a crash
   */
  static async getPlatformStats(crashId: string) {
    return await this.query()
      .where('crashId', crashId)
      .select('platform')
      .count('* as count')
      .groupBy('platform')
      .orderBy('count', 'desc');
  }

  /**
   * Get environment statistics for a crash
   */
  static async getEnvironmentStats(crashId: string) {
    return await this.query()
      .where('crashId', crashId)
      .select('environment')
      .count('* as count')
      .groupBy('environment')
      .orderBy('count', 'desc');
  }

  /**
   * Get user statistics for a crash
   */
  static async getUserStats(crashId: string) {
    return await this.query()
      .where('crashId', crashId)
      .whereNotNull('accountId')
      .select('accountId', 'userName')
      .count('* as count')
      .groupBy('accountId', 'userName')
      .orderBy('count', 'desc')
      .limit(20);
  }

  /**
   * Get latest events for a crash
   */
  static async getLatestEvents(crashId: string, limit: number = 10) {
    return await this.query()
      .where('crashId', crashId)
      .orderBy('createdAt', 'desc')
      .limit(limit);
  }

  /**
   * Delete events older than specified days
   */
  static async deleteOlderThan(days: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await this.query()
      .where('createdAt', '<', cutoffDate)
      .delete();
  }
}

