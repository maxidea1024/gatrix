import db from '../config/knex';
import { createLogger } from '../config/logger';
import { ulid } from 'ulid';

const logger = createLogger('CcuHistory');

export interface CcuHistoryRecord {
  id?: string;
  environmentId: string;
  worldId: string | null;
  worldName: string | null;
  playerCount: number;
  botCount: number;
  recordedAt: Date;
}

export class CcuHistoryModel {
  /**
   * Insert a batch of CCU records (total + per-world)
   */
  static async insertBatch(
    records: Omit<CcuHistoryRecord, 'id'>[]
  ): Promise<void> {
    if (records.length === 0) return;

    const rows = records.map((r) => ({ id: ulid(), ...r }));
    await db('g_ccu_history').insert(rows);
    logger.debug(`Inserted ${rows.length} CCU history records`);
  }

  /**
   * Get CCU history for graphing.
   * When intervalSeconds > 60 is provided, records are downsampled into
   * time buckets of that width using MAX aggregation (preserves peaks).
   */
  static async getHistory(
    environmentId: string,
    from: Date,
    to: Date,
    worldId?: string | null,
    intervalSeconds?: number
  ): Promise<CcuHistoryRecord[]> {
    // No downsampling needed — return raw 1-minute records
    if (!intervalSeconds || intervalSeconds <= 60) {
      const query = db('g_ccu_history')
        .where('environmentId', environmentId)
        .where('recordedAt', '>=', from)
        .where('recordedAt', '<=', to)
        .orderBy('recordedAt', 'asc');

      if (worldId === null) {
        query.whereNull('worldId');
      } else if (worldId !== undefined) {
        query.where('worldId', worldId);
      }

      return query;
    }

    // Downsampled query: bucket by FLOOR(UNIX_TIMESTAMP / interval)
    const bucketExpr = 'FLOOR(UNIX_TIMESTAMP(recordedAt) / ?)';
    const bucketSelectExpr = `FROM_UNIXTIME(${bucketExpr} * ?)`;

    const query = db('g_ccu_history')
      .select(
        'environmentId',
        'worldId',
        db.raw('MAX(worldName) as worldName'),
        db.raw('MAX(playerCount) as playerCount'),
        db.raw('MAX(botCount) as botCount'),
        db.raw(`${bucketSelectExpr} as recordedAt`, [
          intervalSeconds,
          intervalSeconds,
        ])
      )
      .where('environmentId', environmentId)
      .where('recordedAt', '>=', from)
      .where('recordedAt', '<=', to)
      .groupBy(
        'environmentId',
        'worldId',
        db.raw(bucketSelectExpr, [intervalSeconds, intervalSeconds])
      )
      .orderByRaw(`${bucketSelectExpr} asc`, [
        intervalSeconds,
        intervalSeconds,
      ]);

    if (worldId === null) {
      query.whereNull('worldId');
    } else if (worldId !== undefined) {
      query.where('worldId', worldId);
    }

    return query;
  }

  /**
   * Cleanup records older than the specified number of days
   */
  static async cleanupOlderThan(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const deleted = await db('g_ccu_history')
      .where('recordedAt', '<', cutoff)
      .delete();

    if (deleted > 0) {
      logger.info(
        `Cleaned up ${deleted} CCU history records older than ${days} days`
      );
    }

    return deleted;
  }
}
