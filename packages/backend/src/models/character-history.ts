import db from '../config/knex';
import { createLogger } from '../config/logger';
import { ulid } from 'ulid';

const logger = createLogger('CharacterHistory');

const TABLE = 'g_character_history';

export interface CharacterHistoryRecord {
  id?: string;
  environmentId: string;
  worldId: string | null;
  worldName: string | null;
  totalCharacters: number;
  newCharacters: number;
  recordedAt: Date;
}

export class CharacterHistoryModel {
  /**
   * Insert a batch of character history records (total + per-world)
   */
  static async insertBatch(
    records: Omit<CharacterHistoryRecord, 'id'>[]
  ): Promise<void> {
    if (records.length === 0) return;

    const rows = records.map((r) => ({ id: ulid(), ...r }));
    await db(TABLE).insert(rows);
    logger.debug(`Inserted ${rows.length} character history records`);
  }

  /**
   * Get character history for graphing.
   * When intervalSeconds is provided, records are downsampled into
   * time buckets of that width using MAX aggregation.
   */
  static async getHistory(
    environmentId: string,
    from: Date,
    to: Date,
    worldId?: string | null,
    intervalSeconds?: number
  ): Promise<CharacterHistoryRecord[]> {
    // No downsampling needed — return raw records
    if (!intervalSeconds || intervalSeconds <= 600) {
      const query = db(TABLE)
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

    const query = db(TABLE)
      .select(
        'environmentId',
        'worldId',
        db.raw('MAX(worldName) as worldName'),
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
   * Get the latest total character record for a given environment.
   * (worldId IS NULL = total across all worlds)
   */
  static async getLatest(
    environmentId: string
  ): Promise<CharacterHistoryRecord | null> {
    const rows = await db(TABLE)
      .where('environmentId', environmentId)
      .whereNull('worldId')
      .orderBy('recordedAt', 'desc')
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get the latest character record for a specific world in a given environment.
   */
  static async getLatestByWorld(
    environmentId: string,
    worldId: string
  ): Promise<CharacterHistoryRecord | null> {
    const rows = await db(TABLE)
      .where('environmentId', environmentId)
      .where('worldId', worldId)
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
        `Cleaned up ${deleted} character history records older than ${days} days`
      );
    }

    return deleted;
  }
}
