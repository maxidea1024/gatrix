/**
 * Entity Lock Service (Frontend)
 *
 * Handles soft-lock functionality for entity editing
 */
import api from './api';

export interface LockInfo {
  userId: number;
  userName: string;
  userEmail: string;
  lockedAt: number;
  expiresAt: number;
}

export interface PendingCR {
  crId: string;
  crTitle: string;
}

export interface LockCheckResult {
  locked: boolean;
  lockInfo: LockInfo | null;
  pendingCR: PendingCR | null;
}

export interface AcquireLockResult {
  success: boolean;
  message?: string;
  lockedBy?: LockInfo;
}

class EntityLockService {
  /**
   * Acquire a soft lock on an entity
   */
  async acquireLock(
    table: string,
    entityId: string | number,
    environment: string
  ): Promise<AcquireLockResult> {
    try {
      const response = await api.post('/entity-locks/acquire', {
        table,
        entityId: String(entityId),
        environment,
      });
      // api.post returns response.data from axios, which is the actual API response
      // The response is { success: true, message: 'Lock acquired' }
      return response as any as AcquireLockResult;
    } catch (error: any) {
      // api.request throws error.response.data directly for HTTP errors
      // So error itself contains { success, message, lockedBy, status }
      if (error.status === 409) {
        console.log('[EntityLock] Lock conflict, lockedBy:', error.lockedBy);
        return {
          success: false,
          message: error.message,
          lockedBy: error.lockedBy,
        };
      }
      console.error('[EntityLock] Failed to acquire lock:', error);
      return { success: true }; // Fail open
    }
  }

  /**
   * Force acquire a lock (take over from another user)
   */
  async forceAcquireLock(
    table: string,
    entityId: string | number,
    environment: string
  ): Promise<boolean> {
    try {
      const response = await api.post('/entity-locks/force-acquire', {
        table,
        entityId: String(entityId),
        environment,
      });
      return (response as any).success;
    } catch (error) {
      console.error('[EntityLock] Failed to force acquire lock:', error);
      return false;
    }
  }

  /**
   * Release a soft lock
   */
  async releaseLock(
    table: string,
    entityId: string | number,
    environment: string
  ): Promise<boolean> {
    try {
      const response = await api.post('/entity-locks/release', {
        table,
        entityId: String(entityId),
        environment,
      });
      return (response as any).success;
    } catch (error) {
      console.error('[EntityLock] Failed to release lock:', error);
      return false;
    }
  }

  /**
   * Extend (heartbeat) an existing lock
   */
  async extendLock(
    table: string,
    entityId: string | number,
    environment: string
  ): Promise<boolean> {
    try {
      const response = await api.post('/entity-locks/extend', {
        table,
        entityId: String(entityId),
        environment,
      });
      return (response as any).success;
    } catch (error) {
      console.error('[EntityLock] Failed to extend lock:', error);
      return false;
    }
  }

  /**
   * Check if an entity is locked and if there's a pending CR
   */
  async checkLock(
    table: string,
    entityId: string | number,
    environment: string
  ): Promise<LockCheckResult> {
    try {
      const response = await api.get('/entity-locks/check', {
        params: {
          table,
          entityId: String(entityId),
          environment,
        },
      });
      return response as any as LockCheckResult;
    } catch (error) {
      console.error('[EntityLock] Failed to check lock:', error);
      return { locked: false, lockInfo: null, pendingCR: null };
    }
  }
}

export const entityLockService = new EntityLockService();
export default entityLockService;
