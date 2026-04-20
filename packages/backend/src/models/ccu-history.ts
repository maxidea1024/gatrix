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
   * Get CCU history for graphing
   */
  static async getHistory(
    environmentId: string,
    from: Date,
    to: Date,
    worldId?: string | null
  ): Promise<CcuHistoryRecord[]> {
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
