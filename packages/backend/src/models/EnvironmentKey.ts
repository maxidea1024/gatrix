import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';
import crypto from 'crypto';

const logger = createLogger('EnvironmentKey');

// ==================== Types ====================

export type KeyType = 'client' | 'server';

export interface EnvironmentKeyRecord {
  id: string;
  environmentId: string;
  keyType: KeyType;
  keyValue: string;
  keyName: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  usageCount: number;
  createdBy: string | null;
  createdAt: Date;
}

export interface CreateKeyData {
  environmentId: string;
  keyType: KeyType;
  keyName: string;
  createdBy: string;
}

// ==================== Model ====================

export class EnvironmentKey {
  private static readonly TABLE = 'g_environment_keys';

  /**
   * Generate a prefixed key value: gx_client_xxx or gx_server_xxx
   */
  static generateKeyValue(keyType: KeyType): string {
    const prefix = keyType === 'client' ? 'gx_client_' : 'gx_server_';
    const random = crypto.randomBytes(32).toString('base64url');
    return `${prefix}${random}`;
  }

  /**
   * Create a new environment key
   */
  static async create(
    data: CreateKeyData
  ): Promise<{ key: EnvironmentKeyRecord; plainKey: string }> {
    const id = generateULID();
    const keyValue = this.generateKeyValue(data.keyType);

    await db(this.TABLE).insert({
      id,
      environmentId: data.environmentId,
      keyType: data.keyType,
      keyValue,
      keyName: data.keyName,
      createdBy: data.createdBy,
    });

    const key = await this.findById(id);
    if (!key) {
      throw new Error('Failed to create environment key');
    }

    return { key, plainKey: keyValue };
  }

  /**
   * Find key by ID
   */
  static async findById(id: string): Promise<EnvironmentKeyRecord | null> {
    try {
      const row = await db(this.TABLE).where('id', id).first();
      return row || null;
    } catch (error) {
      logger.error('Error finding environment key by ID:', error);
      throw error;
    }
  }

  /**
   * Find active key by its value (for SDK auth)
   * This is the critical lookup used during every SDK request.
   */
  static async findByKeyValue(keyValue: string): Promise<EnvironmentKeyRecord | null> {
    try {
      const row = await db(this.TABLE).where('keyValue', keyValue).where('isActive', true).first();
      return row || null;
    } catch (error) {
      logger.error('Error finding environment key by value:', error);
      throw error;
    }
  }

  /**
   * Find all keys for an environment
   */
  static async findByEnvironment(environmentId: string): Promise<EnvironmentKeyRecord[]> {
    try {
      return db(this.TABLE).where('environmentId', environmentId).orderBy('createdAt', 'desc');
    } catch (error) {
      logger.error('Error finding keys for environment:', error);
      throw error;
    }
  }

  /**
   * Activate a key
   */
  static async activate(id: string): Promise<EnvironmentKeyRecord | null> {
    try {
      await db(this.TABLE).where('id', id).update({ isActive: true });
      return this.findById(id);
    } catch (error) {
      logger.error('Error activating environment key:', error);
      throw error;
    }
  }

  /**
   * Deactivate a key
   */
  static async deactivate(id: string): Promise<EnvironmentKeyRecord | null> {
    try {
      await db(this.TABLE).where('id', id).update({ isActive: false });
      return this.findById(id);
    } catch (error) {
      logger.error('Error deactivating environment key:', error);
      throw error;
    }
  }

  /**
   * Delete a key
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await db(this.TABLE).where('id', id).del();
      return result > 0;
    } catch (error) {
      logger.error('Error deleting environment key:', error);
      throw error;
    }
  }

  /**
   * Record usage (fire-and-forget, non-blocking)
   */
  static async recordUsage(id: string): Promise<void> {
    try {
      await db(this.TABLE)
        .where('id', id)
        .update({
          lastUsedAt: db.raw('UTC_TIMESTAMP()'),
          usageCount: db.raw('usageCount + 1'),
        });
    } catch (error) {
      logger.error('Error recording key usage:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Create default keys for a new environment (1 client + 1 server)
   */
  static async createDefaultKeys(
    environmentId: string,
    createdBy: string
  ): Promise<{ clientKey: string; serverKey: string }> {
    const clientResult = await this.create({
      environmentId,
      keyType: 'client',
      keyName: `${environmentId} Client Key`,
      createdBy,
    });

    const serverResult = await this.create({
      environmentId,
      keyType: 'server',
      keyName: `${environmentId} Server Key`,
      createdBy,
    });

    return {
      clientKey: clientResult.plainKey,
      serverKey: serverResult.plainKey,
    };
  }
}

export default EnvironmentKey;
