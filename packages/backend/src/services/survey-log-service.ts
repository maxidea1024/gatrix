import db from '../config/knex';
import redisClient from '../config/redis';
import { createLogger } from '../config/logger';

const logger = createLogger('SurveyLogService');

export interface SurveyLogQuery {
  page?: number;
  limit?: number;
  surveyId?: string;
  action?: 'JOINED' | 'SENT';
  accountId?: string;
  userName?: string;
  worldId?: string;
  platform?: string;
  channel?: string;
  subchannel?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  environmentId: string;
}

export class SurveyLogService {
  /**
   * Log a survey action directly to Redis stream for async bulk insert
   */
  static async pushLog(
    environmentId: string,
    surveyId: string,
    action: 'JOINED' | 'SENT',
    accountId: string,
    characterId?: string,
    userName?: string,
    worldId?: string,
    platform?: string,
    channel?: string,
    subchannel?: string
  ): Promise<void> {
    try {
      const redis = redisClient.getClient();
      const payload = {
        environmentId,
        surveyId,
        action,
        accountId,
        characterId,
        userName,
        worldId,
        platform,
        channel,
        subchannel,
        createdAtMySQL: new Date().toISOString().slice(0, 19).replace('T', ' '),
      };

      await redis.xadd(
        'survey:stream:logs',
        '*', // auto-generate ID
        'payload',
        JSON.stringify(payload)
      );
    } catch (error) {
      // We only log the error and do NOT throw, because this is a best-effort logging
      logger.warn(`Failed to push survey log to Redis stream: ${error}`);
    }
  }

  /**
   * Get paginated survey logs for CMS
   */
  static async getLogs(query: SurveyLogQuery) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    let dbQuery = db('g_survey_logs').where(
      'environmentId',
      query.environmentId
    );

    if (query.surveyId) {
      dbQuery = dbQuery.andWhere('surveyId', query.surveyId);
    }
    if (query.action) {
      dbQuery = dbQuery.andWhere('action', query.action);
    }
    if (query.accountId) {
      dbQuery = dbQuery.andWhere('accountId', query.accountId);
    }
    if (query.userName) {
      dbQuery = dbQuery.andWhere('userName', query.userName);
    }
    if (query.worldId) {
      dbQuery = dbQuery.andWhere('worldId', query.worldId);
    }
    if (query.platform) {
      dbQuery = dbQuery.andWhere('platform', query.platform);
    }
    if (query.channel) {
      dbQuery = dbQuery.andWhere('channel', query.channel);
    }
    if (query.subchannel) {
      dbQuery = dbQuery.andWhere('subchannel', query.subchannel);
    }
    if (query.startDate) {
      dbQuery = dbQuery.andWhere('createdAt', '>=', query.startDate);
    }
    if (query.endDate) {
      dbQuery = dbQuery.andWhere('createdAt', '<=', query.endDate);
    }
    if (query.search) {
      dbQuery = dbQuery.andWhere((builder) => {
        builder
          .where('accountId', 'like', `%${query.search}%`)
          .orWhere('userName', 'like', `%${query.search}%`);
      });
    }

    // Clone query for counting total
    const countQuery = dbQuery.clone().count('id as total').first();

    // Determine sort column (whitelist allowed columns)
    const allowedSortColumns = [
      'action',
      'accountId',
      'userName',
      'worldId',
      'platform',
      'channel',
      'subchannel',
      'createdAt',
    ];
    const sortColumn =
      query.sortBy && allowedSortColumns.includes(query.sortBy)
        ? query.sortBy
        : 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const logs = await dbQuery
      .select('*')
      .orderBy(sortColumn, sortDirection)
      .limit(limit)
      .offset(offset);

    const countResult = (await countQuery) as
      | { total: string | number }
      | undefined;
    const total = parseInt(String(countResult?.total || 0), 10);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
