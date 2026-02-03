/**
 * Entity Lock Service
 *
 * Provides soft-lock functionality for entities being edited.
 * Uses Redis with TTL for automatic expiration.
 */
import redisClient from '../config/redis';
import logger from '../config/logger';
import { pubSubService } from './PubSubService';

interface LockInfo {
  userId: number;
  userName: string;
  userEmail: string;
  lockedAt: number; // Unix timestamp in ms
  expiresAt: number; // Unix timestamp in ms
}

// Default lock duration: 5 minutes
const DEFAULT_LOCK_TTL_SECONDS = 5 * 60;

// Lock key prefix
const LOCK_KEY_PREFIX = 'entity_lock';

class EntityLockService {
  /**
   * Generate Redis key for entity lock
   */
  private getLockKey(table: string, entityId: string | number, environment: string): string {
    return `${LOCK_KEY_PREFIX}:${environment}:${table}:${entityId}`;
  }

  /**
   * Acquire a soft lock on an entity
   * Returns true if lock acquired, false if already locked by another user
   */
  async acquireLock(
    table: string,
    entityId: string | number,
    environment: string,
    userId: number,
    userName: string,
    userEmail: string,
    ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS
  ): Promise<{ success: boolean; existingLock?: LockInfo }> {
    const key = this.getLockKey(table, entityId, environment);

    try {
      // Check if already locked
      const existingLockStr = await redisClient.get(key);

      if (existingLockStr) {
        const existingLock: LockInfo = JSON.parse(existingLockStr);

        // If locked by the same user, extend the lock
        if (existingLock.userId === userId) {
          const lockInfo: LockInfo = {
            userId,
            userName,
            userEmail,
            lockedAt: existingLock.lockedAt,
            expiresAt: Date.now() + ttlSeconds * 1000,
          };
          await redisClient.set(key, JSON.stringify(lockInfo), ttlSeconds);
          return { success: true };
        }

        // Locked by another user
        return { success: false, existingLock };
      }

      // Acquire new lock
      const lockInfo: LockInfo = {
        userId,
        userName,
        userEmail,
        lockedAt: Date.now(),
        expiresAt: Date.now() + ttlSeconds * 1000,
      };
      await redisClient.set(key, JSON.stringify(lockInfo), ttlSeconds);

      logger.debug(`[EntityLock] Lock acquired: ${key} by user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error('[EntityLock] Failed to acquire lock', error);
      // On error, allow editing (fail open)
      return { success: true };
    }
  }

  /**
   * Force acquire a lock (take over from another user)
   */
  async forceAcquireLock(
    table: string,
    entityId: string | number,
    environment: string,
    userId: number,
    userName: string,
    userEmail: string,
    ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS
  ): Promise<boolean> {
    const key = this.getLockKey(table, entityId, environment);

    try {
      // Get the previous lock owner before overwriting
      const existingLockStr = await redisClient.get(key);
      let previousOwner: LockInfo | null = null;
      if (existingLockStr) {
        previousOwner = JSON.parse(existingLockStr);
      }

      const lockInfo: LockInfo = {
        userId,
        userName,
        userEmail,
        lockedAt: Date.now(),
        expiresAt: Date.now() + ttlSeconds * 1000,
      };
      await redisClient.set(key, JSON.stringify(lockInfo), ttlSeconds);

      logger.info(`[EntityLock] Lock force acquired: ${key} by user ${userId}`);

      // Send SSE notification to notify the previous owner
      if (previousOwner && previousOwner.userId !== userId) {
        try {
          await pubSubService.publishNotification({
            type: 'entity_lock.taken_over',
            data: {
              table,
              entityId: String(entityId),
              environment,
              previousOwner: {
                userId: previousOwner.userId,
                userName: previousOwner.userName,
                userEmail: previousOwner.userEmail,
              },
              newOwner: {
                userId,
                userName,
                userEmail,
              },
            },
          });
        } catch (sseError) {
          logger.warn('[EntityLock] Failed to send SSE notification for force takeover', sseError);
        }
      }

      return true;
    } catch (error) {
      logger.error('[EntityLock] Failed to force acquire lock', error);
      return false;
    }
  }

  /**
   * Release a lock
   */
  async releaseLock(
    table: string,
    entityId: string | number,
    environment: string,
    userId: number
  ): Promise<boolean> {
    const key = this.getLockKey(table, entityId, environment);

    try {
      // Only release if locked by the same user
      const existingLockStr = await redisClient.get(key);
      if (existingLockStr) {
        const existingLock: LockInfo = JSON.parse(existingLockStr);
        if (existingLock.userId !== userId) {
          logger.warn(`[EntityLock] Cannot release lock owned by another user: ${key}`);
          return false;
        }
      }

      await redisClient.del(key);
      logger.debug(`[EntityLock] Lock released: ${key}`);

      // Send SSE notification for lock release
      try {
        await pubSubService.publishNotification({
          type: 'entity_lock.released',
          data: {
            table,
            entityId: String(entityId),
            environment,
            releasedBy: userId,
          },
        });
      } catch (sseError) {
        logger.warn('[EntityLock] Failed to send SSE notification for lock release', sseError);
      }

      return true;
    } catch (error) {
      logger.error('[EntityLock] Failed to release lock', error);
      return false;
    }
  }

  /**
   * Check if an entity is locked
   */
  async checkLock(
    table: string,
    entityId: string | number,
    environment: string
  ): Promise<LockInfo | null> {
    const key = this.getLockKey(table, entityId, environment);

    try {
      const lockStr = await redisClient.get(key);
      if (lockStr) {
        return JSON.parse(lockStr);
      }
      return null;
    } catch (error) {
      logger.error('[EntityLock] Failed to check lock', error);
      return null;
    }
  }

  /**
   * Extend an existing lock (heartbeat)
   */
  async extendLock(
    table: string,
    entityId: string | number,
    environment: string,
    userId: number,
    ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS
  ): Promise<boolean> {
    const key = this.getLockKey(table, entityId, environment);

    try {
      const existingLockStr = await redisClient.get(key);
      if (!existingLockStr) {
        return false;
      }

      const existingLock: LockInfo = JSON.parse(existingLockStr);
      if (existingLock.userId !== userId) {
        return false;
      }

      // Extend TTL
      existingLock.expiresAt = Date.now() + ttlSeconds * 1000;
      await redisClient.set(key, JSON.stringify(existingLock), ttlSeconds);

      return true;
    } catch (error) {
      logger.error('[EntityLock] Failed to extend lock', error);
      return false;
    }
  }

  /**
   * Check if there's a pending CR for an entity (hard lock warning)
   */
  async checkPendingCR(
    table: string,
    entityId: string | number,
    environment: string
  ): Promise<{ hasPending: boolean; crId?: string; crTitle?: string }> {
    // Import dynamically to avoid circular dependency
    const { ChangeRequest } = await import('../models/ChangeRequest');
    const { ChangeItem } = await import('../models/ChangeItem');

    try {
      // Find open or approved CRs that affect this entity
      const pendingItem = await ChangeItem.query()
        .where('targetTable', table)
        .where('targetId', String(entityId))
        .whereIn('opType', ['UPDATE', 'DELETE'])
        .whereExists(
          ChangeRequest.query()
            .whereRaw('g_change_requests.id = g_change_items.changeRequestId')
            .where('environment', environment)
            .whereIn('status', ['open', 'approved'])
        )
        .first();

      if (pendingItem) {
        const cr = await ChangeRequest.query().findById(pendingItem.changeRequestId);

        return {
          hasPending: true,
          crId: cr?.id,
          crTitle: cr?.title,
        };
      }

      return { hasPending: false };
    } catch (error) {
      logger.error('[EntityLock] Failed to check pending CR', error);
      return { hasPending: false };
    }
  }
}

export const entityLockService = new EntityLockService();
export default entityLockService;
