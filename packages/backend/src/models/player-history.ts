import db from '../config/knex';
import { createLogger } from '../config/logger';
import { ulid } from 'ulid';

const logger = createLogger('PlayerHistory');

const TABLE = 'g_player_history';

export interface PlayerHistoryRecord {
  id?: string;
  environmentId: string;
  totalPlayers: number;
  newPlayers: number;
  totalCharacters: number;
  newCharacters: number;
  recordedAt: Date;
}

export class PlayerHistoryModel {
  /**
   * Insert a single player history record
   */
  static async insertRecord(
    record: Omit<PlayerHistoryRecord, 'id'>
  ): Promise<void> {
    const row = { id: ulid(), ...record };
    await db(TABLE).insert(row);
    logger.debug(
      `Inserted player history: players=${record.totalPlayers}(+${record.newPlayers}), chars=${record.totalCharacters}(+${record.newCharacters})`
    );
  }

  /**
   * Get player history for graphing.
   * When intervalSeconds is provided, records are downsampled into
   * time buckets of that width using MAX aggregation.
   */
  static async getHistory(
    environmentId: string,
    from: Date,
    to: Date,
    intervalSeconds?: number
  ): Promise<PlayerHistoryRecord[]> {
    // No downsampling needed — return raw records
    if (!intervalSeconds || intervalSeconds <= 600) {
      return db(TABLE)
        .where('environmentId', environmentId)
        .where('recordedAt', '>=', from)
        .where('recordedAt', '<=', to)
        .orderBy('recordedAt', 'asc');
    }

    // Downsampled query: bucket by FLOOR(UNIX_TIMESTAMP / interval)
    const bucketExpr = 'FLOOR(UNIX_TIMESTAMP(recordedAt) / ?)';
    const bucketSelectExpr = `FROM_UNIXTIME(${bucketExpr} * ?)`;

    return db(TABLE)
      .select(
        'environmentId',
        db.raw('MAX(totalPlayers) as totalPlayers'),
        db.raw('MAX(newPlayers) as newPlayers'),
        db.raw('MAX(totalCharacters) as totalCharacters'),
        db.raw('MAX(newCharacters) as newCharacters'),
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
   * Get the latest player record for a given environment.
   * Used for the overview tab cards.
   */
  static async getLatest(
    environmentId: string
  ): Promise<PlayerHistoryRecord | null> {
    const rows = await db(TABLE)
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

    const deleted = await db(TABLE).where('recordedAt', '<', cutoff).delete();

    if (deleted > 0) {
      logger.info(
        `Cleaned up ${deleted} player history records older than ${days} days`
      );
    }

    return deleted;
  }
}
