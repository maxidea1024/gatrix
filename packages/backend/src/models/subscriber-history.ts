import db from '../config/knex';
import { createLogger } from '../config/logger';
import { ulid } from 'ulid';

const logger = createLogger('SubscriberHistory');

export interface SubscriberHistoryRecord {
  id?: string;
  environmentId: string;
  totalPlayers: number;
  newPlayers: number;
  recordedAt: Date;
}

export class SubscriberHistoryModel {
  /**
   * Insert a single subscriber history record
   */
  static async insertRecord(
    record: Omit<SubscriberHistoryRecord, 'id'>
  ): Promise<void> {
    const row = { id: ulid(), ...record };
    await db('g_player_history').insert(row);
    logger.debug(
      `Inserted subscriber history record: totalPlayers=${record.totalPlayers}, newPlayers=${record.newPlayers}`
    );
  }

  /**
   * Get subscriber history for graphing.
   * When intervalSeconds is provided, records are downsampled into
   * time buckets of that width using MAX aggregation.
   */
  static async getHistory(
    environmentId: string,
    from: Date,
    to: Date,
    intervalSeconds?: number
  ): Promise<SubscriberHistoryRecord[]> {
    // No downsampling needed — return raw records
    if (!intervalSeconds || intervalSeconds <= 600) {
      return db('g_player_history')
        .where('environmentId', environmentId)
        .where('recordedAt', '>=', from)
        .where('recordedAt', '<=', to)
        .orderBy('recordedAt', 'asc');
    }

    // Downsampled query: bucket by FLOOR(UNIX_TIMESTAMP / interval)
    const bucketExpr = 'FLOOR(UNIX_TIMESTAMP(recordedAt) / ?)';
    const bucketSelectExpr = `FROM_UNIXTIME(${bucketExpr} * ?)`;

    return db('g_player_history')
      .select(
        'environmentId',
        db.raw('MAX(totalPlayers) as totalPlayers'),
        db.raw('MAX(newPlayers) as newPlayers'),
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
        db.raw(bucketSelectExpr, [intervalSeconds, intervalSeconds])
      )
      .orderByRaw(`${bucketSelectExpr} asc`, [
        intervalSeconds,
        intervalSeconds,
      ]);
  }

  /**
   * Get the latest subscriber record for a given environment.
   * Used for the overview tab cards.
   */
  static async getLatest(
    environmentId: string
  ): Promise<SubscriberHistoryRecord | null> {
    const rows = await db('g_player_history')
      .where('environmentId', environmentId)
      .orderBy('recordedAt', 'desc')
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Cleanup records older than the specified number of days
   */
  static async cleanupOlderThan(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const deleted = await db('g_player_history')
      .where('recordedAt', '<', cutoff)
      .delete();

    if (deleted > 0) {
      logger.info(
        `Cleaned up ${deleted} subscriber history records older than ${days} days`
      );
    }

    return deleted;
  }
}
