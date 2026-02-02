/**
 * LockService
 *
 * Manages entity locks for concurrent modification control.
 */
import { ulid } from "ulid";
import { EntityLock, LockType } from "../models/EntityLock";
import { User } from "../models/User";
import logger from "../config/logger";

export interface LockCheckResult {
  isLocked: boolean;
  lockType?: LockType;
  lockedBy?: {
    id: number;
    name?: string;
    email?: string;
  };
  expiresAt?: Date;
  canProceed: boolean;
  warning?: string;
}

export interface AcquireLockOptions {
  entityType: string;
  entityId: string;
  environment: string;
  userId: number;
  lockType?: LockType;
  expiresInMinutes?: number;
}

export class LockService {
  /**
   * Check if an entity is locked
   */
  static async checkLock(
    entityType: string,
    entityId: string,
    environment: string,
    currentUserId?: number,
  ): Promise<LockCheckResult> {
    const lock = await EntityLock.query()
      .where("entityType", entityType)
      .where("entityId", entityId)
      .where("environment", environment)
      .withGraphFetched("user")
      .first();

    if (!lock) {
      return { isLocked: false, canProceed: true };
    }

    // Check if expired
    if (lock.isExpired()) {
      // Clean up expired lock
      await EntityLock.query().deleteById(lock.id);
      return { isLocked: false, canProceed: true };
    }

    // Self-lock always allows proceed
    if (currentUserId && lock.lockedBy === currentUserId) {
      return {
        isLocked: true,
        lockType: lock.lockType,
        lockedBy: {
          id: lock.lockedBy,
          name: lock.user?.name,
          email: lock.user?.email,
        },
        expiresAt: lock.expiresAt,
        canProceed: true,
      };
    }

    // Soft lock: warning but allow
    if (lock.lockType === "soft") {
      return {
        isLocked: true,
        lockType: "soft",
        lockedBy: {
          id: lock.lockedBy,
          name: lock.user?.name,
          email: lock.user?.email,
        },
        expiresAt: lock.expiresAt,
        canProceed: true,
        warning: `Entity is being edited by ${lock.user?.name || lock.user?.email || "another user"}`,
      };
    }

    // Hard lock: block
    return {
      isLocked: true,
      lockType: "hard",
      lockedBy: {
        id: lock.lockedBy,
        name: lock.user?.name,
        email: lock.user?.email,
      },
      expiresAt: lock.expiresAt,
      canProceed: false,
    };
  }

  /**
   * Acquire a lock on an entity
   */
  static async acquireLock(options: AcquireLockOptions): Promise<EntityLock> {
    const {
      entityType,
      entityId,
      environment,
      userId,
      lockType = "soft",
      expiresInMinutes = 30,
    } = options;

    // Check existing lock
    const existing = await EntityLock.query()
      .where("entityType", entityType)
      .where("entityId", entityId)
      .where("environment", environment)
      .first();

    if (existing) {
      // If expired, delete and create new
      if (existing.isExpired()) {
        await EntityLock.query().deleteById(existing.id);
      } else if (existing.lockedBy !== userId) {
        // Cannot acquire lock if someone else holds it (for hard locks)
        if (existing.lockType === "hard") {
          throw new Error("Entity is locked by another user");
        }
        // For soft locks, we allow creating a new lock (last editor wins)
        await EntityLock.query().deleteById(existing.id);
      } else {
        // Same user, just refresh the lock
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

        return await existing.$query().patchAndFetch({
          lockType,
          expiresAt,
        });
      }
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // Create new lock
    const lock = await EntityLock.query().insert({
      id: ulid(),
      entityType,
      entityId,
      environment,
      lockedBy: userId,
      lockType,
      expiresAt,
    });

    logger.info(
      `[LockService] Lock acquired: ${entityType}:${entityId} by user ${userId} (${lockType})`,
    );
    return lock;
  }

  /**
   * Release a lock
   */
  static async releaseLock(
    entityType: string,
    entityId: string,
    environment: string,
    userId?: number,
  ): Promise<boolean> {
    let query = EntityLock.query()
      .where("entityType", entityType)
      .where("entityId", entityId)
      .where("environment", environment);

    // If userId provided, only release own lock
    if (userId) {
      query = query.where("lockedBy", userId);
    }

    const deleted = await query.delete();
    if (deleted > 0) {
      logger.info(`[LockService] Lock released: ${entityType}:${entityId}`);
      return true;
    }
    return false;
  }

  /**
   * Release all expired locks (cleanup job)
   */
  static async cleanupExpiredLocks(): Promise<number> {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const deleted = await EntityLock.query()
      .where("expiresAt", "<", now)
      .whereNotNull("expiresAt")
      .delete();

    if (deleted > 0) {
      logger.info(`[LockService] Cleaned up ${deleted} expired locks`);
    }
    return deleted;
  }

  /**
   * Get all locks for a user
   */
  static async getUserLocks(userId: number): Promise<EntityLock[]> {
    return await EntityLock.query()
      .where("lockedBy", userId)
      .orderBy("createdAt", "desc");
  }

  /**
   * Release all locks for a user (e.g., on logout)
   */
  static async releaseAllUserLocks(userId: number): Promise<number> {
    const deleted = await EntityLock.query().where("lockedBy", userId).delete();

    if (deleted > 0) {
      logger.info(
        `[LockService] Released all locks for user ${userId}: ${deleted} locks`,
      );
    }
    return deleted;
  }
}
